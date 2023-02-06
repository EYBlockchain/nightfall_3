import config from 'config';
import Web3 from 'web3';
import axios from 'axios';

const { COMMAND = '' } = process.env;
const { clientApiUrls, addresses } = config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

async function fundAccounts() {
  const CLIENT_HOST = clientApiUrls.client1;
  const DEPLOYER_ADDRESS = addresses.user1;
  const BLOCKCHAIN_WS_HOST = environment.web3WsUrl;
  console.log('BLOCKCHAIN PROVIDER:', BLOCKCHAIN_WS_HOST);
  console.log('DEPLOYER ADDRESS:', DEPLOYER_ADDRESS);
  console.log('CLIENT HOST:', clientApiUrls.client1);

  const web3 = new Web3(`${BLOCKCHAIN_WS_HOST}`);

  // Get ERC20 token ABI
  const resErc20Abi = await axios.get(`${CLIENT_HOST}/contract-abi/ERC20Mock`);
  const erc20Abi = resErc20Abi.data.abi;
  /*
  // Get ERC721 token ABI
  const resErc721Abi = await axios.get(`${CLIENT_HOST}/contract-abi/ERC720Mock`);
  const erc721Abi = resErc721Abi.data.abi;
  // Get ERC1155 token ABI
  const resErc155Abi = await axios.get(`${CLIENT_HOST}/contract-abi/ERC1155Mock`);
  const erc1155Abi = resErc1155Abi.data.abi;
  */

  // Get ERC20 token address
  const resErc20Address = await axios.get(`${CLIENT_HOST}/contract-address/ERC20Mock`);
  const erc20Address = resErc20Address.data.address;
  /*
  // Get ERC721 token address
  const resErc721Address = await axios.get(`${CLIENT_HOST}/contract-address/ERC721Mock`);
  const erc721Address = resErc721Address.data.address;
  // Get ERC1155 token address
  const resErc1155Address = await axios.get(`${CLIENT_HOST}/contract-address/ERC1155Mock`);
  const erc1155Address = resErc1155Address.data.address;
  */

  // Get ERC20 Token contract instance
  const erc20Contract = new web3.eth.Contract(erc20Abi, erc20Address);
  /*
  // Get ERC721 Token contract instance
  const erc721Contract = new web3.eth.Contract(erc721Abi, erc721Address);
  // Get ERC1155 Token contract instance
  const erc1155Contract = new web3.eth.Contract(erc1155Abi, erc1155Address);
  */

  // Get unlocked accounts
  const accounts = await web3.eth.getAccounts();

  if (COMMAND === 'fund') {
    console.log('FUNDING accounts with ERC20 Mock...');
    accounts.forEach(async account => {
      if (account !== DEPLOYER_ADDRESS) {
        erc20Contract.methods.transfer(account, 100000000000).send({ from: DEPLOYER_ADDRESS });
      }
    });
  }

  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    const balanceErc20 = await erc20Contract.methods.balanceOf(account).call();
    console.log('ERC20 BALANCE', account, balanceErc20);
  }
  process.exit(0);
}

fundAccounts();
