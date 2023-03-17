import { expect } from 'chai';
import hardhat from 'hardhat';
import { rand } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import {
  calculateTransactionHash,
  calculateBlockHash,
  createBlockAndTransactions,
} from '../utils/utils.mjs';
import { setCommitmentHashEscrowed } from '../utils/stateStorage.mjs';
import { unpackBlockInfo } from '../../../common-files/utils/block-utils.mjs';

const { ethers, upgrades } = hardhat;

describe('Challenges contract Challenges functions', function () {
  let ProposersInstance;
  let challenges;
  let addr1;
  let state;
  let transactionsCreated;
  let shield;
  let merkleTree;
  let challengesUtil;
  let sanctionedSigner;

  before(async () => {
    const owner = await ethers.getSigners();
    [, , , , sanctionedSigner] = owner;
  });

  beforeEach(async () => {
    [addr1] = await ethers.getSigners();

    transactionsCreated = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      0,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      1,
      '0x11cf76de9bb2b1efc8270e7e2380417daaa4c016456b43cfa831cea32b7840ba',
    );

    const Proposers = await ethers.getContractFactory('Proposers');
    ProposersInstance = await upgrades.deployProxy(Proposers, []);
    await ProposersInstance.deployed();

    const Verifier = await ethers.getContractFactory('Verifier');
    const verifier = await Verifier.deploy();
    await verifier.deployed();

    const Poseidon = await ethers.getContractFactory('Poseidon');
    const poseidon = await Poseidon.deploy();
    await poseidon.deployed();

    const MerkleTree = await ethers.getContractFactory('MerkleTree_Stateless', {
      libraries: {
        Poseidon: poseidon.address,
      },
    });
    merkleTree = await MerkleTree.deploy();
    await merkleTree.deployed();

    const ChallengesUtil = await ethers.getContractFactory('ChallengesUtil', {
      libraries: {
        MerkleTree_Stateless: merkleTree.address,
      },
    });
    challengesUtil = await ChallengesUtil.deploy();
    await challengesUtil.deployed();

    const Utils = await ethers.getContractFactory('Utils');
    const utils = await Utils.deploy();
    await utils.deployed();

    const Challenges = await ethers.getContractFactory('Challenges', {
      libraries: {
        Verifier: verifier.address,
        ChallengesUtil: challengesUtil.address,
        Utils: utils.address,
      },
    });
    challenges = await upgrades.deployProxy(Challenges, [], {
      unsafeAllow: ['external-library-linking'],
    });
    await challenges.deployed();

    const X509 = await ethers.getContractFactory('X509');
    const x509 = await upgrades.deployProxy(X509, []);
    await x509.enableWhitelisting(false);

    const SanctionsListMockDeployer = await ethers.getContractFactory('SanctionsListMock');
    const sanctionsListMockInstance = await SanctionsListMockDeployer.deploy(
      sanctionedSigner.address,
    );
    const sanctionsListAddress = sanctionsListMockInstance.address;

    const Shield = await ethers.getContractFactory('Shield');
    shield = await upgrades.deployProxy(Shield, [sanctionsListAddress, x509.address], {
      initializer: 'initializeState',
    });
    await shield.deployed();

    const State = await ethers.getContractFactory('State', {
      libraries: {
        Utils: utils.address,
      },
    });
    state = await upgrades.deployProxy(State, [addr1.address, challenges.address, shield.address], {
      unsafeAllow: ['external-library-linking'],
      initializer: 'initializeState',
    });
    await state.deployed();

    await ProposersInstance.setStateContract(state.address);

    await challenges.setStateContract(state.address);
  });

  afterEach(async () => {
    // clear down the test network after each test
    await hardhat.network.provider.send('hardhat_reset');
  });

  it('should commitToChallenge', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });
    const hashedTx = ethers.utils.solidityKeccak256(
      ['string', 'string'],
      [newTx.withdrawTransaction, newTx.depositTransaction],
    );
    const tx = await challenges.commitToChallenge(hashedTx);
    expect(await challenges.committers(hashedTx)).to.equal(addr1.address);

    const receipt = await tx.wait();

    const eventCommittedToChallenge = receipt.events.find(
      event => event.event === 'CommittedToChallenge',
    );
    const { commitHash, sender } = eventCommittedToChallenge.args;

    expect(commitHash).to.equal(hashedTx);
    expect(sender).to.equal(addr1.address);
  });

  it('should not commitToChallenge: Hash already committed to', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });
    const hashedTx = ethers.utils.solidityKeccak256(
      ['string', 'string'],
      [newTx.withdrawTransaction, newTx.depositTransaction],
    );
    const tx = await challenges.commitToChallenge(hashedTx);
    expect(await challenges.committers(hashedTx)).to.equal(addr1.address);

    const receipt = await tx.wait();

    const eventCommittedToChallenge = receipt.events.find(
      event => event.event === 'CommittedToChallenge',
    );
    const { commitHash, sender } = eventCommittedToChallenge.args;

    expect(commitHash).to.equal(hashedTx);
    expect(sender).to.equal(addr1.address);

    await expect(challenges.commitToChallenge(hashedTx)).to.be.revertedWith(
      'Hash already committed to',
    );
  });

  it('should challengeLeafCountCorrect', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });
    const salt = (await rand(32)).hex(32);
    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await challenges.challengeLeafCountCorrect(
      transactionsCreated.block,
      newTx.block,
      [newTx.withdrawTransaction, newTx.depositTransaction],
      salt,
    );
    expect(await challenges.committers(hashedData)).to.equal(ethers.constants.AddressZero);
  });

  it('should not challengeLeafCountCorrect: Cannot challenge block', async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId === 31337 || network.chainId === 1337) {
      const newUrl = 'url';
      const newFee = 100;
      const amount = 100;
      const challengeLocked = 5;

      await state.setProposer(addr1.address, [
        addr1.address,
        addr1.address,
        addr1.address,
        newUrl,
        newFee,
        false,
        0,
      ]);
      await state.setNumProposers(1);
      await state.setCurrentProposer(addr1.address);
      await state.setStakeAccount(addr1.address, amount, challengeLocked);
      await setCommitmentHashEscrowed(
        state.address,
        transactionsCreated.depositTransaction.commitments,
      );
      await state.proposeBlock(
        transactionsCreated.block,
        [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
        {
          value: 10,
        },
      );
      const newTx = createBlockAndTransactions(
        '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
        addr1.address,
        1,
        calculateBlockHash(transactionsCreated.block),
      );
      await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
        value: 10,
      });
      const salt = (await rand(32)).hex(32);
      // eslint-disable-next-line prefer-destructuring
      const data = (
        await challenges.populateTransaction.challengeLeafCountCorrect(
          transactionsCreated.block,
          newTx.block,
          [newTx.withdrawTransaction, newTx.depositTransaction],
          salt,
        )
      ).data;
      const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
      await challenges.commitToChallenge(hashedData);
      await ethers.provider.send('evm_increaseTime', [604800]); // + 1 week
      await ethers.provider.send('evm_mine');
      await expect(
        challenges.challengeLeafCountCorrect(
          transactionsCreated.block,
          newTx.block,
          [newTx.withdrawTransaction, newTx.depositTransaction],
          salt,
        ),
      ).to.be.revertedWith('Cannot challenge block');
    } else {
      console.log('Test skipped');
    }
  });

  it('should not challengeLeafCountCorrect: The leafCount is actually correct', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
      3,
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });
    const salt = (await rand(32)).hex(32);
    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      ),
    ).to.be.revertedWith('The leafCount is actually correct');
  });

  it('should not challengeLeafCountCorrect: Commitment hash is invalid', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });
    const salt = (await rand(32)).hex(32);
    await expect(
      challenges.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      ),
    ).to.be.revertedWith('Commitment hash is invalid');
  });

  it('should not challengeLeafCountCorrect: Blocks needs to be subsequent', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const newTx2 = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      2,
      calculateBlockHash(newTx.block),
    );
    await state.proposeBlock(
      newTx2.block,
      [newTx2.withdrawTransaction, newTx2.depositTransaction],
      {
        value: 10,
      },
    );
    const salt = (await rand(32)).hex(32);
    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx2.block,
        [newTx2.withdrawTransaction, newTx2.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeLeafCountCorrect(
        transactionsCreated.block,
        newTx2.block,
        [newTx2.withdrawTransaction, newTx2.depositTransaction],
        salt,
      ),
    ).to.be.revertedWith('Blocks needs to be subsequent');
  });

  it('should challengeHistoricRootBlockNumber', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const siblingPath = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const TransactionInfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };
    const salt = '0x06032a0304000000000000000000000000000000000000000000000000000000';
    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeHistoricRootBlockNumber(
        TransactionInfoBlock,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    const tx = await challenges.challengeHistoricRootBlockNumber(TransactionInfoBlock, salt);

    const receipt = await tx.wait();

    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should not challengeHistoricRootBlockNumber: Historic roots are not greater than L2BlockNumber on chain', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const createNblock = 10;
    let prevBlockHash = calculateBlockHash(newTx.block);
    for (let i = 0; i < createNblock; i++) {
      const newTx2 = createBlockAndTransactions(
        '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
        addr1.address,
        2 + i,
        prevBlockHash,
      );
      // eslint-disable-next-line no-await-in-loop
      await state.proposeBlock(
        newTx2.block,
        [newTx2.withdrawTransaction, newTx2.depositTransaction],
        {
          value: 10,
        },
      );

      prevBlockHash = calculateBlockHash(newTx2.block);
    }

    const siblingPath = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const TransactionInfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };
    const salt = '0x06032a0304000000000000000000000000000000000000000000000000000000';
    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeHistoricRootBlockNumber(
        TransactionInfoBlock,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeHistoricRootBlockNumber(TransactionInfoBlock, salt),
    ).to.be.rejectedWith('Historic roots are not greater than L2BlockNumber on chain');
  });

  it('should challengeCommitment: tx2', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const siblingPath2 = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    const Transaction2InfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath2,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeCommitment(
        Transaction1InfoBlock,
        Transaction2InfoBlock,
        0,
        0,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    const tx = await challenges.challengeCommitment(
      Transaction1InfoBlock,
      Transaction2InfoBlock,
      0,
      0,
      salt,
    );

    const receipt = await tx.wait();

    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should challengeCommitment: tx1', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const siblingPath2 = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    const Transaction2InfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath2,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeCommitment(
        Transaction2InfoBlock,
        Transaction1InfoBlock,
        0,
        0,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    const tx = await challenges.challengeCommitment(
      Transaction2InfoBlock,
      Transaction1InfoBlock,
      0,
      0,
      salt,
    );

    const receipt = await tx.wait();

    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should not challengeCommitment: ', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const siblingPath2 = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    const Transaction2InfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath2,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeCommitment(
        Transaction1InfoBlock,
        Transaction2InfoBlock,
        1,
        1,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeCommitment(Transaction1InfoBlock, Transaction2InfoBlock, 1, 1, salt),
    ).to.be.revertedWith('Not matching commitments');
  });

  it('should not challengeCommitment: Cannot be the same transactionIndex', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeCommitment(
        Transaction1InfoBlock,
        Transaction1InfoBlock,
        0,
        0,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeCommitment(Transaction1InfoBlock, Transaction1InfoBlock, 0, 0, salt),
    ).to.be.revertedWith('Cannot be the same transactionIndex');
  });

  it('should challengeNullifier', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const siblingPath2 = [
      newTx.block.transactionHashesRoot,
      calculateTransactionHash(newTx.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    const Transaction2InfoBlock = {
      blockL2: newTx.block,
      transaction: newTx.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath2,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNullifier(
        Transaction1InfoBlock,
        Transaction2InfoBlock,
        0,
        0,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    const tx = await challenges.challengeNullifier(
      Transaction1InfoBlock,
      Transaction2InfoBlock,
      0,
      0,
      salt,
    );

    const receipt = await tx.wait();

    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should not challengeNullifier: Cannot be the same transactionIndex', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const siblingPath = [
      transactionsCreated.block.transactionHashesRoot,
      calculateTransactionHash(transactionsCreated.depositTransaction),
    ];

    const Transaction1InfoBlock = {
      blockL2: transactionsCreated.block,
      transaction: transactionsCreated.withdrawTransaction,
      transactionIndex: 0,
      transactionSiblingPath: siblingPath,
    };

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNullifier(
        Transaction1InfoBlock,
        Transaction1InfoBlock,
        0,
        0,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);
    await expect(
      challenges.challengeNullifier(Transaction1InfoBlock, Transaction1InfoBlock, 0, 0, salt),
    ).to.be.revertedWith('Cannot be the same transactionIndex');
  });

  it('should challengeNewFrontierCorrect', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push('0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f2f188');
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewFrontierCorrect(
        transactionsCreated.block,
        frontierBeforeBlock,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    const tx = await challenges.challengeNewFrontierCorrect(
      transactionsCreated.block,
      frontierBeforeBlock,
      newTx.block,
      [newTx.withdrawTransaction, newTx.depositTransaction],
      salt,
    );
    const receipt = await tx.wait();
    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should not challengeNewFrontierCorrect: Invalid prior block frontier', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push(ethers.constants.HashZero);
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewFrontierCorrect(
        transactionsCreated.block,
        frontierBeforeBlock,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    await expect(
      challenges.challengeNewFrontierCorrect(
        transactionsCreated.block,
        frontierBeforeBlock,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      ),
    ).to.be.revertedWith('Invalid prior block frontier');
  });

  it('should not challengeNewFrontierCorrect: The frontier is actually fine', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
      1,
      '0x97371071163566848e8acf100ec6eda3204af108e758db44d2482d2ee469faf8',
    );

    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push('0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f2f188');
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewFrontierCorrect(
        transactionsCreated.block,
        frontierBeforeBlock,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    await expect(
      challenges.challengeNewFrontierCorrect(
        transactionsCreated.block,
        frontierBeforeBlock,
        newTx.block,
        [newTx.withdrawTransaction, newTx.depositTransaction],
        salt,
      ),
    ).to.be.revertedWith('The frontier is actually fine');
  });

  it('should challengeNewRootCorrect', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
      1,
      '0x11cf76de9bb2b1efc8270e7e2380417daaa4c016456b43cfa831cea32b7840ba',
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push('0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f2f188');
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewRootCorrect(
        frontierBeforeBlock,
        newTx.block,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    const tx = await challenges.challengeNewRootCorrect(frontierBeforeBlock, newTx.block, salt);
    const receipt = await tx.wait();
    const eventRollback = receipt.events.find(event => event.event === 'Rollback');
    const [blockNumberL2] = eventRollback.args;

    const unpackedBlockInfo = unpackBlockInfo(newTx.block.packedInfo);
    expect(blockNumberL2).to.equal(Number(unpackedBlockInfo.blockNumberL2));
  });

  it('should not challengeNewRootCorrect: Invalid prior block frontier', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
      1,
      '0x11cf76de9bb2b1efc8270e7e2380417daaa4c016456b43cfa831cea32b7840ba',
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push('0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f20000');
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewRootCorrect(
        frontierBeforeBlock,
        newTx.block,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    await expect(
      challenges.challengeNewRootCorrect(frontierBeforeBlock, newTx.block, salt),
    ).to.be.revertedWith('Invalid prior block frontier');
  });

  it('should not challengeNewRootCorrect: The root is actually fine', async function () {
    const newUrl = 'url';
    const newFee = 100;
    const amount = 100;
    const challengeLocked = 5;

    await state.setProposer(addr1.address, [
      addr1.address,
      addr1.address,
      addr1.address,
      newUrl,
      newFee,
      false,
      0,
    ]);
    await state.setNumProposers(1);
    await state.setCurrentProposer(addr1.address);
    await state.setStakeAccount(addr1.address, amount, challengeLocked);
    await setCommitmentHashEscrowed(
      state.address,
      transactionsCreated.depositTransaction.commitments,
    );
    await state.proposeBlock(
      transactionsCreated.block,
      [transactionsCreated.withdrawTransaction, transactionsCreated.depositTransaction],
      {
        value: 10,
      },
    );
    const newTx = createBlockAndTransactions(
      '0x000000000000000000000000499d11e0b6eac7c0593d8fb292dcbbf815fb29ae',
      addr1.address,
      1,
      calculateBlockHash(transactionsCreated.block),
      1,
      '0x11cf76de9bb2b1efc8270e7e2380417daaa4c016456b43cfa831cea32b7840ba',
      '0x14cabaad7afba02a5d7f3a1813cb154975bc46212d29420dfe15fd263f19d770',
    );
    await state.proposeBlock(newTx.block, [newTx.withdrawTransaction, newTx.depositTransaction], {
      value: 10,
    });

    const salt = (await rand(32)).hex(32);

    const front = [];
    front.push('0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f2f188');
    const frontierBeforeBlock = front.concat(Array(32).fill(ethers.constants.HashZero));

    // eslint-disable-next-line prefer-destructuring
    const data = (
      await challenges.populateTransaction.challengeNewRootCorrect(
        frontierBeforeBlock,
        newTx.block,
        salt,
      )
    ).data;
    const hashedData = ethers.utils.solidityKeccak256(['bytes'], [data]);
    await challenges.commitToChallenge(hashedData);

    await expect(
      challenges.challengeNewRootCorrect(frontierBeforeBlock, newTx.block, salt),
    ).to.be.revertedWith('The root is actually fine');
  });
});
