/**
Module to overwrite the VK placeholder in `inner-checks-vk.zok` with the actual VK of the inner-checks circuit.
*/

import fs from 'fs';
import config from 'config';
import logger from './utils/logger.mjs';

// convert a hex string to a decimal string
const hexToDec = hex => {
  return BigInt(hex).toString(10);
};

// FUTURE ENHANCEMENTS: make this module flexible enough to overwrite files for all in/out permutations.
const sourcePath = `${config.CIRCUITS_HOME}/${config.INNER_CHECKS_VK_TEMPLATE_PATH}`; // `.zokm` denoting a file with 'macro syntax'
const destinationPath = `${config.CIRCUITS_HOME}/${config.INNER_CHECKS_VK_PATH}`;

const readFile = filePath => {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'ascii');
  }
  logger.error('Unable to locate file: ', filePath);
  return null;
};

export const writeFile = (filePath, data) => {
  // this will overwrite any existing file:
  try {
    fs.writeFileSync(filePath, data, 'ascii');
  } catch (err) {
    throw new Error(err);
  }
};

export const writeVk = async vk => {
  const circuitCode = readFile(sourcePath);
  const vkArray = Object.values(vk).flat(Infinity).map(hexToDec);
  const regex = /\$.*?\$/; // search for text within $ DOLLAR SIGNS &
  const updatedCircuitCode = circuitCode.replace(regex, vkArray.toString());
  logger.silly('updatedCircuitCode:');
  logger.silly(updatedCircuitCode);
  writeFile(destinationPath, updatedCircuitCode);
};
