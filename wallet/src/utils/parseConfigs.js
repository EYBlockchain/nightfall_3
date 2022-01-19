// eslint-disable-next-line import/no-extraneous-dependencies
import config from 'config';

function parse(configs) {
  for (const key of Object.keys(configs)) {
    let value = configs[key];
    if (value.endsWith && value.endsWith(' BigInt')) {
      value = value.replace(' BigInt', '');
      value = BigInt(value);
      // eslint-disable-next-line no-param-reassign
      configs[key] = value;
    }
    if (value instanceof Object) parse(value);
  }
}
parse(config);
global.config = config;
