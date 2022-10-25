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

import './Pairing.sol';

library Verifier {
    using Pairing for *;

    uint256 constant BN128_GROUP_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }

    function verifyingKey(uint256[] memory _vk, uint256 inputsLength)
        internal
        pure
        returns (VerifyingKey memory vk)
    {
        vk.alfa1 = Pairing.G1Point(_vk[0], _vk[1]);
        vk.beta2 = Pairing.G2Point([_vk[4], _vk[3]], [_vk[6], _vk[5]]);
        vk.gamma2 = Pairing.G2Point([_vk[10], _vk[9]], [_vk[12], _vk[11]]);
        vk.delta2 = Pairing.G2Point([_vk[16], _vk[15]], [_vk[18], _vk[17]]);
        vk.IC = new Pairing.G1Point[](inputsLength + 1);
        for (uint256 i = 0; i < inputsLength + 1; ++i) {
            vk.IC[i] = Pairing.G1Point(_vk[33 + 3 * i], _vk[34 + 3 * i]);
        }
    }

    function verify(
        uint256[] memory _proof,
        uint256[] memory _publicInputs,
        uint256[] memory _vk
    ) public view returns (bool result) {
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
    ) internal view returns (uint256) {
        if ((_vk.length - 33) % 3 != 0 || (_vk.length - 33) / 3 != _publicInputs.length + 1) {
            return 3;
        }
        VerifyingKey memory vk = verifyingKey(_vk, _publicInputs.length);

        if (_proof.length != 8) {
            return 2;
        }

        Proof memory proof;
        proof.A = Pairing.G1Point(_proof[0], _proof[1]);
        proof.B = Pairing.G2Point([_proof[3], _proof[2]], [_proof[5], _proof[4]]);
        proof.C = Pairing.G1Point(_proof[6], _proof[7]);

        //TODO: Verify G2 Point
        if (
            !Pairing.checkG1Point(proof.A) || !Pairing.checkG1Point(proof.C) /*||
            !Pairing.checkG2Point(proof.B) */
        ) return 5;

        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint256 i = 0; i < _publicInputs.length; i++) {
            if (_publicInputs[i] >= BN128_GROUP_ORDER) {
                return 4;
            }
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], _publicInputs[i]));
        }

        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (
            !Pairing.pairingProd4(
                Pairing.negate(proof.A),
                proof.B,
                vk.alfa1,
                vk.beta2,
                vk_x,
                vk.gamma2,
                proof.C,
                vk.delta2
            )
        ) {
            return 1;
        }
        return 0;
    }
}
