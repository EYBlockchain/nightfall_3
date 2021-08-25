/**
Class to hold the current proposer. It's a singleton, so everything should get
The same proposer.
*/
class Proposer {
  address = undefined;

  isMe = false;

  proposers = [];

  constructor() {
    return { address: this.address, proposers: this.proposers, isMe: this.isMe };
  }
}

export default Proposer;
