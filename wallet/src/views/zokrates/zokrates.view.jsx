import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

import { deposit, pad1280ThenHash, pad1024ThenHash, hash1536 } from './circuits';

export default function Zokrates() {
  const [proof, setProof] = useState('');
  useEffect(async () => {
    initialize().then(zokratesProvider => {
      // const source = "def main(private field a) -> (field): return a * a";
      const source = deposit;
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

      const artifacts = zokratesProvider.compile(source, options);
      // computation
      const { witness, output } = zokratesProvider.computeWitness(artifacts, ['2']);
      console.log(output, typeof output);
      // run setup
      const keypair = zokratesProvider.setup(artifacts.program);

      // generate proof
      const genProof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
      // export solidity verifier
      const verifier = zokratesProvider.exportSolidityVerifier(keypair.vk, 'v1');
      console.log(verifier);
      setProof(JSON.stringify(genProof, 2, 2));
    });
  }, []);

  return (
    <div>
      <span>zokrates work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
