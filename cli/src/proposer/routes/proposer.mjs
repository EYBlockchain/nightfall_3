/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';

let nf3Instance = '';
const router = express.Router();

router.post('/offchain-transaction', async req => {
  console.log(`Proposer/offchain-transaction endpoint received POST`);
  console.log(`With content ${JSON.stringify(req.body, null, 2)}`);
  const { transaction } = req.body;

  if (!transaction || nf3Instance === '') return;
  await nf3Instance.sendOffchainTransaction(transaction);
});

function setNf3Instance(nf3) {
  nf3Instance = nf3;
}

export { router, setNf3Instance };
