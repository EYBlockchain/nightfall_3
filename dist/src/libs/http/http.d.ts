import { Axios } from 'axios';
export default class HttpFactory {
    optimist: Axios;
    estimateGasUrl: Axios;
    blockchain: Axios;
    constructor({ environment, options }: {
        environment: any;
        options: any;
    });
}
