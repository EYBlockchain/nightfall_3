import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-storage-layout';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import 'hardhat-gas-reporter';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: { enabled: true },
  paths: {
    sources: './nightfall-deployer/contracts',
    tests: './test/unit/SmartContracts',
  },
  mocha: {
    timeout: 0,
  },
};

export default config;
