import fs from 'fs';
import { copyDir } from './adversary-code/utils.mjs';

const duplicateNullifier = (
  storedVariable,
  functionCalled,
  firstParameter,
  ercAddress,
  tokenId,
) => {
  const duplicateNullifierCode = `let ${storedVariable} = [];
    if(transactionType && transactionType.includes('DuplicateNullifier')) {
      ${storedVariable} = await ${functionCalled}Faulty(
          ${firstParameter},
          compressedZkpPublicKey,
          ${ercAddress},
          ${tokenId},
      );
  } else {
      ${storedVariable} = await ${functionCalled}(
          ${firstParameter},
          compressedZkpPublicKey,
          ercAddress,
          tokenId,
      );
  }`;
  return duplicateNullifierCode;
};

const transpileTransactionType = (_pathToSrc, _pathToInject) => {
  let srcFile = fs.readFileSync(_pathToSrc, 'utf-8');
  srcFile = `/* THIS FILE CONTAINS CODE THAT HAS BEEN AUTOGENERATED DO NOT MODIFY MANUALLY */\n${srcFile}`;

  // Get transactionType from items params
  const regexAddTransactionType =
    /const ercAddress = generalise\(items.ercAddress.toLowerCase\(\)\);/g;
  const reAddTransactionType = `const ercAddress = generalise(items.ercAddress.toLowerCase());
    const { transactionType = 'ValidTransaction' } = items;
    logger.debug(\`user creating transaction type: \${transactionType}\`);`;
  srcFile = srcFile.replace(regexAddTransactionType, reAddTransactionType);

  // Modify getCommitmentsInfo call so that transactionType is being passed
  const regexModifyGetCommitmentsCall = /providedCommitments,(\s)*}\);/g;
  const reModifyGetCommitmentsCall = `providedCommitments, transactionType});`;
  srcFile = srcFile.replace(regexModifyGetCommitmentsCall, reModifyGetCommitmentsCall);

  // Add incorrectTransactions file
  const srcPreamble = /(\n|.)*(?=const rawTransaction)/g;
  const srcPostamble = /const rawTransaction(\n|.)*/g;
  const [srcPre] = srcFile.match(srcPreamble);
  const [srcPost] = srcFile.match(srcPostamble);
  const injectIncorrectTransactions = fs.readFileSync(_pathToInject, 'utf-8');
  srcFile = `${srcPre}\n${injectIncorrectTransactions}\n${srcPost}`;

  fs.writeFileSync(_pathToSrc, srcFile);
};

const transpileGetCommitmentInfo = _pathToSrc => {
  let srcFile = fs.readFileSync(_pathToSrc, 'utf-8');
  srcFile = `/* THIS FILE CONTAINS CODE THAT HAS BEEN AUTOGENERATED DO NOT MODIFY MANUALLY */\n${srcFile}`;

  // Add transactionType as a input parameter for the getCommitmentsInfo function
  const regexModifyCommitmentInfoParameters = /providedCommitments = \[\],/g;
  const reModifyCommitmentInfoParameters = `providedCommitments = [], transactionType = 'ValidTransaction',`;
  srcFile = srcFile.replace(regexModifyCommitmentInfoParameters, reModifyCommitmentInfoParameters);

  // Pass transactionType as a input parameter for findUsableCommitmentsMutex function
  const regexPassTransactionTypeParam = /findUsableCommitmentsMutex\(/g;
  const rePassTransactionTypeParam = `findUsableCommitmentsMutex(
    transactionType,`;
  srcFile = srcFile.replace(regexPassTransactionTypeParam, rePassTransactionTypeParam);

  // Add import for getCommitmentsByHashFaulty
  const regexAddImport = /getCommitmentsByHash,/g;
  const reAddImport = `getCommitmentsByHash, 
  getCommitmentsByHashFaulty,`;
  srcFile = srcFile.replace(regexAddImport, reAddImport);

  // Modify getCommitmentsByHash logic in order to call faulty function if transaction type is
  // duplicateNulifier
  const regexModifyGetCommitmentsCall =
    /const rawCommitments = await getCommitmentsByHash\((\s)*commitmentHashes,(\s)*compressedZkpPublicKey,(\s)*ercAddress,(\s)*tokenId,(\s)*\);/g;
  const reModifyGetCommitmentsCall = duplicateNullifier(
    'rawCommitments',
    'getCommitmentsByHash',
    'commitmentHashes',
    'ercAddress',
    'tokenId',
  );
  srcFile = srcFile.replace(regexModifyGetCommitmentsCall, reModifyGetCommitmentsCall);

  // Add incorrect Historic Block Number code, which modifies the blockNumberL2s array,
  const srcPreamble = /(\n|.)*(?=return {)/g;
  const srcPostamble = /return {(\n|.)*/g;
  const [srcPre] = srcFile.match(srcPreamble);
  const [srcPost] = srcFile.match(srcPostamble);
  const incorrectHistoricBlockNumber = `if(transactionType === 'IncorrectHistoricBlockNumber') {
    blockNumberL2s[Math.floor(Math.random()*blockNumberL2s.length)] = 
      generalise(Math.floor(Math.random() * 2 ** 16)).hex(32);

      logger.debug({
        msg: 'Block Numbers L2 after modification',
        blockNumberL2s,
      });
  }`;
  srcFile = `${srcPre}${incorrectHistoricBlockNumber}${srcPost}`;

  fs.writeFileSync(_pathToSrc, srcFile);
};

const transpileCommitmentStorage = (_pathToSrc, _pathToInject) => {
  let srcFile = fs.readFileSync(_pathToSrc, 'utf-8');
  srcFile = `/* THIS FILE CONTAINS CODE THAT HAS BEEN AUTOGENERATED DO NOT MODIFY MANUALLY */\n${srcFile}`;

  const injectBadTransactions = fs.readFileSync(_pathToInject, 'utf-8');
  const srcPreamble = /(\n|.)*(?=async function getAvailableCommitments)/g;
  const srcPostamble = /async function getAvailableCommitments(\n|.)*/g;
  const [srcPre] = srcFile.match(srcPreamble);
  const [srcPost] = srcFile.match(srcPostamble);
  srcFile = `${srcPre}\n${injectBadTransactions}\n${srcPost}`;

  const regexAddTransactionTypeVerifyFunction =
    /verifyEnoughCommitments\((\s*)compressedZkpPublicKey,/g;
  const reAddTransactionTypeVerifyFunction = `verifyEnoughCommitments(
  transactionType,
  compressedZkpPublicKey,`;
  srcFile = srcFile.replace(
    regexAddTransactionTypeVerifyFunction,
    reAddTransactionTypeVerifyFunction,
  );

  const regexAddTransactionFindCommitmentsFunction =
    /findUsableCommitments\((\s*)compressedZkpPublicKey,/g;
  const reAddTransactionFindCommitmentsFunction = `findUsableCommitments(
  transactionType,
  compressedZkpPublicKey,`;
  srcFile = srcFile.replace(
    regexAddTransactionFindCommitmentsFunction,
    reAddTransactionFindCommitmentsFunction,
  );

  const regexAddTransactionFindCommitmentsMutexFunction =
    /findUsableCommitmentsMutex\((\s*)compressedZkpPublicKey,/g;
  const reAddTransactionFindCommitmentsMutexFunction = `findUsableCommitmentsMutex(
  transactionType,
  compressedZkpPublicKey,`;
  srcFile = srcFile.replace(
    regexAddTransactionFindCommitmentsMutexFunction,
    reAddTransactionFindCommitmentsMutexFunction,
  );

  const regexModifyGetCommitmentsCallFee =
    /const commitmentArrayFee = await getAvailableCommitments\((\s)*db,(\s)*compressedZkpPublicKey,(\s)*ercAddressFee,(\s)*generalise\(0\),(\s)*\);/g;
  const reModifyGetCommitmentsCallFee = duplicateNullifier(
    'commitmentArrayFee',
    'getAvailableCommitments',
    'db',
    'ercAddressFee',
    'generalise(0)',
  );
  srcFile = srcFile.replace(regexModifyGetCommitmentsCallFee, reModifyGetCommitmentsCallFee);

  const regexModifyGetCommitmentsCall =
    /const commitmentArray = await getAvailableCommitments\((\s)*db,(\s)*compressedZkpPublicKey,(\s)*ercAddress,(\s)*tokenId,(\s)*\);/g;
  const reModifyGetCommitmentsCall = duplicateNullifier(
    'commitmentArray',
    'getAvailableCommitments',
    'db',
    'ercAddress',
    'tokenId',
  );
  srcFile = srcFile.replace(regexModifyGetCommitmentsCall, reModifyGetCommitmentsCall);

  fs.writeFileSync(_pathToSrc, srcFile);
};

copyDir('./nightfall-client/', './test/adversary/bad-client/').then(() => {
  console.log('done with client copy');
  for (const circuit of ['deposit', 'transfer', 'withdraw', 'tokenise', 'burn']) {
    transpileTransactionType(
      `./test/adversary/bad-client/src/services/${circuit}.mjs`,
      './test/adversary/adversary-code/incorrectTransactions.mjs',
    );
  }

  transpileCommitmentStorage(
    './test/adversary/bad-client/src/services/commitment-storage.mjs',
    './test/adversary/adversary-code/commitment-storage.mjs',
  );

  transpileGetCommitmentInfo('./test/adversary/bad-client/src/utils/getCommitmentInfo.mjs');

  console.log(`transpile adversary client done`);
});