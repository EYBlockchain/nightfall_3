import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

import { depositNoHash, pad1280ThenHash, pad1024ThenHash, hash1536 } from './circuits';

export default function Zokrates() {
  const [proof, setProof] = useState('');
  useEffect(async () => {
    initialize().then(zokratesProvider => {
      // const source = "def main(private field a) -> (field): return a * a";
      const source = depositNoHash;
      const options = {
        location: 'main.zok', // location of the root module
        resolveCallback: (currentLocation, importLocation) => {
          console.log(`${currentLocation} is importing ' ${importLocation}`);
          let code;
          if (importLocation.endsWith('pad1280ThenHash.zok')) code = pad1280ThenHash;
          else if (importLocation.endsWith('pad1024ThenHash.zok')) code = pad1024ThenHash;
          else if (importLocation.endsWith('hash1536')) code = hash1536;
          return {
            source: code,
            location: importLocation,
          };
        },
      };
      //131873553141274018575215929564076153877009378287622559759079420309422171347 0 0 0 3786913876 4053413099 4184556347 2734706904 2298878123 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 10 2472106341 2077806855 1118094619 3660439001 2018347510 1388557323 531685419 3374069678 2085820079 311957195 586214569 1239578534 3188494577 1261029345 1553887056 2904390599 570879654 1560982371 3898402892 3709879770 4233820303 4009930108 1379203097 3876929725
      const ercContractAddress = [
        '0',
        '0',
        '0',
        '3786913876',
        '4053413099',
        '4184556347',
        '2734706904',
        '2298878123',
      ];
      const id = ['0', '0', '0', '0', '0', '0', '0', '0'];
      const value = ['0', '0', '0', '0', '0', '0', '0', '10'];
      const compressedPkd = [
        '2472106341',
        '2077806855',
        '1118094619',
        '3660439001',
        '2018347510',
        '1388557323',
        '531685419',
        '3374069678',
      ];
      const salt = [
        '2085820079',
        '311957195',
        '586214569',
        '1239578534',
        '3188494577',
        '1261029345',
        '1553887056',
        '2904390599',
      ];
      const newCommitment = [
        '570879654',
        '1560982371',
        '3898402892',
        '3709879770',
        '4233820303',
        '4009930108',
        '1379203097',
        '3876929725',
      ];

      const artifacts = zokratesProvider.compile(source, options);
      // computation
      //const { witness, output } = zokratesProvider.computeWitness(artifacts, ['2']);
      const { witness, output } = zokratesProvider.computeWitness(artifacts, [
        ercContractAddress,
        id,
        value,
        compressedPkd,
        salt,
        newCommitment,
      ]);

      // console.log(output, typeof output);
      // run setup
      const keypair = zokratesProvider.setup(artifacts.program);
      // generate proof
      const genProof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
      console.log(genProof);
      // export solidity verifier
      // const verifier = zokratesProvider.exportSolidityVerifier(keypair.vk, 'v1');
      // console.log(verifier);
      setProof(JSON.stringify(genProof, 2, 2));
      if (zokratesProvider.verify(keypair.vk, genProof)) {
        console.log('Proof is correct...');
      }
    });
  }, []);

  return (
    <div>
      <span>deposit work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
