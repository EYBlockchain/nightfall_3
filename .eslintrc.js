module.exports = {
  extends: ['codfish', 'eslint:recommended', 'plugin:prettier/recommended'],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
    'func-names': 'off',
    'no-sparse-arrays': 'off',
    'lines-between-class-members': 'off',
    '@typescript-eslint/lines-between-class-members': ['error'],
    '@typescript-eslint/no-non-null-assertion': 'off',
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
