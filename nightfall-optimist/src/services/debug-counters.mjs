const debugCounters = {
  // CheckBlock returns a failure
  nBlockInvalid: 0,
  // Proposer WS is closed
  proposerWsClosed: 0,
  // Proposer WS is clossed and coulnd't be opened
  proposerWsFailed: 0,
  // Optimist couldnt proposed blocks because of WS
  proposerBlockNotSent: 0,
};

/**
Function to increase n blocks invalid
*/
export function increaseBlockInvalidCounter() {
  debugCounters.nBlockInvalid++;
}

/**
Function to increase proposer Ws Closed
*/
// export function increaseProposerWsClosed() {
//   debugCounters.proposerWsClosed++;
// }
/**
Function to increase proposer Ws Failed
*/
// export function increaseProposerWsFailed() {
//   debugCounters.proposerWsFailed++;
// }
/**
Function to increase proposer Block not sent
*/
// export function increaseProposerBlockNotSent() {
//   debugCounters.proposerBlockNotSent++;
// }

/*
Get debugCounters
*/
export function getDebugCounters() {
  return debugCounters;
}
