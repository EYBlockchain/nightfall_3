// This 'node' mapper differs from the 'leaf' mapper.
export default function({ value, nodeIndex, isLocked }) {
  return {
    // the additional ternary-operator logic prevents us from overwriting values with 'undefined' when we do updates to the db
    [value ? 'value' : undefined]: value,
    [nodeIndex ? 'nodeIndex' : undefined]: nodeIndex,
    [isLocked ? 'isLocked' : undefined]: isLocked || false,
  };
}
