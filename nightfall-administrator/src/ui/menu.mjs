/**
This module contains the UI components that are presented to the user so that they
can interact with the admin application.
*/
import config from 'config';
import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import Web3 from 'web3';
import { getTokenNames } from '../services/helpers.mjs';

const web3 = new Web3();
const { MULTISIG } = config;
const { APPROVERS } = MULTISIG;
/**
Initialises the CLI
*/
export function initUI() {
  clear();
  console.log(
    chalk.green(
      figlet.textSync('Nightfall_3 Admin', {
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
export async function askQuestions(approved) {
  const questions = [
    {
      name: 'workflow',
      type: 'list',
      message: 'Add an existing signed transaction or create a new one?',
      choices: ['add', 'create', 'get nonce'],
      when: () => !approved,
    },
    {
      name: 'ethereumSigningKey',
      type: 'input',
      message:
        'Please provide the Approver signing key in hex format (0x...), return to find existing transactions',
      validate: input =>
        !input || APPROVERS.includes(web3.eth.accounts.privateKeyToAccount(input).address),
      when: answers => !approved && answers.workflow === 'create',
    },
    {
      name: 'executorAddress',
      type: 'input',
      message: 'Please provide the address of the multisig executor',
      validate: input => web3.utils.isAddress(input),
      when: answers => !approved && answers.workflow === 'create',
    },
    {
      name: 'nonce',
      type: 'input',
      message:
        'Please provide the nonce for the multisig transaction (return to read from blockchain)',
      validate: input => (Number.isInteger(Number(input)) && Number(input) >= 0) || !input,
      when: answers => !approved && answers.workflow === 'create',
    },
    {
      name: 'task',
      type: 'list',
      message: 'What would you like to do?',
      choices: [
        'Get token restrictions',
        'Set token restrictions',
        'Remove token restrictions',
        'Pause contracts',
        'Unpause contracts',
        'Transfer ownership',
        'Set new boot proposer',
        'Set new boot challenger',
        'Add whitelist manager',
        'Remove whitelist manager',
        'Enable whitelisting',
        'Disable whitelisting',
        'Check if address is a whitelist manager',
      ],
      get pageSize() {
        return this.choices.length;
      },
      when: answers => !approved && answers.workflow === 'create',
    },
    {
      name: 'managerAddress',
      type: 'input',
      message: 'Please provide the address of the manager',
      when: answers =>
        [
          'Add whitelist manager',
          'Remove whitelist manager',
          'Check if address is a whitelist manager',
        ].includes(answers.task),
      validate: input => web3.utils.isAddress(input),
    },
    {
      name: 'managerGroupId',
      type: 'input',
      message: 'Please provide the group Id of the manager',
      when: answers => answers.task === 'Add whitelist manager',
      validate: input => Number.isInteger(Number(input)) && Number(input) > 0,
    },
    {
      name: 'tokenName',
      type: 'list',
      get choices() {
        return getTokenNames();
      },
      message: 'Choose a token:',
      when: answers =>
        ['Get token restrictions', 'Set token restrictions', 'Remove token restrictions'].includes(
          answers.task,
        ),
    },
    {
      name: 'depositRestriction',
      type: 'input',
      message: 'Please provide the deposit restriction in base units (ignoring decimalisation)',
      when: answers => answers.task === 'Set token restrictions',
      validate: input => Number.isInteger(Number(input)) && Number(input) > 0,
    },
    {
      name: 'withdrawRestriction',
      type: 'input',
      message: 'Please provide the withdraw restriction in base units (ignoring decimalisation)',
      when: answers => answers.task === 'Set token restrictions',
      validate: input => Number.isInteger(Number(input)) && Number(input) > 0,
    },
    {
      name: 'amount',
      type: 'input',
      message:
        'Please provide the amount in base units, ignoring decimalisation (0 to transfer everything)',
      when: answers => answers.task === 'Transfer Shield contract balance' && answers.tokenName,
      validate: input => Number.isInteger(Number(input)),
    },
    {
      name: 'newEthereumSigningKey',
      type: 'input',
      message: 'Please provide the new PRIVATE key',
      validate: input => web3.utils.isHexStrict(input),
      when: answers =>
        ['Transfer ownership', 'Set new boot proposer', 'Set new boot challenger'].includes(
          answers.task,
        ),
    },
    {
      name: 'executor',
      type: 'input',
      message: 'Please provide the Executor signing key in hex format (0x...)',
      validate: input => web3.utils.isHexStrict(input),
      when: () => !!approved,
    },
    {
      name: 'signedTx',
      type: 'input',
      message: 'Paste the signed transaction(s) here',
      when: answers => answers.workflow === 'add',
    },
  ];
  return inquirer.prompt(questions);
}
