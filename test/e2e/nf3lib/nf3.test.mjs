/* eslint no-empty: "off" */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import { fail } from 'assert';
import Nf3 from '../../../cli/lib/nf3.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;

describe('Nf3 Test', () => {
  describe('Client Authenticated calls tests', () => {
    it('Should fail since no authentication key is set', async () => {
      const nf3User = new Nf3(signingKeys.user1, environment);
      try {
        await nf3User.init(mnemonics.user1);
        fail();
      } catch (err) {}
    });

    it('Should pass since the authentication key is set', async () => {
      process.env.CLIENT_AUTHENTICATION_KEY = process.env.AUTHENTICATION_KEY;

      const nf3User = new Nf3(signingKeys.user1, environment);

      try {
        await nf3User.init(mnemonics.user1);
      } catch (err) {
        fail();
      }
    });
  });
});
