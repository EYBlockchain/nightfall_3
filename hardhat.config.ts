import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';
import 'tsconfig-paths/register';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  paths: {
    sources: './nightfall-deployer/contracts',
    tests: './test/e2e',
  },
  mocha: {
    timeout: 0,
  },
};

export default config;
