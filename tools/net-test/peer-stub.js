// Stubbed out in tests: Net always gets an injected peerFactory, so real PeerJS is never touched.
export default class PeerStub {
  constructor() {
    throw new Error("real PeerJS must not be used in tests");
  }
}
