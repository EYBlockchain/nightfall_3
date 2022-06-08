import indexedDB from 'fake-indexeddb';
import { isCommitmentsCPKDMatchDerivedKeys } from '../../../../src/useCases/CommitmentsBackup/commitmentsVerification';

import { addObjectStoreToIndexedDB } from '../../../../src/useCases/CommitmentsBackup/import';

const wrongCommitments = [
  {
    table: 'commitments',
    rows: [
      { key: '1', value: { _id: '1', value: '1', compressedPkd: '500' } },
      { key: '2', value: { _id: '2', value: '2', compressedPkd: '200' } },
      { key: '3', value: { _id: '3', value: '3', compressedPkd: '100' } },
    ],
  },
];

const mockObject = [
  {
    table: 'transactions',
    rows: [
      { key: '1', value: { _id: '1', value: '1' } },
      { key: '2', value: { _id: '2', value: '2' } },
      { key: '3', value: { _id: '3', value: '3' } },
    ],
  },
  {
    table: 'commitments',
    rows: [
      { key: '1', value: { _id: '1', value: '1', compressedPkd: '100' } },
      { key: '2', value: { _id: '2', value: '2', compressedPkd: '200' } },
      { key: '3', value: { _id: '3', value: '3', compressedPkd: '100' } },
    ],
  },
  {
    table: 'keys',
    rows: [
      { key: '100', value: { _id: '1', value: '1' } },
      { key: '200', value: { _id: '2', value: '2' } },
      { key: '300', value: { _id: '3', value: '3' } },
    ],
  },
];

describe('This suit test should insert some keys in a fake indexedDB and test the verification between commitmnets compressedPkds and these fake derived keys', () => {
  let objResult;
  const OBJ_STORE_NAME = 'keys';
  beforeAll(async () => {
    // Create a database in our fake indexedDB and open it
    const request = indexedDB.open('MyDatabase', 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Create an objectStore for this database
      const objectStore = db.createObjectStore(OBJ_STORE_NAME, { keyPath: 'key' });

      // define what data items the objectStore will contain
      objectStore.createIndex('key', 'key', { unique: false });
      objectStore.createIndex('value', 'value', { unique: false });
    };

    window.indexedDB = indexedDB;

    // Adding the keys to our fake indexedDB
    await addObjectStoreToIndexedDB('MyDatabase', mockObject[2].rows, OBJ_STORE_NAME);

    /**
     * Simulating the getting of keys fron indexedDB
     */
    objResult = await new Promise(resolve => {
      request.onsuccess = async function () {
        // store the result of opening the database in the db variable.
        // This is used a lot below
        const db = request.result;
        const transaction = db.transaction([OBJ_STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(OBJ_STORE_NAME);
        const objectStoreRequest = objectStore.getAll();
        objectStoreRequest.onsuccess = function () {
          // report the success of our request
          db.close();
          resolve(objectStoreRequest.result);
        };
      };
    });
  });
  test('Should expect true because we are passing only commitments that match with the derived keys', async () => {
    const isMatch = await isCommitmentsCPKDMatchDerivedKeys(objResult, mockObject[1].rows);
    expect(isMatch).toEqual(true);
  });
  test('Should expect false because we are passing commitments that not match with the derived keys', async () => {
    const isMatch = await isCommitmentsCPKDMatchDerivedKeys(objResult, wrongCommitments[0].rows);
    expect(isMatch).toEqual(false);
  });
});
