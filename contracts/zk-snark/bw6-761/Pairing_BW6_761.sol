// SPDX-License-Identifier: MIT AND CC0-1.0
//
// **************************************************************************
//
// Pairing_BW6_761 is modified by Michael Connor (for EYGS LLP) from the original alt_bn128 implementation of a Pairing library by Christian Reitwiessner.
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

library Pairing_BW6_761 {

    struct G1Point {
        uint[3] X; // each field element is 761 bits (just shy of 3 * 256 = 768 bits)
        uint[3] Y;
    }

    struct G2Point {
        uint[3] X;
        uint[3] Y;
    }

    /// @dev note: (0,0) is not actually on the curve; this is just a convention.
    /// @author iAmMichaelConnor
    /// @return the Ethereum-encoding of the point at infinity of BW6-761.
    function infinityG1() pure internal returns (G1Point memory) {
        return G1Point(
            [uint(0), uint(0), uint(0)],
            [uint(0), uint(0), uint(0)]
        );
    }

    /// @dev note: (0,0) is not actually on the curve; this is just a convention.
    /// @author iAmMichaelConnor
    /// @return the Ethereum-encoding of the point at infinity of BW6-761's M-twist.
    function infinityG2() pure internal returns (G2Point memory) {
        return G2Point(
            [uint(0), uint(0), uint(0)],
            [uint(0), uint(0), uint(0)]
        );
    }

    /// @return the generator of G1
    // X = 0x1075b020ea190c8b277ce98a477beaee6a0cfb7551b27f0ee05c54b85f56fc779017ffac15520ac11dbfcd294c2e746a17a54ce47729b905bd71fa0c9ea097103758f9a280ca27f6750dd0356133e82055928aca6af603f4088f3af66e5b43d
    // Y = 0x58b84e0a6fc574e6fd637b45cc2a420f952589884c9ec61a7348d2a2e573a3265909f1af7e0dbac5b8fa1771b5b806cc685d31717a4c55be3fb90b6fc2cdd49f9df141b3053253b2b08119cad0fb93ad1cb2be0b20d2a1bafc8f2db4e95363
    function P1() pure internal returns (G1Point memory) {
        return G1Point(
            [
                465308892415002654953065456525087219612465462459131508665556745963670171591,
                54732504807773012332754196408542921042092393462712171500558398132721566746993,
                1564650758105937227603989093386247915746576368743371713829685500761952597053
            ],
            [
                156754567003250291243731216346527801582526905538558216352598772436928132003,
                17345206266475173360034276017504102690467590100150719034410668061296488009172,
                72196803006028709943418975574124549059167347351310937004421858012097726206819
            ]
        );
    }

    /// @return the generator of G2
    // X = 0x110133241d9b816c852a82e69d660f9d61053aac5a7115f4c06201013890f6d26b41c5dab3da268734ec3f1f09feb58c5bbcae9ac70e7c7963317a300e1b6bace6948cb3cd208d700e96efbc2ad54b06410cf4fe1bf995ba830c194cd025f1c
    // Y = 0x17c3357761369f8179eb10e4b6d2dc26b7cf9acec2181c81a78e2753ffe3160a1d86c80b95a59c94c97eb733293fef64f293dbd2c712b88906c170ffa823003ea96fcd504affc758aa2d3a3c5a02a591ec0594f9eac689eb70a16728c73b61
    function P2() pure internal returns (G2Point memory ) {
        return G2Point(
            [
                480714889732506316189785004296967363818202760342591104622025872910079037293,
                17506116492030738917738374491395977723144033117807518758130866273164430784186,
                93362468154965889406159977045877777339850179488624463258909135579530641170204
            ],
            [
                41984764476854328464533355296902683169556237593793090984290269116703433494,
                4575297277931036775734398678523257403449434763871952914757560229922140070656,
                28342765395199459737620840414410381192229788244464125304317823543208887925601
            ]
        );
    }

    /// @author iAmMichaelConnor
    /// @return c - the 3-limbed representation of a minus b.
    function subtractLimbs(
        uint[3] memory a,
        uint[3] memory b
    ) internal pure returns (uint[3] memory c) {
        assembly {
            let maxUint := sub(0,1) // 0xff...ff 32 bytes
            let carry := 0
            let a_i
            let b_i
            let c_i
            let slot
            for { let i := 0 } lt(i, 3) { i := add(i, 1) } { // for(uint i=0; i<3; i+=1)
                slot := mul(0x20, sub(2, i))
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

    /// @author iAmMichaelConnor
    /// @return out = base ** exponent (mod modulus)
    function expmodb768e256m768(
        uint[3] memory base,
        uint exponent,
        uint[3] memory modulus
    ) internal view returns (uint[3] memory out) {
        assembly {
            // define pointer
            let p := mload(0x40)
            // store data
            mstore(p, 0x60)             // Length of base
            mstore(add(p, 0x20), 0x20)  // Length of exponent
            mstore(add(p, 0x40), 0x60)  // Length of modulus
            mstore(add(p, 0x60), mload(base))  // base word 0
            mstore(add(p, 0x80), mload(add(base, 0x20)))  // base word 1
            mstore(add(p, 0xa0), mload(add(base, 0x40)))  // base word 2
            mstore(add(p, 0xc0), exponent)  // exponent word 0
            mstore(add(p, 0xe0), mload(modulus))  // modulus word 0
            mstore(add(p, 0x100), mload(add(modulus, 0x20)))  // modulus word 1
            mstore(add(p, 0x120), mload(add(modulus, 0x40)))  // modulus word 2
            // staticcall(gasLimit, to, inputOffset, inputSize, outputOffset, outputSize)
            if iszero(staticcall(sub(gas(), 2000), 0x05, p, 0x140, p, 0x60)) {
                revert(0, 0)
            }
            // output
            mstore(out, mload(p))
            mstore(add(out, 0x20), mload(add(p, 0x20)))
            mstore(add(out, 0x40), mload(add(p, 0x40)))
        }
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negatePointG1(G1Point memory p) view internal returns (G1Point memory) {
        //
        // Base field modulus = 0x122e824fb83ce0ad187c94004faff3eb926186a81d14688528275ef8087be41707ba638e584e91903cebaff25b423048689c8ed12f9fd9071dcd3dc73ebff2e98a116c25667a8f8160cf8aeeaf0a437e6913e6870000082f49d00000000008b
        // The prime q in the base field F_q for G1
        uint[3] memory q = [
            513987850983873464006802627883984196151100700201527873469053252827320139329,
            50877508454115348380452006117144225713256344386170928517592842154234937605934,
            69036172439834594078135912819926461842834193110597730425838344000302431076491
        ];
        if (p.X[0] == 0 && p.X[1] == 0 && p.X[2] == 0 &&
            p.Y[0] == 0 && p.Y[1] == 0 && p.X[2] == 0)
            return infinityG1(); // point at infinity

        // negativeY = q - (p.Y % q)
        uint[3] memory negativeY = subtractLimbs(
            q,
            expmodb768e256m768(
                p.Y,
                1, // p.Y (mod q) = p.Y ^ 1 (mod q)
                q
            )
        );
        return G1Point(p.X, negativeY);
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negatePointG2(G2Point memory p) view internal returns (G2Point memory) {
        //
        // Base field modulus = 0x122e824fb83ce0ad187c94004faff3eb926186a81d14688528275ef8087be41707ba638e584e91903cebaff25b423048689c8ed12f9fd9071dcd3dc73ebff2e98a116c25667a8f8160cf8aeeaf0a437e6913e6870000082f49d00000000008b
        // The prime q in the base field F_q for G1
        uint[3] memory q = [
            513987850983873464006802627883984196151100700201527873469053252827320139329,
            50877508454115348380452006117144225713256344386170928517592842154234937605934,
            69036172439834594078135912819926461842834193110597730425838344000302431076491
        ];
        if (p.X[0] == 0 && p.X[1] == 0 && p.X[2] == 0 &&
            p.Y[0] == 0 && p.Y[1] == 0 && p.X[2] == 0)
            return infinityG2(); // point at infinity

        // negativeY = q - (p.Y % q)
        uint[3] memory negativeY = subtractLimbs(
            q,
            expmodb768e256m768(
                p.Y,
                1, // p.Y (mod q) = p.Y ^ 1 (mod q)
                q
            )
        );
        return G2Point(p.X, negativeY);
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return sum - the sum of two points of G1
    function addPointsG1(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory sum) {
        uint[12] memory input;
        uint[6] memory output;
        input[0] = p1.X[0];
        input[1] = p1.X[1];
        input[2] = p1.X[2];
        input[3] = p1.Y[0];
        input[4] = p1.Y[1];
        input[5] = p1.Y[2];
        input[6] = p2.X[0];
        input[7] = p2.X[1];
        input[8] = p2.X[2];
        input[9] = p2.Y[0];
        input[10] = p2.Y[1];
        input[11] = p2.Y[2];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x13, input, 0x180, output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "EC addition failed");
        sum.X = [output[0], output[1], output[2]];
        sum.Y = [output[3], output[4], output[5]];
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return sum - the sum of two points of G2
    function addPointsG2(G2Point memory p1, G2Point memory p2) internal view returns (G2Point memory sum) {
        uint[12] memory input;
        uint[6] memory output;
        input[0] = p1.X[0];
        input[1] = p1.X[1];
        input[2] = p1.X[2];
        input[3] = p1.Y[0];
        input[4] = p1.Y[1];
        input[5] = p1.Y[2];
        input[6] = p2.X[0];
        input[7] = p2.X[1];
        input[8] = p2.X[2];
        input[9] = p2.Y[0];
        input[10] = p2.Y[1];
        input[11] = p2.Y[2];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x16, input, 0x180, output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "EC addition failed");
        sum.X = [output[0], output[1], output[2]];
        sum.Y = [output[3], output[4], output[5]];
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return product - the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalarMulG1(G1Point memory p, uint[2] memory s) internal view returns (G1Point memory product) {
        uint[9] memory input;
        uint[6] memory output;
        input[0] = p.X[0];
        input[1] = p.X[1];
        input[2] = p.X[2];
        input[3] = p.Y[0];
        input[4] = p.Y[1];
        input[5] = p.Y[2];
        input[6] = s[0];
        input[7] = s[1];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x14, input, 0x100, output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC scalar multiplication failed");
        product.X = [output[0], output[1], output[2]];
        product.Y = [output[3], output[4], output[5]];
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
    /// @return product - the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalarMulG2(G2Point memory p, uint[2] memory s) internal view returns (G2Point memory product) {
        uint[9] memory input;
        uint[6] memory output;
        input[0] = p.X[0];
        input[1] = p.X[1];
        input[2] = p.X[2];
        input[3] = p.Y[0];
        input[4] = p.Y[1];
        input[5] = p.Y[2];
        input[6] = s[0];
        input[7] = s[1];
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x17, input, 0x100, output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC scalar multiplication failed");
        product.X = [output[0], output[1], output[2]];
        product.Y = [output[3], output[4], output[5]];
    }

    /// @author iAmMichaelConnor
    /// @return product
    function multiexpG1(G1Point[] memory p, uint[2][] memory s) internal view returns (G1Point memory product) {

        require(p.length == s.length, "EC multiexp p length != s length");
        uint elements = p.length;
        uint inputSize = elements * 8;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 8 + 0] = p[i].X[0];
            input[i * 8 + 1] = p[i].X[1];
            input[i * 8 + 2] = p[i].X[2];
            input[i * 8 + 3] = p[i].Y[0];
            input[i * 8 + 4] = p[i].Y[1];
            input[i * 8 + 5] = p[i].Y[2];

            input[i * 8 + 6] = s[i][0];
            input[i * 8 + 7] = s[i][1];
        }
        uint[6] memory output;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x15, add(input, 0x20), mul(inputSize, 0x20), output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC multiexp failed");
        product.X = [output[0], output[1], output[2]];
        product.Y = [output[3], output[4], output[5]];
    }

    /// @author iAmMichaelConnor
    /// @return product
    function multiexpG2(G2Point[] memory p, uint[2][] memory s) internal view returns (G2Point memory product) {

        require(p.length == s.length, "EC multiexp p length != s length");
        uint elements = p.length;
        uint inputSize = elements * 8;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 8 + 0] = p[i].X[0];
            input[i * 8 + 1] = p[i].X[1];
            input[i * 8 + 2] = p[i].X[2];
            input[i * 8 + 3] = p[i].Y[0];
            input[i * 8 + 4] = p[i].Y[1];
            input[i * 8 + 5] = p[i].Y[2];

            input[i * 8 + 6] = s[i][0];
            input[i * 8 + 7] = s[i][1];
        }
        uint[6] memory output;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 0x18, add(input, 0x20), mul(inputSize, 0x20), output, 0xc0)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "EC multiexp failed");
        product.X = [output[0], output[1], output[2]];
        product.Y = [output[3], output[4], output[5]];
    }

    /// @author Christian Reitwiessner & iAmMichaelConnor
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
            input[i * 12 + 2] = p1[i].X[2];
            input[i * 12 + 3] = p1[i].Y[0];
            input[i * 12 + 4] = p1[i].Y[1];
            input[i * 12 + 5] = p1[i].Y[2];

            input[i * 12 + 6] = p2[i].X[0];
            input[i * 12 + 7] = p2[i].X[1];
            input[i * 12 + 8] = p2[i].X[2];
            input[i * 12 + 9] = p2[i].Y[0];
            input[i * 12 + 10] = p2[i].Y[1];
            input[i * 12 + 11] = p2[i].Y[2];
        }
        uint[1] memory out;
        bool success;
        assembly {
            // staticcall(gas, address, in, insize, out, outsize)
            // in = add(input, 0x20) (we skip the first 0x20 bytes because it's the length of the `input` dynamic array, rather than the input array's data)
            // consider replacing `mul(inputSize, 0x20)` with `input` to load the first 0x20 bytes of input; its length.
            success := staticcall(sub(gas(), 2000), 0x19, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
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
