/* eslint import/no-extraneous-dependencies: "off" */

import chai from 'chai';
import assert from 'assert';
import { obfuscate } from '../utils/utils.mjs';

const { expect } = chai;

describe('Utils tests', function () {
  const OBFUSCATION_SETTINGS_TEST = {
    public_key: 'HALF',
    '^(?!.*public).*key(s)?$|.*password.*|.*secret.*|.*mnemonic.*': 'ALL',
  };

  const OBJECT_TO_OBFUSCATE = {
    mnemonic: 'orange xpto iglu blablabla',
    ETH_PRIVATE_KEY: 0x0123456789abcdef,
    ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
    pUbLic_key: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
    zkpPublicKey: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
    compreessedZkpPublicKey: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
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

  const OBFUSCATED_OBJECT = {
    mnemonic: '**************************',
    ETH_PRIVATE_KEY: '*****************',
    ETH_ADDRESS: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
    pUbLic_key: '0x4789FD18D5d71982045*********************',
    zkpPublicKey: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
    compreessedZkpPublicKey: '0x4789FD18D5d71982045d85d5218493fD69F55AC4',
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
  };

  it('Should obfuscate the object successfuly', () => {
    const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

    assert.deepEqual(result, OBFUSCATED_OBJECT);
  });

  it('Should not obfuscate for local environment', () => {
    process.env.ENVIRONMENT = 'test';

    const result = obfuscate(OBJECT_TO_OBFUSCATE, OBFUSCATION_SETTINGS_TEST);

    assert.deepEqual(result, OBJECT_TO_OBFUSCATE);
  });

  it('Should raise an error if ObfuscationSettings is not an object', () => {
    expect(obfuscate.bind('', OBFUSCATION_SETTINGS_TEST)).to.throw(Error);
  });

  it('Should raise an error if ObfuscationSettings param is undefined', () => {
    expect(obfuscate.bind('', undefined)).to.throw(Error);
  });

  it('Should raise an error if the ObfuscationSettings param is not an objec/string - #1', () => {
    expect(obfuscate.bind('', [1, 2, 3])).to.throw(Error);
  });

  it('Should raise an error if the ObfuscationSettings param is not an objec/string - #2', () => {
    expect(obfuscate.bind('', 1)).to.throw(Error);
  });

  it("Shouldn't obfuscate because the string doesn't have a query string - #1", () => {
    const result = obfuscate('http://localhost', OBFUSCATION_SETTINGS_TEST);

    assert.equal(result, 'http://localhost');
  });

  it("Shouldn't obfuscate because the string doesn't have a query string - #2", () => {
    const result = obfuscate('http://localhost?', OBFUSCATION_SETTINGS_TEST);

    assert.equal(result, 'http://localhost?');
  });

  it('Should obfuscate the query string successfully', () => {
    const result = obfuscate(
      'http://localhost?xpto=blablabla&public_key=0x4789FD18D5d71982045d85d5218493fD69F55AC4&priv_key=0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d&secret=xpto01234567&name=&&nop',
      OBFUSCATION_SETTINGS_TEST,
    );

    assert.equal(
      result,
      'http://localhost?xpto=blablabla&public_key=0x4789FD18D5d71982045*********************&priv_key=******************************************************************&secret=************&name=&&nop',
    );
  });

  it("Shouldn't obfuscate the query string for '*PublicKey' strings", () => {
    const result = obfuscate(
      '/commitment/balance?compressedZkpPublicKey=0x8b1cd14f2defec7928cc958e2dfbc86fbd3218e25a10807388a5db4b8fa4837e',
      OBFUSCATION_SETTINGS_TEST,
    );

    assert.equal(
      result,
      '/commitment/balance?compressedZkpPublicKey=0x8b1cd14f2defec7928cc958e2dfbc86fbd3218e25a10807388a5db4b8fa4837e',
    );
  });
});
