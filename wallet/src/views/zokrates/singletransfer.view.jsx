import React, { useEffect, useState } from 'react';
import { initialize } from 'zokrates-js';

import { singleTransferNoHash, mimcHash2, mimcEncryption, mimcConstants, pad512ThenHash, pad3072ThenHash, pad1280ThenHash, hash1024, hash3584, hash1536, pathCheck, elgamal, elligator, chi, constPowerModofhalfp, montgomeryToTwistedEdwards } from './circuits';

export default function Zokrates() {
  const [proof, setProof] = useState('');
  useEffect(async () => {
    initialize().then(zokratesProvider => {
      // const source = "def main(private field a) -> (field): return a * a";
      const source = singleTransferNoHash;
      const options = {
        location: 'main.zok', // location of the root module
        resolveCallback: (currentLocation, importLocation) => {
          console.log(`${currentLocation} is importing ' ${importLocation}`);
          let code;
          if (importLocation.endsWith('mimc-hash-2.zok')) code = mimcHash2;
          else if (importLocation.endsWith('mimc-encryption.zok')) code = mimcEncryption;
          else if (importLocation.endsWith('mimc-constants.zok')) code = mimcConstants;
          else if (importLocation.endsWith('pad512ThenHash.zok')) code = pad512ThenHash;
          else if (importLocation.endsWith('pad1280ThenHash.zok')) code = pad1280ThenHash;
          else if (importLocation.endsWith('pad3072ThenHash.zok')) code = pad3072ThenHash;
          else if (importLocation.endsWith('hash1024')) code = hash1024;
          else if (importLocation.endsWith('hash1536')) code = hash1536;
          else if (importLocation.endsWith('hash3584')) code = hash3584;
          else if (importLocation.endsWith('mimc-path-check.zok')) code = pathCheck;
          else if (importLocation.endsWith('el-gamal4')) code = elgamal;
          else if (importLocation.endsWith('elligator2.zok')) code = elligator;
          else if (importLocation.endsWith('chi.zok')) code = chi;
          else if (importLocation.endsWith('constPowerModOfhalfp-1.zok')) code = constPowerModofhalfp;
          else if (importLocation.endsWith('montgomeryToTwistedEdwards.zok')) code = montgomeryToTwistedEdwards;
          
          return {
            source: code,
            location: importLocation,
          };
        },
      };

      const publicInputsHash = "415417283559201812128556462617247713976080142505265392744951502712092195983";

      // oldcommitment
 
     const ercAddress = ["0", "0", "0", "3786913876", "4053413099", "4184556347", "2734706904", "2298878123"];
     const id = ["0", "0", "0", "0", "0", "0", "0", "0"];
     const value = ["0", "0", "0", "0", "0", "0", "0", "10"];
     const salt = ["3746186814", "650786980", "1084437808", "2163704665", "3284490479", "3413632784", "3416516601", "3148413313"];
     const hash = ["543006746", "3393481281", "4073466703", "2512373315", "3858950242", "1055380497", "3023087956", "1094765179"];
     const ask = "6930558048592459968398874090872446840386493339700763487392344092914357738801";
 
 
   const oldCommitment = {ercAddress: ercAddress, id:id, value: value, salt: salt, hash: hash, ask:ask}
 
   //newcommitment
 
   const pkdRecipient = ["11793120019061651548381689667193031350303535754993894421714575842003180702651", "19514094396296584559699296843667781122852060401076195850868925920595449006047"]
   const valuenew = ["0", "0", "0", "0", "0", "0", "0", "10"];
   const saltnew = ["712034866", "866054266", "3814000985", "4249096863", "4065113913", "2996438565", "3597388231", "1667885982"];
   const hashnew = ["472587739", "1324918119", "1807033832", "1334073929", "3892559028", "3845398866", "3507663518", "2276201717"];
 
   const newcommitment= {pkdRecipient:pkdRecipient, value:valuenew, salt:saltnew, hash:hashnew};
 
 
   // nullifier
   const nsk = ["356285367", "2834115112", "1573131528", "2110052527", "2559426218", "450338363", "1256702011", "376012475"];
   const hashnullifier = ["1891620090", "3067515349", "1495220547", "2170616472", "2937727655", "4008007523", "1761762339", "3901356914"];
 
   const nullifier = {nsk:nsk, hash:hashnullifier};
 
   //path
   const path = ["13884572707255978198257443140098116758186701468512178718449225834623576601752", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "11552442654508826149654886774876308010229326029958322167680405955306403648395", "0", "2406218139732324760769007259542356406383940103365588201580317947943448380165"];
 
 
   //order
   const order = "4";
 
   //secrets
 
   const ephemeralKey1 = ["2679237203", "3503527839", "1388781873", "3772344332", "129740109", "786283164", "1610246462", "3593074079"];
   const ephemeralKey2 = ["1308060774", "210384524", "2076280842", "3189302053", "194623319", "738150332", "3785471981", "715206724"];
   const ephemeralKey3 = ["1582889066", "1356045606", "542529867", "38588561", '3601694477', "2368952083", "1458183372", "2827185879"];
   const ephemeralKey4 = ["3606499998", "769143815", "4024177106", "1019751069", "2019352040", "3701554631", "295088779", "2423849969"];
   const cipherText = ["244277745258585853513141676876204581962698301344585312089712841219917611342", "14718330057817658656593893072484481666507121239769701109458885795232098076601", "7848280779105096438565732530748032112776011420822973194685231834466034147948", "16014765845855805092349861942874862041311104574567060564380184357446867429710", "967776976561604534779831131563332803728493108792643274183774772548241082745", "11736736055257482275065247682839402645524076651033447215647774825942841169476", "9127039525813553201920672988601319025211549133392351392876890764882755314018", "21313425638804010327657949532759221852312012653117455775988377529115546808712", "16963590291331123591457183928374003930147597080209054478568111747716497606711", "20928516370150460885923583115231017143445251657781015873872362680502519403263", "3843250319122776724049692413310494126208551676987721252781566536346378594538", "10556303176928347134722510059208270780821704289274531778270138450074164327305", "20027284826492836292932298755713059268095921474328860019648615878300546814401", "19398689963143003492444482068527551002624782403686412620939389763967041058276", "15306880169473165615977041875540990915267544865033727181559282318437801589627", "5214957194990212213689146012517148467529201725167766518036917059402767882295"];
   const sqrtMessage1 = "9427050129567031675553048604712181295465196374683565284398992208923945768094";
   const sqrtMessage2 = "0";
   const sqrtMessage3 = "7776112414460028141291788792364523016183925580621199492677386666015993400427";
   const sqrtMessage4 = "2220983197769731066101847354068817243110183716854085171716270043156645686319";

 
   const secrets = {ephemeralKey1:ephemeralKey1, ephemeralKey2:ephemeralKey2, ephemeralKey3:ephemeralKey3, ephemeralKey4:ephemeralKey4, cipherText:cipherText, sqrtMessage1:sqrtMessage1, sqrtMessage2:sqrtMessage2, sqrtMessage3:sqrtMessage3, sqrtMessage4:sqrtMessage4};
 
         //computation
 

      const artifacts = zokratesProvider.compile(source, options);
      // computation
      //const { witness, output } = zokratesProvider.computeWitness(artifacts, ['2']);
      const { witness, output } = zokratesProvider.computeWitness(artifacts, [oldCommitment, newcommitment, nullifier, path, order, secrets]);
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
       if ( zokratesProvider.verify(keypair.vk, genProof)) {
        console.log("Proof is correct...")
       }
    });
  }, []);

  return (
    <div>
      <span>Single transfer work beigin</span>
      <p>{proof}</p>
    </div>
  );
}
