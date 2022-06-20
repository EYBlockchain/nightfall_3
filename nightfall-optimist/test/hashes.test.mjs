import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Web3 from 'web3';
import Transaction from 'common-files/classes/transaction.mjs';
import Block from '../src/classes/block.mjs';
import State from './State.json';
import Transactions from './transactions.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const optimistUrl = 'http://localhost:8081';
const web3WsUrl = 'ws://localhost:8546';

let web3;

const setWeb3Provider = async () => {
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
  const provider = new Web3.providers.WebsocketProvider(web3WsUrl, WEB3_PROVIDER_OPTIONS);

  web3 = new Web3(provider);
};

const getContractInstance = async (contractAbi, contractAddress) => {
  const contractInstance = new web3.eth.Contract(contractAbi, contractAddress);
  return contractInstance;
};

describe('Hashes test', () => {
  before(async () => {
    await setWeb3Provider();
  });

  it('should check transaction hashes root in optimist and contracts are the same', async function () {
    // Test transactions generated from optimist

    /* const transactions = [
      {
        transactionHash: '0xe46dfaf17de8586af0776c7c47435642e261ee1c93935fa2eed4c228772c4793',
        blockNumber: 296,
        blockNumberL2: -1,
        commitments: [
          '0x00cdc45b90c8caadc5bdc31eef6d8bf93bd254573fb6b52612286e829da686cf',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        compressedSecrets: [
          '0x1f8f7967100f71e712d8bbb8e74d83a177697ea4254daa3372b6401c10feae0a',
          '0x28fe23540df5e551538a0b925a496d1e6efe5bdfbbd4fdfaa0b41db92723586a',
          '0x8f5628294c6785ff0ef8cc03c64e83d1051ea6f81110894f6386f82a4c0e3e13',
          '0x06a6c0c985902ebb230506f61398fea242cadad2f0921c0f80bfac6004da205a',
          '0x9fc88ba3bfdabd4b53494285336f5908bdd9e83b6b903c574e7b43553966b1b6',
          '0x9be99dd30a62c85bc2717f5c53f3f07dd42e8e37a08649466ee6650fc0bb12b0',
          '0x07d76d6a2d8ea73e210d0b5fec2fc41487404696a7dd92e641f0be92477793bc',
          '0xaa1f4df50186740c575a66eac58746446853e6f629155f61e1c07fef2518e32f',
        ],
        ercAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
        fee: 10,
        historicRootBlockNumberL2: ['1', '0'],
        mempool: true,
        nullifiers: [
          '0x0087ffaf3ff2f8af5d69530afbcc0c8a3b607c0fb1c40b5a6f5ef4131dcecdfa',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        proof: [
          '0x2d3dde8bf821f13b52d888abe0bc162c323f023cacd7fbb892be8d2a2d426d6c',
          '0x13ac286fc9a124562ab8a87504a8d61568576bc1761f9fa921d9337eaa247853',
          '0x16d63dcf25b694797aeb4ee4639d3067489b5b92bdc614fc0dedaf9af3c6b970',
          '0x1e0824cc791a709b21677c13b0d59b6b17a6c56c133cb4965ceeaf4ae7304f78',
          '0x12b133ede4f0398bb75ade2ae613f01474ced00667df093fd2795beba15477fe',
          '0x1b18673347655eb9e3464f0352a678ac47125fa9c8b918a7473d7aae194a644f',
          '0x14c1dbe0108c6ae766f5a5219eeac19094c9a1bf7b26e14bc9e595a449d9d779',
          '0x2e7e6f178af8653eb4b00b15ce1ec30ea6e3a319ed15beecfcf8675ceb1e871d',
        ],
        recipientAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
        tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        tokenType: '0',
        transactionHashL1: '0x986f95b4841a01f8c79472b27bea6fda3915394ecd033d11498aa3260b7778fa',
        transactionType: '1',
        value: 0,
      },
      {
        transactionHash: '0x0a5eb884661f3a7d7321c588c1ba29f37831a636c99d3b5a17bdc3199dddff71',
        blockNumber: 301,
        blockNumberL2: -1,
        commitments: [
          '0x009dfdde08c8b6e4bf1b18ead1ac2fd591a3f5227a8536a1f4ba97ccfbe2a171',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        compressedSecrets: [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        ercAddress: '0x0000000000000000000000009b7bd670d87c3dd5c808ba627c75ba7e88ad066f',
        fee: 10,
        historicRootBlockNumberL2: ['0', '0'],
        mempool: true,
        nullifiers: [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
        proof: [
          '0x1357dfaf6e965385cedd6e78943bf4c9caf5a16aec79a9d01e4dca6e83ddc78c',
          '0x18251fbcd7548a8d0319a71728185bbc1b0bfabf037aee812a4a2f1f85495bbe',
          '0x1020fe0b05a0d3423599739678e17bd665242e70c14720dbe500dd038527d5f6',
          '0x2cfad0db6ee83732ad72187b80f323b737e7d56629acae9716ce9f0b80b525a8',
          '0x11c2ce255177de35f4c6474d897115be76398c1d637bc47c19f0e7720b4185f5',
          '0x2666fb518a02eb1e2875c1fed71bca929627c0a962cc83a49ecfe10d7ea810f4',
          '0x0fda0b8d10c66ee9baf2397c28b28ee7d51ea15d7c352c330ffddf5d7fc17745',
          '0x2459bc1f1e8b141efcc83817782dee5bc60daed95d8c61f77f94d6f484a568ec',
        ],
        recipientAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
        tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        tokenType: '0',
        transactionHashL1: '0x3bed9f3f88e2c973a9e5b2bc854f12ebb5ee90a061956630b94c609533dbfe9b',
        transactionType: '0',
        value: 5,
      },
    ];

    const transact = {
      transactionHash: '0xe46dfaf17de8586af0776c7c47435642e261ee1c93935fa2eed4c228772c4793',
      blockNumber: 296,
      blockNumberL2: -1,
      commitments: [
        '0x00cdc45b90c8caadc5bdc31eef6d8bf93bd254573fb6b52612286e829da686cf',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
      compressedSecrets: [
        '0x1f8f7967100f71e712d8bbb8e74d83a177697ea4254daa3372b6401c10feae0a',
        '0x28fe23540df5e551538a0b925a496d1e6efe5bdfbbd4fdfaa0b41db92723586a',
        '0x8f5628294c6785ff0ef8cc03c64e83d1051ea6f81110894f6386f82a4c0e3e13',
        '0x06a6c0c985902ebb230506f61398fea242cadad2f0921c0f80bfac6004da205a',
        '0x9fc88ba3bfdabd4b53494285336f5908bdd9e83b6b903c574e7b43553966b1b6',
        '0x9be99dd30a62c85bc2717f5c53f3f07dd42e8e37a08649466ee6650fc0bb12b0',
        '0x07d76d6a2d8ea73e210d0b5fec2fc41487404696a7dd92e641f0be92477793bc',
        '0xaa1f4df50186740c575a66eac58746446853e6f629155f61e1c07fef2518e32f',
      ],
      ercAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
      fee: 10,
      historicRootBlockNumberL2: ['1', '0'],
      mempool: true,
      nullifiers: [
        '0x0087ffaf3ff2f8af5d69530afbcc0c8a3b607c0fb1c40b5a6f5ef4131dcecdfa',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
      proof: [
        '0x2d3dde8bf821f13b52d888abe0bc162c323f023cacd7fbb892be8d2a2d426d6c',
        '0x13ac286fc9a124562ab8a87504a8d61568576bc1761f9fa921d9337eaa247853',
        '0x16d63dcf25b694797aeb4ee4639d3067489b5b92bdc614fc0dedaf9af3c6b970',
        '0x1e0824cc791a709b21677c13b0d59b6b17a6c56c133cb4965ceeaf4ae7304f78',
        '0x12b133ede4f0398bb75ade2ae613f01474ced00667df093fd2795beba15477fe',
        '0x1b18673347655eb9e3464f0352a678ac47125fa9c8b918a7473d7aae194a644f',
        '0x14c1dbe0108c6ae766f5a5219eeac19094c9a1bf7b26e14bc9e595a449d9d779',
        '0x2e7e6f178af8653eb4b00b15ce1ec30ea6e3a319ed15beecfcf8675ceb1e871d',
      ],
      recipientAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokenType: '0',
      transactionHashL1: '0x986f95b4841a01f8c79472b27bea6fda3915394ecd033d11498aa3260b7778fa',
      transactionType: '1',
      value: 0,
    };

    for (let i = 0; i < 30; i++) {
      transactions.push(transact);
    }
    */

    const { transactions, priorBlockTransactions } = Transactions;
    console.log('transactions.LENGHT: ', transactions.length);
    console.log('priorBlockTransactions.LENGHT: ', priorBlockTransactions.length);

    const res = await chai.request(optimistUrl).get('/contract-address/State');
    const stateAddress = res.body.address;
    const stateContractInstance = await getContractInstance(State.abi, stateAddress);
    const utilsTransactionHashesRoot = await stateContractInstance.methods
      .hashTransactionHashes(transactions.map(t => Transaction.buildSolidityStruct(t)))
      .call();
    const optimistTransactionHashesRoot = Block.calcTransactionHashesRoot(transactions);

    expect(optimistTransactionHashesRoot).to.be.equal(utilsTransactionHashesRoot);

    const utilsTransactionHashesRoot2 = await stateContractInstance.methods
      .hashTransactionHashes(priorBlockTransactions.map(t => Transaction.buildSolidityStruct(t)))
      .call();
    const optimistTransactionHashesRoot2 = Block.calcTransactionHashesRoot(priorBlockTransactions);

    expect(optimistTransactionHashesRoot2).to.be.equal(utilsTransactionHashesRoot2);
  });

  after(async () => {
    web3.currentProvider.connection.close();
  });
});
