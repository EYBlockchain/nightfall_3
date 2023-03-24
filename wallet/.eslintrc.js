module.exports = {
  root: true,
  extends: ['codfish', 'eslint:recommended', 'plugin:react/recommended'],
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'import/extensions': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
    'func-names': 'off',
    'no-sparse-arrays': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'react/forbid-prop-types': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['off'],
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
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      alias: {
        map: [
          ['@TokenList', './src/static/supported-token-lists'],
          ['@Nightfall', './src/nightfall-browser'],
          ['@Components', './src/components'],
        ],
        extensions: ['.ts', '.js', '.jsx', '.json'],
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
  // Override for TS files
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      env: { browser: true, es6: true, node: true },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      globals: { Atomics: 'readonly', SharedArrayBuffer: 'readonly' },
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2018,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint'],
      rules: {
        indent: ['error', 2, { SwitchCase: 1 }],
        'linebreak-style': ['error', 'unix'],
        quotes: ['error', 'single'],
        'comma-dangle': ['error', 'always-multiline'],
        '@typescript-eslint/no-explicit-any': 0,
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': ['error'],
        'click-events-have-key-events': 'off',
        'react/prop-types': 'off',
      },
    },
  ],
};
