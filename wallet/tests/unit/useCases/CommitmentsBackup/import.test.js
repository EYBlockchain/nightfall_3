// import Dexie from 'dexie';
import indexedDB from 'fake-indexeddb';
// import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

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
  beforeEach(async () => {
    const request = indexedDB.open('MyDatabase', 1);
    await new Promise(resolve => {
      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Create an objectStore for this database
        const objectStore = db.createObjectStore('commitments', { keyPath: 'key' });

        // define what data items the objectStore will contain
        objectStore.createIndex('key', 'key', { unique: false });
        objectStore.createIndex('value', 'value', { unique: false });

        resolve(objectStore);
      };
    });

    // new Dexie('MyDatabase', { indexedDB, IDBKeyRange });

    // const db = await new Dexie('MyDatabase').open();
    // db.version(1).stores({
    //   commitments: 'id++,table,rows',
    //   transactions: 'id++,table,rows',
    // });
  });
  test('Should test indexedDB', async () => {
    window.indexedDB = indexedDB;

    const file = new Blob([JSON.stringify(mockObject)], { type: 'text/plain' });
    expect(file).not.toEqual(mockObject);
    const object = await convertFileToObject(file);
    const rows = await getIndexedDBObjectRowsFromBackupFile(object, 'commitments');
    await addObjectStoreToIndexedDB('MyDatabase', rows, 'commitments');
  });

  // afterEach(() => {
  //   const request = indexedDB.open('MyDatabase', 1);
  //   // eslint-disable-next-line no-unused-vars
  //   request.onsuccess = function (event) {
  //     // store the result of opening the database in the db variable.
  //     // This is used a lot below
  //     const db = request.result;
  //     const transaction = db.transaction(['commitments'], 'readwrite');
  //     const objectStore = transaction.objectStore('commitments');
  //     const objectStoreRequest = objectStore.get('1');
  //     console.log('OLHA O DANADO: ', objectStoreRequest);
  //   };
  // });
});
