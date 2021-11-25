/* eslint import/no-webpack-loader-syntax: 0 */

// ignore unused exports
import deposit from '!!raw-loader!./deposit.zok';
import depositStub from '!!raw-loader!./deposit_stub.zok';
import doubleTransfer from '!!raw-loader!./double_transfer.zok';
import doubleTransferStub from '!!raw-loader!./double_transfer_stub.zok';
import singleTransfer from '!!raw-loader!./single_transfer.zok';
import singleTransferStub from '!!raw-loader!./single_transfer_stub.zok';
import withdraw from '!!raw-loader!./withdraw.zok';
import withdrawStub from '!!raw-loader!./withdraw_stub.zok';

import pad1280ThenHash from '!!raw-loader!./common/hashes/sha256/pad1280ThenHash.zok';
import pad1024ThenHash from '!!raw-loader!./common/hashes/sha256/pad1024ThenHash.zok';
import hash1536 from '!!raw-loader!./common/hashes/sha256/hash1536.zok';

export {
  deposit,
  depositStub,
  doubleTransfer,
  doubleTransferStub,
  singleTransfer,
  singleTransferStub,
  withdraw,
  withdrawStub,
  pad1280ThenHash,
  pad1024ThenHash,
  hash1536,
};
