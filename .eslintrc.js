module.exports = {
  extends: ['codfish'],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/test/*'] }],
  },
  globals: {
    BigInt: 'true',
  },
  env: {
    mocha: true,
  },
};
