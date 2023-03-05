import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-truffle5';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-storage-layout';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import 'hardhat-gas-reporter';

const optimizerDefaultSettings = {
  enabled: true,
  runs: 200,
  details: {
    peephole: true,
    inliner: true,
    jumpdestRemover: true,
    orderLiterals: true,
    deduplicate: true,
    cse: true,
    constantOptimizer: true,
    yulDetails: {
      stackAllocation: true,
      optimizerSteps:
        'dhfoDgvulfnTUtnIf[xa[r]EscLMcCTUtTOntnfDIulLculVcul [j]Tpeulxa[rul]xa[r]cLgvifCTUca[r]LSsTOtfDnca[r]Iulc]jmul[jul] VcTOcul jmul',
    },
  },
};

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        ...optimizerDefaultSettings,
      },
      viaIR: true,
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
