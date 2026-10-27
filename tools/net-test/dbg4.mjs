import { Net } from "../../src/net/net.ts";
import { makePeerSim, makeNtfy } from "./fakes.mjs";
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(2) + "s";
const peer = makePeerSim({ down: true });
const ntfy = makeNtfy({ fail: true });
const host = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
const guest = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
console.log(ts(), "host.host()...");
const p1 = host.host().then(
  (c) => console.log(ts(), "host RESOLVED", c, host.state),
  (e) => console.log(ts(), "host REJECTED", e.message, host.state),
);
host.onMessage((m) => {
  console.log(ts(), "HOST got:", m.t);
  if (m.t === "hello") host.send({ t: "welcome", levelIndex: 0 });
});
guest.onMessage((m) => console.log(ts(), "GUEST got:", m.t));
await new Promise((r) => setTimeout(r, 300));
console.log(ts(), "guest.join, host bc?", !!host.bc, "host state:", host.state);
const p2 = guest.join(host.code).then(
  () => console.log(ts(), "guest LIVE", guest.state),
  (e) => console.log(ts(), "guest REJECTED:", e.message, "|", guest.error),
);
await Promise.allSettled([p1, p2]);
await new Promise((r) => setTimeout(r, 800));
console.log(ts(), "final:", host.state, guest.state);
process.exit(0);
