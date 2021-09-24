import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import Web3 from 'web3';
import Table from 'cli-table';
import Nf3 from '../lib/nf3.mjs';

const web3 = new Web3(); // no URL, we're just using some utilities here

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
async function askQuestions(nf3) {
  const questions = [
    {
      name: 'privateKey',
      type: 'input',
      message: 'Please provide your Ethereum signing key',
      default: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
      validate: input => web3.utils.isHexStrict(input),
      when: () => !nf3.ethereumSigningKey,
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
Simple function to print out the balances object
*/
function printBalances(balances) {
  if (Object.keys(balances).length === 0) {
    console.log('You have no balances yet - try depositing some tokens into Layer 2 from Layer 1');
    return;
  }
  const table = new Table({ head: ['ERC Contract Address', 'Layer 2 Balance'] });
  table.push(balances);
  console.log(table.toString());
}

/**
UI control loop
*/
async function loop(nf3, ercAddress) {
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
  } = await askQuestions(nf3);
  let [x, y] = [pkdX, pkdY]; // make these variable - we may need to change them
  if (privateKey) nf3.setEthereumSigningKey(privateKey); // we'll remember the key so we don't keep asking for it
  let receiptPromise;
  // handle the task that the user has asked for
  switch (task) {
    case 'Deposit':
      receiptPromise = await nf3.deposit(ercAddress, tokenType, value, tokenId, fee);
      break;
    case 'Transfer':
      if (x === 'my key') [x, y] = nf3.zkpKeys.pkd;
      try {
        receiptPromise = await nf3.transfer(
          ercAddress,
          tokenType,
          value,
          tokenId,
          [x, y], // this holds the recipient's pkd point.
          fee,
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
        receiptPromise = await nf3.withdraw(
          ercAddress,
          tokenType,
          value,
          tokenId,
          recipientAddress,
          fee,
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
      printBalances(await nf3.getLayer2Balances());
      return [false, null];
    case 'Exit':
      return [true, null];
    default:
      throw new Error('Unknown task');
  }
  return [false, receiptPromise];
}

async function main() {
  // intialisation
  init();
  const nf3 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
  ); // create an nf3 instance
  await nf3.init();
  const ercAddress = await nf3.getContractAddress('ERCStub');
  let exit;
  let receiptPromise;
  // main CLI loop
  do {
    // eslint-disable-next-line no-await-in-loop
    [exit, receiptPromise] = await loop(nf3, ercAddress);
  } while (!exit);
  // cleanup
  await receiptPromise; // don't attempt to close the connection until we have a receipt
  nf3.close();
}

main();
