/**
An optimistic Transaction class
*/
import gen from 'general-number';
import Web3 from '../utils/web3.mjs';
import { compressProof } from '../utils/curve-maths/curves.mjs';

const { generalise } = gen;

// function to compute the keccak hash of a transaction
function keccak(preimage) {
  const web3 = Web3.connection();
  // compute the solidity hash, using suitable type conversions
  return web3.utils.soliditySha3(
    { t: 'uint64', v: preimage.value },
    { t: 'uint64', v: preimage.historicRootBlockNumberL2 },
    { t: 'uint8', v: preimage.transactionType },
    { t: 'bytes32', v: preimage.publicInputHash },
    { t: 'bytes32', v: preimage.tokenId },
    { t: 'bytes32', v: preimage.ercAddress },
    { t: 'bytes32', v: preimage.recipientAddress },
    ...preimage.commitments.map(ch => ({ t: 'bytes32', v: ch })),
    ...preimage.nullifiers.map(nh => ({ t: 'bytes32', v: nh })),
    ...preimage.proof.map(p => ({ t: 'uint', v: p })),
  );
}

class Transaction {
  // for any given transaction, some of these values will not exist.  In that
  // case, we give them the Solidity default value (0). (TODO - would leaving
  // them undefined work?)
  constructor({
    fee,
    transactionType,
    publicInputs, // this must be an object of the PublicInputs calls
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments: _commitments, // this must be an array of objects from the Commitments class
    nullifiers: _nullifiers, // this must be an array of objects from the Nullifier class
    historicRoot,
    proof, // this must be a proof object, as computed by zokrates worker
  }) {
    if (proof === undefined) throw new Error('Proof cannot be undefined');
    const flatProof = Object.values(proof).flat(Infinity);
    if (publicInputs === undefined) throw new Error('PublicInputs cannot be undefined');
    let commitments;
    let nullifiers;
    if (_commitments === undefined) commitments = [{ hash: 0 }, { hash: 0 }];
    else if (_commitments.length === 1) commitments = [..._commitments, { hash: 0 }];
    else commitments = _commitments;
    if (_nullifiers === undefined) nullifiers = [{ hash: 0 }, { hash: 0 }];
    else if (_nullifiers.length === 1) nullifiers = [..._nullifiers, { hash: 0 }];
    else nullifiers = _nullifiers;
    // convert everything to hex(32) for interfacing with web3
    const preimage = generalise({
      fee: fee || 0,
      transactionType: transactionType || 0,
      publicInputHash: publicInputs.hash,
      tokenId: tokenId || 0,
      value: value || 0,
      ercAddress: ercAddress || 0,
      recipientAddress: recipientAddress || 0,
      commitments: commitments.map(c => c.hash),
      nullifiers: nullifiers.map(n => n.hash),
      historicRoot: historicRoot || 0,
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
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof,
    } = transaction;
    return {
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof: compressProof(proof),
    };
  }
}
export default Transaction;
