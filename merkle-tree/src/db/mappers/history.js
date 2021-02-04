import { ZERO } from 'config';

export default function(history) {
  if (!history) return null;
  const { root, frontier, leafIndex, currentLeafCount, blockNumber } = history;
  return {
    root,
    frontier: frontier.map(f => f || ZERO),
    leafIndex,
    currentLeafCount,
    blockNumber,
  };
}
