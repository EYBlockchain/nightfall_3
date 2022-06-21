/**
 *
 * @description this function should verify if the commitment's compressedPkd match with one of the derived keys.
 * If all match returns true else returns false.
 * @param {Object[]} indexedDBDerivedKeys the derived keys that you get from indexedDB keys objectStore.
 * @param {Object[]} commitmentsFromBackup the rows of commitments from the backup uploaded file.
 * @returns boolean
 */
export default function isCommitmentsCPKDMatchDerivedKeys(
  indexedDBDerivedKeys,
  commitmentsFromBackup,
) {
  return new Promise(resolve => {
    commitmentsFromBackup.forEach(commitment => {
      for (let i = 0; i < indexedDBDerivedKeys.length; i++) {
        if (indexedDBDerivedKeys[i] === commitment.preimage.compressedPkd) {
          break;
        }
        if (i === indexedDBDerivedKeys.length - 1) {
          resolve(false);
        }
      }
    });
    resolve(true);
  });
}
