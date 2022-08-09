/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
An optimistic Transaction class
*/
import gen from 'general-number';
import Web3 from '../utils/web3.mjs';
import { compressProof } from '../utils/curve-maths/curves.mjs';
import constants from '../constants/index.mjs';

const { generalise } = gen;

const TOKEN_TYPES = { ERC20: 0, ERC721: 1, ERC1155: 2 };
const { TRANSACTION_TYPES } = constants;

const arrayEquality = (as, bs) => {
  if (as.length === bs.length) {
    return as.every(a => bs.includes(a));
  }
  return false;
};

// function to compute the keccak hash of a transaction
function keccak(preimage) {
  const web3 = Web3.connection();
  const {
    value,
    fee,
    historicRootBlockNumberL2,
    historicRootBlockNumberL2Fee,
    transactionType,
    tokenType,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    commitmentFee,
    nullifiersFee,
    compressedSecrets,
  } = preimage;
  let { proof } = preimage;
  proof = arrayEquality(proof, [0, 0, 0, 0, 0, 0, 0, 0]) ? [0, 0, 0, 0] : compressProof(proof);
  const transaction = [
    value,
    fee,
    historicRootBlockNumberL2,
    historicRootBlockNumberL2Fee,
    transactionType,
    tokenType,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    commitmentFee,
    nullifiersFee,
    compressedSecrets,
    proof,
  ];
  const encodedTransaction = web3.eth.abi.encodeParameters([TRANSACTION_TYPES], [transaction]);
  return web3.utils.soliditySha3({
    t: 'bytes',
    v: encodedTransaction,
  });
}

class Transaction {
  // for any given transaction, some of these values will not exist.  In that
  // case, we give them the Solidity default value (0). (TODO - would leaving
  // them undefined work?)
  constructor({
    fee,
    historicRootBlockNumberL2: _historicRoot,
    historicRootBlockNumberL2Fee: _historicRootFee,
    transactionType,
    tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments: _commitments, // this must be an array of objects from the Commitments class
    nullifiers: _nullifiers, // this must be an array of objects from the Nullifier class
    commitmentFee: _commitmentFee, // this must be an array of objects from the Commitments class
    nullifiersFee: _nullifiersFee, // this must be an array of objects from the Nullifier class
    compressedSecrets: _compressedSecrets, // this must be array of objects that are compressed from Secrets class
    proof, // this must be a proof object, as computed by zokrates worker
  }) {
    let commitments;
    let nullifiers;
    let commitmentFee;
    let nullifiersFee;
    let compressedSecrets;
    let flatProof;
    let historicRootBlockNumberL2;
    if (proof === undefined) flatProof = [0, 0, 0, 0, 0, 0, 0, 0];
    else flatProof = Object.values(proof).flat(Infinity);
    if (_commitments === undefined) commitments = [{ hash: 0 }, { hash: 0 }];
    else if (_commitments.length === 1) commitments = [..._commitments, { hash: 0 }];
    else commitments = _commitments;
    if (_nullifiers === undefined) nullifiers = [{ hash: 0 }, { hash: 0 }];
    else if (_nullifiers.length === 1) nullifiers = [..._nullifiers, { hash: 0 }];
    else nullifiers = _nullifiers;
    if (_commitmentFee === undefined) commitmentFee = [{ hash: 0 }];
    if (_nullifiersFee === undefined) nullifiersFee = [{ hash: 0 }, { hash: 0 }];
    else if (_nullifiersFee.length === 1) nullifiersFee = [..._nullifiersFee, { hash: 0 }];
    else nullifiersFee = _nullifiersFee;
    if (_compressedSecrets === undefined) compressedSecrets = [0, 0];
    else compressedSecrets = _compressedSecrets;
    if (_historicRoot === undefined) historicRootBlockNumberL2 = [0, 0];
    else if (_historicRoot.length === 1) historicRootBlockNumberL2 = [..._historicRoot, 0];
    else historicRootBlockNumberL2 = _historicRoot;

    if ((transactionType === 0 || transactionType === 2) && TOKEN_TYPES[tokenType] === undefined)
      throw new Error('Unrecognized token type');
    // convert everything to hex(32) for interfacing with web3
    const preimage = generalise({
      fee: fee || 0,
      historicRootBlockNumberL2: historicRootBlockNumberL2 || [0, 0],
      historicRootBlockNumberL2Fee: historicRootBlockNumberL2Fee || [0, 0],
      transactionType: transactionType || 0,
      tokenType: TOKEN_TYPES[tokenType] || 0, // tokenType does not matter for transfer
      tokenId: tokenId || 0,
      value: value || 0,
      ercAddress: ercAddress || 0,
      recipientAddress: recipientAddress || 0,
      commitments: commitments.map(c => c.hash),
      nullifiers: nullifiers.map(n => n.hash),
      commitmentsFee: commitmentFee.map(c => c.hash),
      nullifiersFee: nullifiersFee.map(n => n.hash),
      compressedSecrets,
      proof: flatProof,
    }).all.hex(32);
    // compute the solidity hash, using suitable type conversions
    preimage.transactionHash = keccak(preimage);
    return preimage;
  }

  static checkHash(transaction) {
    // compute the solidity hash, using suitable type conversions
    const transactionHash = keccak(transaction);
    return transactionHash === transaction.transactionHash;
  }

  static calcHash(transaction) {
    // compute the solidity hash, using suitable type conversions
    const transactionHash = keccak(transaction);
    return transactionHash;
  }

  static buildSolidityStruct(transaction) {
    // return a version without properties that are not sent to the blockchain
    const {
      value,
      fee,
      historicRootBlockNumberL2,
      historicRootBlockNumberL2Fee,
      transactionType,
      tokenType,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      commitmentFee,
      nullifiersFee,
      compressedSecrets,
      proof,
    } = transaction;
    return {
      value,
      fee,
      historicRootBlockNumberL2,
      historicRootBlockNumberL2Fee,
      transactionType,
      tokenType,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      commitmentFee,
      nullifiersFee,
      proof: compressProof(proof),
    };
  }
}
export default Transaction;
