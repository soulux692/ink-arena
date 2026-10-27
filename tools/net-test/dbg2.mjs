import { Net } from "../../src/net/net.ts";
import { makePeerSim, makeNtfy, sleep } from "./fakes.mjs";
const peer = makePeerSim();
const ntfy = makeNtfy({ fail: true });
const guest = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl, bcFactory: () => null });
console.log("t=0 join NOPE1");
const p1 = guest.join("NOPE1").then(
  () => "RESOLVED?!",
  (e) => "e1:" + e.message,
);
await sleep(120);
console.log("t=120 leave, state=", guest.state);
guest.leave();
console.log("after leave: role=", guest.role, "state=", guest.state);
console.log("t=120 join NOPE2");
const p2 = guest.join("NOPE2").then(
  () => "RESOLVED?!",
  (e) => "e2:" + e.message,
);
await sleep(120);
console.log("t=240 leave, state=", guest.state);
guest.leave();
console.log("awaiting both...");
const [r1, r2] = await Promise.all([p1, p2]);
console.log("done:", r1, "|", r2);
process.exit(0);
