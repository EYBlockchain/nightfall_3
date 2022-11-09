/**
 This module creates blockchain transactions to interact with the Whitelist smart contract
*/

import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';

const { KYC_CONTRACT_NAME } = constants;

export async function isWhitelisted(address) {
  const kycContractInstance = await waitForContract(KYC_CONTRACT_NAME);
  return kycContractInstance.methods.isWhitelisted(address).call();
}

export async function addUserToWhitelist(address) {
  const kycContractInstance = await waitForContract(KYC_CONTRACT_NAME);
  return kycContractInstance.methods.addUserToWhitelist(address).encodeABI();
}

export async function removeUserFromWhitelist(address) {
  const kycContractInstance = await waitForContract(KYC_CONTRACT_NAME);
  return kycContractInstance.methods.removeUserFromWhitelist(address).encodeABI();
}

export async function validateCertificate(certificate, ethereumAddressSignature) {
  const kycContractInstance = await waitForContract(KYC_CONTRACT_NAME);
  console.log('*!GOT CONTRACT', certificate, ethereumAddressSignature);
  const numberOfTlvs = await kycContractInstance.methods.computeNumberOfTlvs(certificate, 0).call();
  console.log('*!Number of contracts', numberOfTlvs);
  return kycContractInstance.methods
    .validateCertificate(
      certificate,
      numberOfTlvs,
      ethereumAddressSignature || 0,
      !!ethereumAddressSignature,
    )
    .encodeABI();
}
