import fs from 'fs';
import logger from 'general-number/logger.js';
import path from 'path';

export default async function checkCircuitHash({ filepath, hash }) {
    const outputPath = `./output`;
    const filePath = `${outputPath}/circuithash.txt`;
    const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'

    if (!fs.existsSync(filePath)) {
        fs.writeFile(filePath, "[]", function (err) {
            if (err) {
                logger.error(err);
            }
        });
    }

    const resultBuffer = fs.readFileSync(filePath);
    let resultData = JSON.parse(resultBuffer.toString().trim());

    let differentHash;
    let exist = false;

    for (let element of resultData) {
        if (element.circuitName == circuitName && element.circuitHash == hash) {
            differentHash = false;
            exist = true;
        }
        else if (element.circuitName == circuitName && element.circuitHash !== hash) {
            differentHash = true;
            exist = true;
            element.circuitHash = hash
        }
    }

    if (!exist) {
        resultData.push({ circuitHash: hash, circuitName: circuitName, });
        differentHash = true;
    }

    if (differentHash) {
        fs.writeFile(filePath, JSON.stringify(resultData), function (err) {
            if (err) {
                logger.error(err);
            }
        });
    }

    return differentHash;
}
