import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
 async function transactionSubmittedEventHandler(eventParams) {
    logger.info(`rrrrrrrrrrrrrrr--- ${eventParams}`);
 }

 export default transactionSubmittedEventHandler;
