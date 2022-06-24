import config from 'config';
import Queue from 'queue';
import { ecsign } from 'ethereumjs-util';
import logger from '../../../common-files/utils/logger.mjs';
import { waitForContract, web3 } from '../../../common-files/utils/contract.mjs';
import { checkThreshold, saveSigned, getSigned } from './database.mjs';

const { RESTRICTIONS, WEB3_OPTIONS, MULTISIG } = config;
const { SIGNATURE_THRESHOLD } = MULTISIG;
const transactionQueue = new Queue({ autostart: true, concurrency: 1 });
const MULTISIG_CONSTANTS = {};
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

// This function creates the multisig message hash, which is signed (approved) by the key-holders.
// It's worth looking at the multisig contract to see where this all comes from.
export function createMultiSigMessageHash(destination, value, data, executor, gasLimit) {
  const { domainSeparator, txTypeHash, multiSigInstance, txInputHashABI } = MULTISIG_CONSTANTS;
  // get the current multisig nonce
  const nonce = multiSigInstance.methods.nonce.call();
  // compute the hashes to sign over note, sometimes we want a keccak hash over encoded parameter
  // and sometimes over encodedPacked parameters. Hence the two slightly different approaches used.
  const dataHash = web3.utils.soliditySha3({ t: 'bytes', v: data });
  const txInput = [txTypeHash, destination, value, dataHash, nonce, executor, gasLimit];
  const txInputEncoded = web3.eth.abi.encodeParameters(txInputHashABI, txInput);
  const txInputHash = web3.utils.soliditySha3({ t: 'bytes', v: txInputEncoded }); // this is a hash of encoded params
  const totalHash = web3.utils.soliditySha3(
    { t: 'string', v: '\x19\x01' },
    { t: 'bytes32', v: domainSeparator },
    { t: 'bytes32', v: txInputHash },
  ); // this is a hash of encoded, packed params
  return totalHash;
}

// function enabling an approver to sign (approve) a multisig transaction
export async function addMultiSigSignature(
  unsignedTransactionData,
  signingKey,
  contractAddress,
  executorAddress,
) {
  // compute a signature over the unsigned transaction data
  const messageHash = createMultiSigMessageHash(
    contractAddress,
    0,
    unsignedTransactionData,
    executorAddress,
    WEB3_OPTIONS.gas,
  );
  const { r, s, v } = ecsign(Buffer.from(messageHash.slice(2)), Buffer.from(signingKey.slice(2)));
  const signed = {
    messageHash,
    r: `0x${r.toString('hex').padStart(64, '0')}`,
    s: `0x${s.toString('hex').padStart(64, '0')}`,
    v: v.toString(16),
    by: web3.eth.accounts.privateKeyToAccount(signingKey).address,
  };
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
  const signedArray = (await getSigned(signed.messageHash)).sort((a, b) => {
    const x = BigInt(a.signed.by);
    const y = BigInt(b.signed.by);
    return x < y ? -1 : x > y ? 1 : 0; // eslint-disable-line no-nested-ternary
  });
  return signedArray;
}

export async function executeMultiSigTransaction(signedArray, executor) {
  const multiSigInstance = await waitForContract('SimpleMultiSig');
  // execute the multisig
  const multiSigTransaction = multiSigInstance.methods
    .execute(
      signedArray.map(s => s.v),
      signedArray.map(s => s.r),
      signedArray.map(s => s.s),
      signedArray[0].contractAddress,
      0,
      signedArray[0].message,
      web3.eth.accounts.privateKeyToAccount(executor).address,
      WEB3_OPTIONS.gas,
    )
    .encodeABI();
  queueTransaction(multiSigTransaction, executor, multiSigInstance.options.address);
  logger.info('Transaction queued');
  return true;
}

// called at startup to pre-compute some constants used by the multisig
export async function initMultiSig() {
  // constants used to create a mutlisig data structure
  const EIP712DOMAINTYPE_HASH =
    '0xd87cd6ef79d4e2b95e15ce8abf732db51ec771f1ca2edccf22a46c729ac56472';
  // keccak256("Simple MultiSig")
  const NAME_HASH = '0xb7a0bfa1b79f2443f4d73ebb9259cddbcd510b18be6fc4da7d1aa7b1786e73e6';
  // keccak256("1")
  const VERSION_HASH = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6';
  // keccak256("MultiSigTransaction(address destination,uint256 value,bytes data,uint256 nonce,address executor,uint256 gasLimit)")
  const TXTYPE_HASH = '0x3ee892349ae4bbe61dce18f95115b5dc02daf49204cc602458cd4c1f540d56d7';
  const SALT = '0x251543af6a222378665a76fe38dbceae4871a070b7fdaf5c6c30cf758dc33cc0';
  // compute the EIP-712 domain separator
  const multiSigInstance = await waitForContract('SimpleMultiSig');
  const domainSeparatorABI = ['bytes32', 'bytes32', 'bytes32', 'uint', 'address', 'bytes32'];
  const domainSeparator = [
    EIP712DOMAINTYPE_HASH,
    NAME_HASH,
    VERSION_HASH,
    await web3.eth.getChainId(),
    multiSigInstance.options.address,
    SALT,
  ];
  const domainSeparatorEncoded = web3.eth.abi.encode(domainSeparatorABI, domainSeparator);
  const DOMAIN_SEPARATOR = web3.utils.soliditySha3({ t: 'bytes', v: domainSeparatorEncoded });
  MULTISIG_CONSTANTS.domainSeparator = DOMAIN_SEPARATOR;
  MULTISIG_CONSTANTS.txTypeHash = TXTYPE_HASH;
  MULTISIG_CONSTANTS.multiSigInstance = multiSigInstance;
  MULTISIG_CONSTANTS.txInputHashABI = [
    'bytes32',
    'address',
    'uint',
    'bytes32',
    'uint',
    'address',
    'uint',
  ];
}
