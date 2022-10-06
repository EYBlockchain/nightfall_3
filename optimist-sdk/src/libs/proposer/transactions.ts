export async function getMempool() {
  const { result: mempool } = await this.optimist.get(`/proposer/mempool`);
  return mempool;
}

export async function offchainTransaction(transaction) {
  const res = await this.optimist.post(`/proposer/offchain-transaction`, transaction, {
    timeout: 3600000,
  });
  return res;
}
