import fs from 'fs';

import { untarFiles, deleteFile, getFilesRecursively } from '../utils/filing.mjs';

export default async function loadCircuits(circuits) {
  const outputPath = `./circuits/`;

  if (!circuits.name.endsWith('.tar') && !circuits.name.endsWith('.zok')) {
    throw Error(`Expected an archive file with extension '.tar'. Got ${circuits.name}`);
  }

  const exists = fs.existsSync(`${outputPath}${circuits.name}`);

  if (circuits.data) {
    // logic to handle when load-circuits is via rabbitmq
    fs.writeFileSync(`${outputPath}${circuits.name}`, circuits.data);
  } else {
    // logic to handle when load-circuits is via api call
    // Use the mv() method to place the file in the required directory (i.e. "./circuits")
    await circuits.mv(`${outputPath}${circuits.name}`);
  }

  // extra code to handle unpacking a tar archive
  let overwrote;
  if (circuits.name.endsWith('.tar')) {
    // unarchive the circuit files and put in a list then delete the archive
    overwrote = await untarFiles('/app/circuits', circuits.name);
    const files = await getFilesRecursively(`/app/circuits/${circuits.name.replace('.tar', '')}`);
    await deleteFile(`${outputPath}${circuits.name}`);
    // check the archive contained .zok files only
    files.forEach(file => {
      if (!file.endsWith('.zok')) {
        throw Error('For shame, this is not an .zok file');
      }
      return null;
    });
  }

  return {
    status: true,
    message: `File ${circuits.name} was uploaded`,
    data: {
      name: circuits.name,
      mimetype: circuits.mimetype,
      size: circuits.size,
      overwrote: exists || overwrote,
    },
  };
}
