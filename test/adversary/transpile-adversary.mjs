import fs from 'fs';
import path from 'path';
const { mkdir, readdir, copyFile } = fs.promises;

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name !== 'node_modules')
      entry.isDirectory() ? await copyDir(srcPath, destPath) : await copyFile(srcPath, destPath);
  }
}

copyDir('./nightfall-optimist/', './test/adversary/optimist/').then(() => console.log('done'));
