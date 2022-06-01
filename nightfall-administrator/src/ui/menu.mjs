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
      choices: ['Get token restrictions', 'Set token restrictions', 'Exit'],
      when: answers => !!answers.privateKey,
    },
    {
      name: 'tokenName',
      type: 'list',
      get choices() {
        return getTokenNames();
      },
      message: 'Choose a token:',
      when: answers => answers.task === 'Get token restrictions',
    },
  ];
  return inquirer.prompt(questions);
}
