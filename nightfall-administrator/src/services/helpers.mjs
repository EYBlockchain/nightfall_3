import config from 'config';
import Queue from 'queue';
import logger from '../../../common-files/utils/logger.mjs';
import { waitForContract, web3 } from '../../../common-files/utils/contract.mjs';
import { checkThreshold, saveSigned, getSigned } from './database.mjs';

const { RESTRICTIONS, WEB3_OPTIONS, MULTISIG } = config;
const { SIGNATURE_THRESHOLD } = MULTISIG;
const transactionQueue = new Queue({ autostart: true, concurrency: 1 });

/**
Read the names of tokens from the config
*/
export function getTokenNames() {
  const tokenNames = [];
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    tokenNames.push(token.name);
  }
  return tokenNames;
}

export function getTokenAddress(tokenName) {
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) return token.address;
  }
  return 'unknown';
}

export function queueTransaction(unsignedTransaction, signingKey, contractAddress) {
  transactionQueue.push(async () => {
    const tx = {
      from: web3.eth.accounts.privateKeyToAccount(signingKey).address,
      to: contractAddress,
      data: unsignedTransaction,
      gas: WEB3_OPTIONS.gas,
      gasPrice: await web3.eth.getGasPrice(),
    };
    const signed = await web3.eth.accounts.signTransaction(tx, signingKey);
    return new Promise(resolve => {
      web3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once('receipt', receipt => {
          logger.debug(`Transaction ${receipt.transactionHash} has been received.`);
          resolve(receipt);
        })
        .on('error', err => {
          logger.error(err.message);
          resolve(false);
        });
    });
  });
}

export async function addMultiSigSignature(unsignedTransactionData, signingKey, contractAddress) {
  // compute a signature over the unsigned transaction data
  const signed = await web3.eth.accounts.sign(unsignedTransactionData, signingKey); // note the use of 'sign' rather than 'signTransaction'
  console.log('*!SIGNED', signed);
  console.log(
    '*!RECOVERED',
    web3.eth.accounts.recover({
      messageHash: signed.messageHash,
      r: signed.r,
      s: signed.s,
      v: signed.v,
    }),
  );
  // add some useful metadata
  signed.by = web3.eth.accounts.privateKeyToAccount(signingKey).address;
  signed.contractAddress = contractAddress;
  // save the signed transaction until we meet the signature threshold
  try {
    await saveSigned(signed);
  } catch (err) {
    if (err.message.includes('duplicate key')) {
      console.log('You have already signed this message - no action taken');
      return false;
    }
    throw new Error(err);
  }
  console.log('Saved signatures are', await getSigned(signed.messageHash));
  const numberOfSignatures = await checkThreshold(signed.messageHash);
  logger.info(`Number of signatures for this transaction is ${numberOfSignatures}`);
  if (numberOfSignatures < SIGNATURE_THRESHOLD) return false;
  logger.info(`Signature threshold reached`);
  return signed;
}

export async function executeMultiSigTransaction(signed, executor) {
  // now we have the signed data, we need to manipulate it into a form that the multisig contract can consume
  // first it needs to be in ascending address order
  const signedArray = (await getSigned(signed.messageHash)).sort((a, b) => {
    const x = BigInt(a.signed.by);
    const y = BigInt(b.signed.by);
    return x < y ? -1 : x > y ? 1 : 0; // eslint-disable-line no-nested-ternary
  });
  const sigV = signedArray.map(a => a.signed.v);
  const sigR = signedArray.map(a => `0x${a.signed.r.slice(2).padStart(64, '0')}`);
  const sigS = signedArray.map(a => `0x${a.signed.s.slice(2).padStart(64, '0')}`);
  // TODO need a more intelligent choice of executor than 'last to sign'
  const multiSigInstance = await waitForContract('SimpleMultiSig');
  const multiSigTransaction = multiSigInstance.methods
    .execute(
      sigV,
      sigR,
      sigS,
      signed.contractAddress,
      0,
      signed.message,
      web3.eth.accounts.privateKeyToAccount(executor).address,
      WEB3_OPTIONS.gas,
    )
    .encodeABI();
  queueTransaction(multiSigTransaction, executor, multiSigInstance.options.address);
  logger.info('Transaction queued');
  return true;
}
