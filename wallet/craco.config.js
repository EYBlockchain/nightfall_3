/* eslint-disable global-require */
const { addBeforeLoader, loaderByName } = require('@craco/craco');

module.exports = {
  plugins: [{ plugin: require('@semantic-ui-react/craco-less') }],
  webpack: {
    configure: (webpackConfig, { paths }) => {
      const wasmExtensionRegExp = /\.wasm$/;

      webpackConfig.resolve.extensions.push('.wasm');

      webpackConfig.module.rules.forEach((rule) => {
        (rule.oneOf || []).forEach((oneOf) => {
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
