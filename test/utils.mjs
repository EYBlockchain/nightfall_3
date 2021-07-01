import Web3 from 'web3';
import axios from 'axios';
import chai from 'chai';
import rand from '../nightfall-client/src/utils/crypto/crypto-random.mjs';

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
    case 'IncorrectRoot': {
      res = await chai
        .request('http://localhost:8083')
        .get(`/path/${args.leafIndex}`)
        .send({ contractName: 'State' });
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
      badTransactions[1].historicRootBlockNumberL2 = (await rand(8)).hex();
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
        const nonZeroNullifier = badTransactions[i].nullifiers.findIndex(
          n => n !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        );
        if (nonZeroNullifier >= 0) {
          badTransactions[i].nullifiers[nonZeroNullifier] = args.duplicateNullifier;
          break;
        }
      }
      break;
    }
    case 'IncorrectLeafCount': {
      // leafCount is normally re-computed by the /encode endpoint, to ensure
      // that it is correct. Of course that's not much use for this test, so we
      // make the value negative (and wrong). A negative value will tell /encode
      // not to recompute but to use the value we've given it (after flipping
      // the sign back)
      badBlock.leafCount = -badBlock.leafCount - 100;
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

// This function polls for a particular event to be emitted by the blockchain
// from a specified contract.  After timeOut, it will give up and error.
// TODO could we make a neater job with setInterval()?
export async function testForEvents(contractAddress, topics, timeOut = 30000) {
  // console.log('Listening for events');
  const WAIT = 1000;
  let counter = timeOut / WAIT;
  let events;
  while (
    events === undefined ||
    events[0] === undefined ||
    events[0].transactionHash === undefined
  ) {
    // eslint-disable-next-line no-await-in-loop
    events = await web3.eth.getPastLogs({
      fromBlock: web3.utils.toHex(0),
      address: contractAddress,
      topics,
    });
    // console.log('EVENTS WERE', events);
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, WAIT));
    counter--;
    if (counter < 0) throw new Error('No events found before timeout');
  }
  // console.log('Events found');
  return events;
}

export const waitForTimber = async (url, targetLeafCount) => {
  let timberCurrentLeafCount = 0;
  do {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
    // eslint-disable-next-line no-await-in-loop
    timberCurrentLeafCount = await chai.request(url).get('/leaves/count');
  } while (timberCurrentLeafCount !== targetLeafCount);
};

export const topicEventMapping = {
  BlockProposed: '0x566d835e602d4aa5802ee07d3e452e755bc77623507825de7bc163a295d76c0b',
  Rollback: '0xea34b0bc565cb5f2ac54eaa86422ae05651f84522ef100e16b54a422f2053852',
};
