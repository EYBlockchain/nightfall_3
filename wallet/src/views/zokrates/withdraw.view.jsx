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
    const witnessInput = [
      '1372267967327876207394531437215731016851360150467',
      '0',
      '1000000000',
      {
        salt: [
          '2246208325',
          '3976581806',
          '924274170',
          '2727116320',
          '103872325',
          '2249727273',
          '2345114714',
          '1098567841',
        ],
        hash: [
          '329181187',
          '1986653492',
          '2200707616',
          '3181396184',
          '469056713',
          '3601877863',
          '2095763966',
          '1916944028',
        ],
        ask: '1754386802144849162438981230569815152797914906841974666919224833145472521851',
      },
      [
        '680714268',
        '1574905365',
        '2021544373',
        '528763068',
        '140823776',
        '3193981896',
        '290295535',
        '3225951042',
      ],
      '332543718483878373437222072998389070432027344617416704947020745346832712706',
      '893705366084700132548040460931008653290460453987',
      '18016861735897942613306226895718062561408088411112722023719843645300697499020',
      [
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
        '0',
        '9099494177718611132969532090259439967090162160789474874430926841903203984098',
        '16661896491680466948263856095691422254081917307525316089967276439216412571508',
      ],
      '3',
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
    const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);

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
