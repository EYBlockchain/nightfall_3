export default function({
  contractAddress,
  contractInterface,
  treeHeight,
  latestRecalculation,
  latestLeaf,
}) {
  return {
    ...(contractAddress && { contractAddress }),
    ...(contractInterface && { contractInterface }),
    ...(treeHeight && { treeHeight }),
    ...(latestRecalculation && { latestRecalculation }),
    ...(latestLeaf && { latestLeaf }),
  };
}
