// import config from 'config';
import compose from 'docker-compose';
import yaml from 'js-yaml';
import fs from 'fs';
import { Docker } from 'docker-cli-js';
import Web3 from 'web3';
// eslint-disable-next-line no-unused-vars
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

const getOptimistUrls = async () => {
  const data = await docker.command('ps');
  const optimistList = data.containerList.filter(c => c.names.includes('proposer_optimist_'));
  const optimistUrls = [];

  let configYml;
  try {
    configYml = yaml.load(fs.readFileSync('docker/docker-compose.proposers.yml', 'utf8'));
    // const indentedJson = JSON.stringify(configYml, null, 4);
    // console.log(indentedJson);
  } catch (e) {
    console.log(e);
  }
  const web3 = new Web3();
  for (const opt of optimistList) {
    // console.log(`proposer_${opt.names.split('_')[2]}`);
    const proposerAddress = web3.eth.accounts
      .privateKeyToAccount(
        configYml.services[`proposer_${opt.names.split('_')[2]}`].environment.PROPOSER_KEY,
      )
      .address.toUpperCase();
    optimistUrls.push({
      proposer: proposerAddress,
      optimistUrl: `http://localhost:${opt.ports.split('->')[0].split(':')[1]}`,
    });
  }
  return optimistUrls;
};

describe('Ping-pong tests', () => {
  before(async () => {
    console.log('Starting containers...');
    await compose.upAll(dockerComposeOptions);
  });

  it('Runs ping-pong tests', async () => {
    const optimistUrls = await getOptimistUrls();
    userTest(false);
    proposerTest(optimistUrls);
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
