// import config from 'config';
import compose from 'docker-compose';
import { Docker } from 'docker-cli-js';
import { userTest, proposerTest } from './index.mjs';

let result;

// default options for dockerCommand
const dockerCommandOptions = {
  machineName: undefined, // uses local docker
  currentWorkingDirectory: undefined, // uses current working directory
  echo: true, // echo command output to stdout/stderr
  env: undefined,
  stdin: undefined,
};

const docker = new Docker(dockerCommandOptions);

// default optioins for docker-compose
const dockerComposeOptions = {
  config: ['docker/docker-compose.proposers.yml'],
  // log: process.env.LOG_LEVEL || 'silent',
  composeOptions: [['-p', 'nightfall_3']],
};

describe('Ping-pong tests', () => {
  before(async () => {
    console.log('Starting containers...');
    await compose.upAll(dockerComposeOptions);
  });

  it('Runs ping-pong tests', async () => {
    userTest(false);
    // proposerTest();
    result = await userTest(true);
  });

  after(async () => {
    console.log('Stopping containers...');
    try {
      await compose.down(dockerComposeOptions);
    } catch (e) {
      // while removing network: network nightfall_3_nightfall_network has active endpoints
    }
    console.log('Removing volumes...');
    const data = await docker.command('volume ls -q');
    const volumes = data.raw.split('\n').filter(c => c.includes('nightfall_3_optimist_mongodb'));
    for (const v of volumes) {
      console.log(`Removing volume ${v}...`);
      // eslint-disable-next-line no-await-in-loop
      await docker.command(`volume rm ${v}`);
    }

    process.exit(result); // we should terminate with result for GHA to have the correct exit result
  });
});
