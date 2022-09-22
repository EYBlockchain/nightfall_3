import assert from 'assert';
import { obfuscate } from '../utils/utils.mjs';

describe('Utils tests', function () {
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

  it('Should obfuscate the object successfuly', () => {
    process.env.NODE_ENV = 'production';

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

  it("Shouldn't obfuscate for the Dev environment", () => {
    process.env.NODE_ENV = 'developer';

    const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

    assert.equal(result, OBJECT_TO_OBFUSCATE);
  });

  it("Shouldn't obfuscate if the settings object is undefined", () => {
    const result = obfuscate(OBJECT_TO_OBFUSCATE, undefined);

    assert.equal(result, OBJECT_TO_OBFUSCATE);
  });

  it("Shouldn't obfuscate if the settings object is not an object", () => {
    const result = obfuscate(OBJECT_TO_OBFUSCATE, [1, 2, 3]);

    assert.equal(result, OBJECT_TO_OBFUSCATE);
  });
});
