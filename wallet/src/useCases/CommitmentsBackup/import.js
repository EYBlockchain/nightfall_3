/**
 *
 * @param {*} objectRecovered the array object converted from the backup file uploaded.
 * @param {*} objectStoreName the name of indexedDB database objectStore.
 * @description get the rows from the objectsStore recovered from the
 * backup file.
 * @returns promise of array of rows.
 */
const getIndexedDBObjectRowsFromBackupFile = (objectRecovered, objectStoreName) => {
  return new Promise((resolve, reject) => {
    try {
      resolve(objectRecovered.filter(obj => obj.table === objectStoreName)[0].rows);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 *
 * @param {File} file
 * @description read the content of the file got, and convert this
 * in a object.
 * @returns {Promise<object>} Promise of object
 */
const convertFileToObject = file => {
  return new Promise((resolve, reject) => {
    try {
      let objectRecovered;
      const reader = new FileReader();
      reader.onload = async e => {
        const fileText = e.target.result;
        objectRecovered = JSON.parse(fileText);
        resolve(objectRecovered);
      };
      reader.readAsText(file);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * @param {string} databaseName the name of the indexedDB database to be handled.
 * @param {[]} arrayOfObjects the array of objects tha should be inserted into indexedDB table.
 * @param {string} nameOfObjectStore the name of the table or objectStore.
 * @returns an error or true if the process was completed.
 */
const addObjectStoreToIndexedDB = (databaseName, arrayOfObjects, nameOfObjectStore) => {
  return new Promise((resolve, reject) => {
    const myIndexedDB = indexedDB.open(databaseName, 1);

    myIndexedDB.onerror = function () {
      reject(myIndexedDB.error);
    };

    myIndexedDB.onsuccess = function () {
      const db = myIndexedDB.result;
      arrayOfObjects.map(obj => {
        const transaction = db.transaction([nameOfObjectStore], 'readwrite');
        const objStore = transaction.objectStore(nameOfObjectStore);
        const request = objStore.add(obj, obj._id);

        request.onerror = function () {
          reject(request.error);
        };

        return true;
      });
      db.close();
      resolve(true);
    };
  });
};

export { getIndexedDBObjectRowsFromBackupFile, convertFileToObject, addObjectStoreToIndexedDB };
