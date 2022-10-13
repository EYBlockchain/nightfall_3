import config from 'config';
import { waitForContract, web3 } from '@polygon-nightfall/common-files/utils/contract.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { addMultiSigSignature, getMultiSigNonce } from './helpers.mjs';

const { RESTRICTIONS } = config;
const { SHIELD_CONTRACT_NAME } = constants;
const pausables = ['State', 'Shield'];
const ownables = ['State', 'Shield', 'Proposers', 'Challenges'];

/**
 This function adds a whitelist manager
 */
export async function createWhitelistManager(
  groupId,
  address,
  signingKey,
  executorAddress,
  _nonce,
) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.createWhitelistManager(groupId, address).encodeABI();
  return Promise.all([
    addMultiSigSignature(
      data,
      signingKey,
      shieldContractInstance.options.address,
      executorAddress,
      nonce,
    ),
  ]);
}

/**
 This function removes a whitelist manager
 */
export async function removeWhitelistManager(address, signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.removeWhitelistManager(address).encodeABI();
  return Promise.all([
    addMultiSigSignature(
      data,
      signingKey,
      shieldContractInstance.options.address,
      executorAddress,
      nonce,
    ),
  ]);
}

/**
 This function enables/disables whitelisting
 */
export async function enableWhitelisting(enable, signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.enableWhitelisting(enable).encodeABI();
  return Promise.all([
    addMultiSigSignature(
      data,
      signingKey,
      shieldContractInstance.options.address,
      executorAddress,
      nonce,
    ),
  ]);
}

/**
This function sets the restriction data that the Shield contract is currently using
*/
export async function setTokenRestrictions(
  tokenName,
  depositRestriction,
  withdrawRestriction,
  signingKey,
  executorAddress,
  _nonce,
) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      const data = shieldContractInstance.methods
        .setRestriction(token.address, depositRestriction, withdrawRestriction)
        .encodeABI();
      return Promise.all([
        addMultiSigSignature(
          data,
          signingKey,
          shieldContractInstance.options.address,
          executorAddress,
          nonce,
        ),
      ]);
    }
  }
  return false;
}

export async function removeTokenRestrictions(tokenName, signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      const data = shieldContractInstance.methods.removeRestriction(token.address).encodeABI();
      return Promise.all([
        addMultiSigSignature(
          data,
          signingKey,
          shieldContractInstance.options.address,
          executorAddress,
          nonce,
        ),
      ]);
    }
  }
  return false;
}

export async function pauseContracts(signingKey, executorAddress, _nonce) {
  logger.info('All pausable contracts being paused');
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  return Promise.all(
    pausables.map(async (pausable, i) => {
      const contractInstance = await waitForContract(pausable);
      const data = contractInstance.methods.pause().encodeABI();
      return addMultiSigSignature(
        data,
        signingKey,
        contractInstance.options.address,
        executorAddress,
        nonce + i,
      );
    }),
  );
}

export async function unpauseContracts(signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  return Promise.all(
    pausables.map(async (pausable, i) => {
      const contractInstance = await waitForContract(pausable);
      const data = contractInstance.methods.unpause().encodeABI();
      return addMultiSigSignature(
        data,
        signingKey,
        contractInstance.options.address,
        executorAddress,
        nonce + i,
      );
    }),
  );
}

export async function transferOwnership(newOwnerPrivateKey, signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const newOwner = web3.eth.accounts.privateKeyToAccount(newOwnerPrivateKey, true).address;
  return Promise.all(
    ownables.map(async (ownable, i) => {
      const contractInstance = await waitForContract(ownable);
      const data = contractInstance.methods.transferOwnership(newOwner).encodeABI();
      return addMultiSigSignature(
        data,
        signingKey,
        contractInstance.options.address,
        executorAddress,
        nonce + i,
      );
    }),
  );
}

export async function setBootProposer(newProposerPrivateKey, signingKey, executorAddress, _nonce) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const newProposer = web3.eth.accounts.privateKeyToAccount(newProposerPrivateKey, true).address;
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.setBootProposer(newProposer).encodeABI();
  return Promise.all([
    addMultiSigSignature(
      data,
      signingKey,
      shieldContractInstance.options.address,
      executorAddress,
      nonce,
    ),
  ]);
}

export async function setBootChallenger(
  newChallengerPrivateKey,
  signingKey,
  executorAddress,
  _nonce,
) {
  let nonce = _nonce;
  if (!Number.isInteger(nonce)) nonce = await getMultiSigNonce();
  const newChallenger = web3.eth.accounts.privateKeyToAccount(
    newChallengerPrivateKey,
    true,
  ).address;

  logger.info({
    msg: 'Boot challenger',
    newChallenger,
  });
  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);
  const data = shieldContractInstance.methods.setBootChallenger(newChallenger).encodeABI();
  return Promise.all([
    addMultiSigSignature(
      data,
      signingKey,
      shieldContractInstance.options.address,
      executorAddress,
      nonce,
    ),
  ]);
}
