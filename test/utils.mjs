import Web3 from 'web3';
import axios from 'axios';
import chai from 'chai';
import rand from '../src/utils/crypto/crypto-random.mjs';

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
  try {
    const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
    return web3.eth.sendSignedTransaction(signed.rawTransaction);
  } catch (err) {
    return err;
  }
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
  switch (badBlockType) {
    case 'RandomRootNotInTimber': {
      block.root = (await rand(32)).hex();
      break;
    }
    case 'IncorrectRoot': {
      res = await chai
        .request('http://localhost:8083')
        .get(`/path/${args.leafIndex}`)
        .send({ contractName: 'Challenges' });
      block.root = res.body.data[0].value;
      break;
    }
    case 'DuplicateTransaction': {
      transactions[transactions.length - 1] = args.duplicateTransaction;
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
    .send({ block, transactions });
  return { txDataToSign, block: newBlock, transactions: newTransactions };
}
