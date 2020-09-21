import express from 'express';
import fs from 'fs';
import { untarFiles, deleteFile, getFilesRecursively } from '../utils/filing.mjs';

const router = express.Router();

const outputPath = `./circuits/`;

router.post('/', async (req, res, next) => {
  req.setTimeout(900000);
  try {
    if (!req.files) {
      return res.send({
        status: false,
        message: 'No file uploaded',
      });
    }
    // Use the name of the input field (i.e. "circuits") to retrieve the uploaded file
    const { circuits } = req.files;
    if (!circuits.name.endsWith('.tar') && !circuits.name.endsWith('.zok')) {
      return res.send({
        status: false,
        message: `Expected either a zokrates .zok file or tar achive. Got ${circuits.name}`,
      });
    }
    // check for duplicates
    const exists = fs.existsSync(`${outputPath}${circuits.name}`);
    // Use the mv() method to place the file in the required directory (i.e. "./circuits")
    await circuits.mv(`${outputPath}${circuits.name}`);

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
          return res.send({
            status: false,
            message: 'For shame, this is not an .zok file',
          });
        }
        return null;
      });
    }

    // send response
    return res.send({
      status: true,
      message: `File ${circuits.name} was uploaded`,
      data: {
        name: circuits.name,
        mimetype: circuits.mimetype,
        size: circuits.size,
        overwrote: exists || overwrote,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
