import fs from 'fs';
import path from 'path';

const { mkdir, readdir, copyFile } = fs.promises;

// This copies the nightfall-optimist directory
// eslint-disable-next-line import/prefer-default-export
export async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name !== 'node_modules') {
      // eslint-disable-next-line no-await-in-loop
      if (entry.isDirectory()) await copyDir(srcPath, destPath);
      // eslint-disable-next-line no-await-in-loop
      else await copyFile(srcPath, destPath);
    }
  }
}
