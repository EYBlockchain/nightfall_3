import express from 'express';
import fs from 'fs';

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
    // Use the name of the input field (i.e. "circuit") to retrieve the uploaded file
    const { circuit } = req.files;
    if (!circuit.name.endsWith('.zok')) {
      return res.send({
        status: false,
        message: 'For shame, this is not a .zok circuit file',
      });
    }
    // check for duplicates
    const exists = fs.existsSync(`${outputPath}${circuit.name}`);
    // Use the mv() method to place the file in the required directory (i.e. "./circuits")
    circuit.mv(`${outputPath}${circuit.name}`);
    // send response
    return res.send({
      status: true,
      message: `File ${circuit.name} was uploaded`,
      data: {
        name: circuit.name,
        mimetype: circuit.mimetype,
        size: circuit.size,
        overwrote: exists,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
