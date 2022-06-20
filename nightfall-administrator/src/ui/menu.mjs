/**
This module contains the UI components that are presented to the user so that they
can interact with the admin application.
*/
import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import Web3 from 'web3';
import { getTokenNames } from '../services/helpers.mjs';

const web3 = new Web3();
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
export async function askQuestions(ethereumSigningKey) {
  const questions = [
    {
      name: 'privateKey',
      type: 'input',
      message: 'Please provide the Admin signing key in hex format (0x...). Return to exit',
      validate: input => web3.utils.isHexStrict(input) || !input,
      when: () => !ethereumSigningKey,
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
        'Transfer Shield contract balance',
        'Transfer ownership',
        'Set new boot proposer',
        'Set new boot challenger',
        'Exit',
      ],
      when: answers => !!answers.privateKey || !!ethereumSigningKey,
    },
    {
      name: 'tokenName',
      type: 'list',
      get choices() {
        return getTokenNames();
      },
      message: 'Choose a token:',
      when: answers =>
        [
          'Get token restrictions',
          'Set token restrictions',
          'Transfer Shield contract balance',
          'Remove token restrictions',
        ].includes(answers.task),
    },
    {
      name: 'depositRestriction',
      type: 'input',
      message: 'Please provide the deposit restriction in base units (ignoring decimalisation)',
      when: answers => answers.task === 'Set token restrictions',
      validate: input => Number.isInteger(Number(input)),
    },
    {
      name: 'withdrawRestriction',
      type: 'input',
      message: 'Please provide the withdraw restriction in base units (ignoring decimalisation)',
      when: answers => answers.task === 'Set token restrictions',
      validate: input => Number.isInteger(Number(input)),
    },
    {
      name: 'pause',
      type: 'confirm',
      message: 'Pause contracts?',
      when: answers => answers.task === 'Pause contracts',
    },
    {
      name: 'unpause',
      type: 'confirm',
      message: 'Unpause contracts?',
      when: answers => answers.task === 'Unpause contracts',
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
      name: 'newPrivateKey',
      type: 'input',
      message: 'Please provide the new PRIVATE key',
      validate: input => web3.utils.isHexStrict(input),
      when: answers =>
        ['Transfer ownership', 'Set new boot proposer', 'Set new boot challenger'].includes(
          answers.task,
        ),
    },
  ];
  return inquirer.prompt(questions);
}
