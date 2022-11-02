/* eslint-disable no-empty-function */
import hardhat from 'hardhat';
import { setStorageAt } from '@nomicfoundation/hardhat-network-helpers';

const { ethers } = hardhat;

const whitelistSlot = 163;
const advancedWithdrawalSlot = 166;

export async function setWhitelist(shieldAddress) {
  await setStorageAt(
    shieldAddress,
    ethers.utils.hexlify(whitelistSlot),
    ethers.utils.hexlify(ethers.utils.zeroPad(1, 32)),
  );
}

export async function setAdvancedWithdrawal(
  shieldAddress,
  withdrawTransactionHash,
  liquidityProviderAddress,
  fee,
  isWithdrawn,
) {
  const indexAdvanceWithdrawal = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [withdrawTransactionHash, advancedWithdrawalSlot],
  );

  const advancedWithdrawalStruct = ethers.utils.hexlify(
    ethers.utils.concat([
      ethers.utils.hexlify(Number(isWithdrawn)),
      ethers.utils.hexZeroPad(ethers.utils.hexlify(fee), 11),
      liquidityProviderAddress,
    ]),
  );

  await setStorageAt(shieldAddress, indexAdvanceWithdrawal, advancedWithdrawalStruct);
}
