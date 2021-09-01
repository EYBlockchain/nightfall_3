import gen from 'general-number';
import sha256 from '../common-files/utils/crypto/sha256.mjs';

const { GN } = gen;

export const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
export const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
export const url = 'http://localhost:8080';
export const optimistUrl = 'http://localhost:8081';
export const optimistWsUrl = 'ws:localhost:8082';
export const tokenId = '0x00';
export const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
export const value = 10;
// this is the etherum private key for accounts[0]
export const privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
export const gas = 10000000;
export const fee = 1;
export const BLOCK_STAKE = 1000000000000000000; // 1 ether
export const bond = 10000000000000000000; // 10 ether
