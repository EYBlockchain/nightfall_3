import fs from 'fs';
import logger from '../utils/logger.mjs';

const readJsonFile = filePath => {
  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  }
  logger.debug('Unable to locate file: ', filePath);
  return null;
};

/**
Reads the verification key file and extracts the key as a json object
*/
export default function extractVk(inputFile) {
  return readJsonFile(inputFile);
}
