// SPDX-License-Identifier: MIT

/**
CREDITS:

// For the Elliptic Curve Pairing operations and functions verify() and verifyCalculation():
// This file is MIT Licensed.
//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// More information at https://gist.github.com/chriseth/f9be9d9391efc5beb9704255a8e2989d

Minor edits for Nightfall by:
Michael Connor
Duncan Westland
Chaitanya Konda
Harry R
Migrated to G16 by Hari Krishnan
*/

/**
@title Verifier
@dev Example Verifier Implementation - G16 proof verification.
@notice Do not use this example in any production code!
*/

pragma solidity ^0.8.0;

import "./Pairing.sol";

library Verifier {

  using Pairing for *;

  struct Proof_G16 {
      Pairing.G1Point A;
      Pairing.G2Point B;
      Pairing.G1Point C;
  }

  struct Verification_Key_G16 {
        Pairing.G1Point alpha;
        Pairing.G2Point beta;
        Pairing.G2Point gamma;
        Pairing.G2Point delta;
        Pairing.G1Point[] gamma_abc;
  }

  function verify(uint256[] memory _proof, uint256 _publicInputsHash, uint256[] memory _vk) public view returns (bool result) {
      if (verificationCalculation(_proof, _publicInputsHash, _vk) == 0) {
          result = true;
      } else {
          result = false;
      }
  }

  function verificationCalculation(uint256[] memory _proof, uint256 _publicInputsHash, uint256[] memory _vk) internal view returns (uint) {

      Proof_G16 memory proof;
      Pairing.G1Point memory vk_dot_inputs;
      Verification_Key_G16 memory vk;

      vk_dot_inputs = Pairing.G1Point(0, 0); //initialise

      proof.A = Pairing.G1Point(_proof[0], _proof[1]);
      proof.B = Pairing.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
      proof.C = Pairing.G1Point(_proof[6], _proof[7]);

      vk.alpha = Pairing.G1Point(_vk[4],_vk[5]);
      vk.beta = Pairing.G2Point([_vk[6],_vk[7]],[_vk[8],_vk[9]]);
      vk.gamma = Pairing.G2Point([_vk[10],_vk[11]],[_vk[12],_vk[13]]);
      vk.delta = Pairing.G2Point([_vk[14],_vk[15]],[_vk[16],_vk[17]]);

      // vk.gamma_abc.length = (_vk.length - 18)/2;
      uint j = 0;
      for (uint i = 18; i < _vk.length; i+=2) {
        vk.gamma_abc[j++] = Pairing.G1Point(_vk[i], _vk[i+1]);
      }

      /* require(vk.gamma.abc.length == 2, "Length of vk.gamma.abc is incorrect!"); */
      // Replacing for the above require statement so that the proof verification returns false. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
      if (vk.gamma_abc.length != 2) {
        return 1;
      }

          vk_dot_inputs = Pairing.addition(vk_dot_inputs, Pairing.scalar_mul(vk.gamma_abc[1],_publicInputsHash));
          vk_dot_inputs = Pairing.addition(vk_dot_inputs, vk.gamma_abc[0]);

      
        bool success_pp4_pairing;
      success_pp4_pairing=Pairing.pairingProd4(
             proof.A, proof.B,
             Pairing.negate(vk_dot_inputs), vk.gamma,
             Pairing.negate(proof.C), vk.delta,
             Pairing.negate(vk.alpha), vk.beta);
             if(!success_pp4_pairing) {
              return 1;
             }
      return 0;
  }
}
