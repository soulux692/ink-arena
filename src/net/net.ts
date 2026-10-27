// Peer-to-peer transport for co-op. One browser hosts (runs the simulation), the other joins
// through an invite link or room code and streams its input.
//
// Connection strategy (all three race in parallel, first one wins):
//   1. "peer" — PeerJS cloud broker + WebRTC (fast path, works in most cases)
//   2. "rtc"  — raw WebRTC data channel, signalling exchanged over plain HTTPS via ntfy.sh
//              (survives networks where the PeerJS cloud is blocked; includes TURN for strict NAT)
//   3. "bc"   — BroadcastChannel, instant when both tabs share one browser (local testing)
//
// Game traffic always flows over exactly one link (peer > rtc > bc), so messages are never
// duplicated even if several links come up.
import Peer from "peerjs";

export type Role = "off" | "host" | "guest";
export type LinkState = "idle" | "opening" | "waiting" | "connecting" | "live" | "closed" | "error";
export type Via = "" | "p2p" | "local";

/** host → guest */
export interface HostMsg {
  t: "welcome" | "lobby" | "start" | "snap" | "fx" | "vote" | "screen" | "bye";
  [k: string]: unknown;
}
/** guest → host */
export interface GuestMsg {
  t: "hello" | "ready" | "input" | "vote" | "bye";
  [k: string]: unknown;
}

const PREFIX = "inkarena";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(n = 5) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Extracts a room code from a full invite URL, a `#coop=CODE` / `?coop=CODE` fragment, or a raw code. */
export function parseInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  const paramMatch = /[#&?/]coop=([A-Za-z0-9]{3,12})/i.exec(text);
  if (paramMatch) return paramMatch[1].toUpperCase();
  const prefMatch = /inkarena-([A-Za-z0-9]{3,12})/i.exec(text);
  if (prefMatch) return prefMatch[1].toUpperCase();
  // plain code like "KT4PZ" (only if the whole string is a short code, not a full URL without coop=)
  if (!/^https?:/i.test(text) && /^[A-Za-z0-9]{4,8}$/.test(text)) {
    return text.toUpperCase();
  }
  return null;
}

export function inviteLink(code: string) {
  let base = "";
  try {
    if (window.top && window.top !== window && window.top.location?.href) {
      const u = new URL(window.top.location.href);
      u.searchParams.set("coop", code);
      u.hash = `coop=${code}`;
      return u.toString();
    }
  } catch {
    // cross-origin parent frame: fall back to referrer or own location
  }
  try {
    if (document.referrer && /^https?:/i.test(document.referrer)) {
      const u = new URL(document.referrer);
      // only use referrer if our own location is an about:/blob: or frameless sandbox URL
      if (!/^https?:/i.test(window.location.origin) || window.location.pathname === "/srcdoc") {
        u.searchParams.set("coop", code);
        u.hash = `coop=${code}`;
        return u.toString();
      }
    }
  } catch {
    // ignore malformed referrer
  }
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("coop", code);
    u.hash = `coop=${code}`;
    base = u.toString();
  } catch {
    const { origin, pathname } = window.location;
    base = `${origin}${pathname}?coop=${code}#coop=${code}`;
  }
  return base;
}

/** reads ?coop= or #coop= from own window, accessible parent frames, or document.referrer */
export function readInvite(): string | null {
  try {
    const own = parseInviteCode(window.location.hash + "&" + window.location.search + "&" + window.location.href);
    if (own) return own;
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) {
      const fromParent = parseInviteCode(
        window.parent.location.hash + "&" + window.parent.location.search + "&" + window.parent.location.href,
      );
      if (fromParent) return fromParent;
    }
  } catch {
    /* cross-origin parent */
  }
  try {
    if (window.top && window.top !== window) {
      const fromTop = parseInviteCode(
        window.top.location.hash + "&" + window.top.location.search + "&" + window.top.location.href,
      );
      if (fromTop) return fromTop;
    }
  } catch {
    /* cross-origin top */
  }
  try {
    if (document.referrer) {
      const fromRef = parseInviteCode(document.referrer);
      if (fromRef) return fromRef;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearInvite() {
  try {
    const u = new URL(window.location.href);
    const hadQuery = u.searchParams.has("coop");
    const hadHash = /coop=/i.test(u.hash);
    if (!hadQuery && !hadHash) return;
    u.searchParams.delete("coop");
    if (hadHash) u.hash = "";
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch {
    if (!/coop=/i.test(window.location.hash)) return;
    const url = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", url);
  }
}

// ---------------------------------------------------------------------------
// transport seams (tests inject fakes; production uses browser APIs)
// ---------------------------------------------------------------------------

type LinkName = "peer" | "rtc" | "bc";

export interface ConnLike {
  readonly open: boolean;
  on: (ev: string, cb: (...args: never[]) => void) => void;
  send: (data: unknown) => void;
  close: () => void;
}

export interface PeerLike {
  on: (ev: string, cb: (...args: never[]) => void) => void;
  connect: (id: string, opts?: unknown) => ConnLike;
  destroy: () => void;
}

export interface DcLike {
  readonly readyState: string;
  onopen: ((() => void) | null);
  onclose: ((() => void) | null);
  onmessage: (((e: { data: unknown }) => void) | null);
  send: (d: string) => void;
  close: () => void;
}

export interface IceCand {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface RtcLike {
  onicecandidate: (((e: { candidate: IceCand | null }) => void) | null);
  onconnectionstatechange: (((() => void)) | null);
  ondatachannel: (((e: { channel: DcLike }) => void) | null);
  readonly connectionState: string;
  createDataChannel: (label: string) => DcLike;
  createOffer: () => Promise<{ type: string; sdp?: string }>;
  createAnswer: () => Promise<{ type: string; sdp?: string }>;
  setLocalDescription: (d: { type: string; sdp?: string }) => Promise<void>;
  setRemoteDescription: (d: { type: string; sdp?: string }) => Promise<void>;
  addIceCandidate: (c: IceCand | null) => Promise<void>;
  close: () => void;
}

export interface BcLike {
  postMessage: (d: unknown) => void;
  onmessage: (((e: { data: unknown }) => void) | null);
  close: () => void;
}

export interface FetchResp {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface NetDeps {
  peerFactory?: (id?: string) => PeerLike;
  fetchImpl?: (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResp>;
  rtcFactory?: () => RtcLike | null;
  bcFactory?: ((name: string) => BcLike | null) | null;
}

const NTFY = "https://ntfy.sh";
const topicFor = (code: string) => `inkarena-v1-${code.toLowerCase()}`;

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:openrelay.metered.ca:80"] },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

interface SigMsg {
  k?: string;
  gid?: string;
  from?: string;
  sdp?: { type: string; sdp?: string };
  cand?: IceCand | null;
}

type Listener = (msg: HostMsg | GuestMsg) => void;

const randId = (n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
};

export class Net {
  role: Role = "off";
  state: LinkState = "idle";
  code = "";
  error = "";
  ping = 0;
  via: Via = "";
  note = "";

  private deps: Required<Pick<NetDeps, "peerFactory" | "fetchImpl" | "rtcFactory">> & Pick<NetDeps, "bcFactory">;
  private peer: PeerLike | null = null;
  private conn: ConnLike | null = null;
  private bc: BcLike | null = null;
  private bcLive = false;
  private pc: RtcLike | null = null;
  private dc: DcLike | null = null;
  private dcOpen = false;
  private winner: LinkName | null = null;
  private attempt = 0;
  private listeners = new Set<Listener>();
  private changeCbs = new Set<() => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private ntfyTimer: ReturnType<typeof setInterval> | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private ntfySince: string | null = null;
  private ntfyOk = false;
  private ntfyFails = 0;
  private peerOpened = false;
  private peerErr: string | null = null;
  private rtcErr: string | null = null;
  private takenRetries = 0;
  private gid = "";
  private activeGid: string | null = null;
  private signalSeen = false;
  private remoteSet = false;
  private queuedCand: IceCand[] = [];
  private lastAnswer: { type: string; sdp?: string } | null = null;
  private startStamp = 0;
  private lastRx = 0;
  private settle: { resolve: () => void; reject: (e: unknown) => void } | null = null;

  constructor(deps: NetDeps = {}) {
    this.deps = {
      peerFactory:
        deps.peerFactory ??
        ((id?: string) =>
          (id
            ? new Peer(id, { debug: 0, config: ICE })
            : new Peer({ debug: 0, config: ICE })) as unknown as PeerLike),
      fetchImpl:
        deps.fetchImpl ??
        ((url, init) => fetch(url, init as RequestInit) as unknown as Promise<FetchResp>),
      rtcFactory:
        deps.rtcFactory ??
        (() => (typeof RTCPeerConnection !== "undefined" ? (new RTCPeerConnection(ICE) as unknown as RtcLike) : null)),
      bcFactory:
        deps.bcFactory !== undefined
          ? deps.bcFactory
          : (name: string) =>
              typeof BroadcastChannel !== "undefined" ? (new BroadcastChannel(name) as unknown as BcLike) : null,
    };
  }

  onMessage(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onChange(fn: () => void) {
    this.changeCbs.add(fn);
    return () => this.changeCbs.delete(fn);
  }
  private changed() {
    for (const fn of this.changeCbs) fn();
  }
  private emit(msg: HostMsg | GuestMsg) {
    for (const fn of this.listeners) fn(msg);
  }
  private setState(s: LinkState, err = "") {
    this.state = s;
    this.error = err;
    this.changed();
  }
  private setNote(note: string) {
    if (this.note === note) return;
    this.note = note;
    this.changed();
  }

  get connected() {
    return this.state === "live" && (!!this.conn?.open || this.dcOpen || this.bcLive);
  }

  // ------------------------------------------------------------------ host

  /** start a room and wait for a partner */
  host(): Promise<string> {
    const tk = this.beginAttempt();
    this.role = "host";
    this.code = makeCode();
    this.startStamp = Date.now();
    this.setState("opening");
    this.setNote("Открываем комнату…");
    this.openBc(tk);
    this.ntfyStart(tk);
    this.peerRegister(tk, `${PREFIX}-${this.code}`);
    return new Promise((resolve, reject) => {
      this.settle = {
        resolve: () => {
          if (this.alive(tk)) resolve(this.code);
        },
        reject: (e: unknown) => {
          if (this.alive(tk)) reject(e);
        },
      };
      this.deadlineTimer = setTimeout(() => {
        if (!this.alive(tk) || !this.settle) return;
        this.settle = null;
        this.setNote("");
        this.setState(
          "error",
          "Не удалось открыть комнату: нет связи с серверами. Проверь интернет и попробуй ещё раз.",
        );
        reject(new Error("no signaling"));
      }, 10000);
    });
  }

  // ------------------------------------------------------------------ guest

  /** join a room by its code (or a full invite link — it gets parsed) */
  join(rawCode: string): Promise<void> {
    const code = parseInviteCode(rawCode) ?? rawCode.trim().toUpperCase();
    const tk = this.beginAttempt();
    this.role = "guest";
    this.code = code;
    this.gid = randId(6);
    this.startStamp = Date.now();
    if (!/^[A-Z0-9]{3,12}$/.test(code)) {
      this.setState("error", "Похоже, это не код комнаты. Вставь ссылку друга целиком или 5-значный код.");
      return Promise.reject(new Error("bad code"));
    }
    this.setState("connecting");
    this.setNote(`Ищем комнату ${code}…`);
    this.openBc(tk);
    // same-browser shortcut: greet immediately, no handshake round-trip needed
    this.bcPost({ t: "hello" });
    this.peerRegister(tk);
    this.ntfyStart(tk);
    this.startRtcGuest(tk);
    this.startHello();
    return new Promise((resolve, reject) => {
      this.settle = {
        resolve: () => {
          if (this.alive(tk)) resolve();
        },
        reject: (e: unknown) => {
          if (this.alive(tk)) reject(e);
        },
      };
      this.deadlineTimer = setTimeout(() => {
        if (!this.alive(tk) || !this.settle) return;
        this.settle = null;
        this.setNote("");
        const msg =
          this.peerErr === "peer-unavailable"
            ? `Комната ${code} не найдена — возможно, хост закрыл игру. Попроси новую ссылку.`
            : "Не удалось соединиться. Проверь код, интернет и что комната друга открыта.";
        this.setState("error", msg);
        reject(new Error("join timeout"));
      }, 22000);
      setTimeout(() => {
        if (this.alive(tk) && !this.winner && this.role === "guest") {
          this.setNote("Пробуем запасной канал…");
        }
      }, 6000);
      setTimeout(() => {
        // broker says the room does not exist AND the backup channel heard nothing:
        // fail fast instead of staring at a spinner for 22 seconds
        if (!this.alive(tk) || this.winner || !this.settle) return;
        if (this.peerErr === "peer-unavailable" && !this.signalSeen) {
          const st = this.settle;
          this.settle = null;
          if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
          this.deadlineTimer = null;
          this.setNote("");
          this.setState(
            "error",
            `Комната ${code} не найдена — возможно, хост закрыл игру. Попроси новую ссылку.`,
          );
          st.reject(new Error("peer-unavailable"));
        }
      }, 9000);
    });
  }

  // ------------------------------------------------------------------ PeerJS link

  private peerRegister(tk: number, id?: string) {
    let peer: PeerLike;
    try {
      peer = this.deps.peerFactory(id);
    } catch {
      this.onPeerError(tk, "webrtc", "PeerJS недоступен");
      return;
    }
    this.peer = peer;
    peer.on("open", () => {
      if (!this.alive(tk)) return;
      this.peerOpened = true;
      if (this.role === "host") {
        this.maybeHostReady();
        return;
      }
      // guest: dial the room
      try {
        const conn = peer.connect(`${PREFIX}-${this.code}`, { reliable: true, serialization: "json" });
        this.bindPeerConn(conn, tk);
      } catch {
        this.onPeerError(tk, "webrtc", "dial failed");
      }
    });
    peer.on("connection", (raw) => {
      if (!this.alive(tk)) return;
      const conn = raw as unknown as ConnLike;
      if (this.conn?.open) {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.bindPeerConn(conn, tk);
    });
    peer.on("error", (raw) => {
      if (!this.alive(tk)) return;
      const e = raw as { type?: string; message?: string };
      this.onPeerError(tk, e?.type ?? "", String(e?.message ?? e ?? ""));
    });
  }

  private onPeerError(tk: number, type: string, msg: string) {
    void msg;
    // stale room id from a previous tab from a previous tab: pick another code and re-register (hosts only)
    if (type === "unavailable-id" && this.role === "host" && (this.state === "opening" || this.state === "waiting")) {
      if (this.takenRetries++ < 3) {
        this.code = makeCode();
        try {
          this.peer?.destroy();
        } catch {
          /* ignore */
        }
        this.peer = null;
        this.ntfySince = null;
        this.peerRegister(tk, `${PREFIX}-${this.code}`);
        this.changed();
        return;
      }
    }
    if (type === "peer-unavailable") {
      // room id unknown to the broker — the authoritative "room not found"
      this.peerErr = "peer-unavailable";
      if (this.role === "guest" && !this.winner && this.ntfyFails >= 2) {
        this.setNote("");
        this.setState("error", `Комната ${this.code} не найдена — возможно, хост закрыл игру. Попроси новую ссылку.`);
        this.settle?.reject(new Error("peer-unavailable"));
        this.settle = null;
      }
      return;
    }
    if (["network", "socket-error", "socket-closed", "server-error", "ssl-unavailable", "webrtc"].includes(type)) {
      this.peerErr = type || "network";
      if (this.role === "guest" && !this.peerOpened && !this.winner) {
        this.setNote("Основной сервер недоступен, пробуем запасной…");
      }
      this.checkAllFailed(tk);
      return;
    }
  }

  // ------------------------------------------------------------------ BroadcastChannel link

  private openBc(tk: number) {
    if (!this.deps.bcFactory) return;
    let bc: BcLike | null = null;
    try {
      bc = this.deps.bcFactory(`${PREFIX}-bc-${this.code}`);
    } catch {
      bc = null;
    }
    if (!bc) return;
    this.bc = bc;
    bc.onmessage = (ev) => {
      if (!this.alive(tk)) return;
      const raw = ev.data as { t?: string; from?: string; at?: number };
      if (!raw || typeof raw !== "object" || raw.from === this.role) return;
      if (!this.bcLive) {
        this.bcLive = true;
        this.claimWin("bc");
      }
      this.handleIncoming(raw);
    };
  }

  private bcPost(msg: HostMsg | GuestMsg) {
    if (!this.bc) return;
    try {
      this.bc.postMessage({ ...msg, from: this.role });
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------------ ntfy + raw WebRTC link

  private ntfyTopic() {
    return topicFor(this.code);
  }

  private ntfyStart(tk: number) {
    if (this.ntfyTimer) return;
    void this.ntfyPoll(tk);
    this.ntfyTimer = setInterval(() => void this.ntfyPoll(tk), this.role === "host" ? 1500 : 800);
  }

  private ntfyStop() {
    if (this.ntfyTimer) clearInterval(this.ntfyTimer);
    this.ntfyTimer = null;
  }

  private async ntfyPost(tk: number, body: Record<string, unknown>) {
    try {
      const res = await this.deps.fetchImpl(`${NTFY}/${this.ntfyTopic()}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ ...body, from: this.role, at: Date.now() }),
      });
      if (!this.alive(tk)) return;
      if (!res.ok) throw new Error(`http ${res.status}`);
      this.ntfyOk = true;
      this.ntfyFails = 0;
      if (this.role === "host") this.maybeHostReady();
    } catch {
      if (!this.alive(tk)) return;
      this.ntfyFails++;
      if (this.ntfyFails >= 3) this.checkAllFailed(tk);
    }
  }

  private async ntfyPoll(tk: number) {
    if (!this.alive(tk)) return;
    const url = `${NTFY}/${this.ntfyTopic()}/json?poll=1${this.ntfySince ? `&since=${this.ntfySince}` : ""}`;
    let text = "";
    try {
      const res = await this.deps.fetchImpl(url, {});
      if (!this.alive(tk)) return;
      if (!res.ok) throw new Error(`http ${res.status}`);
      this.ntfyOk = true;
      this.ntfyFails = 0;
      if (this.role === "host") this.maybeHostReady();
      text = await res.text();
    } catch {
      if (!this.alive(tk)) return;
      this.ntfyFails++;
      if (this.ntfyFails >= 3) this.checkAllFailed(tk);
      return;
    }
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      let m: { id?: string; event?: string; time?: number; message?: string; title?: string };
      try {
        m = JSON.parse(s) as typeof m;
      } catch {
        continue;
      }
      if (m.id) this.ntfySince = m.id;
      if (m.event && m.event !== "message") continue;
      if (typeof m.time === "number" && m.time * 1000 < this.startStamp - 8000) continue; // stale cache
      if (typeof m.message !== "string" || !m.message) continue;
      let body: SigMsg;
      try {
        body = JSON.parse(m.message) as SigMsg;
      } catch {
        continue;
      }
      if (!body || body.from === this.role) continue; // our own echo
      this.routeSignal(body, tk);
    }
  }

  private routeSignal(body: SigMsg, tk: number) {
    if (!this.alive(tk)) return;
    this.signalSeen = true;
    if (this.role === "host") {
      if (body.k === "offer" && body.gid && body.sdp) {
        if (this.activeGid && this.activeGid !== body.gid && this.dcOpen) return; // already paired (1v1)
        if (this.activeGid === body.gid && this.pc) {
          // guest re-offered (retry): resend our stored answer
          if (this.lastAnswer) void this.ntfyPost(tk, { k: "answer", gid: body.gid, sdp: this.lastAnswer });
          return;
        }
        this.activeGid = body.gid;
        void this.startRtcHost(tk, body.gid, body.sdp);
      } else if (body.k === "cand" && body.gid === this.activeGid && body.cand) {
        void this.addRemoteCand(tk, body.cand);
      }
    } else {
      if (body.gid !== this.gid) return;
      if (body.k === "answer" && body.sdp && !this.remoteSet) {
        void this.applyAnswer(tk, body.sdp);
      } else if (body.k === "cand" && body.cand) {
        void this.addRemoteCand(tk, body.cand);
      }
    }
  }

  private makePc(tk: number): RtcLike | null {
    let pc: RtcLike | null = null;
    try {
      pc = this.deps.rtcFactory();
    } catch {
      pc = null;
    }
    if (!pc) {
      this.rtcErr = "webrtc";
      this.setNote("Браузер не поддерживает WebRTC.");
      this.checkAllFailed(tk);
      return null;
    }
    pc.onicecandidate = (e) => {
      if (!this.alive(tk) || this.pc !== pc) return;
      if (e.candidate) {
        void this.ntfyPost(tk, { k: "cand", gid: this.role === "host" ? this.activeGid : this.gid, cand: e.candidate });
      }
    };
    pc.onconnectionstatechange = () => {
      if (!this.alive(tk) || this.pc !== pc) return;
      if (pc.connectionState === "failed") {
        this.rtcErr = "ice-failed";
        this.checkAllFailed(tk);
      }
    };
    return pc;
  }

  private wireDc(dc: DcLike, tk: number) {
    this.dc = dc;
    dc.onopen = () => {
      if (!this.alive(tk) || this.dc !== dc) return;
      this.dcOpen = true;
      this.claimWin("rtc");
    };
    dc.onmessage = (e) => {
      if (!this.alive(tk) || this.dc !== dc) return;
      try {
        this.handleIncoming(JSON.parse(String(e.data)) as { t?: string; at?: number });
      } catch {
        /* ignore malformed frame */
      }
    };
    dc.onclose = () => {
      if (this.dc !== dc) return;
      this.dcOpen = false;
      this.activeGid = null;
      this.linkDown();
    };
  }

  private startRtcGuest(tk: number) {
    const pc = this.makePc(tk);
    if (!pc) return;
    this.pc = pc;
    try {
      const dc = pc.createDataChannel("game");
      this.wireDc(dc, tk);
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer).then(() => offer))
        .then((offer) => {
          if (!this.alive(tk) || this.pc !== pc) return;
          void this.ntfyPost(tk, { k: "offer", gid: this.gid, sdp: { type: offer.type, sdp: offer.sdp } });
        })
        .catch(() => {
          if (this.alive(tk)) {
            this.rtcErr = "webrtc";
            this.checkAllFailed(tk);
          }
        });
    } catch {
      this.rtcErr = "webrtc";
      this.checkAllFailed(tk);
    }
  }

  private async startRtcHost(tk: number, gid: string, offer: { type: string; sdp?: string }) {
    // tear down any half-open previous attempt for a *different* guest
    this.closePc();
    const pc = this.makePc(tk);
    if (!pc) return;
    this.pc = pc;
    this.remoteSet = false;
    this.queuedCand = [];
    pc.ondatachannel = (e) => {
      if (!this.alive(tk) || this.pc !== pc) return;
      this.wireDc(e.channel, tk);
    };
    try {
      await pc.setRemoteDescription(offer);
      if (!this.alive(tk) || this.pc !== pc || this.activeGid !== gid) return;
      this.remoteSet = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!this.alive(tk) || this.pc !== pc || this.activeGid !== gid) return;
      this.lastAnswer = { type: answer.type, sdp: answer.sdp };
      await this.ntfyPost(tk, { k: "answer", gid, sdp: this.lastAnswer });
      await this.flushCand(tk);
    } catch {
      if (this.alive(tk)) {
        this.rtcErr = "webrtc";
        this.checkAllFailed(tk);
      }
    }
  }

  private async applyAnswer(tk: number, sdp: { type: string; sdp?: string }) {
    if (!this.pc || this.remoteSet) return;
    try {
      await this.pc.setRemoteDescription(sdp);
      if (!this.alive(tk)) return;
      this.remoteSet = true;
      this.setNote("Почти готово…");
      await this.flushCand(tk);
    } catch {
      if (this.alive(tk)) {
        this.rtcErr = "webrtc";
        this.checkAllFailed(tk);
      }
    }
  }

  private async addRemoteCand(tk: number, cand: IceCand) {
    if (!this.pc || !this.alive(tk)) return;
    if (!this.remoteSet) {
      this.queuedCand.push(cand);
      return;
    }
    try {
      await this.pc.addIceCandidate(cand);
    } catch {
      /* stray candidate */
    }
  }

  private async flushCand(tk: number) {
    if (!this.pc) return;
    const q = this.queuedCand;
    this.queuedCand = [];
    for (const c of q) {
      if (!this.alive(tk)) return;
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* stray candidate */
      }
    }
  }

  private closePc() {
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    this.dcOpen = false;
    this.pc = null;
    this.remoteSet = false;
    this.queuedCand = [];
  }

  private checkAllFailed(tk: number) {
    if (!this.alive(tk) || this.winner || !this.settle) return;
    if (this.role === "host") {
      if (this.peerErr && this.ntfyFails >= 3 && !this.peerOpened) {
        const st = this.settle;
        this.settle = null;
        if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
        this.deadlineTimer = null;
        this.setNote("");
        this.setState(
          "error",
          "Не удалось открыть комнату: нет связи с серверами. Проверь интернет и попробуй ещё раз.",
        );
        st.reject(new Error("no signaling"));
      }
      return;
    }
    if (this.role === "guest") {
      // guest: wait until peer gave up AND rtc gave up AND no BC contact
      if (this.peerErr && (this.rtcErr || this.ntfyFails >= 3)) {
        const st = this.settle;
        this.settle = null;
        if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
        this.deadlineTimer = null;
        this.setNote("");
        if (this.peerErr === "peer-unavailable") {
          this.setState(
            "error",
            `Комната ${this.code} не найдена — возможно, хост закрыл игру. Попроси новую ссылку.`,
          );
        } else {
          this.setState(
            "error",
            "Не получается соединиться. Проверь интернет, код комнаты и что комната друга открыта.",
          );
        }
        st.reject(new Error("join failed"));
      }
    }
  }

  // ------------------------------------------------------------------ shared link logic

  private claimWin(name: LinkName) {
    if (this.winner) return;
    this.winner = name;
    this.via = name === "bc" ? "local" : "p2p";
    this.ntfyStop();
    this.setNote("");
    this.setState("live");
    this.startPing();
    if (this.settle) {
      const s = this.settle;
      this.settle = null;
      if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
      this.deadlineTimer = null;
      s.resolve();
    }
    this.changed();
  }

  private linkDown() {
    if (!this.winner) return;
    if (this.conn?.open || this.dcOpen || this.bcLive) return;
    this.winner = null;
    this.via = "";
    this.stopPing();
    if (this.role === "host") {
      this.setState("waiting");
      // a rejoining guest needs signalling again
      this.activeGid = null;
      this.ntfySince = null;
      this.ntfyStart(this.attempt);
    } else {
      this.setState("closed");
    }
    this.emit({ t: "bye" } as HostMsg);
  }

  private handleIncoming(raw: { t?: string; at?: number }) {
    if (!raw || !raw.t) return;
    this.lastRx = Date.now();
    if (raw.t === "ping") {
      this.send({ t: "pong", at: raw.at } as never);
      return;
    }
    if (raw.t === "pong") {
      this.ping = Math.max(1, Math.round(Date.now() - (raw.at ?? Date.now())));
      this.changed();
      return;
    }
    if (raw.t === "welcome" || raw.t === "lobby") {
      this.stopHello();
    }
    this.emit(raw as HostMsg | GuestMsg);
  }

  private startHello() {
    this.stopHello();
    this.send({ t: "hello" });
    let tries = 0;
    this.helloTimer = setInterval(() => {
      tries++;
      if (tries > 40 || this.role !== "guest") {
        this.stopHello();
        return;
      }
      this.send({ t: "hello" });
    }, 500);
  }

  private stopHello() {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
  }

  private startPing() {
    this.stopPing();
    this.lastRx = Date.now();
    this.pingTimer = setInterval(() => {
      if (!this.winner) return;
      if (Date.now() - this.lastRx > 9000) {
        // total silence: the other tab is gone (BroadcastChannel has no close event)
        this.bcLive = false;
        if (this.dc && this.dc.readyState !== "open") this.dcOpen = false;
        if (this.conn && !this.conn.open) this.conn = null;
        this.linkDown();
        return;
      }
      this.send({ t: "ping", at: Date.now() } as never);
    }, 2000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  /** exactly one link carries traffic (peer > rtc > bc), so frames never duplicate */
  send(msg: HostMsg | GuestMsg) {
    if (this.conn?.open) {
      try {
        this.conn.send(msg);
        return;
      } catch {
        /* try the next link */
      }
    }
    if (this.dc && this.dcOpen) {
      try {
        this.dc.send(JSON.stringify(msg));
        return;
      } catch {
        /* try the next link */
      }
    }
    if (this.bc) {
      try {
        this.bc.postMessage({ ...(msg as Record<string, unknown>), from: this.role });
      } catch {
        /* ignore */
      }
    }
  }

  private beginAttempt(): number {
    this.resetLinks();
    this.attempt += 1;
    return this.attempt;
  }

  private alive(tk: number) {
    return tk === this.attempt;
  }

  private resetLinks() {
    if (this.settle) {
      const st = this.settle;
      this.settle = null;
      st.reject(new Error("superseded"));
    }
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
    if (this.ntfyTimer) clearInterval(this.ntfyTimer);
    this.ntfyTimer = null;
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = null;
    try {
      this.conn?.close();
    } catch {
      /* already gone */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* already gone */
    }
    try {
      this.bc?.close();
    } catch {
      /* already gone */
    }
    this.closePc();
    this.conn = null;
    this.peer = null;
    this.bc = null;
    this.bcLive = false;
    this.dcOpen = false;
    this.winner = null;
    this.via = "";
    this.ntfySince = null;
    this.ntfyFails = 0;
    this.ntfyOk = false;
    this.peerOpened = false;
    this.peerErr = null;
    this.rtcErr = null;
    this.activeGid = null;
    this.signalSeen = false;
    this.takenRetries = 0;
    this.lastAnswer = null;
    this.ping = 0;
  }

  private bindPeerConn(conn: ConnLike, tk: number) {
    this.conn = conn;
    conn.on("open", () => {
      if (!this.alive(tk) || this.conn !== conn) return;
      this.claimWin("peer");
    });
    conn.on("data", (raw) => {
      if (!this.alive(tk) || this.conn !== conn) return;
      this.handleIncoming(raw as { t?: string; at?: number });
    });
    conn.on("close", () => {
      if (this.conn !== conn) return;
      this.conn = null;
      this.linkDown();
    });
    conn.on("error", () => {
      if (this.conn !== conn) return;
      if (!conn.open) {
        this.conn = null;
        if (!this.peerOpened) this.onPeerError(tk, "network", "connection failed");
        else this.linkDown();
      }
    });
  }

  private maybeHostReady() {
    if (this.role !== "host" || this.state !== "opening") return;
    if (!this.peerOpened && !this.ntfyOk) return;
    this.setNote("");
    this.setState("waiting");
    if (this.settle) {
      const s = this.settle;
      this.settle = null;
      if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
      this.deadlineTimer = null;
      s.resolve();
    }
  }

  dispose() {
    this.resetLinks();
    this.attempt += 1;
    this.settle = null;
  }

  leave() {
    try {
      this.send({ t: "bye" } as HostMsg);
    } catch {
      /* ignore */
    }
    this.resetLinks();
    this.attempt += 1;
    this.settle = null;
    this.role = "off";
    this.code = "";
    this.via = "";
    this.setNote("");
    this.setState("idle");
  }
}

export const net = new Net();
