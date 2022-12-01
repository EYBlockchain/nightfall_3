const debugCounters = {
  // CheckBlock returns a failure
  nBlockInvalid: 0,
  // Proposer WS is closed
  // proposerWsClosed: 0,
  // Proposer WS is closed and couldn't be opened
  // proposerWsFailed: 0,
  // Optimist couldn't proposed blocks because of WS
  // proposerBlockNotSent: 0,
};

/**
Function to increase n blocks invalid
*/
export function increaseBlockInvalidCounter() {
  debugCounters.nBlockInvalid++;
}

/*
Get debugCounters
*/
export function getDebugCounters() {
  return debugCounters;
}
