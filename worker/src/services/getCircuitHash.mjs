import fs from 'fs';
import path from 'path';

export default async function getCircuitHash(circuit) {
  const outputPath = `./output`;
  const filePath = `${outputPath}/circuithash.txt`;
  const circuitNameWext = path.basename(circuit, '.circom'); // filename without '.circom'
  let returnedHash = 0;

  if (fs.existsSync(filePath)) {
    const resultBuffer = fs.readFileSync(filePath);
    const resultData = JSON.parse(resultBuffer.toString().trim());

    for (const element of resultData) {
      if (element.circuitName === circuitNameWext) {
        returnedHash = element.circuitHash;
      }
    }
  }
  return returnedHash;
}
