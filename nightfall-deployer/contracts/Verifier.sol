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
*/

/**
@title Verifier
@dev Example Verifier Implementation - G16 proof verification.
@notice Do not use this example in any production code!
*/

pragma solidity ^0.8.0;

import './Ownable.sol';
import './Pairing.sol';

library Verifier {
    using Pairing for *;

    uint256 constant BN128_GROUP_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

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

    function verify(
        uint256[] memory _proof,
        uint256[] memory _publicInputs,
        uint256[] memory _vk
    ) public returns (bool result) {
        if (verificationCalculation(_proof, _publicInputs, _vk) == 0) {
            result = true;
        } else {
            result = false;
        }
    }

    function verificationCalculation(
        uint256[] memory _proof,
        uint256[] memory _publicInputs,
        uint256[] memory _vk
    ) public returns (uint256) {
        Proof_G16 memory proof;
        Pairing.G1Point memory vk_dot_inputs;
        Verification_Key_G16 memory vk;

        vk_dot_inputs = Pairing.G1Point(0, 0); //initialise

        proof.A = Pairing.G1Point(_proof[0], _proof[1]);
        proof.B = Pairing.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
        proof.C = Pairing.G1Point(_proof[6], _proof[7]);

        vk.alpha = Pairing.G1Point(_vk[0], _vk[1]);
        vk.beta = Pairing.G2Point([_vk[2], _vk[3]], [_vk[4], _vk[5]]);
        vk.gamma = Pairing.G2Point([_vk[6], _vk[7]], [_vk[8], _vk[9]]);
        vk.delta = Pairing.G2Point([_vk[10], _vk[11]], [_vk[12], _vk[13]]);

        if (_vk.length > 14) {
            vk.gamma_abc = new Pairing.G1Point[]((_vk.length - 14) / 2); // num public inputs + 1
            for (uint256 i = 14; i < _vk.length; i += 2) {
                vk.gamma_abc[(i - 14) / 2] = Pairing.G1Point(_vk[i], _vk[i + 1]);
            }
        }

        /* require(vk.gamma.abc.length == 2, "Length of vk.gamma.abc is incorrect!"); */
        // Replacing for the above require statement so that the proof verification returns false. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
        if (vk.gamma_abc.length != _publicInputs.length + 1) {
            return 1;
        }

        {
            Pairing.G1Point memory sm_qpih;
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_sm_qpih;
            bool success_vkdi_sm_qpih;
            for (uint256 i = 0; i < _publicInputs.length; i++) {
                // check for overflow attacks
                if (_publicInputs[i] >= BN128_GROUP_ORDER) return 2;
                (sm_qpih, success_sm_qpih) = Pairing.scalar_mul(
                    vk.gamma_abc[i + 1],
                    _publicInputs[i]
                );
                (vk_dot_inputs, success_vkdi_sm_qpih) = Pairing.addition(vk_dot_inputs, sm_qpih);
                if (!success_sm_qpih || !success_vkdi_sm_qpih) {
                    return 2;
                }
            }
        }

        {
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_vkdi_q;
            (vk_dot_inputs, success_vkdi_q) = Pairing.addition(vk_dot_inputs, vk.gamma_abc[0]);
            if (!success_vkdi_q) {
                return 3;
            }
        }

        /**
         * e(A*G^{alpha}, B*H^{beta}) = e(G^{alpha}, H^{beta}) * e(G^{psi}, H^{gamma})
         *                              * e(C, H)
         * where psi = \sum_{i=0}^l input_i pvk.query[i]
         */
        {
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_pp4_out_not_0;
            bool success_pp4_pairing;
            (success_pp4_out_not_0, success_pp4_pairing) = Pairing.pairingProd4(
                proof.A,
                proof.B,
                Pairing.negate(vk_dot_inputs),
                vk.gamma,
                Pairing.negate(proof.C),
                vk.delta,
                Pairing.negate(vk.alpha),
                vk.beta
            );
            if (!success_pp4_out_not_0 || !success_pp4_pairing) {
                return 5;
            }
        }
        return 0;
    }
}
