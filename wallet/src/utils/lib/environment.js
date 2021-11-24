/* ignore unused exports */
const SUPPORTED_ENVIRONMENTS = {
  mainnet: {
    name: 'Mainnet',
    chainId: 1,
    clientApiUrl: '',
    optimistApiUrl: '',
    optimistWsUrl: '',
    web3WsUrl: '',
  },
  ropsten: {
    name: 'Ropsten',
    chainId: 3,
    clientApiUrl: 'https://client1.testnet.nightfall3.com',
    optimistApiUrl: 'https://optimist1.testnet.nightfall3.com',
    optimistWsUrl: 'wss://optimist1-ws.testnet.nightfall3.com',
    web3WsUrl: 'wss://ropsten1-ws.testnet.nightfall3.com',
  },
  rinkeby: {
    name: 'Rinkeby',
    chainId: 4,
    clientApiUrl: '',
    optimistApiUrl: '',
    optimistWsUrl: '',
    web3WsUrl: '',
  },
  localhost: {
    name: 'Localhost',
    chainId: 4378921,
    clientApiUrl: 'http://localhost:8080',
    optimistApiUrl: 'http://localhost:8081',
    optimistWsUrl: 'ws://localhost:8082',
    web3WsUrl: 'ws://localhost:8546',
  },
  docker: {
    name: 'Docker',
    chainId: 4378921,
    clientApiUrl: 'http://client1',
    optimistApiUrl: 'http://optimist1',
    optimistWsUrl: 'ws://optimist1:8082',
    web3WsUrl: 'ws://blockchain1:8546',
  },
};

const ContractNames = {
  Shield: 'Shield',
  Proposers: 'Proposers',
  Challenges: 'Challenges',
  State: 'State',
};

const CONTRACT_ADDRESSES = {
  [ContractNames.Shield]: '',
  [ContractNames.Proposers]: '',
  [ContractNames.Challenges]: '',
  [ContractNames.State]: '',
};

const currentEnvironment = {
  clientApiUrl: '',
  optimistApiUrl: '',
  optimistWsUrl: '',
  web3WsUrl: '',
  chainId: null,
};

/**
 * Gets the current supported environments
 * @returns {Object[]} Supported environments
 */
function getSupportedEnvironments() {
  return Object.values(SUPPORTED_ENVIRONMENTS);
}

/**
 * Checks if a network has a supported environment
 * @param {String} env Network name
 * @returns {Boolean} environment supported
 */
function isEnvironmentSupportedByNetworkName(env) {
  if (
    Object.values(SUPPORTED_ENVIRONMENTS).find(supportedEnv => supportedEnv.name === env) !==
    undefined
  ) {
    return true;
  }
  return false;
}

/**
 * Stores the addresses of NF contract by type
 * @param {Object} nf3 - Nightfall instance to retrieve contract addresses from
 * @param {String} contractName - Name of contract
 */
async function setContractAddress(nf3, contractName) {
  CONTRACT_ADDRESSES[contractName] = await nf3.getContractAddress(contractName);
}

/**
 * Stores the addresses of NF contracts
 * @param {Object} nf3 - Nightfall instance to retrieve contract addresses from
 */
async function setContractAddresses(nf3) {
  setContractAddress(nf3, ContractNames.Shield);
  setContractAddress(nf3, ContractNames.Proposers);
  setContractAddress(nf3, ContractNames.Challenges);
  setContractAddress(nf3, ContractNames.State);
}

/**
 * Stores the NF client API URL
 * @param {String} baseApiUrl - client API URL
 */
function setClientApiUrl(baseApiUrl) {
  currentEnvironment.clientApiUrl = baseApiUrl;
}

/**
 * Stores the NF Optimist API URL
 * @param {String} optimistApiUrl - optimist API URL
 */
function setOptimistApiUrl(optimistApiUrl) {
  currentEnvironment.optimistApiUrl = optimistApiUrl;
}

/**
 * Stores the NF Optimist Websocket URL
 * @param {String} optimistWsUrl - optimist Websocket URL
 */
function setOptimistWsUrl(optimistWsUrl) {
  currentEnvironment.optimistWsUrl = optimistWsUrl;
}

/**
 * Stores the NF Web3 Websocket URL
 * @param {String} web3WsUrl - Web3 websocket URL
 */
function setWeb3WsUrl(web3WsUrl) {
  currentEnvironment.web3WsUrl = web3WsUrl;
}

/**
 * Stores the NF network chain Id
 * @param {String} chainId - NF network chain ID
 */
function setChainId(chainId) {
  currentEnvironment.chainId = chainId;
}

/**
 * Sets an environment from a chain id or from a custom environment object
 * @param {Object|Number} env - Chain id or a custom environment object
 */
function setEnvironment(env) {
  if (!env) {
    throw new Error('A environment is required');
  }

  if (typeof env === 'string') {
    if (!isEnvironmentSupportedByNetworkName(env)) {
      throw new Error('Environment not supported');
    }

    setClientApiUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].clientApiUrl);
    setOptimistApiUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].optimistApiUrl);
    setOptimistWsUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].optimistWsUrl);
    setWeb3WsUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].web3WsUrl);
    setChainId(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].chainId);
  } else if (typeof env === 'object') {
    if (env.clientApiUrl && typeof env.clientApiUrl === 'string') {
      setClientApiUrl(env.clientApiUrl);
    }
    if (env.optimistApiUrl && typeof env.optimistApiUrl === 'string') {
      setOptimistApiUrl(env.optimistApiUrl);
    }
    if (env.optimistWsUrl && typeof env.optimistWsUrl === 'string') {
      setOptimistWsUrl(env.optimistWsUrl);
    }
    if (env.web3WsUrl && typeof env.Web3WsUrl === 'string') {
      setWeb3WsUrl(env.web3WsUrl);
    }
    if (env.chainId && typeof env.chainId === 'string') {
      setChainId(env.chainId);
    }
  }
}

/**
 * Returns the current environment
 * @returns {Object} Contains contract addresses, and URLs
 * and the Etherscan URL por the provider
 */
function getCurrentEnvironment() {
  return {
    contracts: CONTRACT_ADDRESSES,
    currentEnvironment,
  };
}

export { setEnvironment, getCurrentEnvironment, getSupportedEnvironments, setContractAddresses };
