import { optimist } from '../classes/http.mjs';

export default async function getContractAddress(contractName) {
  const { address } = await optimist.get(`/contract-address/${contractName}`);
  return address.toLowerCase();
}
