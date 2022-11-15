import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

// variable declaration to avoid eslint error
let type;
let approve;
let transactions;
let txDataToSign;
let proposeEmitter;

if (type === 'submit-transaction') {
  // this is used by adversary proposer for submitting bad transaction.
  try {
    const ercAddress = await this.getContractAddressOptimist('ERC20Mock');
    const approvetxDataToSign = await approve(
      ercAddress,
      this.ethereumAddress,
      this.shieldContractAddress,
      (Number(transactions[0].tokenType) === 0 && 'ERC20') ||
        (Number(transactions[0].tokenType) === 1 && 'ERC721') ||
        (Number(transactions[0].tokenType) === 2 && 'ERC1155'),
      Number(transactions[0].value),
      this.web3,
      !!this.ethereumSigningKey,
    );
    if (approvetxDataToSign) await this.submitTransaction(approvetxDataToSign, ercAddress, 0);
    const receipt = await this.submitTransaction(
      txDataToSign,
      this.shieldContractAddress,
      Number(transactions[0].fee),
    );
    proposeEmitter.emit('submit-transaction-receipt', receipt, transactions);
  } catch (err) {
    logger.error({
      msg: 'Error while trying to submit a submit-transaction',
      err,
    });
  }
}
