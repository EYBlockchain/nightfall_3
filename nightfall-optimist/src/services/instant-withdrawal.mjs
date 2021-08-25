import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';

const { SHIELD_CONTRACT_NAME } = config;
const advanceWithdrawal = async transaction => {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const txDataToSign = await shieldContractInstance.methods
      .advanceWithdrawal(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    logger.info(`txDataToSign : ${txDataToSign}`);
    return { txDataToSign };
  } catch (error) {
    throw new Error(error);
  }
};
export default advanceWithdrawal;
