import Web3 from 'web3';
import axios from 'axios';
import chai from 'chai';
import config from 'config';
import rand from '../src/utils/crypto/crypto-random.mjs';
import PublicInputs from '../src/classes/public-inputs.mjs';

const { ZERO } = config;
let web3;

export function connectWeb3() {
  web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
  return web3;
}

export function closeWeb3Connection() {
  web3.currentProvider.connection.close();
}

export function gasStats(txReceipt) {
  const topic = web3.utils.sha3('GasUsed(uint256,uint256)');
  const { logs } = txReceipt;
  logs.forEach(log => {
    if (log.topics.includes(topic)) {
      const gasData = web3.eth.abi.decodeLog(
        [
          { type: 'uint256', name: 'byShieldContract' },
          { type: 'uint256', name: 'byVerifierContract' },
        ],
        log.data,
        [topic],
      );
      const gasUsedByVerifierContract = Number(gasData.byVerifierContract);
      const gasUsedByShieldContract = Number(gasData.byShieldContract);
      const gasUsed = Number(txReceipt.gasUsed);
      const refund = gasUsedByVerifierContract + gasUsedByShieldContract - gasUsed;
      const attributedToVerifier = gasUsedByVerifierContract - refund;
      console.log(
        'Gas attributed to Shield contract:',
        gasUsedByShieldContract,
        'Gas attributed to Verifier contract:',
        attributedToVerifier,
      );
    }
  });
}

export async function submitTransaction(
  unsignedTransaction,
  privateKey,
  shieldAddress,
  gas,
  value = 0,
) {
  const tx = {
    to: shieldAddress,
    data: unsignedTransaction,
    value,
    gas,
  };
  const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
  return web3.eth.sendSignedTransaction(signed.rawTransaction);
}

export async function getAccounts() {
  const accounts = web3.eth.getAccounts();
  return accounts;
}
export async function getBalance(account) {
  return web3.eth.getBalance(account);
}

// This only works with Ganache but it can move block time forwards
export async function timeJump(secs) {
  axios.post('http://localhost:8545', {
    id: 1337,
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [secs],
  });
}

export async function createBadBlock(badBlockType, block, transactions, args) {
  let res;
  const badBlock = block;
  const badTransactions = transactions;
  switch (badBlockType) {
    case 'RandomRootNotInTimber': {
      badBlock.root = (await rand(32)).hex();
      break;
    }
    case 'IncorrectRoot': {
      res = await chai
        .request('http://localhost:8083')
        .get(`/path/${args.leafIndex}`)
        .send({ contractName: 'Challenges' });
      badBlock.root = res.body.data[0].value;
      break;
    }
    case 'DuplicateTransaction': {
      delete badBlock.root; // we delete root, so that /proposer/encode below can recalculate the root.
      // We don't want the check-block in NO catch wrong root error. Hence this statement
      badTransactions[badTransactions.length - 1] = args.duplicateTransaction;
      break;
    }
    case 'InvalidDepositTransaction': {
      // if both tokenID and value are 0 for deposit, then this is an invalid deposit transaction
      badTransactions[0].tokenId =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      badTransactions[0].value =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      break;
    }
    case 'IncorrectHistoricRoot': {
      // Replace the historic root with a wrong historic root
      badTransactions[0].historicRoot = (await rand(32)).hex();
      // calculate the new public input hash
      badTransactions[0].publicInputHash = new PublicInputs([
        args.ercAddress,
        badTransactions[0].commitments[0],
        badTransactions[0].nullifiers[0],
        badTransactions[0].historicRoot,
      ]).hash.hex(32);
      break;
    }
    case 'IncorrectPublicInputHash': {
      // if both tokenID and value are 0 for deposit, then this is an invalid deposit transaction
      badTransactions[0].publicInputHash = (await rand(32)).hex();
      break;
    }
    case 'IncorrectProof': {
      // use the proof of a prior transaction
      badTransactions[0].proof = args.proof;
      // badTransactions[0].proof = args.proof;
      break;
    }
    case 'DuplicateNullifier': {
      // Find a transaction with a nullifier and replace one we have from earlier
      for (let i = 0; i < badTransactions.length; i++) {
        const nonZeroNullifier = badTransactions[i].nullifiers.findIndex(n => n !== ZERO);
        if (nonZeroNullifier >= 0) {
          badTransactions[i].nullifiers[nonZeroNullifier] = args.duplicateNullifier;
          break;
        }
      }
      break;
    }
    default:
      break;
  }
  const {
    body: { txDataToSign, block: newBlock, transactions: newTransactions },
  } = await chai
    .request('http://localhost:8081')
    .post('/proposer/encode')
    .send({ block: badBlock, transactions: badTransactions });
  return { txDataToSign, block: newBlock, transactions: newTransactions };
}
