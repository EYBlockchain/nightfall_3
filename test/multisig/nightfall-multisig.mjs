/* ignore unused exports */
import logger from 'common-files/utils/logger.mjs';
import { MultiSig } from './multisig.mjs';

// eslint-disable-next-line import/prefer-default-export
export class NightfallMultiSig {
  multiSig; // MultiSig instance

  web3; // web3 instance

  contractInstances = []; // instances of the contracts

  contractsOwnables = ['shield', 'state', 'proposers', 'challenges']; // ownable contracts

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

    const data = this.contractInstances.shield.methods
      .setRestriction(tokenAddress, depositRestriction, withdrawRestriction)
      .encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        this.contractInstances.shield.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function removes the restriction data that the Shield contract is currently using
  */
  async removeTokenRestrictions(tokenAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const data = this.contractInstances.shield.methods.removeRestriction(tokenAddress).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        this.contractInstances.shield.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
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
  async setBootProposer(newProposerPrivateKey, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const newProposer = this.web3.eth.accounts.privateKeyToAccount(
      newProposerPrivateKey,
      true,
    ).address;
    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setBootProposer(newProposer).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the boot challenger
  */
  async setBootChallenger(
    newChallengerPrivateKey,
    signingKey,
    executorAddress,
    _nonce,
    transactions,
  ) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const newChallenger = this.web3.eth.accounts.privateKeyToAccount(
      newChallengerPrivateKey,
      true,
    ).address;
    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setBootChallenger(newChallenger).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the Matic address
  */
  async setMaticAddress(newMaticAddress, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setMaticAddress(newMaticAddress).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the Minimum stake for proposers
  */
  async setMinimumStake(newMinimumStake, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setMinimumStake(newMinimumStake).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the Block stake for proposers
  */
  async setBlockStake(newBlockStake, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setBlockStake(newBlockStake).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
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

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods
      .setRotateProposerBlocks(newRotateProposerBlocks)
      .encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the value per slot for PoS
  */
  async setValuePerSlot(newValuePerSlot, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setValuePerSlot(newValuePerSlot).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
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

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods
      .setProposerSetCount(newProposerSetCount)
      .encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }

  /**
  This function sets the sprints in a span for PoS
  */
  async setSprintsInSpan(newSprintsInSpan, signingKey, executorAddress, _nonce, transactions) {
    let nonce = _nonce;
    if (!Number.isInteger(nonce)) nonce = await this.multiSig.getMultiSigNonce();

    const shieldContractInstance = this.contractInstances.shield;
    const data = shieldContractInstance.methods.setSprintsInSpan(newSprintsInSpan).encodeABI();
    return Promise.all([
      this.multiSig.addMultiSigSignature(
        data,
        signingKey,
        shieldContractInstance.options.address,
        executorAddress,
        nonce,
        transactions.flat(),
      ),
    ]);
  }
}
