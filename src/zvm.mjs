/**
@module web3 wrapper for ZVM.sol
@author iAmMichaelConnor, MirandaWood
*/

/* eslint-disable camelcase */

import logger from './utils/logger.mjs';
import { stitchLimbs } from './utils/general-number.mjs';
import { getContractInstance } from './utils/contract.mjs';
import Web3 from './utils/web3.mjs';

const web3 = Web3.connection();

export const unlockAccount = async (address, password) => {
  await web3.eth.personal.unlockAccount(address, password, 0);
};

/**
Lookup a nullifier (effectively lets you know whether the nullifer exists on-chain)
@param {String} nullifier - an integer string
@returns {bool}
*/
export const nullifierExists = async nullifier => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.nullifiers(nullifier).call();
  logger.debug(`Looked up nullifiers[${nullifier}] = ${lookup}`);
  return lookup !== 0;
};

/**
Lookup a commitment (effectively lets you know whether the commitment exists on-chain)
@param {String} commitment - an integer string
@returns {bool}
*/
export const commitmentExists = async commitment => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.commitments(commitment).call();
  logger.debug(`Looked up commitments[${commitment}] = ${lookup}`);
  return lookup !== 0;
};

/**
Lookup the latest root of the a Merkle Tree, by treeId
@returns {int}
*/
export const getMerkleTreeRoot = async treeId => {
  const ZVM = await getContractInstance('ZVM');
  let lookup;
  switch (treeId) {
    case 'Commitment':
      lookup = await ZVM.methods.latestCommitmentRoot().call();
      break;
    case 'Vk':
      lookup = await ZVM.methods.latestVKRoot().call();
      break;
    case 'PublicState':
      lookup = await ZVM.methods.latestPublicStateRoot().call();
      break;
    default:
      throw new Error(`treeId ${treeId} not recognised`);
  }
  logger.debug(`Looked up ${treeId} tree root:`, lookup);
  return lookup;
};

/**
Lookup the address of a merkle tree instance, by treeId
@param {string} treeId - Commitment, Vk, or PublicState
@returns {address}
*/
export const getMerkleTreeAddress = async treeId => {
  const ZVM = await getContractInstance('ZVM');
  let lookup;
  switch (treeId) {
    case 'Commitment':
      lookup = await ZVM.methods.commitmentTree().call();
      break;
    case 'Vk':
      lookup = await ZVM.methods.vkTree().call();
      break;
    case 'PublicState':
      lookup = await ZVM.methods.publicStateTree().call();
      break;
    default:
      throw new Error(`treeId ${treeId} not recognised`);
  }
  logger.debug(`Looked up ${treeId} tree's address:`, lookup);
  return lookup;
};

/**
Lookup a private contract (effectively lets you know whether the private contract exists on-chain)
@param {String} privateContractAddress - an integer string
@returns {bool}
*/
export const privateContractExists = async privateContractAddress => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.privateContractAddresses(privateContractAddress).call();
  logger.debug('Looked up private contract address:', lookup);
  return lookup !== 0;
};

/**
- note this is the raw getter
@param {String} privateContractAddress - an integer string
@returns {array} vk
*/
export const getVKIDs = async privateContractAddress => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.getVKIDs(privateContractAddress).call();
  logger.debug(`Looked up vkIDs[address=${privateContractAddress}] =`, lookup);
  return lookup;
};

/**
@param {String} vkID - a uint
@param {String} curveType - enum of ['BLS12_377', 'BW6_761', 'ALTBN128']
@returns {array} vk
*/
export const getVK = async (vkID, curveType = 'BLS12_377') => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.getVK(vkID).call();
  logger.debug(`Looked up vk[vkID=${vkID}] =`, lookup);
  // reconstruct each limb of the vk from 256-bit values:
  let numberOfLimbs;
  switch (curveType) {
    default:
      throw new Error(`invalid curveType '${curveType}'`);
    case 'BLS12_377':
      numberOfLimbs = 2; // 377 over 256-bit limbs
      break;
    case 'BW6_761':
      numberOfLimbs = 3; // 761 over 256-bit limbs
      break;
    case 'ALT_BN_254':
      numberOfLimbs = 1; // 254 over 256-bit limbs
      break;
  }
  const vk = [];
  for (let i = 0; i < lookup.length; i += numberOfLimbs) {
    const coeffLimbs = lookup.slice(i, i + numberOfLimbs);
    const coeff = stitchLimbs(coeffLimbs);
    vk.push(coeff);
  }
  // what we end up with is a vk that is still a flattened array, but each coefficient is now a hex string
  return vk;
};

/**
@param {integer} numIn - the number of inputs commitments that are nullified when this VK's circuit is executed
@param {integer} numOut - the number of inputs commitments that are nullified when this VK's circuit is executed
@returns {array} vk
*/
export const getOuterVK = async (numIn, numOut) => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.getOuterVK(numIn, numOut).call();
  logger.debug(`Looked up vk[numIn=${numIn}, numOut=${numOut}] =`, lookup);
  // reconstruct each limb of the vk from 256-bit values:
  const numberOfLimbs = 3; // bw6-761 values are 761-bits (3 limbs of 256-bits)
  const vk = [];
  for (let i = 0; i < lookup.length; i += numberOfLimbs) {
    const coeffLimbs = lookup.slice(i, i + numberOfLimbs);
    const coeff = stitchLimbs(coeffLimbs);
    vk.push(coeff);
  }
  // what we end up with is a vk that is still a flattened array, but each coefficient is now a hex string
  return vk;
};

/**
Lookup a private contract's public storage data
@param {String} privateContractAddress - the private contract address
@returns {object} result
*/
export const getPublicStorageData = async privateContractAddress => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.getPublicStorageData(privateContractAddress).call();
  logger.debug(`Looked up PublicStorageData[address=${privateContractAddress}] =`, lookup);
  const result = {};
  [
    result.privateContractAddress, //
    result.storageVariables,
    result.storageRoot,
    result.stateLeaf,
  ] = [lookup[0], lookup[1], lookup[2], lookup[3]];
  return result;
};

/**
Get the ZVM's private function data struct
@param {String} vkID - a uint
@returns {array} data
*/
export const getPrivateFunctionData = async vkID => {
  const ZVM = await getContractInstance('ZVM');
  const lookup = await ZVM.methods.getPrivateFunctionData(vkID).call();
  logger.debug(`Looked up PrivateFunctionData[vkID=${vkID}] =`, lookup);
  const result = {};
  [
    result.vkID,
    result.privateContractAddress,
    result.predators,
    result.prey,
    result.extensionContractAddress,
  ] = [lookup[0], lookup[1], lookup[2], lookup[3], lookup[4]];
  return result;
};

/**
Get all private contract data that ZVM.sol holds
@param {String} privateContractAddress - a uint
@returns {object} data
*/
export const getPrivateContractData = async privateContractAddress => {
  const exists = await privateContractExists(privateContractAddress);
  if (!exists) {
    const data = { message: 'private contract address not registered on-chain' };
    return data;
  }

  // FUTURE ENHANCEMENTS: assemble these objects with promise.all, for faster, parallel runtime
  const vkIDs = await getVKIDs(privateContractAddress);
  const vks = {};
  const privateFunctionData = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const vkID of vkIDs) {
    privateFunctionData[vkID] = await getPrivateFunctionData(vkID);
    vks[vkID] = await getVK(vkID);
  }
  const publicStorageData = await getPublicStorageData(privateContractAddress);

  return {
    privateContractAddress,
    vkIDs,
    publicStorageData,
    privateFunctionData,
    vks,
  };
};

/**
Get the commitments in the pending commitment queue
@returns {array} queue
*/
export const getQueue = async () => {
  const ZVM = await getContractInstance('ZVM');
  let queue = [];

  const qStart = await ZVM.methods.qStart().call();
  if (qStart === 0) return queue;

  const qEnd = await ZVM.methods.qEnd().call();
  let commitment = qStart;
  let reachedEnd = false;
  while (!reachedEnd) {
    const { current, next } = await ZVM.methods.getQueueEntry(commitment).call();
    if (current !== commitment) throw new Error('Unexpected queue lookup result');
    if (next === 0) {
      reachedEnd = true;
      if (commitment !== qEnd)
        throw new Error('Expected to reach the end of the queue. Check smart contract for bugs.');
    }
    queue = commitment;
    commitment = next;
  }

  logger.debug('Looked up queue:', queue);
  return queue;
};

/**
 * This function calls the registerVK function of ZVM.sol contract parameters to register a vk against its vkID
 *
 * @param {object} vkID - the vkID to be registered
 * @param {number[]} vk - the vk to be registered as a flattened array
 * @param {string} userAddress - The ethereum address of the user paying for deploying the contract
 */
export const registerVK = async (vkID, vk, userAddress) => {
  const ZVM = await getContractInstance('ZVM');

  logger.info(`Registering VK for vkID ${vkID}`);
  logger.debug('vk', vk);

  const txReceipt = await ZVM.methods
    .registerVK(vkID, vk)
    .send({
      from: userAddress,
      gas: '4000000',
    })
    .on('transactionHash', hash => {
      logger.debug('transactionHash', hash);
    })
    .on('receipt', receipt => {
      logger.debug('receipt', receipt);
      logger.debug('gasUsed', receipt.gasUsed);
      return receipt;
    })
    .on('error', error => {
      throw new Error(error);
    });
  return txReceipt;
};

/**
 * This function calls registerVKZVM function as many times as the number of vks to register
 *
 * @param {string[]} vkIDs - An array of vkIDs
 * @param {string[]} vks - An array of vks to be registered
 * @param {string} userAddress - The ethereum address of the user paying for deploying the contract
 */
export const registerVKs = async (vkIDs, vks, userAddress) => {
  const receipts = await Promise.all(
    // eslint-disable-next-line array-callback-return
    vkIDs.map((vkID, index) => {
      return registerVK(vkID, vks[index], userAddress);
    }),
  );
  return receipts;
};

/**
 * This function calls the registerOuterVK function of ZVM.sol contract parameters to register an outer vk
 *
 * @param {integer} numIn - the number of inputs commitments that are nullified when this VK's circuit is executed
 * @param {integer} numOut - the number of inputs commitments that are nullified when this VK's circuit is executed
 * @param {number[]} vk - the vk to be registered as a flattened array
 * @param {string} userAddress - The ethereum address of the user paying for deploying the contract
 */
export const registerOuterVK = async (numIn, numOut, vk, userAddress) => {
  const ZVM = await getContractInstance('ZVM');

  logger.info(`Registering an outerVK for the in:out permutation ${numIn}:${numOut}`);
  logger.debug('vk', vk);

  const txReceipt = await ZVM.methods
    .registerOuterVK(numIn, numOut, vk)
    .send({
      from: userAddress,
      gas: '4000000',
    })
    .on('transactionHash', hash => {
      logger.debug('transactionHash', hash);
    })
    .on('receipt', receipt => {
      logger.debug('receipt', receipt);
      logger.debug('gasUsed', receipt.gasUsed);
      return receipt;
    })
    .on('error', error => {
      throw new Error(error);
    });
  return txReceipt;
};

/**
 * This function calls the registerPrivateContract function of ZVM.sol
 */
export const registerPrivateContract = async (
  privateContractAddress,
  vkIDs,
  predators,
  prey,
  vkLeaves,
  storageVariables,
  storageRoot,
  stateLeaf,
  extensionContractAddresses,
  vks,
  userAddress,
) => {
  const ZVM = await getContractInstance('ZVM');

  logger.info('Registering private contract in ZVM.sol...');
  logger.debug('privateContractAddress:', privateContractAddress);
  logger.debug('vkIDs:', vkIDs);
  logger.debug('predators:', predators);
  logger.debug('prey:', prey);
  logger.debug('vkLeaves:', vkLeaves);
  logger.debug('storageVariables:', storageVariables);
  logger.debug('storageRoot:', storageRoot);
  logger.debug('stateLeaf:', stateLeaf);
  logger.debug('extensionContractAddresses:', extensionContractAddresses);

  const txReceipt = await ZVM.methods
    .registerPrivateContract(
      privateContractAddress,
      vkIDs,
      predators,
      prey,
      vkLeaves,
      storageVariables,
      storageRoot,
      stateLeaf,
      extensionContractAddresses,
    )
    .send({
      from: userAddress,
      gas: '4000000',
    })
    .on('transactionHash', hash => {
      logger.debug('transactionHash', hash);
    })
    .on('receipt', async receipt => {
      logger.debug('receipt', receipt);
      logger.info('gasUsed', receipt.gasUsed);
      return receipt;
    })
    .on('error', error => {
      throw new Error(error);
    });
  let txReceipts = await registerVKs(vkIDs, vks, userAddress);
  txReceipts = [...txReceipts, txReceipt];
  return txReceipts;
};

/**
@param {array} outerProof
@param {string} outerPublicInputsHash
@param {array} outerNullifiers
@param {array} newOuterCommitments
@param {string} commitmentRoot
@param {string} vkRoot
@param {string} publicStateRoot

@param {string} account - the ethereum address to pay gas for the transaction
*/
export const executePrivateFunction = async (
  outerProof,
  outerPublicInputsHash,
  outerNullifiers,
  newOuterCommitments,
  commitmentRoot,
  vkRoot,
  stateRoot,
  account,
) => {
  logger.debug('executePrivateFunction');
  const ZVM = await getContractInstance('ZVM');
  const txReceipt = await ZVM.methods
    .executePrivateFunction(
      outerProof,
      outerPublicInputsHash,
      outerNullifiers,
      newOuterCommitments,
      commitmentRoot,
      vkRoot,
      stateRoot,
    )
    .send({ from: account, gas: '10000000' })
    .on('receipt', receipt => {
      return receipt;
    })
    .on('error', error => {
      throw new Error(error);
    });
  return txReceipt;
};

/**
@param {array} proof - uint[]
@param {string} publicInputsHash - bytes32

@param {array} newCommitmentRoot - bytes32
@param {string} commitments - bytes32[]

@param {string} account - the ethereum address to pay gas for the transaction
*/
export const updateCommitmentRoot = async (
  proof,
  publicInputsHash,
  newCommitmentRoot,
  commitments,
  account,
) => {
  logger.debug('updateCommitmentRoot');
  const ZVM = await getContractInstance('ZVM');
  const txReceipt = await ZVM.methods
    .updateCommitmentRoot(proof, publicInputsHash, newCommitmentRoot, commitments)
    .send({ from: account, gas: '8000000' })
    .on('receipt', receipt => {
      return receipt;
    })
    .on('error', error => {
      throw new Error(error);
    });
  return txReceipt;
};

export default { getPrivateContractData };
