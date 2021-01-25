import { ZERO } from 'config';

export default function({ root, frontier, leafIndex, blockNumber }) {
  return {
    root,
    frontier: frontier.map(f => f || ZERO),
    leafIndex,
    blockNumber,
  };
}
