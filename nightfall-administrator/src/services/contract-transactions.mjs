import config from 'config';
import { waitForContract, web3 } from '../../../common-files/utils/contract.mjs';
import logger from '../../../common-files/utils/logger.mjs';
import { queueTransaction, getTokenAddress } from './helpers.mjs';

const { RESTRICTIONS, SHIELD_CONTRACT_NAME } = config;
const pausables = ['State', 'Shield'];

/**
This function sets the restriction data that the Shield contract is currently using
*/
export async function setTokenRestrictions(
  tokenName,
  depositRestriction,
  withdrawRestriction,
  signingKey,
) {
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      const data = shieldContractInstance.methods
        .setRestriction(token.address, depositRestriction, withdrawRestriction)
        .encodeABI();
      queueTransaction(data, signingKey, shieldContractInstance.options.address);
    }
  }
}

export async function removeTokenRestrictions(tokenName, signingKey) {
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      const data = shieldContractInstance.methods.removeRestriction(token.address).encodeABI();
      queueTransaction(data, signingKey, shieldContractInstance.options.address);
    }
  }
}

export function pauseContracts(signingKey) {
  logger.info('All pausable contracts being paused');
  return Promise.all(
    pausables.map(async pausable => {
      const contractInstance = await waitForContract(pausable);
      const data = contractInstance.methods.pause().encodeABI();
      return queueTransaction(data, signingKey, contractInstance.options.address);
    }),
  );
}

export function unpauseContracts(signingKey) {
  logger.info('All pausable contracts being unpaused');
  return Promise.all(
    pausables.map(async pausable => {
      const contractInstance = await waitForContract(pausable);
      const data = contractInstance.methods.unpause().encodeABI();
      return queueTransaction(data, signingKey, contractInstance.options.address);
    }),
  );
}

export async function transferShieldBalance(tokenName, amount, signingKey) {
  const tokenAddress = getTokenAddress(tokenName);
  if (tokenAddress === 'unknown') throw new Error('Unknown token name');
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods
    .transferShieldBalance(tokenAddress, amount)
    .encodeABI();
  return queueTransaction(data, signingKey, shieldContractInstance.options.address);
}

export function transferOwnership(newOwnerPrivateKey, signingKey) {
  const newOwner = web3.eth.accounts.privateKeyToAccount(newOwnerPrivateKey, true).address;
  return Promise.all(
    pausables.map(async pausable => {
      const contractInstance = await waitForContract(pausable);
      const data = contractInstance.methods.transferOwnership(newOwner).encodeABI();
      return queueTransaction(data, signingKey, contractInstance.options.address);
    }),
  );
}

export async function setBootProposer(newProposerPrivateKey, signingKey) {
  const newProposer = web3.eth.accounts.privateKeyToAccount(newProposerPrivateKey, true).address;
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.setBootProposer(newProposer).encodeABI();
  return queueTransaction(data, signingKey, shieldContractInstance.options.address);
}

export async function setBootChallenger(newChallengerPrivateKey, signingKey) {
  const newChallenger = web3.eth.accounts.privateKeyToAccount(
    newChallengerPrivateKey,
    true,
  ).address;
  console.log('BOOT CHALLENGER', newChallenger);
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.setBootChallenger(newChallenger).encodeABI();
  return queueTransaction(data, signingKey, shieldContractInstance.options.address);
}
