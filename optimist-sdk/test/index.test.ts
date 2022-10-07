/* eslint-disable no-await-in-loop */
import * as config from 'config';
import Proposer from '../src/libs/proposer/index';
import { jest } from '@jest/globals';

jest.useFakeTimers();

const { ENVIRONMENTS, RESTRICTIONS }: any = config;

// eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
const environment: any = ENVIRONMENTS[process.env.ENVIRONMENT!] || ENVIRONMENTS.localhost;

describe('Test', () => {
  // const optimist = new OptimistSDK({
  //   environment,
  // });
  // test('new sdk', async function () {
  //   console.log(environment);
  //   await optimist.init();
  //   // optimist.connection.close();
  //   // console.log(optimist);
  // });
  // afterEach(() => {
  //   optimist.connection.close();
  // });
});
