/* eslint class-methods-use-this: "off" */
/* eslint prefer-destructuring: "off" */
/* eslint no-param-reassign: "off" */

import axios from 'axios';
import Queue from 'queue';
import Web3 from 'web3';
import WebSocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import EventEmitter from 'events';
import logger from 'common-files/utils/logger.mjs';
import { Mutex } from 'async-mutex';
import { approve } from './tokens.mjs';
// import erc20 from './abis/ERC20.mjs';
// import erc721 from './abis/ERC721.mjs';
// import erc1155 from './abis/ERC1155.mjs';
import createJob from './jobScheduler.mjs';

import {
  DEFAULT_FEE_TOKEN_VALUE,
  WEBSOCKET_PING_TIME,
  GAS_MULTIPLIER,
  GAS,
  GAS_PRICE,
  GAS_PRICE_MULTIPLIER,
  GAS_ESTIMATE_ENDPOINT,
  DEFAULT_MIN_L1_WITHDRAW,
  DEFAULT_MIN_L2_WITHDRAW,
} from './constants.mjs';

function ping(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.ping();
  }
}

function createQueue(options) {
  const queue = new Queue(options);
  queue.on('error', error => logger.error({ msg: 'Error caught by queue', error }));

  return queue;
}

// TODO when SDK is refactored such that these functions are split by user, proposer and challenger,
// then there will only be one queue here. The constructor does not need to initialise clientBaseUrl
// for proposer/liquidityProvider/challenger and optimistBaseUrl, optimistWsUrl for a user etc
const userQueue = createQueue({ autostart: true, concurrency: 1 });
const proposerQueue = createQueue({ autostart: true });
const challengerQueue = createQueue({ autostart: true, concurrency: 1 });
const liquidityProviderQueue = createQueue({ autostart: true, concurrency: 1 });

/**
@class
Creates a new Nightfall_3 library instance.
@param {string} clientBaseUrl - The base url for nightfall-client
@param {string} optimistBaseUrl - The base url for nightfall-optimist
@param {string} optimistWsUrl - The webscocket url for nightfall-optimist
@param {string} web3WsUrl - The websocket url for the web3js client
@param {string} ethereumSigningKey - the Ethereum siging key to be used for transactions (hex string).
@param {object} zkpKeys - An object containing the zkp keys to use.  These will be auto-generated if left undefined.
*/
class Nf3 {
  clientBaseUrl;

  optimistBaseUrl;

  optimistWsUrl;

  web3WsUrl;

  web3;

  websockets = [];

  intervalIDs = [];

  shieldContractAddress;

  proposersContractAddress;

  challengesContractAddress;

  stateContractAddress;

  stateContract;

  shieldContract;

  ethereumSigningKey;

  ethereumAddress;

  zkpKeys;

  defaultFeeTokenValue = DEFAULT_FEE_TOKEN_VALUE;

  latestWithdrawHash;

  mnemonic = {};

  // contracts = { ERC20: erc20, ERC721: erc721, ERC1155: erc1155 };

  currentEnvironment;

  nonce = 0;

  nonceMutex = new Mutex();

  clientAuthenticationKey;

  // min fee or reward one should hold for withdaw
  // in State contract.
  minL1Balance = DEFAULT_MIN_L1_WITHDRAW;

  minL2Balance = DEFAULT_MIN_L2_WITHDRAW;

  periodicPaymentJob;

  constructor(
    ethereumSigningKey,
    environment = {
      clientApiUrl: 'http://localhost:8080',
      optimistApiUrl: 'http://localhost:8081',
      optimistWsUrl: 'ws://localhost:8082',
      web3WsUrl: 'ws://localhost:8546',
    },
    zkpKeys,
    clientApiAuthenticationKey,
  ) {
    this.clientBaseUrl = environment.clientApiUrl;
    this.optimistBaseUrl = environment.optimistApiUrl;
    this.optimistWsUrl = environment.optimistWsUrl;
    this.web3WsUrl = environment.web3WsUrl;
    this.ethereumSigningKey = ethereumSigningKey;
    this.zkpKeys = zkpKeys;
    this.currentEnvironment = environment;
    this.clientAuthenticationKey = clientApiAuthenticationKey;

    this.applyHttpClientAuthentication();
  }

  applyHttpClientAuthentication() {
    if (!this.clientAuthenticationKey) {
      logger.info('No client authentication key is set!');
      return;
    }

    const clientBaseUrl = this.clientBaseUrl;
    const clientApiKey = this.clientAuthenticationKey;

    axios.interceptors.request.use(function (config) {
      if (!config.url.includes(clientBaseUrl)) {
        return config;
      }

      config.headers['X-API-Key'] = clientApiKey;

      return config;
    });
  }

  /**
    Initialises the Nf_3 object so that it can communicate with Nightfall_3 and the
    blockchain.
    @returns {Promise}
    */
  async init(mnemonic, contractAddressProvider) {
    await this.setWeb3Provider();
    // this code will call client to get contract addresses, or optimist if client isn't deployed
    switch (contractAddressProvider) {
      case undefined:
        this.contractGetter = this.getContractAddress;
        this.contractAbiGetter = this.getContractAbi;
        break;
      case 'client':
        this.contractGetter = this.getContractAddress;
        this.contractAbiGetter = this.getContractAbi;
        break;
      case 'optimist':
        this.contractGetter = this.getContractAddressOptimist;
        this.contractAbiGetter = this.getContractAbiOptimist;
        break;
      default:
        throw new Error('Unknown contract address server');
    }
    // once we know where to ask, we can get the contract addresses
    this.x509ContractAddress = await this.contractGetter('X509');
    this.shieldContractAddress = await this.contractGetter('Shield');
    this.proposersContractAddress = await this.contractGetter('Proposers');
    this.challengesContractAddress = await this.contractGetter('Challenges');
    this.stateContractAddress = await this.contractGetter('State');
    this.stateContract = await this.getContractInstance('State');
    this.shieldContract = await this.getContractInstance('Shield');

    // set the ethereumAddress iff we have a signing key
    if (typeof this.ethereumSigningKey === 'string') {
      this.ethereumAddress = await this.getAccounts();
    }
    // set zkp keys from mnemonic if provided
    if (typeof mnemonic !== 'undefined') {
      await this.setZkpKeysFromMnemonic(mnemonic, 0);
    }
  }

  /**
    Get contract instance.
    @method
    @param {string} contractName - name of the contract instance to get.
    */
  async getContractInstance(contractName) {
    const abi = await this.contractAbiGetter(contractName);
    const contractAddress = await this.contractGetter(contractName);
    const contractInstance = new this.web3.eth.Contract(abi, contractAddress);
    return contractInstance;
  }

  /**
    Setter for the ethereum private key, in case it wasn't known at build time.
    This will also update the corresponding Ethereum address that Nf_3 uses.
    @method
    @param {string} key - the ethereum private key as a hex string.
    */
  async setEthereumSigningKey(key) {
    this.ethereumSigningKey = key;
    this.ethereumAddress = await this.getAccounts();
    this.nonce = 0;
  }

  /**
    Setter for the zkp keys, in case it wasn't known at build time and we don't
    want to use autogenerated ones.
    @method
    @param {object} keys - The zkp keys object.
    */
  setzkpKeys(keys) {
    this.zkpKeys = keys;
    return this.subscribeToIncomingViewingKeys();
  }

  /**
    Setter for the zkp keys by mnemonic, in case it wasn't known at build time and we don't
    want to use autogenerated ones.
    @method
    @param {string} mnemonic - 12 word phrase
    @param {number} addressIndex - Index used to generate keys combined with mnemonic
    */
  async setZkpKeysFromMnemonic(mnemonic, addressIndex) {
    if (mnemonic !== '') {
      this.mnemonic.phrase = mnemonic;
    }
    this.mnemonic.addressIndex = addressIndex.toString();
    this.zkpKeys = (
      await axios.post(`${this.clientBaseUrl}/generate-zkp-keys`, {
        mnemonic: this.mnemonic.phrase,
        addressIndex: this.mnemonic.addressIndex,
      })
    ).data;
    return this.subscribeToIncomingViewingKeys();
  }

  /**
   * Get the number of unprocessed transactions in the optimist
   * @method unprocessedTransactionCount
   * @async
   */

  async unprocessedTransactionCount() {
    const { result: mempool } = (await axios.get(`${this.optimistBaseUrl}/proposer/mempool`)).data;
    return mempool.filter(e => e.mempool).length;
  }

  /**
   * Get all mempool transactions in the optimist
   * @method getMempoolTransactions
   * @async
   */
  async getMempoolTransactions() {
    const { result: mempool } = (await axios.get(`${this.optimistBaseUrl}/proposer/mempool`)).data;
    return mempool;
  }

  /**
   * Filter the mempool by l2 transaction hash
   * @method requestMempoolTransactionByL2TransactionHash
   * @async
   * @param {string} l2TransactionHash - L2 tx hash
   * @returns {Promise<AxiosResponse>}
   * @throws 404 tx not found
   */
  async requestMempoolTransactionByL2TransactionHash(l2TransactionHash) {
    return axios.get(`${this.optimistBaseUrl}/proposer/mempool/${l2TransactionHash}`);
  }

  /**
  Forces optimist to make a block with whatever transactions it has to hand i.e. it won't wait
  until the block is full
  @method
  @async
  */
  async makeBlockNow() {
    return axios.post(`${this.optimistBaseUrl}/block/make-now`);
  }

  async estimateGas(contractAddress, unsignedTransaction) {
    let gasLimit;
    try {
      // Workaround to estimateGas call not working properly on Polygon Edge nodes
      const res = await axios.post(this.web3WsUrl, {
        method: 'eth_estimateGas',
        params: [
          {
            from: this.ethereumAddress,
            to: contractAddress,
            data: unsignedTransaction,
            value: this.defaultFee.toString(),
          },
        ],
      });
      if (res.data.error) throw new Error(res.data.error);
      gasLimit = parseInt(res.data.result, 16);
    } catch (error) {
      gasLimit = GAS; // backup if estimateGas failed
    }
    return Math.ceil(Number(gasLimit) * GAS_MULTIPLIER); // 50% seems a more than reasonable buffer.
  }

  async estimateGasPrice() {
    let proposedGasPrice;
    try {
      // Call the endpoint to estimate the gas fee.
      const res = (await axios.get(GAS_ESTIMATE_ENDPOINT)).data.result;
      proposedGasPrice = Number(res?.ProposeGasPrice) * 10 ** 9;
    } catch (error) {
      try {
        proposedGasPrice = Number(await this.web3.eth.getGasPrice());
      } catch (err) {
        proposedGasPrice = GAS_PRICE;
      }
    }
    return Math.ceil(proposedGasPrice * GAS_PRICE_MULTIPLIER);
  }

  /**
  Method for signing an Ethereum transaction to the
  blockchain.
  @method
  @async
  @param {object} unsignedTransaction - An unsigned web3js transaction object.
  @param {string} shieldContractAddress - The address of the Nightfall_3 shield address.
  @param {number} fee - the value of the transaction.
  This can be found using the getContractAddress convenience function.
  @returns {Oject} Signed transaction.
  */
  async _signTransaction(unsignedTransaction, contractAddress, fee) {
    let tx;
    let signed;

    await this.nonceMutex.runExclusive(async () => {
      // estimate the gasPrice
      const gasPrice = await this.estimateGasPrice();
      // Estimate the gasLimit
      const gas = await this.estimateGas(contractAddress, unsignedTransaction);

      // Update nonce if necessary
      const _nonce = await this.web3.eth.getTransactionCount(this.ethereumAddress, 'pending');
      if (this.nonce < _nonce) {
        this.nonce = _nonce;
      }

      tx = {
        from: this.ethereumAddress,
        to: contractAddress,
        data: unsignedTransaction,
        value: fee,
        gas,
        gasPrice,
        nonce: this.nonce,
      };
      this.nonce++;

      if (this.ethereumSigningKey) {
        signed = await this.web3.eth.accounts.signTransaction(tx, this.ethereumSigningKey);
      }
    });

    if (this.ethereumSigningKey) {
      return signed;
    }
    return tx;
  }

  /**
  Method for submitting an Ethereum transaction to the
  blockchain.
  @method
  @async
  @param {object} tx - An signed web3js transaction object.
  @returns {Promise} This will resolve into a transaction receipt.
  */
  _sendTransaction(tx) {
    if (this.ethereumSigningKey) {
      return this.web3.eth.sendSignedTransaction(tx.rawTransaction);
    }
    return this.web3.eth.sendTransaction(tx);
  }

  /**
  Method for signing and submitting an Ethereum transaction to the
  blockchain.
  @method
  @async
  @param {object} unsignedTransaction - An unsigned web3js transaction object.
  @param {string} shieldContractAddress - The address of the Nightfall_3 shield address.
  @param {number} fee - the value of the transaction.
  This can be found using the getContractAddress convenience function.
  @returns {Promise} This will resolve into a transaction receipt.
  */
  async submitTransaction(unsignedTransaction, contractAddress = this.shieldContractAddress, fee) {
    const tx = await this._signTransaction(unsignedTransaction, contractAddress, fee);
    logger.debug(`Sending transaction with hash ${tx.transactionHash}`);
    return this._sendTransaction(tx);
  }

  /**
  Determines if a Nightfall_3 server is running and healthy.
  @method
  @async
  @param {string} server - The name of the server being checked ['client', 'optimist']
  @returns {Promise} This will resolve into a boolean - true if the healthcheck passed.
  */
  async healthcheck(server) {
    let url;
    switch (server) {
      case 'client':
        url = this.clientBaseUrl;
        break;
      case 'optimist':
        url = this.optimistBaseUrl;
        break;
      default:
        throw new Error('Unknown server name');
    }
    let res;
    try {
      res = await axios.get(`${url}/healthcheck`);
      if (res.status !== 200) return false;
    } catch (err) {
      return false;
    }
    return true;
  }

  /**
    Returns the abi of a Nightfall_3 contract calling the client.
    @method
    @async
    @param {string} contractName - the name of the smart contract in question. Possible
    values are 'Shield', 'State', 'Proposers', 'Challengers'.
    @returns {Promise} Resolves into the Ethereum address of the contract
    */
  async getContractAbi(contractName) {
    const res = await axios.get(`${this.clientBaseUrl}/contract-abi/${contractName}`);
    return res.data.abi;
  }

  /**
    Returns the abi of a Nightfall_3 contract calling the optimist.
    @method
    @async
    @param {string} contractName - the name of the smart contract in question. Possible
    values are 'Shield', 'State', 'Proposers', 'Challengers'.
    @returns {Promise} Resolves into the Ethereum ABI of the contract
  */
  async getContractAbiOptimist(contractName) {
    const res = await axios.get(`${this.optimistBaseUrl}/contract-abi/${contractName}`);
    return res.data.abi;
  }

  /**
    Returns the address of a Nightfall_3 contract calling the client.
    @method
    @async
    @param {string} contractName - the name of the smart contract in question. Possible
    values are 'Shield', 'State', 'Proposers', 'Challengers'.
    @returns {Promise} Resolves into the Ethereum address of the contract
    */
  async getContractAddress(contractName) {
    const res = await axios.get(`${this.clientBaseUrl}/contract-address/${contractName}`);
    return res.data.address.toLowerCase();
  }

  /**
    Returns the address of a Nightfall_3 contract calling the optimist.
    @method
    @async
    @param {string} contractName - the name of the smart contract in question. Possible
    values are 'Shield', 'State', 'Proposers', 'Challengers'.
    @returns {Promise} Resolves into the Ethereum address of the contract
    */
  async getContractAddressOptimist(contractName) {
    const res = await axios.get(`${this.optimistBaseUrl}/contract-address/${contractName}`);
    return res.data.address;
  }

  /**
    Mint an L2 token
    @method
    @async
    @param {number} fee - The amount (Wei) to pay a proposer for the transaction
    @param {string} ercAddress - The "fake" ercAddress
    @param {string} tokenId - The ID of an ERC721 or ERC1155 token.  Since the token was minted on thin
    air, it can be any value
    @param {string} salt - The salt used to mint the new token. It is optional
    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async tokenise(
    ercAddress,
    value = 0,
    tokenId = 0,
    salt = undefined,
    fee = this.defaultFeeTokenValue,
    providedCommitmentsFee,
  ) {
    const res = await axios.post(`${this.clientBaseUrl}/tokenise`, {
      ercAddress,
      tokenId,
      salt,
      value,
      rootKey: this.zkpKeys.rootKey,
      fee,
      providedCommitmentsFee,
    });

    if (res.data.error) {
      throw new Error(res.data.error);
    }
    return res.status;
  }

  /**
    Burn an L2 token
    @method
    @async
    @param {number} fee - The amount (Wei) to pay a proposer for the transaction
    @param {string} ercAddress - The "fake" ercAddress
    @param {string} tokenId - The ID of an ERC721 or ERC1155 token.  Since the token was minted on thin
    air, it can be any value
    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async burn(
    ercAddress,
    value,
    tokenId,
    fee = this.defaultFeeTokenValue,
    providedCommitments,
    providedCommitmentsFee,
  ) {
    const res = await axios.post(`${this.clientBaseUrl}/burn`, {
      ercAddress,
      tokenId,
      value,
      providedCommitments,
      providedCommitmentsFee,
      rootKey: this.zkpKeys.rootKey,
      fee,
    });

    if (res.data.error) {
      throw new Error(res.data.error);
    }
    return res.status;
  }

  /**
    Transform a set of input L2 tokens into a set of output L2 tokens 
    @method
    @async

    @param {Object[]} inputTokens
    @param {number} inputTokens[].id - the token id
    @param {string} inputTokens[].address - the L2 address
    @param {number} inputTokens[].value - this needs to be less than the total total value of the commitment but is ignored otherwise
    @param {number} inputTokens[].salt
    @param {string} inputTokens[].commitmentHash - the hash of the input commitment

    @param {Object[]} outputTokens
    @param {number} outputTokens[].id - the token id
    @param {string} outputTokens[].address - the L2 address
    @param {number} outputTokens[].value - this needs to be less than the total total value of the commitment but is ignored otherwise
    @param {number} outputTokens[].salt

    @param {number} fee - The amount (Wei) to pay a proposer for the transaction

    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async transform(inputTokens, outputTokens, fee = this.defaultFeeTokenValue) {
    const res = await axios.post(`${this.clientBaseUrl}/transform`, {
      rootKey: this.zkpKeys.rootKey,
      inputTokens,
      outputTokens,
      fee,
    });

    if (res.data.error && res.data.error === 'No suitable commitments') {
      throw new Error('No suitable commitments');
    }
    return res.status;
  }

  /**
    Deposits a Layer 1 token into Layer 2, so that it can be transacted
    privately.
    @method
    @async
    @param {number} fee - The amount (Wei) to pay a proposer for the transaction
    @param {string} ercAddress - The address of the ERCx contract from which the token
    is being taken.  Note that the Nightfall_3 State.sol contract must be approved
    by the token's owner to be able to withdraw the token.
    @param {string} tokenType - The type of token to deposit. Possible values are
    'ERC20', 'ERC721', 'ERC1155'.
    @param {number} value - The value of the token, in the case of an ERC20 or ERC1155
    token.  For ERC721 this should be set to zero.
    @param {string} tokenId - The ID of an ERC721 or ERC1155 token.  In the case of
    an 'ERC20' coin, this should be set to '0x00'.
    @param {object} keys - The ZKP private key set.
    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async deposit(
    ercAddress,
    tokenType,
    value,
    tokenId,
    fee = this.defaultFeeTokenValue,
    providedCommitmentsFee = [],
    salt = undefined,
  ) {
    let txDataToSign;
    try {
      txDataToSign = await approve(
        ercAddress,
        this.ethereumAddress,
        this.shieldContractAddress,
        tokenType,
        value,
        this.web3,
        !!this.ethereumSigningKey,
      );
    } catch (err) {
      logger.error(`Approve transaction failed`);
      throw new Error(err);
    }
    if (txDataToSign) {
      userQueue.push(() => {
        return this.submitTransaction(txDataToSign, ercAddress, 0);
      });
    }
    const res = await axios.post(`${this.clientBaseUrl}/deposit`, {
      ercAddress,
      tokenId,
      tokenType,
      value,
      rootKey: this.zkpKeys.rootKey,
      fee,
      providedCommitmentsFee,
      salt,
    });

    if (res.data.error) {
      throw new Error(res.data.error);
    }
    return new Promise((resolve, reject) => {
      userQueue.push(async () => {
        try {
          logger.debug('Deposit transaction being processed');
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.shieldContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Transfers a token within Layer 2.
    @method
    @async
    @param {number} fee - The amount (Wei) to pay a proposer for the transaction
    @param {string} ercAddress - The address of the ERCx contract from which the token
    is being taken.  Note that the Nightfall_3 State.sol contract must be approved
    by the token's owner to be able to withdraw the token.
    @param {string} tokenType - The type of token to deposit. Possible values are
    'ERC20', 'ERC721', 'ERC1155'.
    @param {number} value - The value of the token, in the case of an ERC20 or ERC1155
    token.  For ERC721 this should be set to zero.
    @param {string} tokenId - The ID of an ERC721 or ERC1155 token.  In the case of
    an 'ERC20' coin, this should be set to '0x00'.
    @param {object} keys - The ZKP private key set of the sender.
    @param {string} compressedZkpPublicKey - The compressed transmission key of the recipient
    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async transfer(
    offchain = false,
    ercAddress,
    tokenType,
    value,
    tokenId,
    compressedZkpPublicKey,
    fee = this.defaultFeeTokenValue,
    providedCommitments,
    providedCommitmentsFee,
  ) {
    const res = await axios.post(`${this.clientBaseUrl}/transfer`, {
      offchain,
      ercAddress,
      tokenId,
      recipientData: {
        values: [value],
        recipientCompressedZkpPublicKeys: [compressedZkpPublicKey],
      },
      rootKey: this.zkpKeys.rootKey,
      fee,
      providedCommitments,
      providedCommitmentsFee,
    });

    if (res.data.error) {
      throw new Error(res.data.error);
    }
    if (!offchain) {
      return new Promise((resolve, reject) => {
        userQueue.push(async () => {
          try {
            const receipt = await this.submitTransaction(
              res.data.txDataToSign,
              this.shieldContractAddress,
              0,
            );
            resolve(receipt);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
    return res.status;
  }

  /**
    Withdraws a token from Layer 2 back to Layer 1. It can then be withdrawn from
    the Shield contract's account by the owner in Layer 1.
    @method
    @async
    @param {number} fee - The amount (Wei) to pay a proposer for the transaction
    @param {string} ercAddress - The address of the ERCx contract from which the token
    is being taken.  Note that the Nightfall_3 State.sol contract must be approved
    by the token's owner to be able to withdraw the token.
    @param {string} tokenType - The type of token to deposit. Possible values are
    'ERC20', 'ERC721', 'ERC1155'.
    @param {number} value - The value of the token, in the case of an ERC20 or ERC1155
    token.  For ERC721 this should be set to zero.
    @param {string} tokenId - The ID of an ERC721 or ERC1155 token.  In the case of
    an 'ERC20' coin, this should be set to '0x00'.
    @param {object} keys - The ZKP private key set of the sender.
    @param {string} recipientAddress - The Ethereum address to where the withdrawn tokens
    should be deposited.
    @returns {Promise} Resolves into the Ethereum transaction receipt.
    */
  async withdraw(
    offchain = false,
    ercAddress,
    tokenType,
    value,
    tokenId,
    recipientAddress,
    fee = this.defaultFeeTokenValue,
    providedCommitments,
    providedCommitmentsFee,
  ) {
    const res = await axios.post(`${this.clientBaseUrl}/withdraw`, {
      offchain,
      ercAddress,
      tokenId,
      tokenType,
      value,
      recipientAddress,
      rootKey: this.zkpKeys.rootKey,
      fee,
      providedCommitments,
      providedCommitmentsFee,
    });
    if (res.data.error) {
      throw new Error(res.data.error);
    }
    this.latestWithdrawHash = res.data.transaction.transactionHash;
    if (!offchain) {
      return new Promise((resolve, reject) => {
        userQueue.push(async () => {
          try {
            const receipt = await this.submitTransaction(
              res.data.txDataToSign,
              this.shieldContractAddress,
              0,
            );
            resolve(receipt);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
    return res.status;
  }

  /**
    Enables someone with a valid withdraw transaction in flight to finalise the
    withdrawal of funds to L1 (only relevant for ERC20).
    @method
    @async
    @param {string} withdrawTransactionHash - the hash of the Layer 2 transaction in question
    */
  async finaliseWithdrawal(withdrawTransactionHash) {
    // find the L2 block containing the L2 transaction hash
    const res = await axios.post(`${this.clientBaseUrl}/finalise-withdrawal`, {
      transactionHash: withdrawTransactionHash,
    });
    return new Promise((resolve, reject) => {
      userQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.shieldContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Enables someone with a valid withdraw transaction in flight to request instant
    withdrawal of funds (only relevant for ERC20).
    @method
    @async
    @param {string} withdrawTransactionHash - the hash of the Layer 2 transaction in question
    @param {number} fee - the amount being paid for the instant withdrawal service
    */
  async requestInstantWithdrawal(withdrawTransactionHash, fee) {
    try {
      // set the instant withdrawal fee
      const res = await axios.post(`${this.clientBaseUrl}/set-instant-withdrawal`, {
        transactionHash: withdrawTransactionHash,
      });
      return new Promise((resolve, reject) => {
        userQueue.push(async () => {
          try {
            const receipt = await this.submitTransaction(
              res.data.txDataToSign,
              this.shieldContractAddress,
              fee,
            );
            resolve(receipt);
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch {
      return null;
    }
  }

  /**
    Enables someone to service a request for an instant withdrawal
    @method
    @async
    @param {string} withdrawTransactionHash - the hash of the Layer 2 transaction in question
    */
  async advanceInstantWithdrawal(withdrawTransactionHash) {
    const res = await axios.post(`${this.optimistBaseUrl}/transaction/advanceWithdrawal`, {
      transactionHash: withdrawTransactionHash,
    });
    return new Promise((resolve, reject) => {
      liquidityProviderQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.shieldContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Gets the hash of the last withdraw transaction - sometimes useful for instant transfers
    @method
    @returns {string} - the transactionHash of the last transaction
    */
  getLatestWithdrawHash() {
    return this.latestWithdrawHash;
  }

  /**
    Returns an event emitter that fires each time an InstantWithdrawalRequested
    event is detected on the blockchain
    */
  async getInstantWithdrawalRequestedEmitter() {
    const emitter = new EventEmitter();
    const connection = new ReconnectingWebSocket(this.optimistWsUrl, [], { WebSocket });
    this.websockets.push(connection); // save so we can close it properly later
    connection.onopen = () => {
      // setup a ping every 15s
      this.intervalIDs.push(
        setInterval(() => {
          ping(connection._ws);
        }, WEBSOCKET_PING_TIME),
      );
      // and a listener for the pong
      logger.debug('Liquidity provider websocket connection opened');
      connection.send('instant');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, withdrawTransactionHash, paidBy, amount } = msg;
      if (type === 'instant') {
        emitter.emit('data', withdrawTransactionHash, paidBy, amount);
      }
    };
    return emitter;
  }

  /**
    Provides nightfall-client with a set of viewing keys.  Without these,
    it won't listen for BlockProposed events and so won't update its transaction collection
    with information about which are on-line.
    @method
    @async
    @param {object} keys - Object containing the ZKP key set (this may be generated
    with the makeKeys function).
    */
  async subscribeToIncomingViewingKeys() {
    return axios.post(`${this.clientBaseUrl}/incoming-viewing-key`, {
      zkpPrivateKeys: [this.zkpKeys.zkpPrivateKey],
      nullifierKeys: [this.zkpKeys.nullifierKey],
    });
  }

  /**
    Closes the Nf3 connection to the blockchain and any open websockets to NF_3
    @method
    */
  close() {
    this.intervalIDs.forEach(intervalID => clearInterval(intervalID));
    this.web3.currentProvider.connection.close();
    this.websockets.forEach(websocket => websocket.close());
  }

  /**
    Registers a new proposer and pays the stake required to register.
    It will use the address of the Ethereum Signing key that is holds to register
    the proposer.
    @method
    @async
    @param {string} url REST API URL with format https://xxxx.xxx.xx
    @param {number} stake - amount to stake
    @param {number} fee - fee of the proposer
    @returns {Promise} A promise that resolves to the Ethereum transaction receipt.
    */
  async registerProposer(url, stake, fee) {
    const res = await axios.post(`${this.optimistBaseUrl}/proposer/register`, {
      address: this.ethereumAddress,
      url,
      fee,
    });
    if (res.data.txDataToSign === '') return false; // already registered
    return new Promise((resolve, reject) => {
      proposerQueue.push(async () => {
        try {
          logger.debug('Submitting register transaction');
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.proposersContractAddress,
            stake,
          );
          logger.debug('Proposer registered on chain');
          resolve(receipt);
        } catch (err) {
          logger.error(`Register proposer failed with error ${err.message}`);
          reject(err);
        }
      });
    });
  }

  /**
    De-registers an existing proposer.
    It will use the address of the Ethereum Signing key that is holds to de-register
    the proposer.
    @method
    @async
    @returns {Promise} A promise that resolves to the Ethereum transaction receipt.
    */
  async deregisterProposer() {
    const res = await axios.post(`${this.optimistBaseUrl}/proposer/de-register`, {
      address: this.ethereumAddress,
    });
    return new Promise((resolve, reject) => {
      proposerQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.proposersContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Change current proposer.
    It will use the address of the Ethereum Signing key that is holds to change the current
    proposer.
    @method
    @async
    @returns {Promise} A promise that resolves to the Ethereum transaction receipt.
    */
  async changeCurrentProposer() {
    const res = await axios.get(`${this.optimistBaseUrl}/proposer/change`, {
      address: this.ethereumAddress,
    });
    return new Promise((resolve, reject) => {
      proposerQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.stateContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Withdraw the stake left by the proposer.
    It will use the address of the Ethereum Signing key that is holds to withdraw the stake.
    @method
    @async
    @returns {Promise} A promise that resolves to the Ethereum transaction receipt.
    */
  async withdrawStake() {
    const res = await axios.post(`${this.optimistBaseUrl}/proposer/withdrawStake`, {
      address: this.ethereumAddress,
    });
    return new Promise((resolve, reject) => {
      proposerQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.proposersContractAddress,
            0,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
    Get all the proposer pending payments.
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum transaction receipt.
    */
  async getProposerPendingPayments() {
    const res = await axios.get(`${this.optimistBaseUrl}/proposer/pending-payments`, {
      params: {
        proposerAddress: this.ethereumAddress,
      },
    });
    return res.data.pendingPayments;
  }

  /**
    Get all the proposer stake.
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum transaction receipt.
    */
  async getProposerStake() {
    const res = await axios.get(`${this.optimistBaseUrl}/proposer/stake`, {
      params: {
        proposerAddress: this.ethereumAddress,
      },
    });
    return res.data;
  }

  /**
    Request block payment.
    @method
    @async
    @return {Promise} A promise that resolves to an axios response.
    */
  async requestBlockPayment(blockHash) {
    const res = await axios.post(`${this.optimistBaseUrl}/proposer/payment`, {
      address: this.ethereumAddress,
      blockHash,
    });
    return this.submitTransaction(res.data.txDataToSign, this.shieldContractAddress, 0);
  }

  /**
    Get current proposer
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum transaction receipt.
    */
  async getCurrentProposer() {
    const res = await axios.get(`${this.optimistBaseUrl}/proposer/current-proposer`);
    return res.data.currentProposer;
  }

  /**
    Get all the list of existing proposers.
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum transaction receipt.
    */
  async getProposers() {
    const res = await axios.get(`${this.optimistBaseUrl}/proposer/proposers`);
    return res.data;
  }

  /**
    Update Proposers URL
    @method
    @async
    @param {string} Proposer REST API URL with format https://xxxx.xxx.xx
    @param {number} stake - amount to stake
    @param {number} fee - fee of the proposer
    @returns {array} A promise that resolves to the Ethereum transaction receipt.
    */
  async updateProposer(url, stake, fee) {
    const res = await axios.post(`${this.optimistBaseUrl}/proposer/update`, {
      address: this.ethereumAddress,
      url,
      fee,
    });
    logger.debug(`Proposer with address ${this.ethereumAddress} updated to URL ${url}`);
    return new Promise((resolve, reject) => {
      proposerQueue.push(async () => {
        try {
          const receipt = await this.submitTransaction(
            res.data.txDataToSign,
            this.proposersContractAddress,
            stake,
          );
          resolve(receipt);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  createEmitter() {
    const emitter = new EventEmitter();

    /*
      Listen for 'error' events. If no event listeners are found for 'error', then the error stops node instance.
     */
    emitter.on('error', error => logger.error({ msg: 'Error caught by emitter', error }));

    return emitter;
  }

  /**
    Get block stake
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum call.
    */
  async getBlockStake() {
    return this.stateContract.methods.getBlockStake().call();
  }

  /**
      Get minimum stake
      @method
      @async
      @returns {array} A promise that resolves to the Ethereum call.
      */
  async getMinimumStake() {
    return this.stateContract.methods.getMinimumStake().call();
  }

  /**
    Get rotate proposer blocks
    @method
    @async
    @returns {array} A promise that resolves to the Ethereum call.
    */
  async getRotateProposerBlocks() {
    return this.stateContract.methods.getRotateProposerBlocks().call();
  }

  // used by proposers and challengers
  async getPendingWithdrawsFromStateContract() {
    return this.stateContract.methods.pendingWithdrawalsFees(this.ethereumAddress).call();
  }

  /**
    Starts a Proposer that listens for blocks and submits block proposal
    transactions to the blockchain.
    @method
    @async
    */
  async startProposer() {
    const proposeEmitter = this.createEmitter();
    const connection = new ReconnectingWebSocket(this.optimistWsUrl, [], { WebSocket });

    this.websockets.push(connection); // save so we can close it properly later

    /*
      we can't setup up a ping until the connection is made because the ping function
      only exists in the underlying 'ws' object (_ws) and that is undefined until the
      websocket is opened, it seems. Hence, we put all this code inside the onopen.
     */
    connection.onopen = () => {
      // setup a ping every 15s
      this.intervalIDs.push(
        setInterval(() => {
          ping(connection._ws);
        }, WEBSOCKET_PING_TIME),
      );
      // and a listener for the pong
      logger.debug('Proposer websocket connection opened');

      connection.send('blocks');
    };

    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign, block, transactions, data } = msg;

      logger.debug(`Proposer received websocket message of type ${type}`);

      if (type === 'block') {
        // First sign transaction, and send it within asynchronous queue. This will
        // ensure that blockProposed events are emitted in order and with the correct nonce.
        const tx = await this._signTransaction(txDataToSign, this.stateContractAddress, 0); // we don't send more stake
        proposerQueue.push(async () => {
          try {
            const receipt = await this._sendTransaction(tx);
            proposeEmitter.emit('receipt', receipt, block, transactions);
          } catch (err) {
            logger.error({
              msg: 'Error while trying to submit a block',
              err,
            });

            // block proposed is reverted. Send transactions back to mempool
            try {
              await axios.get(`${this.optimistBaseUrl}/block/reset-localblock`);
            } catch (errorResetLocalBlock) {
              logger.error({
                msg: 'Error while trying to reset local block',
                errorResetLocalBlock,
              });
            }
            proposeEmitter.emit('error', err, block, transactions);
          }
        });
      } else if (type === 'rollback') {
        proposeEmitter.emit('rollback', data);
      }

      return null;
    };

    connection.onerror = () => logger.error('Proposer websocket connection error');
    connection.onclosed = () => logger.warn('Proposer websocket connection closed');

    // add this proposer to the list of peers that can accept direct transfers and withdraws
    return proposeEmitter;
  }

  /**
    Send offchain transaction to Optimist
    @method
    @async
    @param {string} transaction
    @returns {array} A promise that resolves to the API call status
    */
  async sendOffchainTransaction(transaction) {
    const res = axios.post(
      `${this.optimistBaseUrl}/proposer/offchain-transaction`,
      { transaction },
      { timeout: 3600000 },
    );
    return res.status;
  }

  /**
    Starts a Challenger that listens for challengable blocks and submits challenge
    transactions to the blockchain to challenge the block.
    @method
    @async
    */
  async startChallenger() {
    const challengeEmitter = this.createEmitter();
    const connection = new ReconnectingWebSocket(this.optimistWsUrl, [], { WebSocket });

    this.websockets.push(connection); // save so we can close it properly later

    /*
      we can't setup up a ping until the connection is made because the ping function
      only exists in the underlying 'ws' object (_ws) and that is undefined until the
      websocket is opened, it seems. Hence, we put all this code inside the onopen.
     */
    connection.onopen = () => {
      // setup a ping every 15s
      this.intervalIDs.push(
        setInterval(() => {
          ping(connection._ws);
        }, WEBSOCKET_PING_TIME),
      );
      // and a listener for the pong
      logger.debug('Challenge websocket connection opened');

      connection.send('challenge');
    };

    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign, sender } = msg;

      logger.debug(`Challenger received websocket message of type ${type}`);

      // if we're about to challenge, check it's actually our challenge, so as not to waste gas
      if (type === 'challenge' && sender !== this.ethereumAddress) return null;
      if (type === 'commit' || type === 'challenge') {
        // Get the function selector from the encoded ABI, which corresponds to the first 4 bytes.
        // In hex, it will correspond to the first 8 characters + 2 extra characters (0x), hence we
        // do slice(0,10)
        const txSelector = txDataToSign.slice(0, 10);
        challengerQueue.push(async () => {
          try {
            const receipt = await this.submitTransaction(
              txDataToSign,
              this.challengesContractAddress,
              0,
            );
            challengeEmitter.emit('receipt', receipt, type, txSelector);
          } catch (err) {
            logger.error({
              msg: 'Error while trying to challenge a block',
              type,
              err,
            });
            challengeEmitter.emit('error', err, type, txSelector);
          }
        });
        logger.debug(`queued ${type} ${txDataToSign}`);
      }
      if (type === 'rollback') {
        challengeEmitter.emit('rollback', 'rollback complete');
      }
      return null;
    };
    connection.onerror = () => logger.error('websocket connection error');
    connection.onclosed = () => logger.warn('websocket connection closed');
    return challengeEmitter;
  }

  // method to turn challenges off and on.  Note, this does not affect the queue
  challengeEnable(enable) {
    return axios.post(`${this.optimistBaseUrl}/challenger/enable`, { enable });
  }

  // eslint-disable-next-line class-methods-use-this
  pauseQueueChallenger() {
    return new Promise(resolve => {
      if (challengerQueue.autostart) {
        // put an event at the head of the queue which will cleanly pause it.
        challengerQueue.unshift(async () => {
          challengerQueue.autostart = false;
          challengerQueue.stop();
          logger.info(`queue challengerQueue has been paused`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  unpauseQueueChallenger() {
    challengerQueue.autostart = true;
    challengerQueue.unshift(async () => logger.info(`queue challengerQueue has been unpaused`));
  }

  /**
    Returns the balance of tokens held in layer 2
    @method
    @async
    @param {Array} ercList - list of erc contract addresses to filter.
    @returns {Promise} This promise resolves into an object whose properties are the
    addresses of the ERC contracts of the tokens held by this account in Layer 2. The
    value of each propery is the number of tokens originating from that contract.
    */
  async getLayer2Balances({ ercList } = {}) {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/balance`, {
      params: {
        compressedZkpPublicKey: this.zkpKeys.compressedZkpPublicKey,
        ercList,
      },
    });
    return res.data.balance;
  }

  async getLayer2BalancesUnfiltered({ ercList } = {}) {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/balance`, {
      params: {
        compressedZkpPublicKey: ercList,
      },
    });
    return res.data.balance;
  }

  /**
    Returns the balance of tokens held in layer 2
    @method
    @async
    @param {Array} ercList - list of erc contract addresses to filter.
    @param {Boolean} filterByCompressedZkpPublicKey - flag to indicate if request is filtered
    ones compressed zkp public key
    @returns {Promise} This promise resolves into an object whose properties are the
    addresses of the ERC contracts of the tokens held by this account in Layer 2. The
    value of each propery is the number of tokens pending deposit from that contract.
    */
  async getLayer2PendingDepositBalances(ercList, filterByCompressedZkpPublicKey) {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/pending-deposit`, {
      params: {
        compressedZkpPublicKey:
          filterByCompressedZkpPublicKey === true ? this.zkpKeys.compressedZkpPublicKey : null,
        ercList,
      },
    });
    return res.data.balance;
  }

  /**
    Returns the balance of tokens held in layer 2
    @method
    @async
    @param {Array} ercList - list of erc contract addresses to filter.
    @param {Boolean} filterByCompressedZkpPublicKey- flag to indicate if request is filtered
    ones compressed zkp public key
    @returns {Promise} This promise resolves into an object whose properties are the
    addresses of the ERC contracts of the tokens held by this account in Layer 2. The
    value of each propery is the number of tokens pending spent (transfer & withdraw)
    from that contract.
    */
  async getLayer2PendingSpentBalances(ercList, filterByCompressedZkpPublicKey) {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/pending-spent`, {
      params: {
        compressedZkpPublicKey:
          filterByCompressedZkpPublicKey === true ? this.zkpKeys.compressedZkpPublicKey : null,
        ercList,
      },
    });
    return res.data.balance;
  }

  /**
    Returns the commitments of tokens held in layer 2
    @method
    @async
    @param {Array} ercList - list of erc contract addresses to filter.
    @param {Boolean} filterByCompressedZkpPublicKey- flag to indicate if request is filtered
    @returns {Promise} This promise resolves into an object whose properties are the
    addresses of the ERC contracts of the tokens held by this account in Layer 2. The
    value of each propery is an array of commitments originating from that contract.
    */
  async getLayer2Commitments(ercList, filterByCompressedZkpPublicKey) {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/commitments`, {
      params: {
        compressedZkpPublicKey:
          filterByCompressedZkpPublicKey === true ? [this.zkpKeys.compressedZkpPublicKey] : [],
        ercList,
      },
    });
    return res.data.commitments;
  }

  /**
    Returns the pending withdraws commitments
    @method
    @async
    @returns {Promise} This promise resolves into an object whose properties are the
    addresses of the ERC contracts of the tokens held by this account in Layer 2. The
    value of each propery is an array of withdraw commitments originating from that contract.
    */
  async getPendingWithdraws() {
    const res = await axios.get(`${this.clientBaseUrl}/commitment/withdraws`);
    return res.data.commitments;
  }

  /**
   * Set a Web3 Provider URL
   */
  async setWeb3Provider() {
    // initialization of web3 provider has been taken from common-files/utils/web3.mjs
    //  Target is to mainain web3 socker alive
    const WEB3_PROVIDER_OPTIONS = {
      clientConfig: {
        // Useful to keep a connection alive
        keepalive: true,
        keepaliveInterval: 10,
      },
      timeout: 3600000,
      reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 120,
        onTimeout: false,
      },
    };
    const provider = new Web3.providers.WebsocketProvider(this.web3WsUrl, WEB3_PROVIDER_OPTIONS);

    this.web3 = new Web3(provider);
    this.web3.eth.transactionBlockTimeout = 2000;
    this.web3.eth.transactionConfirmationBlocks = 12;
    if (typeof window !== 'undefined') {
      if (window.ethereum && this.ethereumSigningKey === '') {
        this.web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        // Metamask not available
        throw new Error('No Web3 provider found');
      }
    }

    provider.on('error', err => logger.error(`web3 error: ${err}`));
    provider.on('connect', () => logger.info('Blockchain Connected ...'));
    provider.on('end', () => logger.info('Blockchain disconnected'));

    // attempt a reconnect if the socket is down
    this.intervalIDs.push(() => {
      setInterval(() => {
        if (!this.web3.currentProvider.connected) this.web3.setProvider(provider);
      }, 2000);
    });
    // set up a pinger to ping the web3 provider. This will help to further ensure
    // that the websocket doesn't timeout. We don't use the blockNumber but we save it
    // anyway. Someone may find a use for it.
    this.intervalIDs.push(() => {
      setInterval(() => {
        this.blockNumber = this.web3.eth.getBlockNumber();
      }, WEBSOCKET_PING_TIME);
    });
  }

  /**
    Web3 provider getter
    @returns {Object} provider
    */
  getWeb3Provider() {
    return this.web3;
  }

  /**
    Get Ethereum Balance
    @param {String} address - Ethereum address of account
    @returns {String} - Ether balance in account
    */
  getL1Balance(address) {
    return this.web3.eth.getBalance(address).then(function (balanceWei) {
      return Web3.utils.fromWei(balanceWei);
    });
  }

  /**
    Get EthereumAddress available.
    @param {String} privateKey - Private Key - optional
    @returns {String} - Ether balance in account
    */
  getAccounts() {
    const account =
      this.ethereumSigningKey.length === 0
        ? this.web3.eth.getAccounts().then(address => address[0])
        : this.web3.eth.accounts.privateKeyToAccount(this.ethereumSigningKey).address;
    return account;
  }

  /**
    Signs a message with a given authenticated account
    @param {String} msg  - Message to sign
    @param {String } account - Ethereum address of account
    @returns {Promise} - string with the signature
    */
  signMessage(msg, account) {
    if (this.ethereumSigningKey) {
      return this.web3.eth.accounts.sign(msg, this.ethereumSigningKey).signature;
    }
    return this.web3.eth.personal.sign(msg, account);
  }

  /**
  Returns current network ID
  @returns {Promise} - Network Id number
  */
  getNetworkId() {
    return this.web3.eth.net.getId();
  }

  /**
   Validates an X509 (RSA) certificate
   */
  async validateCertificate(
    certificate,
    ethereumAddressSignature,
    isEndUser,
    checkOnly,
    oidGroup = 0,
    address,
  ) {
    // now validate the cert
    if (!address) address = '0x0000000000000000000000000000000000000000';
    const res = await axios.post(`${this.clientBaseUrl}/x509/validate`, {
      certificate,
      ethereumAddressSignature,
      isEndUser,
      checkOnly,
      oidGroup,
      address,
    });
    const txDataToSign = res.data;
    return this.submitTransaction(txDataToSign, this.x509ContractAddress);
  }

  /**
    Get proposerStartBlock
    @method
    @async
    @returns {uint256} A promise that resolves to the Ethereum call.
    */
  async proposerStartBlock() {
    return this.stateContract.methods.proposerStartBlock().call();
  }

  /**
  getMaxProposers
  @method
  @async
  @returns {uint256} A promise that resolves to the Ethereum call.
  */
  async getMaxProposers() {
    return this.stateContract.methods.getMaxProposers().call();
  }

  /**
  get spanProposersList
  @method
  @async
  @returns {uint256} A promise that resolves to the Ethereum call.
  */
  async spanProposersList(sprint) {
    return this.stateContract.methods.spanProposersList(sprint).call();
  }

  /**
  get currentSprint
  @method
  @async
  @returns {uint256} A promise that resolves to the Ethereum call.
  */
  async currentSprint() {
    return this.stateContract.methods.currentSprint().call();
  }

  /**
  getNumProposers
  @method
  @async
  @returns {uint256} A promise that resolves to the Ethereum call.
  */
  async getNumProposers() {
    return this.stateContract.methods.getNumProposers().call();
  }

  /**
    getSprintsInSpan
    @method
    @async
    @returns {uint256} A promise that resolves to the Ethereum call.
    */
  async getSprintsInSpan() {
    return this.stateContract.methods.getSprintsInSpan().call();
  }

  /**
   * Get L2 transaction (tx) status for a given L2 tx hash
   *
   * @async
   * @method getL2TransactionStatus
   * @param {string} l2TransactionHash - L2 tx hash
   * @returns {Promise<AxiosResponse>}
   * @throws 404 tx not found, 400 tx is incorrect
   */
  async getL2TransactionStatus(l2TransactionHash) {
    return axios.get(`${this.clientBaseUrl}/transaction/status/${l2TransactionHash}`);
  }

  /**
   * function start periodic payment
   * @param cronExp {string} default is At 00:00 on every 6th day-of-week (Saturday).
   */
  startPeriodicPayment(cronExp = '0 0 * * */6') {
    this.periodicPaymentJob = createJob(cronExp, async () => {
      try {
        logger.info(`--in cron job --- ${new Date().toLocaleString()}`);
        const { feesL1, feesL2 } = await this.getPendingWithdrawsFromStateContract();
        logger.info(
          `${this.ethereumAddress} pending balance are feesL1 - ${feesL1}, and feesL2 - ${feesL2}`,
        );
        if (Number(feesL1) < this.minL1Balance && Number(feesL2) < this.minL2Balance) {
          return;
        }
        const { txDataToSign } = (await axios.post(`${this.optimistBaseUrl}/proposer/withdraw`))
          .data;
        const tx = await this._signTransaction(txDataToSign, this.stateContractAddress, 0);
        await this._sendTransaction(tx);
      } catch (err) {
        logger.error({
          msg: 'Error while trying to submit withdraw tx',
          err,
        });
      }
    });
    this.periodicPaymentJob.start();
  }

  /**
   * This function not just stop periodic payment job
   * but also destroys it as well
   */
  stopPeriodicPayment() {
    if (!this.periodicPaymentJob) throw Error('Periodic Payment job not created yet');
    this.periodicPaymentJob.stop();
    this.periodicPaymentJob = undefined;
  }
}

export default Nf3;
