global.sharedWorkerpool = new Set();

// warns at page reload if sharedWorker for generateProof
// is in progress
global.onbeforeunload = event => {
  if (!global.sharedWorkerpool.size) return null;
  const e = event || window.event;
  e.preventDefault();
  if (e) e.returnValue = '';
  return '';
};
