/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
An optimistic Transaction class
*/
import config from 'config';
import gen from 'general-number';
import Web3 from 'web3';
import utils from '../utils/crypto/merkle-tree/utils.mjs';
import { compressProof } from '../utils/curve-maths/curves.mjs';

const { generalise } = gen;

const TOKEN_TYPES = { ERC20: 0, ERC721: 1, ERC1155: 2 };
const { SIGNATURES } = config;

const arrayEquality = (as, bs) => {
  if (as.length === bs.length) {
    return as.every(a => bs.includes(a));
  }
  return false;
};

export const packTransactionInfo = (value, fee, circuitHash, tokenType) => {
  console.log(generalise(value), '--generalise(value)--');
  const valuePacked = generalise(value).hex(14).slice(2);
  const feePacked = generalise(fee).hex(12).slice(2);
  const circuitHashPacked = generalise(circuitHash).hex(5).slice(2);
  const tokenTypePacked = generalise(tokenType).hex(1).slice(2);

  return '0x'.concat(circuitHashPacked, feePacked, valuePacked, tokenTypePacked);
};

export const packHistoricRoots = historicRootBlockNumberL2 => {
  let historicRootsHex = historicRootBlockNumberL2.map(h => generalise(h).hex(8).slice(2)).join('');

  while (historicRootsHex.length % 64 !== 0) {
    historicRootsHex += '0';
  }

  const historicRootsPacked = [];
  for (let i = 0; i < historicRootsHex.length; i += 64) {
    historicRootsPacked.push(`0x${historicRootsHex.substring(i, i + 64)}`);
  }

  return historicRootsPacked;
};

// function to compute the keccak hash of a transaction
function keccak(preimage) {
  const web3 = new Web3();
  const {
    value,
    fee,
    circuitHash,
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
  // Proof is uncompressed
  if (proof.length === 8) {
    proof = arrayEquality(proof, [0, 0, 0, 0, 0, 0, 0, 0]) ? [0, 0, 0, 0] : compressProof(proof);
  } // Do we need a condition where the length is neither 8 nor 4?

  const packedInfo = packTransactionInfo(value, fee, circuitHash, tokenType);

  const historicRootsPacked = packHistoricRoots(historicRootBlockNumberL2);

  const transaction = [
    packedInfo,
    historicRootsPacked,
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
    circuitHash,
    tokenType,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments: _commitments, // this must be an array of objects from the Commitments class
    nullifiers: _nullifiers, // this must be an array of objects from the Nullifier class
    compressedSecrets: _compressedSecrets, // this must be array of objects that are compressed from Secrets class
    _proof, // this must be a proof object, as computed by circom worker
    numberNullifiers,
    numberCommitments,
    isOnlyL2,
  }) {
    let compressedSecrets;
    let proof;
    if (_proof === undefined) proof = [0, 0, 0, 0, 0, 0, 0, 0];
    else {
      proof = compressProof(_proof);
    }

    const commitments = utils.padArray(_commitments, { hash: 0 }, numberCommitments);
    const nullifiers = utils.padArray(_nullifiers, { hash: 0 }, numberNullifiers);
    const historicRootBlockNumberL2 = utils.padArray(_historicRoot, 0, numberNullifiers);

    if (_compressedSecrets === undefined || _compressedSecrets.length === 0)
      compressedSecrets = [0, 0];
    else compressedSecrets = _compressedSecrets;
    if (!isOnlyL2 && TOKEN_TYPES[tokenType] === undefined)
      throw new Error('Unrecognized token type');
    // convert everything to hex(32) for interfacing with web3

    const preimage = generalise({
      value: value || 0,
      fee: fee || 0,
      circuitHash: circuitHash || 0,
      tokenType: TOKEN_TYPES[tokenType] || 0, // tokenType does not matter for transfer
      historicRootBlockNumberL2,
      tokenId: tokenId || 0,
      ercAddress: ercAddress || 0,
      recipientAddress: recipientAddress || 0,
      commitments: commitments.map(c => c.hash),
      nullifiers: nullifiers.map(n => n.hash),
      compressedSecrets,
      proof,
    }).all.hex(32);

    // compute the solidity hash, using suitable type conversions
    preimage.transactionHash = keccak(preimage);

    return preimage;
  }

  static calcHash(transaction) {
    // compute the solidity hash, using suitable type conversions
    const transactionHash = keccak(transaction);
    return transactionHash;
  }

  static unpackTransactionInfo(packedInfo) {
    const packedInfoHex = generalise(packedInfo).hex(32).slice(2);

    const circuitHash = generalise(`0x${packedInfoHex.slice(0, 10)}`).hex(5);
    const fee = generalise(`0x${packedInfoHex.slice(10, 34)}`).hex(12);
    const value = generalise(`0x${packedInfoHex.slice(34, 62)}`).hex(14);
    const tokenType = generalise(`0x${packedInfoHex.slice(62, 64)}`).hex(1);

    return { value, fee, circuitHash, tokenType };
  }

  static unpackHistoricRoot(nRoots, historicRootsPacked) {
    const historicRootPackedHex = historicRootsPacked
      .map(h => generalise(h).hex(32).slice(2))
      .join('');

    const historicRootBlockNumberL2 = [];

    for (let i = 0; i < historicRootPackedHex.length; i += 16) {
      if (historicRootBlockNumberL2.length === nRoots) break;
      historicRootBlockNumberL2.push(`0x${historicRootPackedHex.substring(i, i + 16)}`);
    }

    return historicRootBlockNumberL2;
  }

  static buildSolidityStruct(transaction) {
    // return a version without properties that are not sent to the blockchain
    const {
      value,
      fee,
      historicRootBlockNumberL2,
      circuitHash,
      tokenType,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof,
    } = transaction;

    const packedInfo = packTransactionInfo(value, fee, circuitHash, tokenType);

    const historicRootsPacked = packHistoricRoots(historicRootBlockNumberL2);

    // Proof may already be compressed
    let compressedProof = proof;
    if (proof.length === 8) {
      compressedProof = arrayEquality(proof, [0, 0, 0, 0, 0, 0, 0, 0])
        ? [0, 0, 0, 0]
        : compressProof(proof);
    }
    return {
      packedInfo,
      historicRootBlockNumberL2: historicRootsPacked,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof: compressedProof,
    };
  }
}
export default Transaction;
