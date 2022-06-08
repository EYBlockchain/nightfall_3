/**
 *
 * @description this function should verify if the commitment's compressedPkd match with one of the derived keys.
 * If all match returns true else returns false.
 * @param {Object[]} indexedDBDerivedKeys the derived keys that you get from indexedDB keys objectStore.
 * @param {Object[]} commitmentsFromBackup the rows of commitments from the backup uploaded file.
 * @returns boolean
 */
const isCommitmentsCPKDMatchDerivedKeys = (indexedDBDerivedKeys, commitmentsFromBackup) => {
  return new Promise(resolve => {
    commitmentsFromBackup.forEach(commitment => {
      indexedDBDerivedKeys.every((derivatedKey, index) => {
        if (derivatedKey.key === commitment.value.compressedPkd) {
          return false;
        }
        if (index === indexedDBDerivedKeys.length - 1) {
          resolve(false);
        }
        return true;
      });
    });
    resolve(true);
  });
};

export { isCommitmentsCPKDMatchDerivedKeys };
