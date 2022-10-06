export async function getCurrentProposer() {
  const { currentProposer } = await this.services.optimist.get(`/proposer/current-proposer`);
  return currentProposer;
}

export async function getProposers() {
  const res = await this.services.optimist.get(`/proposer/proposers`);
  return res;
}

export async function registerProposer({ stake, url }) {
  const { txDataToSign: data } = await this.services.optimist.post(`/proposer/register`, {
    address: this.address,
    url,
  });

  await this.submitTransaction({
    data,
    value: stake,
  });
}

export async function unregisterProposer() {
  const { txDataToSign: data } = await this.services.optimist.post(`/proposer/de-register`, {
    address: this.address,
  });

  await this.submitTransaction({ data, value: 0 });
}

export async function updateProposer(url) {
  const { txDataToSign: data } = await this.services.optimist.post(`/proposer/update`, {
    address: this.address,
    url,
  });

  await this.submitTransaction({ data });
  console.log(`Proposer with address ${this.address} updated to URL ${url}`);
}

export async function changeCurrentProposer() {
  const { txDataToSign: data } = await this.services.optimist.get(`/proposer/change`, {
    address: this.address,
  });

  await this.submitTransaction({ data });
}
