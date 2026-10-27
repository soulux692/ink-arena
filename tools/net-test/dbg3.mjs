import { Net } from "../../src/net/net.ts";
import { makePeerSim, makeNtfy, sleep } from "./fakes.mjs";

// --- BC-only ---
{
  console.log("--- BC test ---");
  const peer = makePeerSim({ down: true });
  const ntfy = makeNtfy({ fail: true });
  const host = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
  const guest = new Net({ peerFactory: peer.factory, fetchImpl: ntfy.fetchImpl });
  const p1 = host.host().then(
    (c) => console.log("host resolved", c),
    (e) => console.log("host rejected:", e.message, "| state:", host.state),
  );
  host.onMessage((m) => {
    console.log("HOST got:", m.t);
    if (m.t === "hello") host.send({ t: "welcome", levelIndex: 0 });
  });
  guest.onMessage((m) => console.log("GUEST got:", m.t));
  await sleep(300);
  console.log("host code:", host.code, "host state:", host.state);
  const p2 = guest.join(host.code).then(
    () => console.log("guest LIVE, via:", guest.via),
    (e) => console.log("guest REJECTED:", e.message, "| state:", guest.state, "| err:", guest.error),
  );
  await Promise.allSettled([p1, p2]);
  await sleep(500);
  console.log("final:", { hs: host.state, gs: guest.state, gerr: guest.error });
  host.leave();
  guest.leave();
}
process.exit(0);
