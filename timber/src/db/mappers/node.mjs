// This 'node' mapper differs from the 'leaf' mapper.
export default ({ value, nodeIndex }) => {
  return {
    value,
    nodeIndex,
  };
};
