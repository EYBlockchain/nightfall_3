/* ignore unused exports */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { MultiSig } from './multisig.mjs';

// eslint-disable-next-line import/prefer-default-export
export class NightfallMultiSig {
  multiSig; // MultiSig instance

  web3; // web3 instance

  contractInstances = []; // instances of the contracts

  contractsOwnables = ['shield', 'state', 'proposers', 'challenges']; // ownable contracts

  contractsConfigurables = ['shield', 'state', 'proposers', 'challenges']; // config contracts. Have access to config variables

  contractsPausables = ['shield', 'state']; // pausable contracts

  constructor(web3Instance, contractInstances, signatureThreshold, chainId, gasLimit) {
    this.web3 = web3Instance;
    this.multiSig = new MultiSig(
      this.web3,
      contractInstances.multisig,
      signatureThreshold,
      chainId,
      gasLimit,
    );
    this.contractInstances = contractInstances;
  }

  contractInstancesOwnables() {
    const contractInstancesResult = [];
    this.contractsOwnables.forEach(contract =>
      contractInstancesResult.push(this.contractInstances[contract]),
    );
    return contractInstancesResult;
  }

  contractInstancesConfigurables() {
    const contractInstancesResult = [];
    this.contractsConfigurables.forEach(contract =>
      contractInstancesResult.push(this.contractInstances[contract]),
    );
    return contractInstancesResult;
  }

  contractInstancesPausables() {
    const contractInstancesResult = [];
    this.contractsPausables.forEach(contract =>
      contractInstancesResult.push(this.contractInstances[contract]),
    );
    return contractInstancesResult;
  }

  /**
  This function transfers the ownership of the contracts that are ownable
  */
  async transferOwnership(newOwnerPrivateKey, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const newOwner = this.web3.eth.accounts.privateKeyToAccount(newOwnerPrivateKey, true).address;
    return Promise.all(
      this.contractInstancesOwnables().map(async (ownable, i) => {
        const contractInstance = ownable;
        const data = contractInstance.methods.transferOwnership(newOwner).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the restriction data that the Shield contract is currently using
  */
  async setTokenRestrictions(
    tokenAddress,
    depositRestriction,
    withdrawRestriction,
    signingKey,
    executorAddress,
    _nonce,
    transactions,
  ) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods
          .setRestriction(tokenAddress, depositRestriction, withdrawRestriction)
          .encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function removes the restriction data that the Shield contract is currently using
  */
  async removeTokenRestrictions(tokenAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.removeRestriction(tokenAddress).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function pauses contracts that are pausable
  */
  async pauseContracts(signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    logger.info('All pausable contracts being paused');
    return Promise.all(
      this.contractInstancesPausables().map(async (pausable, i) => {
        const contractInstance = pausable;
        const data = contractInstance.methods.pause().encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function unpauses contracts that are pausable
  */
  async unpauseContracts(signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    logger.info('All pausable contracts being unpaused');
    return Promise.all(
      this.contractInstancesPausables().map(async (pausable, i) => {
        const contractInstance = pausable;
        const data = contractInstance.methods.unpause().encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the boot proposer
  */
  async setBootProposer(newProposerAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setBootProposer(newProposerAddress).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the boot challenger
  */
  async setBootChallenger(newChallengerAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setBootChallenger(newChallengerAddress).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the Matic address
  */
  async setMaticAddress(newMaticAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setMaticAddress(newMaticAddress).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the Minimum stake for proposers
  */
  async setMinimumStake(newMinimumStake, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setMinimumStake(newMinimumStake).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the Block stake for proposers
  */
  async setBlockStake(newBlockStake, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setBlockStake(newBlockStake).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the rotate proposer blocks for current proposer
  */
  async setRotateProposerBlocks(
    newRotateProposerBlocks,
    signingKey,
    executorAddress,
    _nonce,
    transactions,
  ) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods
          .setRotateProposerBlocks(newRotateProposerBlocks)
          .encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the value per slot for PoS
  */
  async setValuePerSlot(newValuePerSlot, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setValuePerSlot(newValuePerSlot).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the proposer set count for PoS
  */
  async setProposerSetCount(
    newProposerSetCount,
    signingKey,
    executorAddress,
    _nonce,
    transactions,
  ) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setProposerSetCount(newProposerSetCount).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the sprints in a span for PoS
  */
  async setSprintsInSpan(newSprintsInSpan, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setSprintsInSpan(newSprintsInSpan).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }

  /**
  This function sets the maximum number of proposers for PoS
  */
  async setMaxProposers(newMaxProposers, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    return Promise.all(
      this.contractInstancesConfigurables().map(async (configurable, i) => {
        const contractInstance = configurable;
        const data = contractInstance.methods.setMaxProposers(newMaxProposers).encodeABI();
        return this.multiSig.addMultiSigSignature(
          data,
          signingKey,
          contractInstance.options.address,
          executorAddress,
          nonce + i,
          transactions.flat(),
        );
      }),
    );
  }
}
