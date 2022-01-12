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

// function to compute the keccak hash of a transaction
function keccak(preimage) {
  const web3 = Web3.connection();
  // compute the solidity hash, using suitable type conversions
  return web3.utils.soliditySha3(
    { t: 'uint64', v: preimage.value },
    ...preimage.historicRootBlockNumberL2.map(hi => ({ t: 'uint256', v: hi })),
    { t: 'uint8', v: preimage.transactionType },
    { t: 'uint8', v: preimage.tokenType },
    { t: 'bytes32', v: preimage.tokenId },
    { t: 'bytes32', v: preimage.ercAddress },
    { t: 'bytes32', v: preimage.recipientAddress },
    ...preimage.commitments.map(ch => ({ t: 'bytes32', v: ch })),
    ...preimage.nullifiers.map(nh => ({ t: 'bytes32', v: nh })),
    ...preimage.compressedSecrets.map(es => ({ t: 'bytes32', v: es })),
    ...compressProof(preimage.proof).map(p => ({ t: 'uint', v: p })),
  );
}

class Transaction {
  // for any given transaction, some of these values will not exist.  In that
  // case, we give them the Solidity default value (0). (TODO - would leaving
  // them undefined work?)
  constructor({
    fee,
    historicRootBlockNumberL2,
    transactionType,
    tokenType,
    publicInputs, // this must be an object of the PublicInputs calls
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments: _commitments, // this must be an array of objects from the Commitments class
    nullifiers: _nullifiers, // this must be an array of objects from the Nullifier class
    compressedSecrets: _compressedSecrets, // this must be array of objects that are compressed from Secrets class
    proof, // this must be a proof object, as computed by zokrates worker
  }) {
    if (proof === undefined) throw new Error('Proof cannot be undefined');
    const flatProof = Object.values(proof).flat(Infinity);
    if (publicInputs === undefined) throw new Error('PublicInputs cannot be undefined');
    let commitments;
    let nullifiers;
    let compressedSecrets;
    if (_commitments === undefined) commitments = [{ hash: 0 }, { hash: 0 }];
    else if (_commitments.length === 1) commitments = [..._commitments, { hash: 0 }];
    else commitments = _commitments;
    if (_nullifiers === undefined) nullifiers = [{ hash: 0 }, { hash: 0 }];
    else if (_nullifiers.length === 1) nullifiers = [..._nullifiers, { hash: 0 }];
    else nullifiers = _nullifiers;
    if (_compressedSecrets === undefined) compressedSecrets = [0, 0, 0, 0, 0, 0, 0, 0];
    else compressedSecrets = _compressedSecrets;

    if ((transactionType === 0 || transactionType === 3) && TOKEN_TYPES[tokenType] === undefined)
      throw new Error('Unrecognized token type');

    // convert everything to hex(32) for interfacing with web3
    const preimage = generalise({
      fee: fee || 0,
      historicRootBlockNumberL2: historicRootBlockNumberL2 || [0, 0],
      transactionType: transactionType || 0,
      tokenType: TOKEN_TYPES[tokenType] || 0, // tokenType does not matter for transfer
      publicInputs: publicInputs.publicInputs ?? publicInputs,
      tokenId: tokenId || 0,
      value: value || 0,
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
      historicRootBlockNumberL2,
      transactionType,
      tokenType,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof: compressProof(proof),
    };
  }
}
export default Transaction;
