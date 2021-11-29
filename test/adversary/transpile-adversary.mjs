import fs from 'fs';
import path from 'path';

const { mkdir, readdir, copyFile } = fs.promises;

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name !== 'node_modules') {
      // eslint-disable-next-line no-await-in-loop
      if (entry.isDirectory()) await copyDir(srcPath, destPath);
      // eslint-disable-next-line no-await-in-loop
      else await copyFile(srcPath, destPath);
    }
  }
}

// Transpile Assembler Code

const transpileAssembler = (_pathToSrc, _pathToInject) => {
  let srcFile = fs.readFileSync(_pathToSrc, 'utf-8');
  const injectFile = fs.readFileSync(_pathToInject, 'utf-8');

  // const preamble = /(\n|.)*(?=\n.*config;)/g;
  // const postamble = /.*config;(\n|.)*/g;
  // const [codePre] = srcFile.match(preamble);
  // const [codePost] = srcFile.match(postamble);

  const regex1 = /(\n|.)*(?=\nclass Block)/g;
  const regex2 = /class Block(.|\n)*/g;
  const [left] = srcFile.match(regex1);
  const [right] = srcFile.match(regex2);

  srcFile = `${left}\n${injectFile}\n${right}`;

  // Call Rerouting.
  const regexReplaceCalls = /this\.localLeafCount \+=.*(\n.*){3}/g;
  const reRoute = `const badBlock = createBadBlock({
      proposer,
      root: updatedTimber.root,
      leafCount: timber.leafCount,
      nCommitments,
      blockNumberL2,
      previousBlockHash,
      frontier: updatedTimber.frontier,
    });
    this.localLeafCount = badBlock.leafCount;
    this.localFrontier = badBlock.frontier;
    this.localBlockNumberL2 = badBlock.blockNumberL2;
    this.localRoot = badBlock.root;`;
  srcFile = srcFile.replace(regexReplaceCalls, reRoute);

  // Modify Return
  const regexReplaceReturn = /return new Block(\n|.)*previousBlockHash,\n.*(}\);)/g;
  const reReturn = `return new Block({
      proposer,
      transactionHashes: transactions.map(t => t.transactionHash),
      leafCount: badBlock.leafCount,
      root: badBlock.root,
      blockHash,
      nCommitments: badBlock.nCommitments,
      blockNumberL2: badBlock.blockNumberL2,
      previousBlockHash,
    });`;
  srcFile = srcFile.replace(regexReplaceReturn, reReturn);

  fs.writeFileSync(_pathToSrc, srcFile);
};

const transpileTransactionLookup = (_pathToSrc, _pathToInject) => {
  let srcFile = fs.readFileSync(_pathToSrc, 'utf-8');
  const injectFile = fs.readFileSync(_pathToInject, 'utf-8');

  const regexInjectFileNoPreamble = /const error(\n|.)*/g;
  const [postAmble] = injectFile.match(regexInjectFileNoPreamble);

  const regexReplaceCall =
    /(.*getMostProfitableTransactions.*)(\n|.)*(?=\n\/\*\*\nFunction to save a \(unprocessed\) Transaction)/g;

  srcFile = srcFile.replace(regexReplaceCall, postAmble);
  fs.writeFileSync(_pathToSrc, srcFile);
};

copyDir('./nightfall-optimist/', './test/adversary/nightfall-adversary/').then(() => {
  console.log('done copy');
  transpileAssembler(
    './test/adversary/nightfall-adversary/src/classes/block.mjs',
    './test/adversary/services/block-assembler.mjs',
  );
  transpileTransactionLookup(
    './test/adversary/nightfall-adversary/src/services/database.mjs',
    './test/adversary/services/database.mjs',
  );
  console.log(`transpile assembler done'`);
});
