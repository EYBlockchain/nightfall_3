/* eslint-disable no-empty-function */
import hardhat from 'hardhat';
import { packTransactionInfo } from '../../../common-files/classes/transaction.mjs';
import { packBlockInfo } from '../../../common-files/utils/block-utils.mjs';

const { ethers } = hardhat;

export function calculateBlockHash(b) {
  const encodedBlock = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [b.packedInfo, b.root, b.previousBlockHash, b.frontierHash, b.transactionHashesRoot],
  );

  return ethers.utils.keccak256(encodedBlock);
}

export function calculateTransactionHash(tx) {
  const encodedTx = ethers.utils.defaultAbiCoder.encode(
    [
      'uint256',
      'uint256[]',
      'bytes32',
      'bytes32',
      'bytes32',
      'bytes32[]',
      'bytes32[]',
      'bytes32[2]',
      'uint256[4]',
    ],
    [
      tx.packedInfo,
      tx.historicRootBlockNumberL2,
      tx.tokenId,
      tx.ercAddress,
      tx.recipientAddress,
      tx.commitments,
      tx.nullifiers,
      tx.compressedSecrets,
      tx.proof,
    ],
  );

  const encodedTxPadded = ethers.utils.hexZeroPad(32, 32).concat(encodedTx.slice(2));
  return ethers.utils.keccak256(encodedTxPadded);
}

export function createBlockAndTransactions(
  erc20MockAddress,
  ownerAddress,
  blockNumberL2 = 0,
  previousBlockHash = '0x0000000000000000000000000000000000000000000000000000000000000000',
  leafCount = 1,
  frontierHash = '0x6fdcfc8a2d541d6b99b6d6349b67783edf599fedfd1931b96f4385bcb3f2f188',
  root = '0x2dffeee2af2f5be8b946c00d2a0f96dc59ac65d1decce3bae9c2c70d5efca4a0',
  fee = 1,
) {
  const packedInfoWithdraw = packTransactionInfo(10, fee, 2, 0);

  const withdrawTransaction = {
    packedInfo: packedInfoWithdraw,
    historicRootBlockNumberL2: [
      '0x0000000000000000000000000000000000000000000000000000000000000009',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ercAddress: ethers.utils.hexZeroPad(erc20MockAddress, 32),
    recipientAddress: ethers.utils.hexZeroPad(ownerAddress, 32),
    commitments: [
      '0x078ba912b4169b22fb2d9b6fba6229ccd4ae9c2610c72312d0c6d18d85fd22cf',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    nullifiers: [
      '0x078ba912b4169b22fb2d9b6fba6249ccd4ae9c2610c72312d0c6d18d85fd22cf',
      '0x078ba912b4169b22fb2d9b6fba6239ccd4ae9c2610c72312d0c6d18d85fd22cf',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    compressedSecrets: [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    proof: [
      '0x2e608465669d24b9f8f0cf93b76d68e10e2ab6d5e24a6097217334960088b63',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
  };

  const packedInfoDeposit = packTransactionInfo(10, 0, 0, 0);

  const depositTransaction = {
    packedInfo: packedInfoDeposit,
    historicRootBlockNumberL2: [],
    tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ercAddress: ethers.utils.hexZeroPad(erc20MockAddress, 32),
    recipientAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
    commitments: ['0x078ba912b4169b22fb2d9b6fba6229ccd4ae9c2610c72312d0c6d18d85fd22cf'],
    nullifiers: [],
    compressedSecrets: [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
    proof: [
      '0x2e608465669d24b9f8f0cf93b76d68e10e2ab6d5e24a6097217334960088b63',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
  };

  const transactionHashesRoot = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [calculateTransactionHash(withdrawTransaction), calculateTransactionHash(depositTransaction)],
  );

  const packedInfoBlock = packBlockInfo(leafCount, ownerAddress, blockNumberL2);

  const block = {
    packedInfo: packedInfoBlock,
    root,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  };

  return { depositTransaction, withdrawTransaction, block };
}
