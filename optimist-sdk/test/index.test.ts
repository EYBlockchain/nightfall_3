/* eslint-disable no-await-in-loop */
import * as config from 'config';
import OptimistSDK from '../src/libs/nightfall/optimistSDK.js';
import { jest } from '@jest/globals';

jest.useFakeTimers();

const { ENVIRONMENTS, RESTRICTIONS }: any = config;

// eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
const environment: any = ENVIRONMENTS[process.env.ENVIRONMENT!] || ENVIRONMENTS.localhost;

describe('Test', () => {
  const optimist = new OptimistSDK({
    environment,
  });
  test('new sdk', async function () {
    console.log(environment);

    await optimist.init();
    // optimist.connection.close();
    // console.log(optimist);
  });

  afterEach(() => {
    optimist.connection.close();
  });
});
