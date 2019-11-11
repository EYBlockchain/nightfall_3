// This 'node' mapper differs from the 'leaf' mapper.
export default function({ value, nodeIndex }) {
  return {
    value,
    nodeIndex,
  };
}
