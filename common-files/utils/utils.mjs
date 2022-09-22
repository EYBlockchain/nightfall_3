/* eslint no-use-before-define: "off" */
/* eslint no-else-return: "off" */

export const isDev = () => process.env.NODE_ENV !== 'production';

/**
 * This method is intended to be used for obfuscating sensitive data, totally or partially. It uses the obfuscation
 * settings passed as parameter to perform the obfuscation.
 *
 * @param object Object over which the obfuscation will run.
 * @param obfuscationSettings Object that contains the rules to be applied during obfuscation. These obfuscation
 * rules are only applied on Production environments only. The obfuscated fields will be printed in the logs
 * using asteriskis (e.g. private_key: '*******...', api_key: '03bac*****9123', etc.). Keep the keys (fields) in
 * lower case and you're safe.
 *
 * Details about the object:
 * key - Name of the field to obfuscate. It can be a regex.
 * value - contains how the obfuscation will be applied to the content. Allowed values:
 *  ALL - obfuscate all the content. (e.g. 'private_key': 'ALL')
 *  HALF - ofuscate the second half of the content (e.g. 'private_key': 'HALF')
 */
export const obfuscate = (object, obfuscationSettings) => {
  if (
    isDev() ||
    !object ||
    typeof object !== 'object' ||
    !obfuscationSettings ||
    typeof obfuscationSettings !== 'object' ||
    Array.isArray(obfuscationSettings) ||
    obfuscationSettings.length === 0
  ) {
    return object;
  }

  const obfuscatedObject = {};
  const objectKeys = Object.keys(object);
  const obfuscationKeys = Object.keys(obfuscationSettings);

  objectKeys.forEach(objectKey => {
    let value = object[objectKey];

    if (value) {
      let obfuscationApplied = false;
      for (let i = 0; i < obfuscationKeys.length; i++) {
        const obfuscationKey = obfuscationKeys[i];

        if (new RegExp(obfuscationKey).test(objectKey.toLowerCase())) {
          value = obfuscateValue(value, obfuscationSettings, obfuscationKey);
          obfuscationApplied = true;
          break;
        }
      }

      if (!obfuscationApplied && typeof value === 'object') {
        value = obfuscate(value, obfuscationSettings);
      }
    }

    obfuscatedObject[objectKey] = value;
  });

  return obfuscatedObject;
};

const obfuscateString = (value, obfuscationToApply) => {
  if (obfuscationToApply === 'ALL') {
    return '*'.repeat(value.length <= 80 ? value.length : 80);
  }

  const midIndex = Math.floor(value.length / 2);
  return value.substring(0, midIndex) + '*'.repeat(midIndex);
};

const obfuscateValue = (value, obfuscationSettings, obfuscationKey) => {
  const obfuscationToApply = obfuscationSettings[obfuscationKey];

  if (typeof value !== 'string') {
    if (typeof value === 'number') {
      /* eslint no-param-reassign: "off" */
      value = String(value);
    } else {
      if (Array.isArray(value)) {
        return value.map(v => obfuscateValue(v, obfuscationSettings, obfuscationKey));
      } else if (typeof value === 'object') {
        return obfuscate(value, obfuscationSettings);
      }

      return '********************';
    }
  }

  return obfuscateString(value, obfuscationToApply);
};
