export default async function withdrawStake() {
  const { txDataToSign: data } = await this.optimist.post(`/proposer/withdrawBond`, {
    address: this.address,
  });

  await this.submitTransaction({ data });
}
