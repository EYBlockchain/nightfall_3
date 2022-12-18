import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const { STATE_CONTRACT_NAME } = constants;

const TIMER_CHANGE_PROPOSER_SECOND = process.env.TIMER_CHANGE_PROPOSER_SECOND || 30;
const MAX_ROTATE_TIMES = process.env.MAX_ROTATE_TIMES || 2;

async function autoChangeCurrentProposer(proposer) {
  const web3 = Web3.connection();
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);

  while (true) {
    logger.info('Checking Proposer...');
    const proposerStartBlock = await stateContractInstance.methods.proposerStartBlock().call();
    const rotateProposerBlocks = await stateContractInstance.methods.getRotateProposerBlocks().call();
    const numproposers = await stateContractInstance.methods.getNumProposers().call();
    const currentSprint = await stateContractInstance.methods.currentSprint().call();
    const currentBlock = await web3.eth.getBlockNumber();
    const sprintInSpan = await stateContractInstance.methods.getSprintsInSpan().call();

    if (currentBlock - proposerStartBlock >= rotateProposerBlocks && numproposers > 1) {
      if (currentSprint === '0') {
        let spanProposersList = [];
        for (let i = 0; i < sprintInSpan; i++) {
          spanProposersList.push(stateContractInstance.methods.spanProposersList(i).call())
        }
        spanProposersList = await Promise.all(spanProposersList);
        logger.info(`list of next proposer: ${spanProposersList}`);
      }
      const spanProposersListAtPosition = await stateContractInstance.methods.spanProposersList(currentSprint).call();
      logger.info(`Proposer address: ${spanProposersListAtPosition} and sprint: ${currentSprint}`);
      try {
        if (spanProposersListAtPosition === proposer.address) {
          logger.info(`${proposer.address} is Calling changeCurrentProposer`);
          await stateContractInstance.methods.changeCurrentProposer().send();
        } else if (currentBlock - proposerStartBlock >= rotateProposerBlocks * MAX_ROTATE_TIMES) {
          logger.info(`${proposer.address} is Calling changeCurrentProposer`);
          await stateContractInstance.methods.changeCurrentProposer().send();
        }
      } catch (err) {
        logger.info(err);
      }
    }
    await new Promise(resolve => setTimeout(resolve, TIMER_CHANGE_PROPOSER_SECOND * 1000));
  }
}

export default autoChangeCurrentProposer;
