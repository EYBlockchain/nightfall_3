/* eslint-disable no-empty-function */
import hardhat from 'hardhat';
import { setStorageAt } from '@nomicfoundation/hardhat-network-helpers';

const { ethers } = hardhat;

const whitelistSlot = 163;
const withdrawnSlot = 166;
const advancedWithdrawalSlot = 167;
const isEscrowedSlot = 168;

export async function setTransactionWithdrawn(shieldAddress, withdrawTransactionHash) {
  const indexWithdrawn = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [withdrawTransactionHash, withdrawnSlot],
  );

  await setStorageAt(shieldAddress, indexWithdrawn, ethers.utils.hexZeroPad(1, 32));
}

export async function setWhitelist(shieldAddress) {
  await setStorageAt(
    shieldAddress,
    ethers.utils.hexlify(whitelistSlot),
    ethers.utils.hexlify(ethers.utils.zeroPad(1, 32)),
  );
}

export async function setEscrowed(shieldAddress, transactionHash) {
  const index = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [transactionHash, isEscrowedSlot],
  );

  await setStorageAt(shieldAddress, index, ethers.utils.hexlify(ethers.utils.zeroPad(1, 32)));
}

export async function setAdvancedWithdrawal(
  shieldAddress,
  withdrawTransactionHash,
  liquidityProviderAddress,
  fee,
) {
  const indexAdvanceWithdrawal = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [withdrawTransactionHash, advancedWithdrawalSlot],
  );

  const advancedWithdrawalStruct = ethers.utils.hexlify(
    ethers.utils.concat([
      ethers.utils.hexZeroPad(ethers.utils.hexlify(fee), 12),
      liquidityProviderAddress,
    ]),
  );

  await setStorageAt(shieldAddress, indexAdvanceWithdrawal, advancedWithdrawalStruct);
}
