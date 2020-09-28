/**
 * This module contains the logic needed to interact with the FTokenShield contract,
 * specifically handling the mint, transfer, simpleBatchTransfer, and burn functions for fungible commitments.
 *
 * @module erc721.js
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor
 */
const contract = require('truffle-contract');
const zokrates = require('@eyblockchain/zokrates.js');
const fs = require('fs');
const config = require('./config');
const merkleTree = require('./merkleTree');
const utils = require('./utils');
const logger = require('./logger');
const Element = require('./Element');
const Web3 = require('./provider');
const erc721Interface = require('./contracts/ERC721Interface.json');

/**
 * Mint a commitment
 * @param {string} tokenId - Token's unique ID
 * @param {string} zkpPublicKey - ZKP public key, see README for more info
 * @param {string} salt - Alice's token serial number as a hex string
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.nfTokenShieldJson - ABI of nfTokenShield
 * @param {String} blockchainOptions.nfTokenShieldAddress - Address of deployed nfTokenShieldContract
 * @param {String} blockchainOptions.erc721Address - Address of ERC721 contract
 * @param {String} blockchainOptions.account - Account that is sending these transactions
 * @param {Object} zokratesOptions
 * @param {String} zokratesOptions.codePath - Location of compiled code (without the .code suffix)
 * @param {String} [zokratesOptions.outputDirectory=./] - Directory to output all generated files
 * @param {String} [zokratesOptions.witnessName=witness] - Name of witness file
 * @param {String} [zokratesOptions.pkPath] - Location of the proving key file
 * @param {Boolean} zokratesOptions.createProofJson - Whether or not to create a proof.json file
 * @param {String} [zokratesOptions.proofName=proof.json] - Name of generated proof JSON.
 * @returns {String} commitment
 * @returns {Number} commitmentIndex - the index of the token within the Merkle Tree.  This is required for later transfers/joins so that Alice knows which 'chunks' of the Merkle Tree she needs to 'get' from the NFTokenShield contract in order to calculate a path.
 */
async function mint(tokenId, zkpPublicKey, salt, blockchainOptions, zokratesOptions) {
  const { nfTokenShieldJson, nfTokenShieldAddress, erc721Address } = blockchainOptions;
  const erc721AddressPadded = `0x${utils.strip0x(erc721Address).padStart(64, '0')}`;
  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  const nfTokenShield = contract(nfTokenShieldJson);
  nfTokenShield.setProvider(Web3.connect());
  const nfTokenShieldInstance = await nfTokenShield.at(nfTokenShieldAddress);

  logger.debug('\nIN MINT...');

  // Calculate new arguments for the proof:
  const commitment = utils.shaHash(
    erc721AddressPadded,
    utils.strip0x(tokenId).slice(-32 * 2),
    zkpPublicKey,
    salt,
  );

  // Summarize values in the console:
  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE; // packing size in bits
  const pt = Math.ceil((config.LEAF_HASHLENGTH * 8) / config.ZOKRATES_PACKING_SIZE); // packets in bits
  logger.debug(
    'contractAddress:',
    erc721AddressPadded,
    ' : ',
    utils.hexToFieldPreserve(erc721AddressPadded, 248, pt),
  );
  logger.debug('tokenId:', tokenId, ' : ', utils.hexToFieldPreserve(tokenId, p, pt));
  logger.debug(
    'ownerPublicKey:',
    zkpPublicKey,
    ' : ',
    utils.hexToFieldPreserve(zkpPublicKey, p, pt),
  );
  logger.debug('salt:', salt, ' : ', utils.hexToFieldPreserve(salt, p, pt));

  logger.debug('New Proof Variables:');
  logger.debug('commitment:', commitment, ' : ', utils.hexToFieldPreserve(commitment, p, pt));

  const publicInputHash = utils.shaHash(erc721AddressPadded, tokenId, commitment);
  logger.debug('publicInputHash:', publicInputHash);

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc721AddressPadded, 'field', 248, 1),
    new Element(tokenId, 'field'),
    new Element(zkpPublicKey, 'field'),
    new Element(salt, 'field'),
    new Element(commitment, 'field'),
  ]);

  await zokrates.computeWitness(codePath, outputDirectory, witnessName, allInputs);

  await zokrates.generateProof(pkPath, codePath, `${outputDirectory}/witness`, provingScheme, {
    createFile: createProofJson,
    directory: outputDirectory,
    fileName: proofName,
  });

  let { proof } = JSON.parse(fs.readFileSync(`${outputDirectory}/${proofName}`));

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  logger.debug('Getting ERC721 contract instance');
  // Getting the ERC721 contract instance.
  const nfToken = contract(erc721Interface);
  nfToken.setProvider(Web3.connect());
  const nfTokenInstance = await nfToken.at(erc721Address);

  await nfTokenInstance.approve(nfTokenShieldAddress, tokenId, {
    from: account,
    gas: 4000000,
  });

  logger.debug('Minting within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('public inputs:');
  logger.debug(publicInputs);

  // Mint the commitment
  const txReceipt = await nfTokenShieldInstance.mint(
    erc721AddressPadded,
    proof,
    publicInputs,
    tokenId,
    commitment,
    {
      from: account,
      gas: 6500000,
      gasPrice: config.GASPRICE,
    },
  );
  utils.gasUsedStats(txReceipt, 'mint');

  const newLeafLog = txReceipt.logs.filter(log => {
    return log.event === 'NewLeaf';
  });
  const commitmentIndex = newLeafLog[0].args.leafIndex;
  logger.debug('root in solidity:', newLeafLog[0].args.root);
  logger.debug('Mint output: [z_A, z_A_index]:', commitment, commitmentIndex.toString());
  logger.debug('MINT COMPLETE\n');

  return { commitment, commitmentIndex };
}

/**
 * This function actually transfers a token, assuming that we have a proof.
 * @param {String} tokenId - the token's unique id (this is a full 256 bits)
 * @param {String} receiverZkpPublicKey
 * @param {String} originalCommitmentSalt
 * @param {String} newCommitmentSalt
 * @param {String} senderZkpPrivateKey
 * @param {String} commitment - Commitment of token being sent
 * @param {Integer} commitmentIndex - the position of commitment in the on-chain Merkle Tree
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.erc721Address - Address of ERC721 contract
 * @param {String} blockchainOptions.nfTokenShieldJson - ABI of nfTokenShield
 * @param {String} blockchainOptions.nfTokenShieldAddress - Address of deployed nfTokenShieldContract
 * @param {String} blockchainOptions.account - Account that is sending these transactions
 * @returns {String} outputCommitment - New commitment
 * @returns {Number} outputCommitmentIndex - the index of the token within the Merkle Tree.  This is required for later transfers/joins so that Alice knows which 'chunks' of the Merkle Tree she needs to 'get' from the NFTokenShield contract in order to calculate a path.
 * @returns {Object} txReceipt - a promise of a blockchain transaction
 */
async function transfer(
  tokenId,
  receiverZkpPublicKey,
  originalCommitmentSalt,
  newCommitmentSalt,
  senderZkpPrivateKey,
  commitment,
  commitmentIndex,
  blockchainOptions,
  zokratesOptions,
) {
  const { nfTokenShieldJson, nfTokenShieldAddress, erc721Address } = blockchainOptions;
  const erc721AddressPadded = `0x${utils.strip0x(erc721Address).padStart(64, '0')}`;
  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  logger.debug('\nIN TRANSFER...');

  const nfTokenShield = contract(nfTokenShieldJson);
  nfTokenShield.setProvider(Web3.connect());
  const nfTokenShieldInstance = await nfTokenShield.at(nfTokenShieldAddress);

  // Calculate new arguments for the proof:
  const nullifier = utils.shaHash(originalCommitmentSalt, senderZkpPrivateKey);
  const outputCommitment = utils.shaHash(
    erc721AddressPadded,
    utils.strip0x(tokenId).slice(-config.LEAF_HASHLENGTH * 2),
    receiverZkpPublicKey,
    newCommitmentSalt,
  );

  // Get the sibling-path from the token commitment (leaf) to the root. Express each node as an Element class.
  const siblingPath = await merkleTree.getSiblingPath(
    account,
    nfTokenShieldInstance,
    commitment,
    commitmentIndex,
  );

  const root = siblingPath[0];
  // TODO: checkRoot() is not essential. It's only useful for debugging as we make iterative improvements to nightfall's zokrates files. Possibly delete in future.
  merkleTree.checkRoot(commitment, commitmentIndex, siblingPath, root);

  const siblingPathElements = siblingPath.map(
    nodeValue => new Element(nodeValue, 'field', config.NODE_HASHLENGTH * 8, 1),
  ); // we truncate to 216 bits - sending the whole 256 bits will overflow the prime field

  // Summarise values in the console:
  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE;
  const pt = Math.ceil((config.LEAF_HASHLENGTH * 8) / config.ZOKRATES_PACKING_SIZE);
  logger.debug(
    'contractAddress:',
    erc721AddressPadded,
    ' : ',
    utils.hexToFieldPreserve(erc721AddressPadded, 248, pt),
  );
  logger.debug('tokenId: ', tokenId, ' : ', utils.hexToFieldPreserve(tokenId, p, pt));
  logger.debug(
    'originalCommitmentSalt:',
    originalCommitmentSalt,
    ' : ',
    utils.hexToFieldPreserve(originalCommitmentSalt, p, pt),
  );
  logger.debug(
    'newCommitmentSalt:',
    newCommitmentSalt,
    ':',
    utils.hexToFieldPreserve(newCommitmentSalt, p, pt),
  );
  logger.debug(
    'senderSecretKey:',
    senderZkpPrivateKey,
    ':',
    utils.hexToFieldPreserve(senderZkpPrivateKey, p, pt),
  );
  logger.debug(
    'receiverPublicKey:',
    receiverZkpPublicKey,
    ':',
    utils.hexToFieldPreserve(receiverZkpPublicKey, p, pt),
  );
  logger.debug('inputCommitment:', commitment, ':', utils.hexToFieldPreserve(commitment, p, pt));

  logger.debug('New Proof Variables:');
  logger.debug('nullifier:', nullifier, ':', utils.hexToFieldPreserve(nullifier, p, pt));
  logger.debug(
    'outputCommitment:',
    outputCommitment,
    ':',
    utils.hexToFieldPreserve(outputCommitment, p, pt),
  );
  logger.debug('root:', root, ':', utils.hexToFieldPreserve(root, p));
  logger.debug(`siblingPath:`, siblingPath);
  logger.debug(`commitmentIndex:`, commitmentIndex);

  const publicInputHash = utils.shaHash(root, nullifier, outputCommitment);
  logger.debug('publicInputHash:', publicInputHash);

  const rootElement =
    process.env.HASH_TYPE === 'mimc'
      ? new Element(root, 'field', 256, 1)
      : new Element(root, 'field', 128, 2);

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc721AddressPadded, 'field', 248, 1),
    new Element(tokenId, 'field'),
    ...siblingPathElements.slice(1),
    new Element(commitmentIndex, 'field', 128, 1), // the binary decomposition of a leafIndex gives its path's 'left-right' positions up the tree. The decomposition is done inside the circuit.
    new Element(nullifier, 'field'),
    new Element(receiverZkpPublicKey, 'field'),
    new Element(originalCommitmentSalt, 'field'),
    new Element(newCommitmentSalt, 'field'),
    new Element(senderZkpPrivateKey, 'field'),
    rootElement,
    new Element(outputCommitment, 'field'),
  ]);

  await zokrates.computeWitness(codePath, outputDirectory, witnessName, allInputs);

  await zokrates.generateProof(pkPath, codePath, `${outputDirectory}/witness`, provingScheme, {
    createFile: createProofJson,
    directory: outputDirectory,
    fileName: proofName,
  });

  let { proof } = JSON.parse(fs.readFileSync(`${outputDirectory}/${proofName}`));

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  logger.debug('Transferring within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('publicInputs:');
  logger.debug(publicInputs);

  const txReceipt = await nfTokenShieldInstance.transfer(
    proof,
    publicInputs,
    root,
    nullifier,
    outputCommitment,
    {
      from: account,
      gas: 6500000,
      gasPrice: config.GASPRICE,
    },
  );
  utils.gasUsedStats(txReceipt, 'transfer');

  const newLeafLog = txReceipt.logs.filter(log => {
    return log.event === 'NewLeaf';
  });
  const outputCommitmentIndex = newLeafLog[0].args.leafIndex;

  logger.debug('TRANSFER COMPLETE\n');

  return {
    outputCommitment,
    outputCommitmentIndex,
    txReceipt,
  };
}

/**
 * Burns a commitment and returns the token balance to blockchainOptions.tokenReceiver
 * @param {String} tokenId - ID of token
 * @param {String} receiverZkpPrivateKey
 * @param {String} salt - salt of token
 * @param {String} commitment
 * @param {String} commitmentIndex
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.erc721Address - Address of ERC721 contract
 * @param {String} blockchainOptions.nfTokenShieldJson - ABI of nfTokenShield
 * @param {String} blockchainOptions.nfTokenShieldAddress - Address of deployed nfTokenShieldContract
 * @param {String} blockchainOptions.account - Account that is sending these transactions
 */
async function burn(
  tokenId,
  receiverZkpPrivateKey,
  salt,
  commitment,
  commitmentIndex,
  blockchainOptions,
  zokratesOptions,
) {
  const {
    nfTokenShieldJson,
    nfTokenShieldAddress,
    erc721Address,
    tokenReceiver: payTo,
  } = blockchainOptions;
  const erc721AddressPadded = `0x${utils.strip0x(erc721Address).padStart(64, '0')}`;

  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  const nfTokenShield = contract(nfTokenShieldJson);
  nfTokenShield.setProvider(Web3.connect());
  const nfTokenShieldInstance = await nfTokenShield.at(nfTokenShieldAddress);

  const payToOrDefault = payTo || account; // have the option to pay out to another address
  logger.debug('\nIN BURN...');

  // Calculate new arguments for the proof:
  const nullifier = utils.shaHash(salt, receiverZkpPrivateKey);

  // Get the sibling-path from the token commitment (leaf) to the root. Express each node as an Element class.
  const siblingPath = await merkleTree.getSiblingPath(
    account,
    nfTokenShieldInstance,
    commitment,
    commitmentIndex,
  );

  const root = siblingPath[0];
  merkleTree.checkRoot(commitment, commitmentIndex, siblingPath, root);

  const siblingPathElements = siblingPath.map(
    nodeValue => new Element(nodeValue, 'field', config.NODE_HASHLENGTH * 8, 1),
  ); // we truncate to 216 bits - sending the whole 256 bits will overflow the prime field
  const commitmentIndexElement = new Element(commitmentIndex, 'field', 128, 1); // the binary decomposition of a leafIndex gives its path's 'left-right' positions up the tree. The decomposition is done inside the circuit.

  // Summarise values in the console:
  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE;
  const pt = Math.ceil((config.LEAF_HASHLENGTH * 8) / config.ZOKRATES_PACKING_SIZE);
  logger.debug(
    'erc721AddressPadded:',
    erc721AddressPadded,
    ' : ',
    utils.hexToFieldPreserve(erc721AddressPadded, p, pt),
  );
  logger.debug(`tokenId: ${tokenId} : ${utils.hexToFieldPreserve(tokenId, p, pt)}`);
  logger.debug(
    `secretKey: ${receiverZkpPrivateKey} : ${utils.hexToFieldPreserve(
      receiverZkpPrivateKey,
      p,
      pt,
    )}`,
  );
  logger.debug(`salt: ${salt} : ${utils.hexToFieldPreserve(salt, p, pt)}`);
  logger.debug(`commitment: ${commitment} : ${utils.hexToFieldPreserve(commitment, p, pt)}`);
  logger.debug(`payTo: ${payToOrDefault}`);
  // left-pad the payToAddress with 0's to fill all 256 bits (64 octets) (so the sha256 function is hashing the same thing as inside the zokrates proof)
  const payToLeftPadded = utils.leftPadHex(payToOrDefault, config.LEAF_HASHLENGTH * 2);
  logger.debug(`payToLeftPadded: ${payToLeftPadded}`);

  logger.debug('New Proof Variables:');
  logger.debug(`nullifier: ${nullifier} : ${utils.hexToFieldPreserve(nullifier, p, pt)}`);
  logger.debug(`root: ${root} : ${utils.hexToFieldPreserve(root, p, pt)}`);
  logger.debug(`siblingPath:`, siblingPath);
  logger.debug(`commitmentIndexElement:`, commitmentIndexElement);

  // Using padded version of erc721 and payTo to match the publicInputHash
  const publicInputHash = utils.shaHash(
    erc721AddressPadded,
    root,
    nullifier,
    tokenId,
    payToLeftPadded,
  );
  logger.debug('publicInputHash:', publicInputHash);

  const rootElement =
    process.env.HASH_TYPE === 'mimc'
      ? new Element(root, 'field', 256, 1)
      : new Element(root, 'field', 128, 2);

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc721AddressPadded, 'field', 248, 1),
    new Element(payTo, 'field'),
    new Element(tokenId, 'field'),
    new Element(receiverZkpPrivateKey, 'field'),
    new Element(salt, 'field'),
    ...siblingPathElements.slice(1),
    commitmentIndexElement,
    new Element(nullifier, 'field'),
    rootElement,
  ]);

  await zokrates.computeWitness(codePath, outputDirectory, witnessName, allInputs);

  await zokrates.generateProof(pkPath, codePath, `${outputDirectory}/witness`, provingScheme, {
    createFile: createProofJson,
    directory: outputDirectory,
    fileName: proofName,
  });

  let { proof } = JSON.parse(fs.readFileSync(`${outputDirectory}/${proofName}`));

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  logger.debug('Burning within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('publicInputs:');
  logger.debug(publicInputs);

  // Burns commitment and returns token to payTo
  const txReceipt = await nfTokenShieldInstance.burn(
    erc721AddressPadded,
    proof,
    publicInputs,
    root,
    nullifier,
    tokenId,
    payTo,
    {
      from: account,
      gas: 6500000,
      gasPrice: config.GASPRICE,
    },
  );
  utils.gasUsedStats(txReceipt, 'burn');

  logger.debug('BURN COMPLETE\n');

  return { txReceipt };
}

module.exports = {
  mint,
  transfer,
  burn,
};
