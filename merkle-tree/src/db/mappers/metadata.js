export default function({ contractAddress, contractInterface, latestRecalculation, latestLeaf }) {
  return {
    ...(contractAddress && { contractAddress }),
    ...(contractInterface && { contractInterface }),
    ...(latestRecalculation && { latestRecalculation }),
    ...(latestLeaf && { latestLeaf }),
  };
}
