import config from 'config';

const { ZERO } = config;

export default history => {
  if (!history) return null;
  const { root, oldRoot, frontier, leafIndex, currentLeafCount, blockNumber, transactionHash } =
    history;
  return {
    root,
    oldRoot: oldRoot || ZERO,
    frontier: frontier.map(f => f || ZERO),
    leafIndex,
    currentLeafCount,
    blockNumber,
    transactionHash,
  };
};
