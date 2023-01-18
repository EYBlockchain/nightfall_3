const debugCounters = {
  // CheckBlock returns a failure
  nBlockInvalid: 0,
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
