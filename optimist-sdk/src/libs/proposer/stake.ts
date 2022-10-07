export async function withdrawStake() {
  const { txDataToSign: data } = await this.optimist.post(`/proposer/withdrawBond`, {
    address: this.address,
  });

  await this.submitTransaction({ data });
}

export async function increaseStake({ stake }) {
  const { txDataToSign: data } = await this.services.optimist.post(`/proposer/update`, {
    address: this.address,
    url: this.url,
  });

  await this.submitTransaction({ data, value: stake });
}
