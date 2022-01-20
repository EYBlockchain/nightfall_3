import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import clear from 'clear';
import Web3 from 'web3';
import Table from 'cli-table';
import { generateMnemonic } from 'bip39';
import Nf3 from '../lib/nf3.mjs';
import { toBaseUnit } from '../lib/units.mjs';
import { getDecimals } from '../lib/tokens.mjs';
import { setEnvironment, getCurrentEnvironment } from '../lib/environment.mjs';

const web3 = new Web3('ws://localhost:8546');
let latestWithdrawTransactionHash; // we'll remember this globally so it can be used for instant withdrawals

const argv = yargs(hideBin(process.argv)).parse();
const { environment } = argv;

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
      choices: [
        'Deposit',
        'Transfer',
        'Withdraw',
        'Instant-Withdraw',
        'View my wallet',
        'View my pending deposits',
        'View my pending spent',
        'Exit',
      ],
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
      name: 'compressedPkd',
      type: 'input',
      message: "Provide the compressed recipient's transmission key",
      default: nf3.zkpKeys.compressedPkd,
      when: answers => answers.task === 'Transfer',
      validate: input => web3.utils.isHexStrict(input),
    },
    {
      name: 'fee',
      type: 'input',
      message: 'What fee do you wish to pay (Wei)?',
      default: 10,
      validate: input => input >= 0,
      when: answers =>
        answers.task === 'Deposit' ||
        answers.task === 'Transfer' ||
        answers.task === 'Withdraw' ||
        answers.task === 'Instant-Withdraw',
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
      message: 'How many tokens are you transacting (in Eth)?',
      default: 10,
      type: 'input',
      when: answers => answers.tokenType === 'ERC20' || answers.tokenType === 'ERC1155',
      validate: input => input > 0,
    },
    {
      name: 'tokenId',
      message: 'What is the ID of your token?',
      type: 'input',
      when: answers => answers.tokenType === 'ERC721' || answers.tokenType === 'ERC1155',
    },
    {
      name: 'withdrawTransactionHash',
      message: 'What is the hash of the transaction you want an instant withdrawal for?',
      default: 'last withdraw',
      type: 'input',
      validate: input => web3.utils.isHexStrict(input) || input === 'last withdraw',
      when: answers => answers.task === 'Instant-Withdraw',
    },
    {
      name: 'offchain',
      message: 'Do you want to post the transaction on-chain or send it directly to a Proposer?',
      type: 'list',
      choices: ['on-chain', 'direct'],
      when: answers => answers.task === 'Transfer' || answers.task === 'Withdraw',
      filter: input => input !== 'on-chain',
    },
  ];
  return inquirer.prompt(questions);
}

/**
Simple function to print out the balances object
*/
function printBalances(balances, type) {
  console.log(`${type} BALANCES ${balances}`);
  if (Object.keys(balances).length === 0) {
    console.log('You have no balances yet - try depositing some tokens into Layer 2 from Layer 1');
    return;
  }
  // eslint-disable-next-line guard-for-in
  for (const compressedPkd in balances) {
    const table = new Table({ head: ['ERC Contract Address', `${type} Layer 2 Balance`] });
    Object.keys(balances[compressedPkd]).forEach(ercAddress =>
      table.push({ [ercAddress]: balances[compressedPkd][ercAddress][0] }),
    );
    console.log(chalk.yellow(`${type} Balances of user ${compressedPkd}`));
    console.log(table.toString());
  }
}

/**
UI control loop
*/
async function loop(nf3, ercAddress) {
  let receiptPromise;
  const {
    task,
    recipientAddress,
    fee,
    tokenType,
    value = 0,
    tokenId = '0x00',
    privateKey,
    compressedPkd,
    withdrawTransactionHash,
    offchain,
  } = await askQuestions(nf3);
  if (privateKey) {
    await nf3.setEthereumSigningKey(privateKey); // we'll remember the key so we don't keep asking for it
    nf3.addPeer('http://optimist1:80'); // add a Proposer for direct transfers and withdraws
  }
  // handle the task that the user has asked for
  switch (task) {
    case 'Deposit': {
      const valueWei = toBaseUnit(
        value.toString(),
        await getDecimals(ercAddress[tokenType], tokenType, web3),
      );
      receiptPromise = nf3.deposit(ercAddress[tokenType], tokenType, valueWei, tokenId, fee);
      break;
    }
    case 'Transfer': {
      const valueWei = toBaseUnit(
        value.toString(),
        await getDecimals(ercAddress[tokenType], tokenType, web3),
      );
      try {
        receiptPromise = nf3.transfer(
          offchain,
          ercAddress[tokenType],
          tokenType,
          valueWei,
          tokenId,
          compressedPkd,
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
    }
    case 'Withdraw': {
      const valueWei = toBaseUnit(
        value.toString(),
        await getDecimals(ercAddress[tokenType], tokenType, web3),
      );
      try {
        receiptPromise = nf3.withdraw(
          offchain,
          ercAddress[tokenType],
          tokenType,
          valueWei,
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
    }
    case 'Instant-Withdraw':
      try {
        await receiptPromise; // we want the other transactions to complete before we try this
        latestWithdrawTransactionHash = nf3.getLatestWithdrawHash();
        receiptPromise = nf3.requestInstantWithdrawal(
          withdrawTransactionHash === 'last withdraw'
            ? latestWithdrawTransactionHash
            : withdrawTransactionHash,
          fee,
        );
      } catch (err) {
        console.log('Instant withdrawal failed. The server reported', err.response.data);
      }
      break;
    case 'View my wallet':
      printBalances(await nf3.getLayer2Balances(), '');
      return [false, null];
    case 'View my pending deposits':
      printBalances(await nf3.getLayer2PendingDepositBalances(), 'Pending Deposit');
      return [false, null];
    case 'View my pending spent':
      printBalances(await nf3.getLayer2PendingSpentBalances(), 'Pending Spent');
      return [false, null];
    case 'Exit':
      return [true, null];
    default:
      throw new Error('Unknown task');
  }
  return [false, receiptPromise];
}

async function main(testEnvironment) {
  // intialisation
  init();
  if (typeof testEnvironment !== 'undefined') {
    setEnvironment(testEnvironment);
  } else {
    setEnvironment('Localhost');
  }
  const nf3Env = getCurrentEnvironment().currentEnvironment;
  const nf3 = new Nf3(nf3Env.web3WsUrl, '', nf3Env);
  const mnemonic = generateMnemonic();
  await nf3.init(mnemonic);
  const erc20Address = await nf3.getContractAddress('ERC20Mock');
  const erc721Address = await nf3.getContractAddress('ERC721Mock');
  const erc1155Address = await nf3.getContractAddress('ERC1155Mock');
  const ercAddress = {
    ERC20: erc20Address,
    ERC721: erc721Address,
    ERC1155: erc1155Address,
  };
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

main(environment);
