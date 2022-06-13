// 0: {table: 'blocks', rows: Array(0)}
// 1: {table: 'circuit_storage', rows: Array(12)}
// 2: {table: 'commitments', rows: Array(2)}
// 3: {table: 'keys', rows: Array(11)}
// 4: {table: 'timber', rows: Array(106)}
// 5: {table: 'transactions', rows: Array(2)}

import indexedDB from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { exportIndexdDB } from '../../../../src/useCases/CommitmentsBackup/export';

describe('Tests about indexedDB', () => {
  const OBJ_STORE_NAME = 'commitments';

  test('Should get an array of indexedDB tables exported by the function exportIndexdDB', async () => {
    const request = indexedDB.open('MyDatabase', 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Create the objectsStore for this database
      db.createObjectStore(OBJ_STORE_NAME, { keyPath: 'key' });
    };

    window.indexedDB = indexedDB;
    const databaseExported = await exportIndexdDB('MyDatabase');

    expect(databaseExported).toHaveLength(1);
    expect(databaseExported[0].table).toEqual(OBJ_STORE_NAME);
  });
});
