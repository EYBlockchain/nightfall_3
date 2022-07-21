const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const Verifier = artifacts.require('Verifier.sol');
const Shield = artifacts.require('Shield.sol');
const MerkleTree_Stateless = artifacts.require('MerkleTree_Stateless.sol');
const Structures = artifacts.require('Structures.sol');
const Config = artifacts.require('Config.sol');
const Utils = artifacts.require('Utils.sol');
const ChallengesUtil = artifacts.require('ChallengesUtil.sol');
const Proposers = artifacts.require('Proposers.sol');
const Challenges = artifacts.require('Challenges.sol');
const Poseidon = artifacts.require('Poseidon.sol');
const State = artifacts.require('State.sol');
// const { poseidonContract } = require('circomlibjs');
// const contract = require('@truffle/contract');
// const Web3 = require('web3');

module.exports = async function (deployer) {
  // const poseidonT3ABI = poseidonContract.generateABI(2);
  // const poseidonT3Bytecode = poseidonContract.createCode(2);

  // let web3Provider = provider
  //   ? provider
  //   : host === 'ganache'
  //   ? new Web3.providers.HttpProvider(url)
  //   : new Web3.providers.WebsocketProvider(url);

  // const web3 = new Web3(web3Provider);
  // const accounts = await web3.eth.getAccounts();

  // const PoseidonT3Lib = contract({
  //   contractName: 'PoseidonT3',
  //   abi: poseidonT3ABI,
  //   bytecode: poseidonT3Bytecode,
  // });

  // PoseidonT3Lib.setProvider(web3Provider);

  await deployer.deploy(Verifier);
  await deployer.link(Verifier, [Challenges, ChallengesUtil]);
  //await deployer.deploy(PoseidonT3Lib, { from: accounts[0] });
  await deployer.deploy(Poseidon);
  await deployer.link(Poseidon, MerkleTree_Stateless);
  await deployer.deploy(MerkleTree_Stateless);
  await deployer.link(MerkleTree_Stateless, [Challenges, ChallengesUtil]);
  await deployer.deploy(Utils);
  await deployer.link(Utils, [Shield, State, Challenges, ChallengesUtil]);
  await deployer.deploy(ChallengesUtil);
  await deployer.link(ChallengesUtil, Challenges);
  await upgradeProxy((await Structures.deployed()).address, Structures, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Config.deployed()).address, Config, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Proposers.deployed()).address, Proposers, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Challenges.deployed()).address, Challenges, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await Shield.deployed()).address, Shield, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
  await upgradeProxy((await State.deployed()).address, State, {
    deployer,
    unsafeAllowLinkedLibraries: true,
  });
};
