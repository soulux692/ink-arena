import { Net } from "../../src/net/net.ts";
import { makePeerSim, makeNtfy } from "./fakes.mjs";

const peer = makePeerSim();
const ntfy = makeNtfy();
const guest = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
guest.onChange(() => console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] state=${guest.state} note="${guest.note}" err="${guest.error}"`));
const t0 = Date.now();
console.log("joining ZZZZZ (broker up, no host)...");
const p = guest.join("ZZZZZ").then(
  () => console.log("RESOLVED?!"),
  (e) => console.log(`REJECTED after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, e.message),
);
setTimeout(() => {
  console.log("internals:", JSON.stringify({
    peerErr: guest.peerErr, rtcErr: guest.rtcErr, ntfyFails: guest.ntfyFails,
    peerOpened: guest.peerOpened, signalSeen: guest.signalSeen, winner: guest.winner,
    hasSettle: !!guest.settle, state: guest.state,
  }));
}, 4000);
await p;
process.exit(0);
