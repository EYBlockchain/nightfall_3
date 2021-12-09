import logger from '../common-files/utils/logger';
import { queueManager } from '../common-files/utils/event-queue';
import { initialClientSync } from './services/state-sync';
import { startEventQueue, eventHandlers } from './event-handlers/index';
// import deposit from './services/deposit';
// import transfer from './services/transfer';
// import withdraw from './services/withdraw';

const main = async () => {
  try {
    initialClientSync().then(async () => {
      await startEventQueue(queueManager, eventHandlers);
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();

// async function approve(ercAddress, ownerAddress, spenderAddress, tokenType, value, provider) {
//   const abi = getAbi(tokenType);
//   const ercContract = new provider.eth.Contract(abi, ercAddress);

//   switch (tokenType) {
//     case TOKEN_TYPE.ERC20: {
//       const allowance = await ercContract.methods.allowance(ownerAddress, spenderAddress).call();
//       const allowanceBN = new Web3.utils.BN(allowance);
//       const valueBN = new Web3.utils.BN(value);

//       if (allowanceBN.lt(valueBN)) {
//         return ercContract.methods
//           .approve(spenderAddress, APPROVE_AMOUNT)
//           .send({ from: ownerAddress });
//       }
//       return Promise.resolve();
//     }

//     case TOKEN_TYPE.ERC721:
//     case TOKEN_TYPE.ERC1155: {
//       if (!(await ercContract.methods.isApprovedForAll(ownerAddress, spenderAddress).call())) {
//         return ercContract.methods
//           .setApprovalForAll(spenderAddress, true)
//           .send({ from: ownerAddress });
//       }
//       break;
//     }

//     default:
//       throw new Error('Unknown token type', tokenType);
//   }
//   return Promise.resolve();
// }

// const deposit = async (params) => {
//   try {
//     await approve(
//       ercAddress,
//       this.ethereumAddress,
//       this.shieldContractAddress,
//       tokenType,
//       value,
//       this.web3,
//     );
//   } catch (err) {
//     throw new Error(err);
//   }
// }
