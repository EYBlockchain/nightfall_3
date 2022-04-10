const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
/* eslint-disable global-require */
const { addBeforeLoader, loaderByName } = require('@craco/craco');
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const path = require(`path`);

module.exports = {
  webpack: {
    alias: {
      '@TokenList': path.resolve(__dirname, `src/static/supported-token-lists/`),
      '@Nightfall': path.resolve(__dirname, `src/nightfall-browser/`),
      '@Components': path.resolve(__dirname, `src/components/`),
    },
    plugins: {
      add: [
        new WebpackManifestPlugin({
          fileName: 'assets_test.json',
          generate: (seed, files) => {
            const js = [];
            const css = [];
            files.forEach(file => {
              if (file.path.endsWith('.js') && file.isInitial) {
                js.push({ value: file.path, type: 'entry' });
              }
              if (file.path.endsWith('.css') && file.isInitial) {
                css.push({ value: file.path, type: 'entry' });
              }
            });
            return { js, css };
          },
        }),
      ],
      remove: ['ManifestPlugin'],
    },
    configure: (webpackConfig, { paths }) => {
      const wasmExtensionRegExp = /\.wasm$/;
      const config = require('../config/default');
      webpackConfig.resolve.extensions.push('.wasm');
      // eslint-disable-next-line no-extend-native
      BigInt.prototype.toJSON = function () {
        return `${this.toString()} BigInt`;
      };

      // eslint-disable-next-line no-param-reassign
      webpackConfig.externals = { config: JSON.stringify(config) };
      webpackConfig.module.rules.forEach(rule => {
        (rule.oneOf || []).forEach(oneOf => {
          if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
            oneOf.exclude.push(wasmExtensionRegExp);
          }
        });
      });

      const wasmLoader = {
        test: wasmExtensionRegExp,
        include: paths.appSrc,
        loader: require.resolve('wasm-loader'),
        options: {},
      };
      addBeforeLoader(webpackConfig, loaderByName('file-loader'), wasmLoader);
      return webpackConfig;
    },
  },
};
