import config from 'config';
import level from 'level';

console.log('\nopening level database');
console.log(config.LEVEL_DB_PATH);
const db = level(config.LEVEL_DB_PATH); // the levelDB database we're going to create

console.log('\nlevel database is open');

export default db;
