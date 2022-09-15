import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';

import './hardhat.test-esm-task';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  paths: {
    sources: './nightfall-deployer/contracts',
    tests: './test/e2e',
  },
};

export default config;
