import { Net, parseInviteCode, inviteLink, readInvite, clearInvite } from "../../src/net/net.ts";
import { makePeerSim, makeNtfy, makeRtcPair, sleep, withTimeout } from "./fakes.mjs";

let failures = 0;
const ok = (name, extra = "") => console.log(`ok   ${name}${extra ? `  (${extra})` : ""}`);
const fail = (name, why) => {
  failures++;
  console.error(`FAIL ${name}: ${why}`);
};
const section = (t) => console.log(`\n== ${t} ==`);

// ---------------------------------------------------------------- helpers
section("invite helpers");
{
  const cases = [
    ["https://x.test/game/?coop=KT4PZ#coop=KT4PZ", "KT4PZ"],
    ["https://x.test/#coop=ab9cd", "AB9CD"],
    ["https://x.test/?coop=xy7zw", "XY7ZW"],
    ["kt4pz", "KT4PZ"],
    ["  inkarena-KT4PZ ", "KT4PZ"],
    ["https://x.test/just-a-page", null],
    ["", null],
    [null, null],
  ];
  for (const [input, want] of cases) {
    const got = parseInviteCode(input);
    if (got !== want) fail("parseInviteCode", `${input} -> ${got}, want ${want}`);
  }
  ok("parseInviteCode", `${cases.length} cases`);

  const g = globalThis;
  const keepWin = g.window;
  const keepDoc = g.document;
  g.window = { location: new URL("https://game.test/play/?coop=RM8QW#coop=RM8QW"), top: null, parent: null };
  g.window.top = g.window;
  g.window.parent = g.window;
  g.document = { referrer: "" };
  if (readInvite() !== "RM8QW") fail("readInvite", "hash+query");
  const link = inviteLink("AB12C");
  if (!link.includes("coop=AB12C") || !link.includes("?coop=") || !link.includes("#coop=")) {
    fail("inviteLink", link);
  } else {
    ok("inviteLink", link);
  }
  // iframe with useless own URL but referrer carrying the invite
  g.window = { location: new URL("about:srcdoc"), top: null, parent: null };
  g.window.top = g.window;
  g.window.parent = g.window;
  g.document = { referrer: "https://platform.test/app?coop=ZZ99Q" };
  if (readInvite() !== "ZZ99Q") fail("readInvite", "referrer fallback");
  else ok("readInvite", "query/hash/referrer");
  g.window = keepWin;
  g.document = keepDoc;
}

// ---------------------------------------------------------------- scenario helper
async function scenario(name, fn) {
  try {
    await withTimeout(fn(), 30000, name);
    ok(name);
  } catch (e) {
    fail(name, e && e.message ? e.message : String(e));
  }
}

const quietNet = (deps) => {
  const n = new Net(deps);
  return n;
};

// ---------------------------------------------------------------- 1. PeerJS happy path
await scenario("peer link: host+guest connect, messages flow once", async () => {
  const peer = makePeerSim();
  const ntfy = makeNtfy({ fail: true });
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  const code = await withTimeout(host.host(), 5000, "host()");
  if (host.state !== "waiting") throw new Error("host not waiting: " + host.state);
  const seen = [];
  guest.onMessage((m) => seen.push(m));
  await withTimeout(guest.join(code), 8000, "guest.join");
  if (guest.state !== "live" || host.state !== "live") throw new Error(`states ${guest.state}/${host.state}`);
  if (guest.via !== "p2p" || host.via !== "p2p") throw new Error("via should be p2p");
  host.send({ t: "lobby", n: 1 });
  guest.send({ t: "ready", v: true });
  await sleep(50);
  const lobbies = seen.filter((m) => m.t === "lobby");
  if (lobbies.length !== 1) throw new Error(`guest got ${lobbies.length} lobbies, want exactly 1`);
  host.leave();
  guest.leave();
});

// ---------------------------------------------------------------- 2. ntfy + raw RTC path
await scenario("ntfy+rtc link: broker down, handshake completes", async () => {
  const peer = makePeerSim({ down: true });
  const ntfy = makeNtfy();
  const rtc = makeRtcPair();
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, rtcFactory: rtc.hostFactory, bcFactory: () => null });
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, rtcFactory: rtc.guestFactory, bcFactory: () => null });
  const code = await withTimeout(host.host(), 8000, "host() via ntfy");
  const seen = [];
  guest.onMessage((m) => seen.push(m));
  await withTimeout(guest.join(code), 15000, "guest.join via rtc");
  if (guest.via !== "p2p") throw new Error("via=" + guest.via);
  host.send({ t: "lobby", n: 7 });
  await sleep(50);
  if (seen.filter((m) => m.t === "lobby").length !== 1) throw new Error("lobby not delivered once over rtc");
  if (ntfy.stats.posts < 2) throw new Error("expected signaling posts, got " + ntfy.stats.posts);
  host.leave();
  guest.leave();
});

// ---------------------------------------------------------------- 3. same-browser BC path
await scenario("broadcast link: everything else down, same browser", async () => {
  const peer = makePeerSim({ down: true });
  const ntfy = makeNtfy({ fail: true });
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
  const p1 = host.host().catch((e) => e);
  // emulate the App: answer every hello like the real lobby does
  host.onMessage((m) => {
    const t = (m as { t?: string }).t;
    if (t === "hello" || t === "ping") host.send({ t: "welcome", levelIndex: 0 } as never);
  });
  await sleep(300);
  // host may error (no signaling at all) — but BC still lets a local guest through;
  // emulate what the App does: proceed regardless once BC is up
  const code = host.code;
  const seen = [];
  guest.onMessage((m) => seen.push(m));
  await withTimeout(guest.join(code), 8000, "guest.join via bc");
  if (guest.via !== "local") throw new Error("via=" + guest.via);
  host.send({ t: "lobby", n: 3 });
  await sleep(50);
  if (seen.filter((m) => m.t === "lobby").length !== 1) throw new Error("bc delivery failed");
  await p1.catch(() => {});
  host.leave();
  guest.leave();
});

// ---------------------------------------------------------------- 4. total outage
await scenario("all transports down: clear errors on both sides", async () => {
  const peer = makePeerSim({ down: true });
  const ntfy = makeNtfy({ fail: true });
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  const t0 = Date.now();
  await host.host().then(
    () => {
      throw new Error("host should have failed");
    },
    () => {},
  );
  if (host.state !== "error") throw new Error("host state=" + host.state);
  if (!/сервер|интернет/i.test(host.error)) throw new Error("host error: " + host.error);
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  await guest.join("QQQQQ").then(
    () => {
      throw new Error("guest should have failed");
    },
    () => {},
  );
  if (guest.state !== "error") throw new Error("guest state=" + guest.state);
  console.log(`   (failed fast in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  host.leave();
  guest.leave();
});

// ---------------------------------------------------------------- 5. unknown room, fast room-not-found
await scenario("unknown room: fast 'not found' (no 22s stare)", async () => {
  const peer = makePeerSim(); // broker up, but nobody hosts ZZZZZ
  const ntfy = makeNtfy();
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  const t0 = Date.now();
  await guest.join("ZZZZZ").then(
    () => {
      throw new Error("join should have failed");
    },
    () => {},
  );
  const dt = (Date.now() - t0) / 1000;
  if (!/не найдена/.test(guest.error)) throw new Error("wrong message: " + guest.error);
  if (dt > 15) throw new Error(`too slow: ${dt.toFixed(1)}s`);
  console.log(`   (failed correctly in ${dt.toFixed(1)}s)`);
  guest.leave();
});

// ---------------------------------------------------------------- 6. stale ntfy cache ignored
await scenario("stale ntfy cache is ignored", async () => {
  const peer = makePeerSim({ down: true });
  const ntfy = makeNtfy();
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, rtcFactory: () => null, bcFactory: () => null });
  const codeP = host.host();
  // wait until the host actually starts polling (code is assigned synchronously)
  await sleep(100);
  const topic = `inkarena-v1-${host.code.toLowerCase()}`;
  ntfy.injectStale(topic, { k: "offer", gid: "OLD", from: "guest", sdp: { type: "offer", sdp: "x" } });
  await withTimeout(codeP, 8000, "host()");
  await sleep(2500);
  if (host.activeGid) throw new Error("stale offer was accepted");
  host.leave();
});

// ---------------------------------------------------------------- 7. attempt invalidation (retry safety)
await scenario("stale attempt cannot resurrect or crash", async () => {
  const peer = makePeerSim();
  const ntfy = makeNtfy({ fail: true });
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
  const p1 = guest.join("NOPE1").catch(() => "e1");
  await sleep(120);
  guest.leave();
  const p2 = guest.join("NOPE2").catch(() => "e2");
  await sleep(120);
  guest.leave();
  const [r1, r2] = await Promise.all([p1, p2]);
  await sleep(300);
  if (guest.role !== "off" || guest.state !== "idle") throw new Error(`role=${guest.role} state=${guest.state}`);
  if (r1 !== "e1" || r2 !== "e2") throw new Error("stale promises misbehaved");
});

// ---------------------------------------------------------------- 8. no duplicate delivery with all links up
await scenario("single delivery when peer+rtc+bc all connect", async () => {
  const peer = makePeerSim();
  const ntfy = makeNtfy();
  const rtc = makeRtcPair();
  const host = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, rtcFactory: rtc.hostFactory });
  const guest = quietNet({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, rtcFactory: rtc.guestFactory });
  const code = await withTimeout(host.host(), 8000, "host()");
  const seen = [];
  guest.onMessage((m) => {
    if (m.t === "lobby") seen.push(m);
  });
  await withTimeout(guest.join(code), 12000, "guest.join");
  await sleep(2500); // let the slower links also come up
  for (let i = 0; i < 5; i++) host.send({ t: "lobby", n: i });
  await sleep(300);
  if (seen.length !== 5) throw new Error(`got ${seen.length}/5 (duplicates or loss)`);
  host.leave();
  guest.leave();
});

console.log(failures ? `\n${failures} FAILURES` : "\nall net checks passed");
process.exit(failures ? 1 : 0);
