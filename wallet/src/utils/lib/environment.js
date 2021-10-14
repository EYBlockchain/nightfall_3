/* ignore unused exports */
import { setProvider } from './providers';

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
    clientApiUrl: '',
    optimistApiUrl: '',
    optimistWsUrl: '',
    web3WsUrl: '',
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

async function setContractAddress(contractName) {
  // CONTRACT_ADDRESSES[contractName] = await Nf3.getContractAddress(contractName);
  CONTRACT_ADDRESSES[contractName] = '0x121221';
}

function setClientApiUrl(baseApiUrl) {
  currentEnvironment.clientApiUrl = baseApiUrl;
}

function setOptimistApiUrl(optimistApiUrl) {
  currentEnvironment.optimistApiUrl = optimistApiUrl;
}

function setOptimistWsUrl(optimistWsUrl) {
  currentEnvironment.optimistWsUrl = optimistWsUrl;
}

function setWeb3WsUrl(web3WsUrl) {
  currentEnvironment.web3WsUrl = web3WsUrl;
}

/**
 * Sets an environment from a chain id or from a custom environment object
 * @param {Object|Number} env - Chain id or a custom environment object
 * @param {Bool} enableProvider - Set provider now
 */
function setEnvironment(env, enableProvider) {
  if (!env) {
    throw new Error('A environment is required');
  }

  setContractAddress(ContractNames.Shield);
  setContractAddress(ContractNames.Proposers);
  setContractAddress(ContractNames.Challenges);
  setContractAddress(ContractNames.State);

  if (typeof env === 'string') {
    if (!isEnvironmentSupportedByNetworkName(env)) {
      throw new Error('Environment not supported');
    }
  }
  setClientApiUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].clientApiUrl);
  setOptimistApiUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].optimistApiUrl);
  setOptimistWsUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].optimistWsUrl);
  setWeb3WsUrl(SUPPORTED_ENVIRONMENTS[env.toLowerCase()].web3WsUrl);

  if (typeof env === 'object') {
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
  }

  if (enableProvider) {
    setProvider(currentEnvironment.web3WsUrl);
  }
}

/**
 * Returns the current environment
 * @returns {Object} Contains contract addresses, Hermez API and Batch Explorer urls
 * and the Etherscan URL por the provider
 */
function getCurrentEnvironment() {
  return {
    contracts: CONTRACT_ADDRESSES,
    currentEnvironment,
  };
}

export { setEnvironment, getCurrentEnvironment, getSupportedEnvironments };
