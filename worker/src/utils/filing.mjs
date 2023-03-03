/* eslint-disable camelcase */

import fs from 'fs';
import tar from 'tar';
import path from 'path';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import * as snarkjs from 'snarkjs';

const outputPath = `/app/output`;

export const getVerificationKeyByCircuitPath = async circuitPath => {
  const vkPath = `${outputPath}/${circuitPath}/${path.basename(circuitPath)}.zkey`;
  if (fs.existsSync(vkPath)) {
    logger.debug(`Exporting verification key with snarkjs for ${vkPath}`);

    let vk;
    try {
      vk = await snarkjs.zKey.exportVerificationKey(vkPath);
      logger.debug(`Exported verification key for ${vkPath}`);
    } catch (error) {
      logger.error({
        msg: 'Error snarkjs exportVerificationKey',
        error,
      });
      throw new Error(error);
    }
    return vk;
  }

  logger.warn({ msg: 'Unable to locate file', vkPath });

  return null;
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
      logger.error({ msg: 'Error trying to delete file', filePath, errorMessage: err.message });
      return null;
    },
  );
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

export const readJsonFile = filePath => {
  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  }

  logger.warn({ msg: 'Unable to locate file', filePath });

  return null;
};
