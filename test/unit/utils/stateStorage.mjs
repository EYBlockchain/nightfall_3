/* eslint-disable no-empty-function */
import hardhat from 'hardhat';
import { BigNumber } from 'ethers';
import { setStorageAt, time } from '@nomicfoundation/hardhat-network-helpers';

const { ethers } = hardhat;

const txInfoSlot = 163;
const blockHashesSlot = 164;
const stakeAccountsSlot = 167;
const blockInfoSlot = 168;

export async function setTransactionInfo(
  stateAddress,
  transactionHash,
  isEscrowed = false,
  ethFee = 0,
) {
  const index = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [transactionHash, txInfoSlot],
  );

  const txInfoStruct = ethers.utils.hexlify(
    ethers.utils.concat([
      ethers.utils.hexlify(Number(isEscrowed)),
      ethers.utils.hexZeroPad(ethers.utils.hexlify(ethFee), 31),
    ]),
  );

  await setStorageAt(stateAddress, index, txInfoStruct);
}

export async function setBlockInfo(
  stateAddress,
  blockHash,
  feeL2Payments = 0,
  blockClaimed = false,
) {
  const index = ethers.utils.solidityKeccak256(['uint256', 'uint256'], [blockHash, blockInfoSlot]);

  const txInfoStruct = ethers.utils.hexlify(
    ethers.utils.concat([
      ethers.utils.hexlify(Number(blockClaimed)),
      ethers.utils.hexZeroPad(ethers.utils.hexlify(feeL2Payments), 31),
    ]),
  );
  await setStorageAt(stateAddress, index, txInfoStruct);
}

export async function setStakeAccount(stateAddress, proposer, amount, challengeLocked, timeStake) {
  const index = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [proposer, stakeAccountsSlot],
  );

  const stakeAccountStruct = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(
      ethers.utils.concat([
        ethers.utils.hexZeroPad(ethers.utils.hexlify(timeStake), 4),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(challengeLocked), 14),
        ethers.utils.hexZeroPad(ethers.utils.hexlify(amount), 14),
      ]),
    ),
    32,
  );

  await setStorageAt(stateAddress, index, stakeAccountStruct);
}

export async function setBlockData(
  StateInstance,
  stateAddress,
  blockHash,
  blockStake,
  proposerAddress,
) {
  const indexTime = ethers.utils.solidityKeccak256(
    ['uint256'],
    [ethers.utils.hexlify(blockHashesSlot)],
  );

  const blocksL2 = await StateInstance.getNumberOfL2Blocks();
  await setStorageAt(
    stateAddress,
    ethers.utils.hexlify(blockHashesSlot),
    ethers.utils.hexZeroPad(ethers.utils.hexlify(blocksL2.add(1), 32)),
  );
  await setStorageAt(stateAddress, indexTime, blockHash);
  await setStorageAt(
    stateAddress,
    ethers.utils.hexlify(BigNumber.from(indexTime).add(1)),
    ethers.utils.hexZeroPad(ethers.utils.hexlify(await time.latest()), 32),
  );
  await setStorageAt(
    stateAddress,
    ethers.utils.hexlify(BigNumber.from(indexTime).add(2)),
    ethers.utils.hexlify(
      ethers.utils.concat([
        ethers.utils.hexZeroPad(ethers.utils.hexlify(blockStake), 12),
        proposerAddress,
      ]),
    ),
  );
}
