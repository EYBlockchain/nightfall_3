import indexedDB from 'fake-indexeddb';

import {
  addObjectStoreToIndexedDB,
  convertFileToObject,
  getIndexedDBObjectRowsFromBackupFile,
} from '../../../../src/useCases/CommitmentsBackup/import';

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
      { key: '1', value: { _id: '1', value: '1' } },
      { key: '2', value: { _id: '2', value: '2' } },
      { key: '3', value: { _id: '3', value: '3' } },
    ],
  },
  {
    table: 'keys',
    rows: [
      { key: '1', value: { _id: '1', value: '1' } },
      { key: '2', value: { _id: '2', value: '2' } },
      { key: '3', value: { _id: '3', value: '3' } },
    ],
  },
];

describe('Tests about file', () => {
  test('Should convert a blob file in a object', async () => {
    const file = new Blob([JSON.stringify(mockObject)], { type: 'text/plain' });
    expect(file).not.toEqual(mockObject);
    const object = await convertFileToObject(file);
    expect(object).toEqual(mockObject);
  });

  test('Should get an array of rows from the object recovered from a file', async () => {
    const file = new Blob([JSON.stringify(mockObject)], { type: 'text/plain' });
    expect(file).not.toEqual(mockObject);
    const object = await convertFileToObject(file);
    const rows = await getIndexedDBObjectRowsFromBackupFile(object, 'commitments');
    expect(rows).toEqual(mockObject[1].rows);
  });
});

describe('Tests about indexedDB', () => {
  let object;
  const OBJ_STORE_NAME = 'commitments';
  beforeEach(async () => {
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

    const file = new Blob([JSON.stringify(mockObject)], { type: 'text/plain' });
    expect(file).not.toEqual(mockObject);
    object = await convertFileToObject(file);
  });
  test('Should add objects in the indexedDB objectStore chosen', async () => {
    const rows = await getIndexedDBObjectRowsFromBackupFile(object, OBJ_STORE_NAME);
    await addObjectStoreToIndexedDB('MyDatabase', rows, OBJ_STORE_NAME);
    const request = indexedDB.open('MyDatabase', 1);

    request.onsuccess = async function () {
      // store the result of opening the database in the db variable.
      // This is used a lot below
      const db = request.result;
      const transaction = db.transaction([OBJ_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(OBJ_STORE_NAME);
      const objectStoreRequest = objectStore.get('1');
      objectStoreRequest.onsuccess = function () {
        // report the success of our request
        const objResult = objectStoreRequest.result;
        expect(objResult.key).toEqual('1');
      };
    };
  });

  afterEach(() => {});
});
