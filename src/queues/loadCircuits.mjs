import fs from 'fs';

import rabbitmq from '../utils/rabbitmq.mjs';
import { untarFiles, deleteFile, getFilesRecursively } from '../utils/filing.mjs';

export default function receiveMessage() {
  const outputPath = `./circuits/`;

  rabbitmq.receiveMessage('load-circuits', async message => {
    const circuits = JSON.parse(message.content.toString());
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      if (!circuits.name.endsWith('.tar')) {
        throw Error(`Expected an archive file with extension '.tar'. Got ${circuits.name}`);
      }
      fs.writeFileSync(`${outputPath}${circuits.name}`, circuits.data);

      // unarchive the circuit files
      await untarFiles('/app/circuits', circuits.name);

      // get a list of files from the unarchived folder
      const files = await getFilesRecursively(`/app/circuits/${circuits.name.replace('.tar', '')}`);
      files.forEach(file => {
        if (!file.endsWith('.zok')) {
          throw Error('For shame, this is not an .zok file');
        }
        return null;
      });

      // delete the archive file
      await deleteFile(`${outputPath}${circuits.name}`);
    } catch (err) {
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
