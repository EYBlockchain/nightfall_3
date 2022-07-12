import Web3 from 'web3';
import provider from './web3provider.mjs';

const web3 = new Web3(provider());

export default web3;
