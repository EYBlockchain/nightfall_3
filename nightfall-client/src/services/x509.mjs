/**
 This module creates blockchain transactions to interact with the Whitelist smart contract
*/

import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';

const { X509_CONTRACT_NAME } = constants;

async function validateCertificate(certificate, ethereumAddressSignature) {
  const x509ContractInstance = await waitForContract(X509_CONTRACT_NAME);
  const numberOfTlvs = await x509ContractInstance.methods
    .computeNumberOfTlvs(certificate, 0)
    .call();
  return x509ContractInstance.methods
    .validateCertificate(
      certificate,
      numberOfTlvs,
      ethereumAddressSignature || 0,
      !!ethereumAddressSignature,
    )
    .encodeABI();
}

export { validateCertificate as default };
