/**
Module that runs up as a proposer
*/
import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import Nf3 from '../../../../cli/lib/nf3.mjs';

const {
  zkpMnemonic,
  userEthereumSigningKey,
  optimistWsUrl,
  web3WsUrl,
  clientBaseUrl,
  optimistBaseUrl,
} = config;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function localTest() {
  logger.info('Starting local test...');
  const nf3 = new Nf3(
    clientBaseUrl,
    optimistBaseUrl,
    optimistWsUrl,
    web3WsUrl,
    userEthereumSigningKey,
  );
  await nf3.init(zkpMnemonic);
  if (await nf3.healthcheck('client')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  const ercAddress = await nf3.getContractAddress('ERCStub'); // TODO use proper mock contracts
  const startBalance = await nf3.getLayer2Balances();
  await nf3.deposit(ercAddress, 'ERC20', 1, '0x00');
  await nf3.deposit(ercAddress, 'ERC20', 1, '0x00');
  await new Promise(resolve => setTimeout(resolve, 30000)); // wait for the block to propose TODO: active check
  const endBalance = await nf3.getLayer2Balances();
  if (Object.keys(startBalance).length >= Object.keys(endBalance).length) {
    logger.warn('The test failed because the L2 balance has not increased');
    process.exit(1);
  }
  logger.info('Test passed');
  nf3.close();
}

localTest();
