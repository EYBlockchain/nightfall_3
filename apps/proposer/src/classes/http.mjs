import config from 'config';
import axios from 'axios';

const { optimistApiUrl, web3WsUrl } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { WEB3_OPTIONS: estimateGasEndpoint } = config;

export class HttpFactory {
  constructor() {
    this.optimist = axios.create({
      baseURL: optimistApiUrl,
    });
    this.optimist.interceptors.response.use(res => res.data);

    this.estimateGasUrl = axios.create({
      baseURL: estimateGasEndpoint,
    });
    this.estimateGasUrl.interceptors.response.use(res => res.data);

    this.blockchain = axios.create({
      baseURL: web3WsUrl,
    });
    this.blockchain.interceptors.response.use(res => res.data);
  }
}

export const { optimist, estimateGasUrl, blockchain } = new HttpFactory();
