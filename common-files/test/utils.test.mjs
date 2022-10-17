import assert from 'assert';
import { obfuscate } from '../utils/utils.mjs';

describe('Utils tests', function () {
  describe('Obfuscation', function () {
    const OBFUSCATION_SETTINGS_TEST = {
      public_key: 'HALF',
      '.*key(s)?|.*password.*|.*secret.*': 'ALL',
    };

    const OBJECT_TO_OBFUSCATE = {
      ETH_PRIVATE_KEY: 0x0123456789abcdef,
      ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
      pUbLic_key: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
      My_secret: 'testing...',
      SECRET: 'testing...',
      SECRET_test: 'testing...',
      xxxSECRETxxx: 'testing...',
      My_passworD: 'testing...',
      PASSWORD: 'testing...',
      PASSWord_xpto: 'testing...',
      xxxxPASSWORDxxxx: 'testing...',
      null_: null,
      kEys: [
        2389213809483081092831,
        '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
        {
          secret: 'blablabla',
        },
      ],
      sensitive_info_inside: {
        ETH_PRIVATE_KEY: 0x0123456789abcdef,
        ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
        pUbLic_key: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
        My_secret: 'testing...',
        SECRET: 'testing...',
        SECRET_test: 'testing...',
        xxxSECRETxxx: 'testing...',
        My_passworD: 'testing...',
        PASSWORD: 'testing...',
        PASSWord_xpto: 'testing...',
        xxxxPASSWORDxxxx: 'testing...',
        kEys: [
          2389213809483081092831,
          '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
          'test',
        ],
        inner_: {
          inner__: {
            inner___: {
              ok: 'okokok',
              key: 92943898394824,
            },
          },
        },
      },
      more_one_key: () => {},
    };

    this.beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.ENVIRONMENT = 'aws';
    });

    it('Should obfuscate the object successfully', () => {
      const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

      assert.deepEqual(result, {
        ETH_PRIVATE_KEY: '*****************',
        ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
        pUbLic_key: '0x4789FD18D5d71982045*********************',
        My_secret: '**********',
        SECRET: '**********',
        SECRET_test: '**********',
        xxxSECRETxxx: '**********',
        My_passworD: '**********',
        PASSWORD: '**********',
        PASSWord_xpto: '**********',
        xxxxPASSWORDxxxx: '**********',
        null_: null,
        kEys: [
          '**********************',
          '******************************************************************',
          {
            secret: '*********',
          },
        ],
        sensitive_info_inside: {
          ETH_PRIVATE_KEY: '*****************',
          ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
          pUbLic_key: '0x4789FD18D5d71982045*********************',
          My_secret: '**********',
          SECRET: '**********',
          SECRET_test: '**********',
          xxxSECRETxxx: '**********',
          My_passworD: '**********',
          PASSWORD: '**********',
          PASSWord_xpto: '**********',
          xxxxPASSWORDxxxx: '**********',
          kEys: [
            '**********************',
            '******************************************************************',
            '****',
          ],
          inner_: {
            inner__: {
              inner___: {
                ok: 'okokok',
                key: '**************',
              },
            },
          },
        },
        more_one_key: '********************',
      });
    });

    it("Shouldn't obfuscate if the parameter to obfuscate is not an object", () => {
      const result = obfuscate('', OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, '');
    });

    it("Shouldn't obfuscate for the local environment", () => {
      process.env.ENVIRONMENT = 'local';

      const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate for when ENVIRONMENT is blank", () => {
      process.env.ENVIRONMENT = '';

      const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate for when ENVIRONMENT is not set", () => {
      delete process.env.ENVIRONMENT;

      const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate if the settings object is undefined", () => {
      const result = obfuscate(OBJECT_TO_OBFUSCATE, undefined);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate if the settings object is not an objec/string - #1", () => {
      const result = obfuscate(OBJECT_TO_OBFUSCATE, [1, 2, 3]);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate if the settings object is not an objec/string - #2", () => {
      const result = obfuscate(OBJECT_TO_OBFUSCATE, 1);

      assert.equal(result, OBJECT_TO_OBFUSCATE);
    });

    it("Shouldn't obfuscate because the string doesn't have a query string - #1", () => {
      const result = obfuscate('http://localhost', OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, 'http://localhost');
    });

    it("Shouldn't obfuscate because the string doesn't have a query string - #2", () => {
      const result = obfuscate('http://localhost?', OBFUSCATION_SETTINGS_TEST);

      assert.equal(result, 'http://localhost?');
    });

    it('Should obfuscate the query string successfully #1', () => {
      const result = obfuscate(
        'http://localhost?xpto=blablabla&public_key=0x4789FD18D5d71982045d85d5218493fD69F55AC4&priv_key=0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d&secret=xpto01234567&name=&&nop',
        OBFUSCATION_SETTINGS_TEST,
      );

      assert.equal(
        result,
        'http://localhost?xpto=blablabla&public_key=0x4789FD18D5d71982045*********************&priv_key=******************************************************************&secret=************&name=&&nop',
      );
    });

    it('Should obfuscate the query string successfully #2', () => {
      const result = obfuscate(
        '/commitment/balance?compressedZkpPublicKey=0x8b1cd14f2defec7928cc958e2dfbc86fbd3218e25a10807388a5db4b8fa4837e',
        OBFUSCATION_SETTINGS_TEST,
      );

      assert.equal(
        result,
        '/commitment/balance?compressedZkpPublicKey=******************************************************************',
      );
    });
  });
});
