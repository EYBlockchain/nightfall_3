/* eslint-disable camelcase */

import fs from 'fs';
import tar from 'tar';
import path from 'path';
import logger from './logger.mjs';

const outputPath = `/app/output`;

const vkPath = circuitPath => `${outputPath}/${circuitPath}/${path.basename(circuitPath)}_vk.key`;

const readJsonFile = filePath => {
  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  }
  logger.warn('Unable to locate file: ', filePath);
  return null;
};

/**
Strip the 'raw' field from the vk data
*/
const stripRawData = vk => {
  const { alpha, beta, gamma, delta, gamma_abc } = vk;
  return { alpha, beta, gamma, delta, gamma_abc };
};

export const getVerificationKeyByCircuitPath = circuitPath => {
  const vk = readJsonFile(vkPath(circuitPath));
  const strippedVK = vk === null ? vk : stripRawData(vk);
  return strippedVK;
};

export const getProofFromFile = filePath => {
  return readJsonFile(`${outputPath}/${filePath}`);
};

export const untarFiles = async (filePath, fileName) => {
  const dir = fileName.replace('.tar', '');
  const cwd = `${filePath}/${dir}`;
  const exists = fs.existsSync(cwd);
  if (!exists) {
    fs.mkdirSync(cwd);
  }
  await tar.x({
    file: `${filePath}/${fileName}`,
    cwd,
  });
  return exists;
};

export const deleteFile = async filePath => {
  await fs.rmdir(
    filePath,
    {
      recursive: true,
    },
    err => {
      if (err) {
        return console.error(err);
      }
      return null;
    },
  );
};

export const deleteSingleFile = fileName => {
  fs.unlink(fileName, err => {
    if (err) throw err;
  });
};

export const getFilesRecursively = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const fileStat = fs.lstatSync(filePath);

    if (fileStat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else {
      fileList.push(file);
    }
  });

  return fileList;
};
