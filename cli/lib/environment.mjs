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
    clientApiUrl: 'https://client.testnet.nightfall3.com',
    optimistApiUrl: 'https://optimist.testnet.nightfall3.com',
    optimistWsUrl: 'wss://optimist-ws.testnet.nightfall3.com',
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
    chainId: 1337,
    clientApiUrl: 'http://localhost:8080',
    optimistApiUrl: 'http://localhost:8081',
    optimistWsUrl: 'ws://localhost:8082',
    web3WsUrl: 'ws://localhost:8546',
  },
  docker: {
    name: 'Docker',
    chainId: 1337,
    clientApiUrl: 'http://client',
    optimistApiUrl: 'http://optimist',
    optimistWsUrl: 'ws://optimist:8080',
    web3WsUrl: 'ws://blockchain:8546',
  },
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
    currentEnvironment,
  };
}

export { setEnvironment, getCurrentEnvironment, getSupportedEnvironments };
