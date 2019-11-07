/**
@module index.js
@desc
@author iAmMichaelConnor
*/

import app from './app';
import deployer from './deployer';

const main = async () => {
  try {
    // deploy the contract:
    await deployer.deploy();

    app.listen(80, '0.0.0.0', () => {
      console.log(`\ndeployer RESTful API server started on ::: 80`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

main();
