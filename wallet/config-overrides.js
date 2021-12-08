const path = require('path');
const webConfig = require('../config/default');

BigInt.prototype.toJSON = function() {
  return this.toString();
};

module.exports = function override(config) {
  const wasmExtensionRegExp = /\.wasm$/;
  config.resolve.extensions.push('.wasm');
  config.externals = {};
  config.externals.config = JSON.stringify(webConfig);

  config.module.rules.forEach(rule => {
    (rule.oneOf || []).forEach(oneOf => {
      if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
        // make file-loader ignore WASM files
        oneOf.exclude.push(wasmExtensionRegExp);
      }
    });
  });

  // add a dedicated loader for WASM
  config.module.rules.push({
    test: wasmExtensionRegExp,
    include: path.resolve(__dirname, 'src'),
    use: [{ loader: require.resolve('wasm-loader'), options: {} }],
  });
  return config;
};
