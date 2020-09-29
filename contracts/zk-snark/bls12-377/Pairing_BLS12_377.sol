// SPDX-License-Identifier: MIT AND CC0-1.0
//
// **************************************************************************
//
// Pairing_BLS12_377 is modified by iAmMichaelConnor & Chaitanya Konda (for EYGS LLP) from the original alt_bn128 implementation of a Pairing library by Christian Reitwiessner.
// Any modifications are CC0 1.0 public domain, where permitted.
// To the extent possible under law, EYGS LLP has waived all copyright and related or neighboring rights to said modifications.
//
// **************************************************************************
//
// From the original alt_bn128 library:
//
// This file is MIT Licensed.
//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// More information at https://gist.github.com/chriseth/f9be9d9391efc5beb9704255a8e2989d
//
// **************************************************************************

pragma solidity ^0.6.9;

library Pairing_BLS12_377 {

    struct G1Point {
        uint[2] X; // each field element is 377 bits (377 expressed in 256-bit multiples is 2 * 256 = 512 bits)
        uint[2] Y;
    }

    struct G2Point {
        uint[4] X;
        uint[4] Y;
    }

    /// @dev note: (0,0) is not actually on the curve; this is just a convention.
    /// @author iAmMichaelConnor & ChaitanyaKonda
    /// @return the Ethereum-encoding of the point at infinity of BLS12-377.
    function infinityG1() pure internal returns (G1Point memory) {
        return G1Point(
            [uint(0), uint(0)],
            [uint(0), uint(0)]
        );
    }

    /// @dev note: (0,0) is not actually on the curve; this is just a convention.
    /// @author iAmMichaelConnor & ChaitanyaKonda
    /// @return the Ethereum-encoding of the point at infinity of BLS12-377's D-twist.
    function infinityG2() pure internal returns (G2Point memory) {
        return G2Point(
            [uint(0), uint(0), uint(0), uint(0)],
            [uint(0), uint(0), uint(0), uint(0)]
        );
    }

    /// @return the generator of G1
    // X = 81937999373150964239938255573465948239988671502647976594219695644855304257327692006745978603320413799295628339695
    // Y = 241266749859715473739788878240585681733927191168601896383759122102112907357779751001206799952863815012735208165030
    function P1() pure internal returns (G1Point memory) {
        return G1Point(
            [
                707630373653754672292588614503104340,
                60421077330822247253223257814525074956116378693405231428281530645757189417455
            ],
            [
                2083620318528311783367176451364220612,
                85712755334475159129592084309549795139151724284837731534077673745306378604198
            ]
        );
    }

    /// @return the generator of G2
    // X_C0 = 233578398248691099356572568220835526895379068987715365179118596935057653620464273615301663571204657964920925606294
    // X_C1 = 140913150380207355837477652521042157274541796891053068589147167627541651775299824604154852141315666357241556069118
    // Y_C0 = 63160294768292073209381361943935198908131692476676907196754037919244929611450776219210369229519898517858833747423
    // Y_C1 = 149157405641012693445398062341192467754805999074082136895788947234480009303640899064710353187729182149407503257491
    function P2() pure internal returns (G2Point memory) {
        return G2Point(
            [
                2017222418104673366492554483137256705,
                89285742193438925969923203768342439527019295989203036979731155231217473835414,
                1216949718312841550562989542504218837,
                37611701202995549609417370436177324550878497915157469649441715783850797394686
            ],
            [
                545462951608420164085300153306771380,
                100420391726288104355732173845271676169238010207543126493447081107888763915743,
                1288148496356380556788366925421506730,
                44296744734318302885660646794936203861530477911798874813074723234012002488211
            ]
        );
    }

    /// @author iAmMichaelConnor
    /// @return c - the 2-limbed representation of a minus b.
    function subtractLimbs(
        uint[2] memory a,
        uint[2] memory b
    ) internal pure returns (uint[2] memory c) {
        assembly {
            let maxUint := sub(0,1) // 0xff...ff 32 bytes
            let carry := 0
            let a_i
            let b_i
            let c_i
            let slot
            for { let i := 0 } lt(i, 2) { i := add(i, 1) } { // for(uint i=0; i<2; i+=1)
                slot := mul(0x20, sub(1, i))
                a_i := mload(add(a, slot))
                b_i := mload(add(b, slot))
                if eq(carry, 1) {
                    // if (carry == 1)
                    switch eq(a_i, 0)
                        case 1 {
                            // if (a_i == 0)
                            a_i := maxUint
                            carry := 1
                        }
                        default {
                            // (a_i > 0)
                            a_i := sub(a_i, 1)
                            carry := 0
                        }
                }

                switch lt(a_i, b_i)
                    case 1 {
                        // a_i < b_i
                        c_i := add(add(sub(maxUint, b_i), a_i), 1) // c_i = ff...ff - b_i + a_i + 1 ( = a_i - b_i without overflowing)
                        carry := 1
                    }
                    default {
                        // a_i >= b_i
                        c_i := sub(a_i, b_i)
                    }

                mstore(add(c, slot), c_i)
            }

            if lt(a_i, b_i) {
                // a_i < b_i <-- we're catching the final case, where we might have borrowed from a non-existent further-left term
                // in this case, we must have a < b, and so for safety we revert.
                stop()
            }
        }
    }

    /// @author iAmMichaelConnor & ChaitanyaKonda
    /// @return out = base ** exponent (mod modulus)
    function expmodb512e256m512(
        uint[2] memory base,
        uint exponent,
        uint[2] memory modulus
    ) internal view returns (uint[2] memory out) {
        assembly {
            // define pointer
            let p := mload(0x40)
            // store data
            mstore(p, 0x40)             // Length of base
            mstore(add(p, 0x20), 0x20)  // Length of exponent
            mstore(add(p, 0x40), 0x40)  // Length of modulus
            mstore(add(p, 0x60), mload(base))  // base word 0
            mstore(add(p, 0x80), mload(add(base, 0x20)))  // base word 1
            mstore(add(p, 0xa0), exponent)  // exponent word 0
            mstore(add(p, 0xc0), mload(modulus))  // modulus word 0
            mstore(add(p, 0xe0), mload(add(modulus, 0x20)))  // modulus word 1
            // staticcall(gasLimit, to, inputOffset, inputSize, outputOffset, outputSize)
            if iszero(staticcall(sub(gas(), 2000), 0x05, p, 0x100, p, 0x40)) {
                revert(0, 0)
            }
            // output
            mstore(out, mload(p)) // output word 0
            mstore(add(out, 0x20), mload(add(p, 0x20))) // output word 1
        }
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor & ChaitanyaKonda
    /// @return the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negatePointG1(G1Point memory p) view internal returns (G1Point memory) {
        // Base field modulus =  258664426012969094010652733694893533536393512754914660539884262666720468348340822774968888139573360124440321458177

        // The prime q in the base field F_q for G1
        uint[2] memory q = [
            2233869582254757176697208567811361083,
            11821711093692503419202826048817742432896994856600506088868478158150448447489
        ];
        if (p.X[0] == 0 && p.X[1] == 0 &&
            p.Y[0] == 0 && p.Y[1] == 0)
            return infinityG1(); // point at infinity

        // negativeY = q - (p.Y % q)
        uint[2] memory negativeY = subtractLimbs(
            q,
            expmodb512e256m512(
                p.Y,
                1, // p.Y (mod q) = p.Y ^ 1 (mod q)
                q
            )
        );
        return G1Point(p.X, negativeY);
    }

    /// @author Christian Reitwiessner & ChaitanyaKonda
    /// @return sum - the sum of two points of G1
    function addPointsG1(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory sum) {
        uint[8] memory input;
        uint[4] memory output;
        input[0] = p1.X[0];
        input[1] = p1.X[1];
        input[2] = p1.Y[0];
        input[3] = p1.Y[1];
        input[4] = p2.X[0];
        input[5] = p2.X[1];
        input[6] = p2.Y[0];
        input[7] = p2.Y[1];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x1c, input, 0x100, output, 0x80)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "EC addition failed");
        sum.X = [output[0], output[1]];
        sum.Y = [output[2], output[3]];
    }

    /// @author Christian Reitwiessner & ChaitanyaKonda
    /// @return sum - the sum of two points of G2
    function addPointsG2(G2Point memory p1, G2Point memory p2) internal view returns (G2Point memory sum) {
        uint[16] memory input;
        uint[8] memory output;
        input[0] = p1.X[0];
        input[1] = p1.X[1];
        input[2] = p1.X[2];
        input[3] = p1.X[3];
        input[4] = p1.Y[0];
        input[5] = p1.Y[1];
        input[6] = p1.Y[2];
        input[7] = p1.Y[3];
        input[8] = p2.X[0];
        input[9] = p2.X[1];
        input[10] = p2.X[2];
        input[11] = p2.X[3];
        input[12] = p2.Y[0];
        input[13] = p2.Y[1];
        input[14] = p2.Y[2];
        input[15] = p2.Y[3];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x1f, input, 0x200, output, 0x100)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "EC addition failed");
        sum.X = [output[0], output[1], output[2], output[3]];
        sum.Y = [output[4], output[5], output[6], output[7]];
    }

    /// @author Christian Reitwiessner & ChaitanyaKonda
    /// @return product - the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalarMulG1(G1Point memory p, uint s) internal view returns (G1Point memory product) {
        uint[5] memory input;
        uint[4] memory output;
        input[0] = p.X[0];
        input[1] = p.X[1];
        input[2] = p.Y[0];
        input[3] = p.Y[1];
        input[4] = s;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x1d, input, 0xa0, output, 0x80)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC scalar multiplication failed");
        product.X = [output[0], output[1]];
        product.Y = [output[2], output[3]];
    }

    /// @author Christian Reitwiessner & ChaitanyaKonda
    /// @return product - the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalarMulG2(G2Point memory p, uint s) internal view returns (G2Point memory product) {
        uint[9] memory input;
        uint[8] memory output;
        input[0] = p.X[0];
        input[1] = p.X[1];
        input[2] = p.X[2];
        input[3] = p.X[3];
        input[4] = p.Y[0];
        input[5] = p.Y[1];
        input[6] = p.Y[2];
        input[7] = p.Y[3];
        input[8] = s;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x20, input, 0x120, output, 0x100)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC scalar multiplication failed");
        product.X = [output[0], output[1], output[2], output[3]];
        product.Y = [output[4], output[5], output[6], output[7]];
    }

    /// @author iAmMichaelConnor & ChaitanyaKonda
    /// @return product
    function multiexpG1(G1Point[] memory p, uint[] memory s) internal view returns (G1Point memory product) {

        require(p.length == s.length, "EC multiexp p length != s length");
        uint elements = p.length;
        uint inputSize = elements * 5;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 5 + 0] = p[i].X[0];
            input[i * 5 + 1] = p[i].X[1];
            input[i * 5 + 2] = p[i].Y[0];
            input[i * 5 + 3] = p[i].Y[1];

            input[i * 5 + 4] = s[i];
        }
        uint[4] memory output;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x1e, add(input, 0x20), mul(inputSize, 0x20), output, 0x80)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC multiexp failed");
        product.X = [output[0], output[1]];
        product.Y = [output[2], output[3]];
    }

    /// @author iAmMichaelConnor & ChaitanyaKonda
    /// @return product
    function multiexpG2(G2Point[] memory p, uint[] memory s) internal view returns (G2Point memory product) {

        require(p.length == s.length, "EC multiexp p length != s length");
        uint elements = p.length;
        uint inputSize = elements * 9;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 9 + 0] = p[i].X[0];
            input[i * 9 + 1] = p[i].X[1];
            input[i * 9 + 2] = p[i].X[2];
            input[i * 9 + 3] = p[i].X[3];
            input[i * 9 + 4] = p[i].Y[0];
            input[i * 9 + 5] = p[i].Y[1];
            input[i * 9 + 6] = p[i].Y[2];
            input[i * 9 + 7] = p[i].Y[3];

            input[i * 9 + 8] = s[i];
        }
        uint[8] memory output;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x21, add(input, 0x20), mul(inputSize, 0x20), output, 0x100)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC multiexp failed");
        product.X = [output[0], output[1], output[2], output[3]];
        product.Y = [output[4], output[5], output[6], output[7]];
    }

    /// @author Christian Reitwiessner & ChaitanyaKonda
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(
        G1Point[] memory p1,
        G2Point[] memory p2
    ) internal view returns (bool) {
        require(p1.length == p2.length, "EC pairing p1 length != p2 length");
        uint elements = p1.length;
        uint inputSize = elements * 12;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 12 + 0] = p1[i].X[0];
            input[i * 12 + 1] = p1[i].X[1];
            input[i * 12 + 2] = p1[i].Y[0];
            input[i * 12 + 3] = p1[i].Y[1];

            input[i * 12 + 4] = p2[i].X[0];
            input[i * 12 + 5] = p2[i].X[1];
            input[i * 12 + 6] = p2[i].X[2];
            input[i * 12 + 7] = p2[i].X[3];
            input[i * 12 + 8] = p2[i].Y[0];
            input[i * 12 + 9] = p2[i].Y[1];
            input[i * 12 + 10] = p2[i].Y[2];
            input[i * 12 + 11] = p2[i].Y[3];

        }
        uint[1] memory out;
        bool success;
        assembly {
            // staticcall(gas, address, in, insize, out, outsize)
            // in = add(input, 0x20) (we skip the first 0x20 bytes because it's the length of the `input` dynamic array, rather than the input array's data)
            // consider replacing `mul(inputSize, 0x20)` with `input` to load the first 0x20 bytes of input; its length.
            success := staticcall(sub(gas(), 2000), 0x22, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
            // Use "invalid" to make gas estimation work
            //switch success case 0 { invalid() }   //MC has commented out so that 'false' can be returned (rather than an error being thrown)
        }
        //require(success, "EC Pairing calculation failed");   //MC has commented out so that 'false' can be returned (rather than an error being thrown)
        return out[0] != 0;
    }

    /// @author Christian Reitwiessner
    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(
        G1Point memory a1, G2Point memory a2,
        G1Point memory b1, G2Point memory b2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }

    /// @author Christian Reitwiessner
    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2
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

    /// @author Christian Reitwiessner
    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2,
            G1Point memory d1, G2Point memory d2
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
