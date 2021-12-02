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
@dev Example Verifier Implementation - GM17 proof verification.
@notice Do not use this example in any production code!
*/

pragma solidity ^0.8.0;

import "./Ownable.sol";
import "./Pairing.sol";

library Verifier {
    using Pairing for *;

    struct Proof_GM17 {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    struct Verification_Key_GM17 {
        Pairing.G2Point H;
        Pairing.G1Point Galpha;
        Pairing.G2Point Hbeta;
        Pairing.G1Point Ggamma;
        Pairing.G2Point Hgamma;
        Pairing.G1Point[2] query;
    }

    function verify(
        uint256[] memory _proof,
        uint256 _publicInputsHash,
        uint256[] memory _vk
    ) public returns (bool result) {
        if (verificationCalculation(_proof, _publicInputsHash, _vk) == 0) {
            result = true;
        } else {
            result = false;
        }
    }

    function verificationCalculation(
        uint256[] memory _proof,
        uint256 _publicInputsHash,
        uint256[] memory _vk
    ) public returns (uint256) {
        Proof_GM17 memory proof;
        Pairing.G1Point memory vk_dot_inputs;
        Verification_Key_GM17 memory vk;

        vk_dot_inputs = Pairing.G1Point(0, 0); //initialise

        proof.A = Pairing.G1Point(_proof[0], _proof[1]);
        proof.B = Pairing.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
        proof.C = Pairing.G1Point(_proof[6], _proof[7]);

        vk.H = Pairing.G2Point([_vk[0], _vk[1]], [_vk[2], _vk[3]]);
        vk.Galpha = Pairing.G1Point(_vk[4], _vk[5]);
        vk.Hbeta = Pairing.G2Point([_vk[6], _vk[7]], [_vk[8], _vk[9]]);
        vk.Ggamma = Pairing.G1Point(_vk[10], _vk[11]);
        vk.Hgamma = Pairing.G2Point([_vk[12], _vk[13]], [_vk[14], _vk[15]]);

        // vk.query.length = (_vk.length - 16)/2;
        uint256 j = 0;
        for (uint256 i = 16; i < _vk.length; i += 2) {
            vk.query[j++] = Pairing.G1Point(_vk[i], _vk[i + 1]);
        }

        /* require(vk.query.length == 2, "Length of vk.query is incorrect!"); */
        // Replacing for the above require statement so that the proof verification returns false. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
        if (vk.query.length != 2) {
            return 1;
        }

        {
            Pairing.G1Point memory sm_qpih;
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_sm_qpih;
            bool success_vkdi_sm_qpih;
            (sm_qpih, success_sm_qpih) = Pairing.scalar_mul(vk.query[1], _publicInputsHash);
            (vk_dot_inputs, success_vkdi_sm_qpih) = Pairing.addition(vk_dot_inputs, sm_qpih);
            if (!success_sm_qpih || !success_vkdi_sm_qpih) {
                return 2;
            }
        }

        {
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_vkdi_q;
            (vk_dot_inputs, success_vkdi_q) = Pairing.addition(vk_dot_inputs, vk.query[0]);
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
            Pairing.G1Point memory add_A_Galpha;
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_pp4_out_not_0;
            bool success_pp4_pairing;
            {
                bool success_add_A_Galpha;
                (add_A_Galpha, success_add_A_Galpha) = Pairing.addition(proof.A, vk.Galpha);
                if (!success_add_A_Galpha) {
                    return 4;
                }
            }
            (success_pp4_out_not_0, success_pp4_pairing) = Pairing.pairingProd4(
                vk.Galpha,
                vk.Hbeta,
                vk_dot_inputs,
                vk.Hgamma,
                proof.C,
                vk.H,
                Pairing.negate(add_A_Galpha),
                Pairing.addition2(proof.B, vk.Hbeta)
            );
            if (!success_pp4_out_not_0 || !success_pp4_pairing) {
                return 5;
            }
        }

        /**
         * e(A, H^{gamma}) = e(G^{gamma}, B)
         */
        {
            // The following success variables replace require statements with corresponding functions called. Removing require statements to ensure a wrong proof verification challenge's require statement correctly works
            bool success_pp2_out_not_0;
            bool success_pp2_pairing;
            (success_pp2_out_not_0, success_pp2_pairing) = Pairing.pairingProd2(
                proof.A,
                vk.Hgamma,
                Pairing.negate(vk.Ggamma),
                proof.B
            );
            if (!success_pp2_out_not_0 || !success_pp2_pairing) {
                return 6;
            }
        }

        return 0;
    }
}
