/**
 *
 * @description this function should verify if the commitment's compressedPkd match with one of the derived keys.
 * If all match returns true else returns false.
 * @param {Object[]} indexedDBDerivedKeys the derived keys that you get from indexedDB keys objectStore.
 * @param {Object[]} commitmentsFromBackup the rows of commitments from the backup uploaded file.
 * @returns boolean
 */
[
  '0x0284b26cafa09dc560528c2a963831ec0d68e35cb2e4033482fe90ffd6f7ab3d',
  '0x0db8551518e35587ac665d8e07445d19a746f867c70485c1bde8af5418b5c2de',
  '0x0ee56d4879c8541a06765c3f6b70ea0eb99a84acb0a7a60d46e0828d436f8cef',
  '0x14d5f7a6e1c5db59e519266f20f5a6884d9944a002877bc6c1925a57fedfc71b',
  '0x2a54090abe4396a1ed37993cc7166938da25c943f17135a095a722c47cac1877',
  '0x2bb84f91e7b7ded2bb73d72f99bf422e0650a718d887ebb3eba6ee48d18c99eb',
  '0x2ffe191ed9f5243d2e276d068cc397e4f730b115ac99694d1bc6c98b60938a91',
  '0x8e4613e3815adc39e81c8258511c637cbf15e8c030a13ba2e9176804670514d7',
  '0x99d2c1d8823089dc98cc9973f94a046690d172cefcb16b11e8918f3ce2a9fe7e',
  '0xa4a85774d3a30784bb148087ebecb3cfd7ee81e4fa30ac399d3438b4bf5e6699',
  'cryptokey',
];

const isCommitmentsCPKDMatchDerivedKeys = (indexedDBDerivedKeys, commitmentsFromBackup) => {
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
};

export { isCommitmentsCPKDMatchDerivedKeys };
