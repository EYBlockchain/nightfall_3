module.exports = {
  extends: [
    'codfish',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
    'func-names': 'off',    
  },
  parser: 'babel-eslint', // Uses babel-eslint transforms.
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  settings: {
    react: {
      version: 'latest',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['./wallet/node_modules', './wallet/src/'],
      },
    },
  },
  globals: {
    BigInt: 'true',
  },
  env: {
    mocha: true,
    browser: true,
    node: true,
    jest: true,
  },
  plugins: ['import'],
};
