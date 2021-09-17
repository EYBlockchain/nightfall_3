import axios from 'axios';
import config from 'config';
import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import Web3 from 'web3';

import { generateKeys } from '../../nightfall-client/src/services/keys.mjs';
import {
  submitTransaction,
  getContractAddress,
  clientBaseUrl,
  web3WsUrl,
  healthcheck,
} from './common.mjs';

const { ZKP_KEY_LENGTH } = config;
axios.defaults.baseURL = clientBaseUrl;
let ethereumSigningKey;

/**
Initialises the CLI
*/
function init() {
  clear();
  console.log(
    chalk.green(
      figlet.textSync('Nightfall_3 CLI', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      }),
    ),
  );
}

/**
Asks CLI questions
*/
async function askQuestions(web3) {
  const questions = [
    {
      name: 'privateKey',
      type: 'input',
      message: 'Please provide your Ethereum signing key',
      default: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
      validate: input => web3.utils.isHexStrict(input),
      when: () => !ethereumSigningKey,
    },
    {
      name: 'task',
      type: 'list',
      message: 'What would you like to do?',
      choices: ['Deposit', 'Transfer', 'Withdraw', 'View my wallet', 'Exit'],
    },
    {
      name: 'recipientAddress',
      type: 'input',
      message: 'Which Ethereum address should the withdrawal be paid to?',
      default: '0x9c8b2276d490141ae1440da660e470e7c0349c63',
      when: answers => answers.task === 'Withdraw',
      validate: input => web3.utils.isAddress(input),
    },
    {
      name: 'pkdX',
      type: 'input',
      message: "Provide the x coordinate of the recipient's transmission key",
      default: 'my key',
      when: answers => answers.task === 'Transfer',
      validate: input => web3.utils.isHexStrict(input) || input === 'my key',
    },
    {
      name: 'pkdY',
      type: 'input',
      message: "Provide the y coordinate of the recipient's transmission key",
      default: 'my key',
      when: answers => answers.task === 'Transfer' && answers.pkdX !== 'my key',
      validate: input => web3.utils.isHexStrict(input),
    },
    {
      name: 'fee',
      type: 'input',
      message: 'What fee do you wish to pay (Wei)?',
      default: 10,
      validate: input => input >= 0,
      when: answers =>
        answers.task === 'Deposit' || answers.task === 'Transfer' || answers.task === 'Withdraw',
    },
    {
      name: 'tokenType',
      message: 'What type of token are you transacting?',
      type: 'list',
      choices: ['ERC20', 'ERC721', 'ERC1155'],
      when: answers =>
        answers.task === 'Deposit' || answers.task === 'Transfer' || answers.task === 'Withdraw',
    },
    {
      name: 'value',
      message: 'How many tokens are you transacting?',
      default: 10,
      type: 'input',
      when: answers => answers.tokenType === 'ERC20' || answers.tokenType === 'ERC1155',
      validate: input => input > 0,
    },
    {
      name: 'tokenId',
      message: 'What is the ID of your token?',
      type: 'input',
      when: answers => answers.tokenType === 'ERC721',
      validate: input => web3.utils.isHexStrict(input),
    },
  ];
  return inquirer.prompt(questions);
}

/**
Asks NF_3 to create a deposit, via the CLI
*/
async function deposit(fee, ercAddress, tokenType, value, tokenId, keys) {
  const res = await axios.post('/deposit', {
    ercAddress,
    tokenId,
    tokenType,
    value,
    pkd: keys.pkd,
    nsk: keys.nsk,
    fee,
  });
  return res.data.txDataToSign;
}

async function transfer(fee, ercAddress, tokenType, value, tokenId, keys, pkd) {
  const res = await axios.post('/transfer', {
    ercAddress,
    tokenId,
    recipientData: {
      values: [value],
      recipientPkds: [pkd],
    },
    nsk: keys.nsk,
    ask: keys.ask,
    fee,
  });
  return res.data.txDataToSign;
}

async function withdraw(fee, ercAddress, tokenType, value, tokenId, keys, recipientAddress) {
  const res = await axios.post('/withdraw', {
    ercAddress,
    tokenId,
    tokenType,
    value,
    recipientAddress,
    nsk: keys.nsk,
    ask: keys.ask,
  });
  return res.data.txDataToSign;
}

async function makeKeys() {
  // TODO replace with an http API
  return generateKeys(ZKP_KEY_LENGTH);
}

/**
Without this, nightfall-client won't listed for BlockProposed events.
*/
async function subscribeToIncomingViewingKeys(keys) {
  return axios.post('/incoming-viewing-key', {
    ivk: keys.ivk,
    nsk: keys.nsk,
  });
}

/**
Does the preliminary setup for interacting with Nightfall
*/
async function setup() {
  await healthcheck(clientBaseUrl);
  const web3 = new Web3(web3WsUrl);
  const keys = await makeKeys();
  subscribeToIncomingViewingKeys(keys);
  return [keys, getContractAddress('ERCStub'), getContractAddress('Shield'), web3];
}

/**
UI control loop
*/
async function loop(keys, ercAddress, shieldAddress, web3) {
  const {
    task,
    recipientAddress,
    fee,
    tokenType,
    value = 0,
    tokenId = '0x00',
    privateKey,
    pkdX,
    pkdY,
  } = await askQuestions(web3);
  let [x, y] = [pkdX, pkdY]; // make these variable - we may need to change them
  if (privateKey) ethereumSigningKey = privateKey; // we'll remember the key so we don't keep asking for it
  let txDataToSign;
  // handle the task that the user has asked for
  switch (task) {
    case 'Deposit':
      txDataToSign = await deposit(fee, await ercAddress, tokenType, value, tokenId, await keys);
      break;
    case 'Transfer':
      if (x === 'my key') [x, y] = keys.pkd;
      try {
        txDataToSign = await transfer(
          fee,
          await ercAddress,
          tokenType,
          value,
          tokenId,
          await keys,
          [x, y], // this holds the recipient's pkd point.
        );
      } catch (err) {
        if (err.response.data.includes('No suitable commitments were found')) {
          console.log('No suitable commitments were found');
          return [false, null];
        }
        throw err;
      }
      break;
    case 'Withdraw':
      try {
        txDataToSign = await withdraw(
          fee,
          await ercAddress,
          tokenType,
          value,
          tokenId,
          await keys,
          recipientAddress,
        );
      } catch (err) {
        if (err.response.data.includes('No suitable commitments were found')) {
          console.log('No suitable commitments were found');
          return [false, null];
        }
        throw err;
      }
      break;
    case 'View my wallet':
      console.log('Comming soon');
      return [false, null];
    case 'Exit':
      return [true, null];
    default:
      throw new Error('Unknown task');
  }
  const receiptPromise = submitTransaction(
    web3,
    await txDataToSign,
    ethereumSigningKey,
    await shieldAddress,
    fee,
  );
  return [false, receiptPromise];
}

async function main() {
  init();
  console.log('Running setup...');
  const [keys, ercAddress, shieldAddress, web3] = await Promise.all(await setup());
  console.log('Setup complete');
  let exit;
  let receiptPromise;
  // main CLI loop
  do {
    // eslint-disable-next-line no-await-in-loop
    [exit, receiptPromise] = await loop(keys, ercAddress, shieldAddress, web3);
  } while (!exit);
  await receiptPromise; // don't attempt to close the connection until we have a receipt
  web3.currentProvider.connection.close();
}

main();
