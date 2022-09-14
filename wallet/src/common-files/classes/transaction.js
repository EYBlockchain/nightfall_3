/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
An optimistic Transaction class
*/
import gen from 'general-number';
import Web3 from '../utils/web3';
import { compressProof } from '../utils/curve-maths/curves';

const { generalise } = gen;

const TOKEN_TYPES = { ERC20: 0, ERC721: 1, ERC1155: 2 };
const { SIGNATURES } = global.config;

const arrayEquality = (as, bs) => {
  if (as.length === bs.length) {
    return as.every(a => bs.includes(a));
  }
  return false;
};

const padArray = (arr, padWith, n) => {
  if (arr === undefined) return generalise([...Array.from({ length: n }, () => padWith)]);
  if (arr.length < n) {
    const nullPadding = generalise(Array.from({ length: n - arr.length }, () => padWith));
    return arr.concat(nullPadding);
  }
  return arr;
};

// function to compute the keccak hash of a transaction
function keccak(preimage) {
  const web3 = Web3.connection();
  const {
    value,
    fee,
    transactionType,
    tokenType,
    historicRootBlockNumberL2,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    compressedSecrets,
  } = preimage;
  let { proof } = preimage;
  proof = arrayEquality(proof, [0, 0, 0, 0, 0, 0, 0, 0]) ? [0, 0, 0, 0] : compressProof(proof);
  const transaction = [
    value,
    fee,
    transactionType,
    tokenType,
    historicRootBlockNumberL2,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    compressedSecrets,
    proof,
  ];
  const encodedTransaction = web3.eth.abi.encodeParameters([SIGNATURES.TRANSACTION], [transaction]);
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
    transactionType,
    tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments: _commitments, // this must be an array of objects from the Commitments class
    nullifiers: _nullifiers, // this must be an array of objects from the Nullifier class
    compressedSecrets: _compressedSecrets, // this must be array of objects that are compressed from Secrets class
    proof, // this must be a proof object, as computed by zokrates worker
    numberNullifiers,
    numberCommitments,
  }) {
    let compressedSecrets;
    let flatProof;
    if (proof === undefined) flatProof = [0, 0, 0, 0, 0, 0, 0, 0];
    else flatProof = Object.values(proof).flat(Infinity);

    const commitments = padArray(_commitments, { hash: 0 }, numberCommitments);
    const nullifiers = padArray(_nullifiers, { hash: 0 }, numberNullifiers);
    const historicRootBlockNumberL2 = padArray(_historicRoot, 0, numberNullifiers);

    if (_compressedSecrets === undefined || _compressedSecrets.length === 0)
      compressedSecrets = [0, 0];
    else compressedSecrets = _compressedSecrets;

    if ((transactionType === 0 || transactionType === 2) && TOKEN_TYPES[tokenType] === undefined)
      throw new Error('Unrecognized token type');
    // convert everything to hex(32) for interfacing with web3
    const preimage = generalise({
      value: value || 0,
      fee: fee || 0,
      transactionType: transactionType || 0,
      tokenType: TOKEN_TYPES[tokenType] || 0, // tokenType does not matter for transfer
      historicRootBlockNumberL2,
      tokenId: tokenId || 0,
      ercAddress: ercAddress || 0,
      recipientAddress: recipientAddress || 0,
      commitments: commitments.map(c => c.hash),
      nullifiers: nullifiers.map(n => n.hash),
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
      transactionType,
      tokenType,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof,
    } = transaction;
    return {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof: arrayEquality(proof, [0, 0, 0, 0, 0, 0, 0, 0]) ? [0, 0, 0, 0] : compressProof(proof),
    };
  }
}
export default Transaction;
