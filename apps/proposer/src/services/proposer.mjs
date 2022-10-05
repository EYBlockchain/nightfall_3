/* eslint-disable import/no-unresolved */
import submitTransaction from '../utils/submitTransaction.mjs';
import { BadRequestError } from '../../common-files/utils/errors.mjs';
import { address } from '../classes/web3.mjs';
import { optimist } from '../classes/http.mjs';
import logger from '../../common-files/utils/logger.mjs';

export async function getCurrentProposer() {
  const { currentProposer } = await optimist.get(`/proposer/current-proposer`);
  return currentProposer;
}

export function getProposers() {
  const res = optimist.get(`/proposer/proposers`);
  return res;
}

export async function registerProposer(bond, url) {
  const { txDataToSign: data } = await optimist.post(`/proposer/register`, {
    address,
    url,
  });

  if (!data) throw new BadRequestError('Already registered');
  await submitTransaction({
    data,
    value: bond,
  });
}

export async function unregisterProposer() {
  const { txDataToSign: data } = await optimist.post(`/proposer/de-register`, {
    address,
  });

  await submitTransaction({ data });
}

export async function updateProposer(url, stake) {
  const { txDataToSign: data } = await optimist.post(`/proposer/update`, {
    address,
    url,
  });

  const submit = { data };
  if (stake) submit.stake = stake;
  await submitTransaction(submit);
  logger.debug(`Proposer with address ${address} updated to URL ${url} and stake ${stake}`);
}

export async function changeCurrentProposer() {
  const { txDataToSign: data } = await optimist.get(`/proposer/change`, {
    address,
  });

  await submitTransaction({ data });
}

export async function withdrawStake() {
  const { txDataToSign: data } = await optimist.post(`/proposer/withdrawBond`, {
    address,
  });

  await submitTransaction({ data });
}
