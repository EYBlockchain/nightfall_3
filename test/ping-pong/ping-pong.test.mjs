import config from 'config';
import compose from 'docker-compose';
import yaml from 'js-yaml';
import fs from 'fs';
import { Docker } from 'docker-cli-js';
import Web3 from 'web3';
import { expect } from 'chai';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  userTest,
  proposerTest,
  setParametersConfig,
  getStakeAccount,
  getCurrentProposer,
} from './index.mjs';

const { mnemonics, signingKeys } = config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

let result;
const nf3User = new Nf3(signingKeys.liquidityProvider, environment);

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
  const optimistUrls = []; // list with all the proposers from the yml file and their optimistUrl

  let configYml;
  try {
    configYml = yaml.load(fs.readFileSync('docker/docker-compose.proposers.yml', 'utf8'));
  } catch (e) {
    console.log(e);
  }
  const web3 = new Web3();
  for (const opt of optimistList) {
    const proposerAddress = web3.eth.accounts.privateKeyToAccount(
      configYml.services[`proposer_${opt.names.split('_')[2]}`].environment.PROPOSER_KEY,
    ).address;
    optimistUrls.push({
      proposer: proposerAddress,
      optimistUrl: `http://localhost:${opt.ports.split('->')[0].split(':')[1]}`,
    });
  }
  return optimistUrls;
};

const getInitialProposerStats = async optimistUrls => {
  const proposersStats = {
    proposersBlocks: {},
    sprints: 0,
    proposersInitialStakes: [],
    proposersFinalStakes: [],
  }; // initialize stats for the test

  for (const prop of optimistUrls) {
    // eslint-disable-next-line no-await-in-loop
    const stakeAccount = await getStakeAccount(prop.proposer);
    proposersStats.proposersInitialStakes.push({
      proposer: prop.proposer.toUpperCase(),
      stake: stakeAccount,
    });
  }
  return proposersStats;
};

const waitForCurrentProposer = async () => {
  let currentProposer = await getCurrentProposer();
  // let proposers boot and wait until we have the current proposer registered from the services
  while (currentProposer.thisAddress === '0x0000000000000000000000000000000000000000') {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 10000));
    // eslint-disable-next-line no-await-in-loop
    currentProposer = await getCurrentProposer();
  }
};

describe('Ping-pong tests', () => {
  before(async () => {
    await nf3User.init(mnemonics.liquidityProvider);
    await setParametersConfig(nf3User); // initialize parameters and contracts
    console.log('Removing volumes...');
    const data = await docker.command('volume ls -q');
    const volumes = data.raw.split('\n').filter(c => c.includes('nightfall_3_optimist_mongodb'));
    for (const v of volumes) {
      console.log(`Removing volume ${v}...`);
      // eslint-disable-next-line no-await-in-loop
      await docker.command(`volume rm ${v}`);
    }

    console.log('Starting containers...');
    await compose.upAll(dockerComposeOptions);
  });

  it('Runs ping-pong tests', async () => {
    const optimistUrls = await getOptimistUrls(); // get optimist urls for the different proposers
    const proposersStats = await getInitialProposerStats(optimistUrls);
    await waitForCurrentProposer();

    const blockStake = await nf3User.getBlockStake();
    console.log('BLOCKSTAKE: ', blockStake);

    userTest(false, optimistUrls); // user 1 sending deposit & transfer operations
    proposerTest(optimistUrls, proposersStats, nf3User); // user to rotate proposers and get block statistics
    result = await userTest(true, optimistUrls); // user 2 sending deposit & transfer operations
    expect(result).to.be.equal(0); // expect 0 success, 1 error

    for (const prop of optimistUrls) {
      // eslint-disable-next-line no-await-in-loop
      const stakeAccount = await getStakeAccount(prop.proposer);
      proposersStats.proposersFinalStakes.push({
        proposer: prop.proposer.toUpperCase(),
        stake: stakeAccount,
      });
    }

    if (proposersStats.proposersBlocks) {
      console.log('FINAL STATS:');
      console.log('  - BLOCKS:');
      for (const pb of proposersStats.proposersBlocks) {
        console.log(`     ${pb.proposer} : ${pb.blocks}`);
      }
      console.log('  - INITIAL STAKES:');
      for (const p of proposersStats.proposersInitialStakes) {
        console.log(`     ${p.proposer} : ${p.stake}`);
      }
      console.log('  - FINAL STAKES:');
      for (const p of proposersStats.proposersFinalStakes) {
        console.log(`     ${p.proposer} : ${p.stake}`);
        const pInitial = proposersStats.proposersInitialStakes.find(
          pi => pi.proposer === p.proposer,
        );
        const pBlocks = proposersStats.proposersBlocks.find(pb => pb.proposer === p.proposer);
        if (pBlocks) {
          // only if this proposer has proposed blocks
          expect(Number(p.stake.challengeLocked)).to.be.equal(
            Number(pInitial.stake.challengeLocked) + Number(pBlocks.blocks) * Number(blockStake),
          );
        }
      }
      console.log(`  - SPRINTS: ${proposersStats.sprints}`);

      expect(proposersStats.sprints).to.be.greaterThan(0);
    }
    nf3User.close();
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
  });
});
