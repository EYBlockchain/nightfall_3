// SPDX-License-Identifier: LGPL3

pragma solidity ^0.8.0;

/**
 * @title Elliptic curve operations on twist points for alt_bn128
 * @author Mustafa Al-Bassam (mus@musalbas.com)
 */

// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// More information at https://gist.github.com/chriseth/f9be9d9391efc5beb9704255a8e2989d

library Pairing {
    struct G1Point {
        uint256 X;
        uint256 Y;
    }
    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint256[2] X;
        uint256[2] Y;
    }

    /// @return the generator of G1
    function P1() internal pure returns (G1Point memory) {
        return G1Point(1, 2);
    }

    /// @return the generator of G2
    function P2() internal pure returns (G2Point memory) {
        return
            G2Point(
                [
                    11559732032986387107991004021392285783925812861821192530917403151452391805634,
                    10857046999023057135944570762232829481370756359578518086990519993285655852781
                ],
                [
                    4082367875863433681332203403145435568316851327593401208105741076214120093531,
                    8495653923123431417604973247489272438418190587263600148770280649306958101930
                ]
            );
    }

    /// @return r the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negate(G1Point memory p) internal pure returns (G1Point memory r) {
        // The prime q in the base field F_q for G1
        uint256 q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        if (p.X == 0 && p.Y == 0) return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }

    /// @return r the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2)
        internal
        view
        returns (G1Point memory r)
    {
        uint256[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly ("memory-safe") {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }
        require(success, 'pairing-add-failed');
    }

    /// @return r the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalar_mul(G1Point memory p, uint256 s) internal view returns (G1Point memory r) {
        uint256[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly ("memory-safe") {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }
        require(success, 'pairing-mul-failed');
    }

    function invMod(uint256 x, uint256 q) internal pure returns (uint256) {
        uint256 inv = 0;
        uint256 newT = 1;
        uint256 r = q;
        uint256 t;
        while (x != 0) {
            t = r / x;
            (inv, newT) = (newT, addmod(inv, (q - mulmod(t, newT, q)), q));
            (r, x) = (x, r - t * x);
        }

        return inv;
    }

    function modDivide(
        uint256 a,
        uint256 b,
        uint256 q
    ) internal pure returns (uint256) {
        return mulmod(a, invMod(b, q), q);
    }

    function complexDivMod(
        uint256[2] memory a,
        uint256[2] memory b,
        uint256 q
    ) internal pure returns (uint256[2] memory) {
        uint256 denominator = addmod(mulmod(b[0], b[0], q), mulmod(b[1], b[1], q), q);
        uint256 realNumerator = addmod(mulmod(a[0], b[0], q), mulmod(a[1], b[1], q), q);
        uint256 imaginaryNumerator = addmod(mulmod(b[0], a[1], q), q - mulmod(b[1], a[0], q), q);
        return [
            modDivide(realNumerator, denominator, q),
            modDivide(imaginaryNumerator, denominator, q)
        ];
    }

    function complexAddMod(
        uint256[2] memory a,
        uint256[2] memory b,
        uint256 q
    ) internal pure returns (uint256[2] memory) {
        return [addmod(a[0], b[0], q), addmod(a[1], b[1], q)];
    }

    function complexMulMod(
        uint256[2] memory a,
        uint256[2] memory b,
        uint256 q
    ) internal pure returns (uint256[2] memory) {
        return [
            addmod(mulmod(a[0], b[0], q), q - (mulmod(a[1], b[1], q)), q),
            addmod(mulmod(a[1], b[0], q), mulmod(a[0], b[1], q), q)
        ];
    }

    function checkG1Point(G1Point memory p) internal pure returns (bool) {
        uint256 q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

        if (p.Y > q || p.X > q) return false;

        // check on curve
        uint256 lhs = mulmod(p.Y, p.Y, q); // y^2
        uint256 rhs = mulmod(p.X, p.X, q); // x^2
        rhs = mulmod(rhs, p.X, q); // x^3
        rhs = addmod(rhs, 3, q); // x^3 + b
        if (lhs != rhs) {
            return false;
        }
        return true;
    }

    function checkG2Point(G2Point memory p) internal pure returns (bool) {
        uint256 q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

        if (p.Y[0] > q || p.X[0] > q || p.Y[1] > q || p.X[1] > q) return false;

        uint256[2] memory X = [p.X[1], p.X[0]];
        uint256[2] memory Y = [p.Y[1], p.Y[0]];

        // check on curve
        uint256[2] memory lhs = complexMulMod(Y, Y, q);
        uint256[2] memory rhs = complexMulMod(X, X, q);
        rhs = complexMulMod(rhs, X, q);
        rhs = complexAddMod(rhs, complexDivMod([uint256(3), 0], [uint256(9), 1], q), q);
        //TODO: Hardcode complex Div?
        //[ 19485874751759354771024239261021720505790618469301721065564631296452457478373,
        // 266929791119991161246907387137283842545076965332900288569378510910307636690 ]
        if (lhs[0] != rhs[0] || lhs[1] != rhs[1]) {
            return false;
        }
        return true;
    }

    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
        require(p1.length == p2.length, 'pairing-lengths-failed');
        uint256 elements = p1.length;
        uint256 inputSize = elements * 6;
        uint256[] memory input = new uint256[](inputSize);
        for (uint256 i = 0; i < elements; i++) {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
            input[i * 6 + 2] = p2[i].X[0];
            input[i * 6 + 3] = p2[i].X[1];
            input[i * 6 + 4] = p2[i].Y[0];
            input[i * 6 + 5] = p2[i].Y[1];
        }
        uint256[1] memory out;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly ("memory-safe") {
            success := staticcall(
                sub(gas(), 2000),
                8,
                add(input, 0x20),
                mul(inputSize, 0x20),
                out,
                0x20
            )
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }
        require(success, 'pairing-opcode-failed');
        return out[0] != 0;
    }

    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }

    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](3);
        G2Point[] memory p2 = new G2Point[](3);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        return pairing(p1, p2);
    }

    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2,
        G1Point memory d1,
        G2Point memory d2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](4);
        G2Point[] memory p2 = new G2Point[](4);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p1[3] = d1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        p2[3] = d2;
        return pairing(p1, p2);
    }
}
