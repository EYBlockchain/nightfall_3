import utilsMT from '../../utils-merkle-tree.mjs';
import logger from '../../logger.mjs';

// This 'leaf' mapper differs from the 'node' mapper.
export default (treeHeight, { value, nodeIndex, leafIndex, blockNumber, transactionHash }) => {
  // to prevent incorrect leaf data from being stored, we ensure the nodeIndex is calculated correctly from the leafIndex:
  const checkNodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex, treeHeight);
  if (!nodeIndex) {
    nodeIndex = checkNodeIndex; // eslint-disable-line no-param-reassign
    logger.debug(`Inserting a nodeIndex of ${nodeIndex} for leafIndex ${leafIndex}`);
  } else if (nodeIndex !== checkNodeIndex) {
    throw new Error(
      `Intercepted an incorrect nodeIndex of ${nodeIndex} for leafIndex ${leafIndex}. The nodeIndex should have been ${checkNodeIndex}`,
    );
  }

  return {
    value,
    nodeIndex,
    leafIndex,
    blockNumber,
    transactionHash,
  };
};
