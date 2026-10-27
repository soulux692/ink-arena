// In-memory fakes: a PeerJS-style broker, an ntfy-style topic bus, and a paired WebRTC.
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------------------------------------------------------- fake PeerJS */
export function makePeerSim({ down = false } = {}) {
  const peers = new Map();
  class FakeConn {
    constructor() {
      this.open = false;
      this.handlers = {};
      this.peer = null;
      this.closed = false;
    }
    on(ev, cb) {
      (this.handlers[ev] ??= []).push(cb);
      return this;
    }
    emit(ev, a) {
      (this.handlers[ev] ?? []).slice().forEach((cb) => cb(a));
    }
    send(d) {
      if (this.peer && !this.peer.closed) queueMicrotask(() => this.peer.emit("data", d));
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      this.emit("close");
      const p = this.peer;
      if (p && !p.closed) {
        p.closed = true;
        p.open = false;
        p.emit("close");
      }
    }
  }
  class FakePeer {
    constructor(id) {
      this.id = id;
      this.handlers = {};
      this.destroyed = false;
      queueMicrotask(() => {
        if (this.destroyed) return;
        if (down) return this.emit("error", { type: "socket-error", message: "socket-error" });
        if (id) {
          if (peers.has(id)) return this.emit("error", { type: "unavailable-id", message: "ID taken" });
          peers.set(id, this);
        }
        this.emit("open", id ?? "guest-anon");
      });
    }
    on(ev, cb) {
      (this.handlers[ev] ??= []).push(cb);
      return this;
    }
    emit(ev, a) {
      (this.handlers[ev] ?? []).slice().forEach((cb) => cb(a));
    }
    connect(id) {
      const a = new FakeConn();
      const b = new FakeConn();
      a.peer = b;
      b.peer = a;
      queueMicrotask(() => {
        if (down) return this.emit("error", { type: "socket-error", message: "x" });
        const remote = peers.get(id);
        if (!remote || remote.destroyed) {
          return this.emit("error", { type: "peer-unavailable", message: `Could not connect to peer ${id}` });
        }
        remote.emit("connection", b);
        a.open = true;
        a.emit("open");
        b.open = true;
        b.emit("open");
      });
      return a;
    }
    destroy() {
      this.destroyed = true;
      if (this.id) peers.delete(this.id);
    }
  }
  return { factory: (id) => new FakePeer(id), peers };
}

/* ---------------------------------------------------------- fake ntfy bus */
export function makeNtfy({ fail = false } = {}) {
  const topics = new Map();
  let seq = 0;
  const stats = { posts: 0, polls: 0 };
  const fetchImpl = async (url, init = {}) => {
    if (fail) throw new Error("ntfy down");
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const method = (init.method || "GET").toUpperCase();
    if (method === "POST") {
      const topic = parts[0];
      const arr = topics.get(topic) ?? [];
      arr.push({ id: `m${++seq}`, event: "message", time: Date.now() / 1000, message: init.body });
      topics.set(topic, arr);
      stats.posts++;
      return { ok: true, status: 200, text: async () => "{}" };
    }
    const topic = parts[0];
    const since = u.searchParams.get("since");
    const arr = topics.get(topic) ?? [];
    let out = arr;
    if (since) {
      const i = arr.findIndex((m) => m.id === since);
      out = i >= 0 ? arr.slice(i + 1) : [];
    }
    stats.polls++;
    return { ok: true, status: 200, text: async () => out.map((m) => JSON.stringify(m)).join("\n") };
  };
  return {
    fetchImpl,
    stats,
    injectStale(topic, body) {
      const arr = topics.get(topic) ?? [];
      arr.push({ id: `m${++seq}`, event: "message", time: Date.now() / 1000 - 600, message: JSON.stringify(body) });
      topics.set(topic, arr);
    },
  };
}

/* ---------------------------------------------------------- fake WebRTC pair */
export function makeRtcPair() {
  const S = { guest: null, host: null, guestDc: null, hostDc: null };
  const mkDc = () => {
    const dc = {
      readyState: "connecting",
      onopen: null,
      onclose: null,
      onmessage: null,
      peer: null,
      send(d) {
        if (this.peer && this.peer.onmessage) queueMicrotask(() => this.peer.onmessage({ data: d }));
      },
      close() {
        this.readyState = "closed";
      },
    };
    return dc;
  };
  const tryOpen = () => {
    const g = S.guest;
    const h = S.host;
    if (g && h && g._local && g._remote && h._local && h._remote && S.guestDc && S.hostDc) {
      S.guestDc.peer = S.hostDc;
      S.hostDc.peer = S.guestDc;
      for (const dc of [S.guestDc, S.hostDc]) {
        if (dc.readyState !== "open") {
          dc.readyState = "open";
          queueMicrotask(() => dc.onopen && dc.onopen());
        }
      }
    }
  };
  const mkPc = (side) => {
    const pc = {
      connectionState: "new",
      onicecandidate: null,
      onconnectionstatechange: null,
      ondatachannel: null,
      _local: null,
      _remote: null,
      createDataChannel() {
        const dc = mkDc();
        S.guestDc = dc;
        return dc;
      },
      async createOffer() {
        return { type: "offer", sdp: "fake-offer" };
      },
      async createAnswer() {
        return { type: "answer", sdp: "fake-answer" };
      },
      async setLocalDescription(d) {
        this._local = d;
        queueMicrotask(() => {
          this.onicecandidate &&
            this.onicecandidate({ candidate: { candidate: "cand", sdpMid: "0", sdpMLineIndex: 0 } });
          this.onicecandidate && this.onicecandidate({ candidate: null });
        });
        tryOpen();
      },
      async setRemoteDescription(d) {
        this._remote = d;
        if (side === "host" && d.type === "offer") {
          const dc = mkDc();
          S.hostDc = dc;
          queueMicrotask(() => this.ondatachannel && this.ondatachannel({ channel: dc }));
        }
        tryOpen();
      },
      async addIceCandidate() {},
      close() {},
    };
    S[side] = pc;
    return pc;
  };
  return { guestFactory: () => mkPc("guest"), hostFactory: () => mkPc("host") };
}
