module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['codfish', 'eslint:recommended', 'plugin:react/recommended'],
  plugins: ['react'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
  },
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
    'react/prop-types': 'off',
    'react/jsx-no-bind': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'react/self-closing-comp': 'off',
    'default-param-last': 'off', // nightfall_3/demo-ui/src/cli/lib/nf3.mjs complains a lot about it and I don't want to break it.
  },
};
