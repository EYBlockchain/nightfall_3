/* ignore unused exports */
import { edwardsCompress } from '../../common-files/utils/curve-maths/curves';
/**
 *
 * @description this function should verify if the commitment's compressedZkpPublicKey match with one of the derived keys.
 * If all match returns true else returns false.
 * @param {Object[]} indexedDBDerivedKeys the derived keys that you get from indexedDB keys objectStore.
 * @param {Object[]} commitmentsFromBackup the rows of commitments from the backup uploaded file.
 * @returns boolean
 */
const isCommitmentsCPKDMatchDerivedKeys = (indexedDBDerivedKeys, commitmentsFromBackup) => {
  return new Promise(resolve => {
    commitmentsFromBackup.forEach(commitment => {
      for (let i = 0; i < indexedDBDerivedKeys.length; i++) {
        const compressedZkpPublicKey = edwardsCompress([
          BigInt(commitment.preimage.zkpPublicKey[0]),
          BigInt(commitment.preimage.zkpPublicKey[1]),
        ]);
        if (indexedDBDerivedKeys[i] === compressedZkpPublicKey) {
          break;
        }
        if (i === indexedDBDerivedKeys.length - 1) {
          resolve(false);
        }
      }
    });
    resolve(true);
  });
};

export default isCommitmentsCPKDMatchDerivedKeys;
