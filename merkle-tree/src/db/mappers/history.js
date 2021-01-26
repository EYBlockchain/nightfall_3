import { ZERO } from 'config';

export default function(history) {
  if (!history) return null;
  const { root, frontier, leafIndex, blockNumber } = history;
  return {
    root,
    frontier: frontier.map(f => f || ZERO),
    leafIndex,
    blockNumber,
  };
}
