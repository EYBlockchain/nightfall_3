/* ignore unused exports */
import { ecsign } from 'ethereumjs-util';
import logger from 'common-files/utils/logger.mjs';

// eslint-disable-next-line import/prefer-default-export
export class MultiSig {
  transactions = [];

  MULTISIG_CONSTANTS = {};

  SIGNATURE_THRESHOLD = 2;

  web3;

  gas;

  constructor(web3Provider, multiSigContractInstance, signatureThreshold, chainId, gasLimit) {
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
    const domainSeparatorABI = ['bytes32', 'bytes32', 'bytes32', 'uint', 'address', 'bytes32'];
    const domainSeparator = [
      EIP712DOMAINTYPE_HASH,
      NAME_HASH,
      VERSION_HASH,
      chainId,
      multiSigContractInstance.options.address,
      SALT,
    ];

    this.SIGNATURE_THRESHOLD = signatureThreshold;
    this.web3 = web3Provider;
    this.gas = gasLimit;
    const domainSeparatorEncoded = this.web3.eth.abi.encodeParameters(
      domainSeparatorABI,
      domainSeparator,
    );
    const DOMAIN_SEPARATOR = this.web3.utils.soliditySha3({
      t: 'bytes',
      v: domainSeparatorEncoded,
    });
    this.MULTISIG_CONSTANTS.domainSeparator = DOMAIN_SEPARATOR;
    this.MULTISIG_CONSTANTS.txTypeHash = TXTYPE_HASH;
    this.MULTISIG_CONSTANTS.multiSigInstance = multiSigContractInstance;
    this.MULTISIG_CONSTANTS.txInputHashABI = [
      'bytes32',
      'address',
      'uint',
      'bytes32',
      'uint',
      'address',
      'uint',
    ];
  }

  /**
   Read the nonce from the multisig contract
  */
  async getMultiSigNonce() {
    const { multiSigInstance } = this.MULTISIG_CONSTANTS;
    if (!multiSigInstance) throw new Error('No multisig instance');
    const nonce = await multiSigInstance.methods.nonce().call();
    return Number(nonce);
  }

  /**
  Function to send signed transaction
  */
  async sendTransaction(unsignedTransaction, signingKey, contractAddress) {
    const tx = {
      from: this.web3.eth.accounts.privateKeyToAccount(signingKey).address,
      to: contractAddress,
      data: unsignedTransaction,
      gas: this.gas,
      gasPrice: await this.web3.eth.getGasPrice(),
    };
    const signed = await this.web3.eth.accounts.signTransaction(tx, signingKey);
    return this.web3.eth.sendSignedTransaction(signed.rawTransaction);
  }

  /**
  Function to save a signed transaction, ready for the multisig
  */
  async saveSigned(signed) {
    this.transactions.push({ _id: signed.messageHash.concat(signed.by.slice(2)), ...signed });
  }

  /**
  Function to get the signatures
  */
  async getSigned(messageHash) {
    return this.transactions.filter(t => t.messageHash === messageHash);
  }

  /**
  Function to check that there are enough transactions to send some signed data
  */
  async checkThreshold(messageHash) {
    return this.transactions.filter(t => t.messageHash === messageHash).length;
  }

  // This function saves a signed transaction and will return the array of so-far signed
  // transactions
  async addSignedTransaction(signed) {
    // save the signed transaction until we meet the signature threshold, only if it's actually signed
    if (signed.r) {
      try {
        await this.saveSigned(signed);
      } catch (err) {
        if (err.message.includes('duplicate key'))
          console.log('You have already signed this message - no action taken');
        else throw new Error(err);
      }
    }
    const numberOfSignatures = await this.checkThreshold(signed.messageHash);
    logger.info(`Number of signatures for this transaction is ${numberOfSignatures}`);
    if (numberOfSignatures === this.SIGNATURE_THRESHOLD) logger.info(`Signature threshold reached`);
    const signedArray = (await this.getSigned(signed.messageHash)).sort((a, b) => {
      const x = BigInt(a.by);
      const y = BigInt(b.by);
      return x < y ? -1 : x > y ? 1 : 0; // eslint-disable-line no-nested-ternary
    });
    return signedArray;
  }

  // This function creates the multisig message hash, which is signed (approved) by the key-holders.
  // It's worth looking at the multisig contract to see where this all comes from.
  async createMultiSigMessageHash(destination, value, data, _nonce, executor, gasLimit) {
    const { domainSeparator, txTypeHash, multiSigInstance, txInputHashABI } =
      this.MULTISIG_CONSTANTS;
    let nonce = _nonce;
    // get the current multisig nonce if it's not provided (requires blockchain connection)
    if (!_nonce) nonce = await multiSigInstance.methods.nonce().call();
    // compute the hashes to sign over note, sometimes we want a keccak hash over encoded parameter
    // and sometimes over encodedPacked parameters. Hence the two slightly different approaches used.
    const dataHash = this.web3.utils.soliditySha3({ t: 'bytes', v: data });
    const txInput = [txTypeHash, destination, value, dataHash, nonce, executor, gasLimit];
    const txInputEncoded = this.web3.eth.abi.encodeParameters(txInputHashABI, txInput);
    const txInputHash = this.web3.utils.soliditySha3({ t: 'bytes', v: txInputEncoded }); // this is a hash of encoded params
    const totalHash = this.web3.utils.soliditySha3(
      { t: 'string', v: '\x19\x01' },
      { t: 'bytes32', v: domainSeparator },
      { t: 'bytes32', v: txInputHash },
    ); // this is a hash of encoded, packed params
    return totalHash;
  }

  // function enabling an approver to sign (approve) a multisig transaction
  async addMultiSigSignature(
    unsignedTransactionData,
    signingKey,
    contractAddress,
    executorAddress,
    nonce,
  ) {
    // compute a signature over the unsigned transaction data
    const messageHash = await this.createMultiSigMessageHash(
      contractAddress,
      0,
      unsignedTransactionData,
      nonce, // eslint-disable-line no-param-reassign
      executorAddress,
      this.gas,
    );
    if (!signingKey) return this.addSignedTransaction({ messageHash }); // if no signing key is given, don't create a new signed transaction
    const { r, s, v } = ecsign(
      Buffer.from(messageHash.slice(2), 'hex'),
      Buffer.from(signingKey.slice(2), 'hex'),
    );
    const signed = {
      messageHash,
      r: `0x${r.toString('hex').padStart(64, '0')}`,
      s: `0x${s.toString('hex').padStart(64, '0')}`,
      v: `0x${v.toString(16)}`,
      by: this.web3.eth.accounts.privateKeyToAccount(signingKey).address,
      contractAddress,
      data: unsignedTransactionData,
    };
    return this.addSignedTransaction(signed);
  }

  async executeMultiSigTransaction(signedArray, executor) {
    const { multiSigInstance } = this.MULTISIG_CONSTANTS;
    // execute the multisig
    const multiSigTransaction = multiSigInstance.methods
      .execute(
        signedArray.map(s => s.v),
        signedArray.map(s => s.r),
        signedArray.map(s => s.s),
        signedArray[0].contractAddress,
        0,
        signedArray[0].data,
        this.web3.eth.accounts.privateKeyToAccount(executor).address,
        this.gas,
      )
      .encodeABI();
    return this.sendTransaction(multiSigTransaction, executor, multiSigInstance.options.address);
  }

  /**
   * Execute multisig transaction
   */
  async executeMultiSigTransactions(approved, executor) {
    for (const approval of approved) {
      logger.info('Executing multisig transaction');
      // eslint-disable-next-line no-await-in-loop
      await this.executeMultiSigTransaction(approval.slice(0, this.SIGNATURE_THRESHOLD), executor);
    }
  }
}
