/* eslint no-param-reassign: "off" */
const { aliasWebpack } = require('react-app-alias-ex');
const rootConfig = require('../config/default');

module.exports = function override(config) {
  config.externals = {
    config: JSON.stringify(rootConfig),
    '@polygon-nightfall/common-files/utils/logger.mjs': JSON.stringify({}), // mock logger in cli/nf3.mjs
    ws: JSON.stringify({}), // mock ws in cli/nf3.mjs
    'node-cron': JSON.stringify({}), // mock node-cron in cli/nf3.mjs
    crypto: JSON.stringify({}), // mock crypto in cli/nf3.mjs
  };
  return aliasWebpack({})(config);
};
