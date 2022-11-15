/* eslint-disable no-empty-function */
import hardhat from 'hardhat';
import { setStorageAt } from '@nomicfoundation/hardhat-network-helpers';

const { ethers } = hardhat;

const txInfoSlot = 162;
const advancedWithdrawalSlot = 163;

export async function setTransactionInfo(shieldAddress, transactionHash, isEscrowed, isWithdrawn) {
  const index = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [transactionHash, txInfoSlot],
  );

  const txInfoStruct = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(
      ethers.utils.concat([
        ethers.utils.hexlify(Number(isWithdrawn)),
        ethers.utils.hexlify(Number(isEscrowed)),
      ]),
    ),
    32,
  );

  await setStorageAt(shieldAddress, index, txInfoStruct);
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
