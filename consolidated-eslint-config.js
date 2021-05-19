module.exports = {
  extends: ['codfish'],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
  },
  globals: {
    BigInt: 'true',
  },
  env: {
    mocha: true,
    es6: true,
  },
  parserOptions: {
    sourceType: 'module',
    allowImportExportEverywhere: true,
  },
};
