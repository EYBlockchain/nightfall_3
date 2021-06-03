module.exports = {
  extends: ['codfish'],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
    'no-await-in-loop': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/test/*'] }],
  },
  globals: {
    BigInt: 'true',
  },
  env: {
    mocha: true,
  },
};
