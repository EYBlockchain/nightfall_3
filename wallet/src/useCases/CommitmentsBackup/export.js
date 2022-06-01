import Dexie from 'dexie';

async function exportIndexdDB(databaseName) {
  const db = await new Dexie(databaseName).open();
  return db.transaction('r', db.tables, () => {
    return Promise.all(
      db.tables.map(table => table.toArray().then(rows => ({ table: table.name, rows: rows }))),
    );
  });
}

export { exportIndexdDB };
