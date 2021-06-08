import fs from 'fs';

const readJsonFile = filePath => {
  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  }
  console.log('Unable to locate file: ', filePath);
  return null;
};

/**
Reads the verification key file and extracts the key as a json object
*/
export default function extractVk(inputFile) {
  return readJsonFile(inputFile);
}
