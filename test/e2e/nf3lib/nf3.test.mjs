/* eslint no-empty: "off" */

import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import { fail } from 'assert';
import Nf3 from 'common-files/classes/nf3.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;

describe('Nf3 Test', () => {
  /* This suite of tests require that `nightfall-client` be set with an authentication key (see `AUTHENTICATION_KEY` env var)
   * for it to work. The value of the authentication key should be set in the environment variable `CLIENT_AUTHENTICATION_KEY`
   * so that it can be captured inside the tests.
   */
  describe('nightfall-client authenticated calls tests', () => {
    it('Should fail since no authentication key is set', async () => {
      const nf3User = new Nf3(signingKeys.user1, environment);
      try {
        await nf3User.init(mnemonics.user1);
        fail();
      } catch (err) {
        expect(err.isAxiosError && err.response.status === 401).to.be.equal(true);
      } finally {
        nf3User.close();
      }
    });

    it('Should pass since the client authentication key is set', async () => {
      const nf3User = new Nf3(
        signingKeys.user1,
        environment,
        undefined,
        process.env.CLIENT_AUTHENTICATION_KEY,
      );

      try {
        await nf3User.init(mnemonics.user1);
      } catch (err) {
        fail();
      } finally {
        nf3User.close();
      }
    });
  });
});
