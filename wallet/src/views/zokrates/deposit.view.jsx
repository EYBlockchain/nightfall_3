import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

// eslint-disable-next-line
import abi from './deposit/artifacts/deposit-abi.json';
// eslint-disable-next-line
import programFile from './deposit/artifacts/deposit-program';
// eslint-disable-next-line
import pkFile from './deposit/keypair/deposit-pk';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

export default function Zokrates() {
  const [proof, setProof] = useState('');

  useEffect(async () => {
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
      ercContractAddress,
      id,
      value,
      compressedPkd,
      salt,
      newCommitment,
    ]);

    // // generate proof
    const genProof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
    setProof(JSON.stringify(genProof, 2, 2));
  }, []);

  return (
    <div>
      <span>deposit work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
