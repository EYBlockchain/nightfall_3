/* eslint-disable no-undef */

if (transactionType === 'IncorrectInput') {
  const invalidFields = [
    'tokenType',
    'transactionHash',
    'ercAddress',
    'proof',
    'historicRootBlockNumberL2',
  ];
  if (generalise(transaction.tokenType).bigInt === 0n) invalidFields.push('tokenId');
  if (generalise(transaction.tokenType).bigInt === 1n) invalidFields.push('value');
  if (transaction.commitments.length === 0) invalidFields.push('commitments');
  if (transaction.nullifiers.length === 0) invalidFields.push('nullifiers');
  const keys = Object.keys(transaction).filter(k => !invalidFields.includes(k));
  const selectedKey = keys[Math.floor(Math.random() * keys.length)];
  const modifiedValue = generalise(Math.floor(Math.random() * 2 ** 32)).hex(32);
  logger.debug({
    msg: `Modifying ${selectedKey} with ${modifiedValue} to make the transaction invalid`,
  });
  if (['commitments', 'nullifiers', 'compressedSecrets'].includes(selectedKey)) {
    const index = Math.floor(Math.random() * transaction[selectedKey].length);
    transaction[selectedKey][index] = modifiedValue;
  } else {
    transaction[selectedKey] = modifiedValue;
  }

  logger.debug({
    msg: 'Transaction after modification',
    transaction,
  });
} else if (transactionType === 'IncorrectProof') {
  transaction.proof[0] = generalise(Math.floor(Math.random() * 2 ** 32)).hex(32);

  logger.debug({
    msg: 'Transaction after modification',
    transaction,
  });
}
