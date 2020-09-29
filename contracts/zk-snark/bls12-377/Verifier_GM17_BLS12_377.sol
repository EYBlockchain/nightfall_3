// SPDX-License-Identifier: MIT AND CC0-1.0
//
// ***************************************************************************
//
// Verifier_GM17_BLS12_377 is modified by iAmMichaelConnor & Chaitanya Konda (for EYGS LLP) from the original alt_bn128 implementation of a zk-SNARK verifier contract by Christian Reitwiessner.
// Any modifications are CC0 1.0 public domain, where permitted.
// To the extent possible under law, EYGS LLP has waived all copyright and related or neighboring rights to said modifications.
//
// ***************************************************************************
//
// From the original alt_bn128 verifier contract:
//
// This file is MIT Licensed.
//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// More information at https://gist.github.com/chriseth/f9be9d9391efc5beb9704255a8e2989d
//
// ***************************************************************************

pragma solidity ^0.6.9;

import "../IVerifier.sol";
import {Pairing_BLS12_377 as Pairing} from "./Pairing_BLS12_377.sol";


/**
@title Verifier
@dev Example Verifier Implementation - GM17 proof verification.
@notice Do not use this example in any production code!
*/
contract Verifier_GM17_BLS12_377 is IVerifier {

  using Pairing for *;

  struct Proof {
      Pairing.G1Point A;
      Pairing.G2Point B;
      Pairing.G1Point C;
  }

  struct VerificationKey {
      Pairing.G2Point H;
      Pairing.G1Point Galpha;
      Pairing.G2Point Hbeta;
      Pairing.G1Point Ggamma;
      Pairing.G2Point Hgamma;
      Pairing.G1Point query0; // we separate out the 0th element, for a cheap dot product between `query` and `inputs` (array slices of memory arrays aren't yet supported).
      Pairing.G1Point[] query;
  }

  /// @author iAmMichaelConnor
  function verify(
      uint[] calldata _proof,
      uint[] calldata _inputs,
      uint[] calldata _vk
  ) external view override returns (bool result) {
      if (verificationCalculation(_proof, _inputs, _vk) == 0) {
          result = true;
      } else {
          result = false;
      }
  }

  /// @author Christian Reitwiessner & iAmMichaelConnor & ChaitanyaKonda
  function verificationCalculation(
      uint[] memory _proof,
      uint[] memory _inputs,
      uint[] memory _vk
  ) private view returns (uint) {

      require(_proof.length == 16, "Length of proof[] is incorrect");
      require(_vk.length >= 32 && _vk.length % 4 == 0, "Length of _vk[] is incorrect");

      Proof memory proof;
      VerificationKey memory vk;
      Pairing.G1Point memory vk_dot_inputs;

      proof.A = Pairing.G1Point(
          [_proof[0], _proof[1]],
          [_proof[2], _proof[3]]
      );
      proof.B = Pairing.G2Point(
          [_proof[4], _proof[5], _proof[6], _proof[7]],
          [_proof[8], _proof[9], _proof[10], _proof[11]]
      );
      proof.C = Pairing.G1Point(
          [_proof[12], _proof[13]],
          [_proof[14], _proof[15]]
      );

      vk.H = Pairing.G2Point(
          [_vk[0], _vk[1], _vk[2], _vk[3]],
          [_vk[4], _vk[5], _vk[6], _vk[7]]
      );
      vk.Galpha = Pairing.G1Point(
          [_vk[8], _vk[9]],
          [_vk[10], _vk[11]]
      );
      vk.Hbeta = Pairing.G2Point(
          [_vk[12], _vk[13], _vk[14], _vk[15]],
          [_vk[16], _vk[17], _vk[18], _vk[19]]
      );
      vk.Ggamma = Pairing.G1Point(
          [_vk[20], _vk[21]],
          [_vk[22], _vk[23]]
      );
      vk.Hgamma = Pairing.G2Point(
          [_vk[24], _vk[25], _vk[26], _vk[27]],
          [_vk[28], _vk[29], _vk[30], _vk[31]]
      );
      if (_vk.length > 32) {
          vk.query0 = Pairing.G1Point(
              [_vk[32], _vk[33]],
              [_vk[34], _vk[35]]
          );
      }
      vk.query = new Pairing.G1Point[]((_vk.length - 36) / 4);
      if (_vk.length > 36) {

          uint j = 0;
          for (uint i = 36; i < _vk.length; i+=4) {
              vk.query[j++] = Pairing.G1Point(
                  [_vk[i], _vk[i+1]],
                  [_vk[i+2], _vk[i+3]]
              );
          }
      }

      require(_inputs.length == vk.query.length, "Length of _inputs[] or vk.query[] is incorrect!");

      /*
       * Compute x = Q[0] + s[0]*Q[1] + s[1]*Q[2] + ...
       * i.e. vk_dot_inputs = vk.query0 + multiexp(vk.query, inputs)
       */
      if (vk.query.length == 0) {
          vk_dot_inputs = vk.query0;
      } else if (vk.query.length == 1) {
          // vk.query[0] and _inputs[0] exist
          vk_dot_inputs = Pairing.addPointsG1(
              vk.query0,
              Pairing.scalarMulG1(vk.query[0], _inputs[0])
          );
      } else {
          // vk.query.length > 1 and _inputs.length > 1, so multiexp is likely the most efficient method:
          vk_dot_inputs = Pairing.addPointsG1(
              vk.query0,
              Pairing.multiexpG1(vk.query, _inputs)
          );
      }

      /**
       * e(A*G^{alpha}, B*H^{beta}) = e(G^{alpha}, H^{beta}) * e(G^{psi}, H^{gamma})
       *                              * e(C, H)
       * where psi = \sum_{i=0}^l input_i pvk.query[i]
       */
      if (
          !Pairing.pairingProd4(
              vk.Galpha,
              vk.Hbeta,
              vk_dot_inputs,
              vk.Hgamma,
              proof.C,
              vk.H,
              Pairing.negatePointG1(
                  Pairing.addPointsG1(
                      proof.A,
                      vk.Galpha
                  )
              ),
              Pairing.addPointsG2(
                  proof.B,
                  vk.Hbeta
              )
          )
      ) {
          return 1;
      }

      /**
       * e(A, H^{gamma}) = e(G^{gamma}, B)
       */
      if (
          !Pairing.pairingProd2(
              proof.A,
              vk.Hgamma,
              Pairing.negatePointG1(
                  vk.Ggamma
              ),
              proof.B
          )
      ) {
          return 2;
      }

      delete proof;
      delete vk;
      delete vk_dot_inputs;

      // successful verification:
      return 0;
  }
}
