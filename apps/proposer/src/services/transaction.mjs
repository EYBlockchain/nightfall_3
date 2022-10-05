import { optimist } from '../classes/http.mjs';

export async function getMempool() {
  const { result: mempool } = await optimist.get(`/proposer/mempool`);
  return mempool;
}

export async function offchainTransaction(transaction) {
  const res = await optimist.post(`/proposer/offchain-transaction`, transaction, {
    timeout: 3600000,
  });
  return res;
}
