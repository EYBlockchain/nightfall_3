const path = require('path');

module.exports = function override(config) {
  const wasmExtensionRegExp = /\.wasm$/;

  config.resolve.extensions.push('.wasm');

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

  // add a dedicated loader for zok
  config.module.rules.push({
    test: /\.zok$/i,
    include: path.resolve(__dirname, 'src'),
    use: [{ loader: require.resolve('raw-loader'), options: { esModule: false } }],
  });

  return config;
};
