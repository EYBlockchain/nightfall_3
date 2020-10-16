const request = require('request');
const config = require('../config');
const utilsPoll = require('./utils');
const utils = require('../utils');
const logger = require('../logger');

const url = `${process.env.MERKLE_TREE_HOST}:${process.env.MERKLE_TREE_PORT}`;

/**
Start the event filter in the timber microservice, for the given contract
*/
async function start(contractName) {
  logger.debug(`\nCalling /start(${contractName})`);
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/start`,
      method: 'POST',
      json: true,
      headers: { contractname: contractName },
      // body:, // no body
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body.data);
    });
  });
}

/**
Posts a starts merkle-tree microservice's filter
@returns {false | object} Polling functions MUST return FALSE if the poll is unsuccessful. Otherwise we return the response from the merkle-tree microservice
*/
const startEventFilterPollingFunction = async args => {
  try {
    const { contractName } = args;

    const response = await start(contractName);

    return response;
  } catch (err) {
    logger.debug(
      `Got a polling error "${err}", but that might be because the external server missed our call - we'll poll again...`,
    );
    return false;
  }
};

/**
Get the latestLeaf object from the tree's metadata db.
@param {string} contractName
*/
async function getLatestLeaf(contractName) {
  logger.debug(`\nCalling getLatestLeaf(${contractName})`);
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/metadata/latestLeaf`,
      method: 'GET',
      json: true,
      headers: { contractname: contractName },
      // body:, // no body; uses url param
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body.data);
    });
  });
}

/**
Posts a starts merkle-tree microservice's filter
@returns {false | object} Polling functions MUST return FALSE if the poll is unsuccessful. Otherwise we return the response from the merkle-tree microservice
*/
const getLatestLeafPollingFunction = async args => {
  try {
    const { contractName, blockNumber } = args;
    let latestFilteredBlockNumber = 0;

    const { latestLeaf } = await getLatestLeaf(contractName);

    latestFilteredBlockNumber = latestLeaf.blockNumber;

    if (latestFilteredBlockNumber < blockNumber) {
      logger.debug(
        `\nblockNumber ${blockNumber} has not yet been filtered into the merkle-tree's db`,
      );
      return false; // i.e. poll again until we know the required blockNumber has been filtered.
    }

    logger.debug(`\nThe merkle-tree microservice's filter has reached block ${blockNumber}`);
    return true;
  } catch (err) {
    logger.debug(
      `\nGot a polling error "${err}", but that might be because the external server missed our call - we'll poll again...`,
    );
    return false;
  }
};

/**
Start polling for the latestLeaf object, until we see that a particular blockNumber has been filterex.
@param {string} contractName
*/
async function waitForBlockNumber(contractName, blockNumber) {
  logger.debug(`\nCalling waitForBlockNumber(${contractName}, ${blockNumber})`);
  try {
    // we poll the merkle-tree microservice, because it might not have filtered the blockNumber we want yet:
    // eslint-disable-next-line no-await-in-loop
    await utilsPoll.poll(getLatestLeafPollingFunction, config.POLLING_FREQUENCY, {
      contractName,
      blockNumber,
    }); // eslint-disable-line no-await-in-loop
    return;
  } catch (err) {
    throw new Error(`Could not get the latestLeaf from the merkle-tree microservice`);
  }
}

/**
Get the leaf object for the given leafIndex.
@param {string} contractName
@param {integer} leafIndex
*/
async function getLeafByLeafIndex(contractName, leafIndex) {
  logger.debug(`\nCalling getLeafByLeafIndex(${contractName}, ${leafIndex})`);
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/leaf/index/${leafIndex}`,
      method: 'GET',
      json: true,
      headers: { contractname: contractName },
      // body:, // no body; uses url param
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body.data);
    });
  });
}

/**
Get the nodes on the sibling path from the given leafIndex to the root.
@param {string} contractName
@param {integer} leafIndex
*/
async function getSiblingPathByLeafIndex(contractName, leafIndex) {
  logger.debug(`\nCalling getSiblingPathByLeafIndex(${contractName}, ${leafIndex})`);
  return new Promise((resolve, reject) => {
    const options = {
      url: `${url}/siblingPath/${leafIndex}`,
      method: 'GET',
      json: true,
      headers: { contractname: contractName },
      // body:, // no body; uses url param
    };
    request(options, (err, res, body) => {
      if (err) reject(err);
      else resolve(body.data);
    });
  });
}

/**
Starts the merkle-tree microservice's filter
@param {string} contractName
*/
async function startEventFilter() {
  // State the contracts to start filtering. The merkle-tree's config file states which events to filter for each contract.
  // TODO: move this into the zkp's config file?
  logger.debug(`\nStarting the merkle-tree microservice's event filters...`);

  const contractNames = ['FTokenShield', 'NFTokenShield'];

  await Promise.all(
    contractNames.map(async contractName => {
      try {
        const response = await utilsPoll.poll(
          startEventFilterPollingFunction,
          config.POLLING_FREQUENCY,
          {
            contractName,
          },
        );
        logger.debug(`\nResponse from merkle-tree microservice for ${contractName}:`);
        logger.debug(response);
        return response;
      } catch (err) {
        throw new Error(`Could not start merkle-tree microservice's filter for ${contractName}`);
      }
    }),
  );
}

/**
This function computes the path through a Mekle tree to get from a token
to the root by successive hashing.  This is needed for part of the private input
to proofs that need demonstrate that a token is in a Merkle tree.
It works for any size of Merkle tree, it just needs to know the tree depth, which it gets from config.js
@param {contract} shieldContract - an instance of the shield contract that holds the commitments
@param {string} commitment - the commitment value
@param {integer} commitmentIndex - the leafIndex within the shield contract's merkle tree of the commitment we're getting the sibling path for
@returns {object} containing: an array of strings - where each element of the array is a node of the sister-path of
the path from myToken to the Merkle Root and whether the sister node is to the left or the right (this is needed because the order of hashing matters)
*/
async function getSiblingPath(shieldContract, _commitment, commitmentIndex) {
  // check the commitment's format:
  // logger.debug('commitment', commitment);
  // if (commitment.length !== config.LEAF_HASHLENGTH * 2) {
  //   throw new Error(`commitment has incorrect length: ${commitment}`);
  // }

  const { contractName } = shieldContract.constructor._json; // eslint-disable-line no-underscore-dangle

  // check the database's mongodb aligns with the merkle-tree's mongodb: i.e. check leaf.commitmentIndex === commitment:
  logger.debug('\nChecking leaf...');
  logger.debug('commitment:', _commitment);
  logger.debug('commitmentIndex:', commitmentIndex);
  const leaf = await getLeafByLeafIndex(contractName, commitmentIndex);
  logger.debug('leaf:', leaf);
  if (leaf.value !== _commitment)
    throw new Error(
      `FATAL: The given commitmentIndex ${commitmentIndex} returns different commitment values in the database microservice (${_commitment}) vs the merkle-tree microservice (${leaf.value}).`,
    );

  // get the sibling path for the commitment:
  const siblingPath = await getSiblingPathByLeafIndex(contractName, commitmentIndex).then(result =>
    result.map(node => node.value),
  );

  logger.debug(siblingPath);

  // check the root has been correctly calculated, by cross-referencing with the roots() mapping on-chain:
  logger.debug('\nChecking root...');
  const rootInDb = siblingPath[0];
  logger.debug('rootInDb:', rootInDb);
  const rootOnChain = await shieldContract.roots.call(rootInDb);
  logger.debug('rootOnChain:', rootOnChain);
  if (rootOnChain !== rootInDb)
    throw new Error(
      'FATAL: The root calculated within the merkle-tree microservice does not match any historic on-chain roots.',
    );

  // Check the lengths of the hashes of the path and the sibling-path - they should all be a set length (except the more secure root):

  // // Handle the root separately:
  // siblingPath[0] = utils.strip0x(siblingPath[0]);
  // if (siblingPath[0].length !== 0 && siblingPath[0].length !== config.LEAF_HASHLENGTH * 2)
  //   // the !==0 check is for the very first path calculation
  //   throw new Error(`root has incorrect length: ${siblingPath[0]}`);
  //
  // // Now the rest of the nodes:
  // for (let i = 1; i < siblingPath.length; i += 1) {
  //   siblingPath[i] = utils.strip0x(siblingPath[i]);
  //
  //   if (siblingPath[i].length !== 0 && siblingPath[i].length !== config.NODE_HASHLENGTH * 2)
  //     // the !==0 check is for the very first path calculation
  //     throw new Error(`sibling path node ${i} has incorrect length: ${siblingPath[i]}`);
  // }

  return siblingPath;
}

/**
Paired with checkRoot() - for debugging only
*/
function orderBeforeConcatenation(order, pair) {
  if (parseInt(order, 10) === 0) {
    return pair;
  }
  return pair.reverse();
}

/**
checkRoot - for DEBUGGING only. Helps give detailed logging for each hash up the merkle-tree, so as to better debug zokrates code.
*/
function checkRoot(commitment, commitmentIndex, siblingPath, root) {
  // define Merkle Constants:
  const { TREE_HEIGHT, NODE_HASHLENGTH } = config;

  const truncatedCommitment = commitment.slice(-NODE_HASHLENGTH * 2); // truncate to the desired 216 bits for Merkle Path computations

  const binaryCommitmentIndex = commitmentIndex
    .toString(2) // to binary
    .padStart(TREE_HEIGHT, '0') // pad to correct length
    .split(''); // convert to array for easier iterability

  // logger.debug(`commitment:`, commitment);
  // logger.debug(`truncatedCommitment:`, truncatedCommitment);
  // logger.debug(`commitmentIndex:`, commitmentIndex);
  // logger.debug(`binaryCommitmentIndex:`, binaryCommitmentIndex);
  // logger.debug(`siblingPath:`, siblingPath);
  // logger.debug(`root:`, root);

  const siblingPathTruncated = siblingPath.map(node => `0x${node.slice(-NODE_HASHLENGTH * 2)}`);

  let hash216 = truncatedCommitment;
  let hash256;

  for (let r = TREE_HEIGHT; r > 0; r -= 1) {
    const pair = [hash216, siblingPathTruncated[r]];
    // logger.debug('leftInput pre ordering:', pair[0]);
    // logger.debug('rightInput pre ordering:', pair[1]);
    // logger.debug('left or right?:', binaryCommitmentIndex[r - 1]);
    const orderedPair = orderBeforeConcatenation(binaryCommitmentIndex[r - 1], pair);
    // logger.debug('leftInput:', orderedPair[0]);
    // logger.debug('rightInput:', orderedPair[1]);
    hash256 = utils.concatenateThenHash(...orderedPair);
    // keep the below comments for future debugging:
    // logger.debug(`output pre-slice at row ${r - 1}:`, hash256);
    hash216 = `0x${hash256.slice(-NODE_HASHLENGTH * 2)}`;
    // logger.debug(`output at row ${r - 1}:`, hash216);
  }

  const rootCheck = hash256;

  if (root !== rootCheck) {
    throw new Error(
      `Root ${root} cannot be recalculated from the path and commitment ${commitment}. An attempt to recalculate gives ${rootCheck} as the root.`,
    );
  } else {
    logger.debug(
      `\nRoot ${root} successfully reconciled from first principles using the commitment and its sister-path.`,
    );
  }
}

/**
checks the details of an incoming (newly transferred token), to ensure the data we have received is correct and legitimate!!
*/
async function checkCorrectness(
  contractAddress,
  value,
  publicKey,
  salt,
  commitment,
  commitmentIndex,
  blockNumber,
  shieldContract,
) {
  console.log('Checking h(contractAddress|value|publicKey|salt) = z...');
  const commitmentCheck = utils.concatenateThenHash(
    `0x${utils.strip0x(contractAddress).padStart(64, '0')}`,
    utils.strip0x(value).slice(-(config.LEAF_HASHLENGTH * 2)),
    publicKey,
    salt,
  );

  const zCorrect = commitmentCheck === commitment;
  console.log('commitment:', commitment);
  console.log('commitmentCheck:', commitmentCheck);

  console.log(
    'Checking the commitment exists in the merkle-tree db (and therefore was emitted as an event on-chain)...',
  );
  console.log('commitment:', commitment);
  console.log('commitmentIndex:', commitmentIndex);
  const { contractName } = shieldContract.constructor._json; // eslint-disable-line no-underscore-dangle

  // query the merkle-tree microservice until it's filtered the blockNumber we wish to query:
  await waitForBlockNumber(contractName, blockNumber);

  const leaf = await getLeafByLeafIndex(contractName, commitmentIndex);
  console.log('leaf found:', leaf);
  if (leaf.value !== commitment)
    throw new Error(
      `Could not find commitment ${commitment} at the given commitmentIndex ${commitmentIndex} in  the merkle-tree microservice. Found ${leaf.value} instead.`,
    );

  const zOnchainCorrect = leaf.value === commitment;
  console.log('commitment:', commitment);
  console.log('commitment emmitted by blockchain:', leaf.value);

  return {
    zCorrect,
    zOnchainCorrect,
  };
}

module.exports = {
  startEventFilter,
  waitForBlockNumber,
  getLeafByLeafIndex,
  getSiblingPath,
  getSiblingPathByLeafIndex,
  checkRoot,
  checkCorrectness,
};
