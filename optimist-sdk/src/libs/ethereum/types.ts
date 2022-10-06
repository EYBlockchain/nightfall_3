import Web3 from 'web3';
import type { WebsocketProvider } from 'web3-core';
import { Services } from '../http/types';

export interface Defaults {
  gas: number;
  gasPrice: number;
  fee: number;
}

export interface EstimateGasResponse {
  result: {
    ProposeGasPrice: number;
  };
}

export interface GasTypes {
  address: string;
  web3: Web3;
  defaults: Defaults;
  services: Services;
  estimateGas: Function;
  estimateGasPrice: Function;
}

export interface Web3WebsocketTypes {
  provider: WebsocketProvider;
  web3: Web3;
}
