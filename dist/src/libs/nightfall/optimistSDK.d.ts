/// <reference types="node" />
import ReconnectingWebSocket from 'reconnecting-websocket';
import Queue from 'queue';
import { ContractsType } from './types.js';
import Proposer from '../proposer/index.js';
import { Defaults, GasTypes } from '../ethereum/types.js';
import { Axios } from 'axios';
import Web3 from 'web3';
import { Services } from '../http/types.js';
export default class OptimistSDK extends Proposer {
    intervalIDs: Array<NodeJS.Timeout>;
    eventQueue: Queue;
    connection: ReconnectingWebSocket;
    contracts: ContractsType;
    gas: GasTypes;
    optimist: Axios;
    web3: Web3;
    privateKey: string;
    defaults: Defaults;
    services: Services;
    constructor({ environment }: {
        environment: any;
    });
    init(): Promise<void>;
}
