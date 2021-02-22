import { ZERO } from 'config';

export default function(history) {
  if (!history) return null;
  const { root, oldRoot, frontier, leafIndex, currentLeafCount, blockNumber } = history;
  return {
    root,
    oldRoot: oldRoot || ZERO,
    frontier: frontier.map(f => f || ZERO),
    leafIndex,
    currentLeafCount,
    blockNumber,
  };
}
