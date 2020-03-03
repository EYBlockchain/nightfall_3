/**
If CONTRACT_ORIGIN = 'compile', we need to compile the contracts from source, in order to obtain a contract interface json.
*/
import path from 'path';
import fs from 'fs-extra';
import solc from 'solc';
import config from 'config';
import { releases } from './solc-versions-list';

const { contractsPath } = config;
const { buildPath } = config;

const getSolcVersion = contractName => {
  console.log('getSolcVersion...');
  const contractsFiles = fs.readdirSync(contractsPath);
  const source = {};
  console.log('CONTRACTSFILES:', contractsFiles);

  contractsFiles.forEach(fileName => {
    if (contractName === path.basename(fileName, '.sol')) {
      // filename without '.sol'
      const contractFullPath = path.resolve(contractsPath, fileName);
      source[fileName] = {
        content: fs.readFileSync(contractFullPath, 'utf8'),
      };
    }
  });

  // console.log('source:', source);

  if (Object.keys(source).length === 0 && source.constructor === Object)
    throw new Error(`Contract ${contractName} not found in ${contractsPath}.`);

  const sourceCodeString = JSON.stringify(source);
  const regex = new RegExp(/(?<=pragma solidity .)(0).*?(?=;)/g);
  const solcVersion = sourceCodeString.match(regex);
  console.log(`solcVersion for ${contractName} is ${solcVersion}`);
  return solcVersion;
};

const buildSources = () => {
  console.log('buildSources...');
  const sources = {};
  const contractsFiles = fs.readdirSync(contractsPath);

  console.log('CONTRACTSFILES:', contractsFiles);

  contractsFiles.forEach(file => {
    if (path.extname(file) === '.sol') {
      const contractFullPath = path.resolve(contractsPath, file);
      sources[file] = {
        content: fs.readFileSync(contractFullPath, 'utf8'),
      };
    }
  });

  // console.log('SOURCES:', sources);

  return sources;
};

const createSolcInput = sources => {
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  };
  return input;
};

const compile = (solcInstance, input) => {
  const compiledOutput = solcInstance.compile(JSON.stringify(input));
  console.log('COMPILED OUTPUT:', JSON.parse(compiledOutput).errors || 'no errors :)');

  const compiledContracts = JSON.parse(compiledOutput).contracts;

  console.log('COMPILED CONTRACTS:', compiledContracts);
  // eslint-disable-next-line no-restricted-syntax
  for (const contract of Object.keys(compiledContracts)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const contractName of Object.keys(compiledContracts[contract])) {
      fs.outputJsonSync(
        path.resolve(buildPath, `${contractName}.json`),
        compiledContracts[contract][contractName],
        { spaces: 2 },
      );
    }
  }
};

const loadRemoteVersionAsync = async solcVersionRelease => {
  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(solcVersionRelease, (err, solcInstance) => {
      if (err) {
        reject(err);
      } else resolve(solcInstance);
    });
  });
};

export const compileContract = async contractName => {
  try {
    const solcVersion = getSolcVersion(contractName);
    const sources = buildSources();
    const input = createSolcInput(sources);

    const solcInstance = await loadRemoteVersionAsync(releases[solcVersion].slice(8, -3));
    compile(solcInstance, input);
  } catch (err) {
    throw new Error(err);
  }
};

export default { compileContract };
