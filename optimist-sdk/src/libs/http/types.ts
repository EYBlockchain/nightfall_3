import { Axios } from 'axios';

export interface Services {
  blockchain: Axios;
  estimateGasUrl: Axios;
  optimist: Axios;
}
