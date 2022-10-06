import axios, { Axios } from 'axios';

export default class HttpFactory {
  optimist: Axios;
  estimateGasUrl: Axios;
  blockchain: Axios;

  constructor({ environment, options }) {
    const { optimistApiUrl, web3WsUrl } = environment;
    const { estimateGasEndpoint } = options;

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
