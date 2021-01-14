/**
An optimistic layer 2 Block class
*/
import gen from 'general-number';

const { generalise } = gen;

/**
This Block class does not have the Block components that are computed on-chain.
A Block struct in Solidity also has a blockTime and a blockHash. The
blocktime is computed on-chain at the point of Block submission, and is
part of the preimage of the blockHash, thus we cannot compute either of
these properties offchain.
*/
export class Block {
  constructor({ proposer, transactions, priorRoot }) {
    // we need to compute the new Merkle root
    
    // convert everything to hex(32) for interfacing with web3
    return generalise({
      proposer,
      transactionHashes,
      root,
    }).all.hex(32);
  }
}


export default Block;
