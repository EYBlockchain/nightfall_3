import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

// eslint-disable-next-line
import abi from '../../zokrates/withdraw/artifacts/withdraw-abi.json';
// eslint-disable-next-line
import programFile from '../../zokrates/withdraw/artifacts/withdraw-program';
// eslint-disable-next-line
import pkFile from '../../zokrates/withdraw/keypair/withdraw-pk';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

export default function Zokrates() {
  const [proof, setProof] = useState('');
  useEffect(async () => {
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
      ercAddress,
      id,
      value,
      salt,
      hash,
      ask,
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
    const nullifier = { nsk, hash: hashnullifier };

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
    const zokratesProvider = await initialize();
    const program = await fetch(programFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    const pk = await fetch(pkFile)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);

    const artifacts = { program: new Uint8Array(program), abi: JSON.stringify(abi) };
    const keypair = { pk: new Uint8Array(pk) };

    // computation
    const { witness } = zokratesProvider.computeWitness(artifacts, [
      oldCommitment,
      nullifier,
      recipientAddress,
      path,
      order,
    ]);

    // generate proof
    const genProof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
    setProof(JSON.stringify(genProof, 2, 2));
  }, []);

  return (
    <div>
      <span>withdraw work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
