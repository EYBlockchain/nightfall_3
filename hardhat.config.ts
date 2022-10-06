import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.3',
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
  mocha: {
    timeout: 0
  }
};

export default config;
