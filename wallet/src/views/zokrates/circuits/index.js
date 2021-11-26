/* eslint import/no-webpack-loader-syntax: 0 */

// ignore unused exports
import deposit from '!!raw-loader!./deposit.zok';
import depositStub from '!!raw-loader!./deposit_stub.zok';
import depositNoHash from '!!raw-loader!./deposit-nohash.zok';

import doubleTransfer from '!!raw-loader!./double_transfer.zok';
import doubleTransferStub from '!!raw-loader!./double_transfer_stub.zok';
import doubleTransferNoHash from '!!raw-loader!./double_transfer-nohash.zok';


import singleTransfer from '!!raw-loader!./single_transfer.zok';
import singleTransferStub from '!!raw-loader!./single_transfer_stub.zok';
import singleTransferNoHash from '!!raw-loader!./single_transfer-nohash.zok';


import withdraw from '!!raw-loader!./withdraw.zok';
import withdrawStub from '!!raw-loader!./withdraw_stub.zok';
import withdrawNoHash from '!!raw-loader!./withdraw-nohash.zok';


//concatenate
import orderLeftRight from '!!raw-loader!./common/concatenate/order-left-right-1x1.zok';

//encryption
import elgamal from '!!raw-loader!./common/encryption/el-gamal4.zok';

//hashes
import mimcEncryption from '!!raw-loader!./common/hashes/mimc/mimc-encryption.zok';
import mimcConstants from '!!raw-loader!./common/hashes/mimc/mimc-constants.zok';
import mimcHash1 from '!!raw-loader!./common/hashes/mimc/mimc-hash-1.zok';
import mimcHash2 from '!!raw-loader!./common/hashes/mimc/mimc-hash-2.zok';
import mimcHash5 from '!!raw-loader!./common/hashes/mimc/mimc-hash-5.zok';
import hash512 from '!!raw-loader!./common/hashes/sha256/hash512.zok';
import hash1024 from '!!raw-loader!./common/hashes/sha256/hash1024.zok';
import hash1536 from '!!raw-loader!./common/hashes/sha256/hash1536.zok';
import hash2048 from '!!raw-loader!./common/hashes/sha256/hash2048.zok';
import hash3584 from '!!raw-loader!./common/hashes/sha256/hash3584.zok';
import hash4096 from '!!raw-loader!./common/hashes/sha256/hash4096.zok';
import hash4608 from '!!raw-loader!./common/hashes/sha256/hash4608.zok';
import pad256ThenHash from '!!raw-loader!./common/hashes/sha256/pad256ThenHash.zok';
import pad512ThenHash from '!!raw-loader!./common/hashes/sha256/pad512ThenHash.zok';
import pad640ThenHash from '!!raw-loader!./common/hashes/sha256/pad640ThenHash.zok';
import pad768ThenHash from '!!raw-loader!./common/hashes/sha256/pad768ThenHash.zok';
import pad896ThenHash from '!!raw-loader!./common/hashes/sha256/pad896ThenHash.zok';
import pad1024ThenHash from '!!raw-loader!./common/hashes/sha256/pad1024ThenHash.zok';
import pad1152ThenHash from '!!raw-loader!./common/hashes/sha256/pad1152ThenHash.zok';
import pad1280ThenHash from '!!raw-loader!./common/hashes/sha256/pad1280ThenHash.zok';
import pad1536ThenHash from '!!raw-loader!./common/hashes/sha256/pad1536ThenHash.zok';
import pad1792ThenHash from '!!raw-loader!./common/hashes/sha256/pad1792ThenHash.zok';
import pad3072ThenHash from '!!raw-loader!./common/hashes/sha256/pad3072ThenHash.zok';
import pad3840ThenHash from '!!raw-loader!./common/hashes/sha256/pad3840ThenHash.zok';
import pad4096ThenHash from '!!raw-loader!./common/hashes/sha256/pad4096ThenHash.zok';

//hashToCurve
import chi from '!!raw-loader!./common/hashToCurve/chi.zok';
import elligator from '!!raw-loader!./common/hashToCurve/elligator2.zok';
import constPowerModofhalfp from '!!raw-loader!./common/hashToCurve/constPowerModOfhalfp-1.zok';
import montgomeryToTwistedEdwards from '!!raw-loader!./common/hashToCurve/montgomeryToTwistedEdwards.zok';

//merkle-tree
import pathCheck from '!!raw-loader!./common/merkle-tree/mimc-path-check.zok';

export {
  deposit,
  depositStub,
  depositNoHash,
  doubleTransfer,
  doubleTransferStub,
  doubleTransferNoHash,
  singleTransfer,
  singleTransferStub,
  singleTransferNoHash,
  withdraw,
  withdrawStub,
  withdrawNoHash,
  orderLeftRight,
  elgamal,
  mimcEncryption,
  mimcConstants,
  mimcHash1,
  mimcHash2,
  mimcHash5,
  hash512,
  hash1024,
  hash1536,
  hash2048,
  hash3584,
  hash4096,
  hash4608,
  pad256ThenHash,
  pad512ThenHash,
  pad640ThenHash,
  pad768ThenHash,
  pad896ThenHash,
  pad1024ThenHash,
  pad1152ThenHash,
  pad1280ThenHash,
  pad1536ThenHash,
  pad1792ThenHash,
  pad3072ThenHash,
  pad3840ThenHash,
  pad4096ThenHash,
  chi,
  elligator,
  constPowerModofhalfp,
  montgomeryToTwistedEdwards,
  pathCheck,
};

