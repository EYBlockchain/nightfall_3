import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

import {
  withdrawNoHash,
  mimcHash2,
  mimcEncryption,
  mimcConstants,
  pad512ThenHash,
  pad1536ThenHash,
  pad1280ThenHash,
  hash1024,
  hash2048,
  hash1536,
  pathCheck,
} from './circuits';

export default function Zokrates() {
  const [proof, setProof] = useState('');
  useEffect(async () => {
    initialize().then(zokratesProvider => {
      // const source = "def main(private field a) -> (field): return a * a";
      const source = withdrawNoHash;
      const options = {
        location: 'main.zok', // location of the root module
        resolveCallback: (currentLocation, importLocation) => {
          console.log(`${currentLocation} is importing ' ${importLocation}`);
          let code;
          if (importLocation.endsWith('mimc-hash-2.zok')) code = mimcHash2;
          else if (importLocation.endsWith('mimc-encryption.zok')) code = mimcEncryption;
          else if (importLocation.endsWith('mimc-constants.zok')) code = mimcConstants;
          else if (importLocation.endsWith('pad512ThenHash.zok')) code = pad512ThenHash;
          else if (importLocation.endsWith('pad1536ThenHash.zok')) code = pad1536ThenHash;
          else if (importLocation.endsWith('pad1280ThenHash.zok')) code = pad1280ThenHash;
          else if (importLocation.endsWith('hash1024')) code = hash1024;
          else if (importLocation.endsWith('hash1536')) code = hash1536;
          else if (importLocation.endsWith('hash2048')) code = hash2048;
          else if (importLocation.endsWith('mimc-path-check.zok')) code = pathCheck;
          return {
            source: code,
            location: importLocation,
          };
        },
      };
      // 0 0 0 3786913876 4053413099 4184556347 2734706904 2298878123 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 10 2219597431 1755426215 3293145557 3243256786 3816304020 1517647008 425275575 1318493102 366750885 2604783080 3623807610 4147206897 2198290470 1707590623 385867958 4233993206 20554508024765599754681452527149817852616693887653983104651939102134258746269 60165613 1853956399 2123184558 1150957582 2995252443 2268101302 4050509027 3488140304 625919956 422449450 1194504794 2151460778 3906881990 2763939802 883444624 2224534737 893705366084700132548040460931008653290460453987 6100509968277764863775768711148611107175898089815871963355773213731205366508 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 13951531544348673269400720537311387247715263843017456944493996457606504233631 0 20781082199163440865218068816821413366576335772482013527788056044402762718175 4

      const ercAddress = [
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
      const salt = [
        '2219597431',
        '1755426215',
        '3293145557',
        '3243256786',
        '3816304020',
        '1517647008',
        '425275575',
        '1318493102',
      ];
      const hash = [
        '366750885',
        '2604783080',
        '3623807610',
        '4147206897',
        '2198290470',
        '1707590623',
        '385867958',
        '4233993206',
      ];
      const ask = '20554508024765599754681452527149817852616693887653983104651939102134258746269';

      const oldCommitment = {
        ercAddress: ercAddress,
        id: id,
        value: value,
        salt: salt,
        hash: hash,
        ask: ask,
      };

      const nsk = [
        '60165613',
        '1853956399',
        '2123184558',
        '1150957582',
        '2995252443',
        '2268101302',
        '4050509027',
        '3488140304',
      ];
      const hashnullifier = [
        '625919956',
        '422449450',
        '1194504794',
        '2151460778',
        '3906881990',
        '2763939802',
        '883444624',
        '2224534737',
      ];

      const nullifier = { nsk: nsk, hash: hashnullifier };

      const recipientAddress = '893705366084700132548040460931008653290460453987';

      const path = [
        '6100509968277764863775768711148611107175898089815871963355773213731205366508',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '13951531544348673269400720537311387247715263843017456944493996457606504233631',
        '0',
        '20781082199163440865218068816821413366576335772482013527788056044402762718175',
      ];
      const order = '4';

      const artifacts = zokratesProvider.compile(source, options);
      // computation
      //const { witness, output } = zokratesProvider.computeWitness(artifacts, ['2']);
      const { witness, output } = zokratesProvider.computeWitness(artifacts, [
        oldCommitment,
        nullifier,
        recipientAddress,
        path,
        order,
      ]);

      //   console.log(output, typeof output);
      //   // run setup
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
      <span>withdraw work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
