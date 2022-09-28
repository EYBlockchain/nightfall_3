import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './nightfall-deployer/contracts',
    tests: './test/e2e',
  },
  networks: {
    localhost: {
      url: ' http://127.0.0.1:8546/',
      chainId: 31337,
    }
  },
  mocha: {
    timeout: 0
  }
};

export default config;
