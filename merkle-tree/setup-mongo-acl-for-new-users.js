/* eslint-disable */

const existingRole = db.getRoles().map(data => {
  console.log('\nsrc/db/setup-mongo-acl-for-new-users getRoles()');
  console.log('data:');
  console.log(data);
  return data.role;
});

db.getCollectionNames().forEach(c => {
  console.log('\nsrc/db/setup-mongo-acl-for-new-users getCollectionNames()');
  console.log('c:');
  console.log(c);

  if (existingRole.indexOf(c) !== -1) return;
  if (c.indexOf('_') === -1) return;

  const username = c.split('_')[0];
  const dbName = db.toString();

  db.createRole({
    role: c,
    privileges: [
      {
        resource: {
          db: dbName,
          collection: c,
        },
        actions: ['find', 'update', 'insert'],
      },
    ],
    roles: [],
  });

  db.grantRolesToUser(username, [{ role: c, db: dbName }]);
  db.revokeRolesFromUser(username, [{ role: 'read', db: dbName }]);
});
