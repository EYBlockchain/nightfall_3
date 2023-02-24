// SPDX-License-Identifier: CC0

pragma solidity ^0.8.17;

contract Sha {
    uint256 constant truncate64 =
        0x000000000000000000000000000000000000000000000000ffffffffffffffff;

    /*
    Pads a message for SHA-384, SHA-512, SHA-512/224 and SHA-512/256
    */
    function padMessage1024(bytes calldata message) public pure returns (bytes memory) {
        uint256 l = message.length * 8;
        uint256 l1 = (l + 1) % 1024;
        uint256 k = (1920 - l1) % 1024;
        // the message length is an integer number of bytes. The padded message length is an integer number of bytes (n * 64 bytes).
        // Therefore the padding must be an integer number of bytes.  The last part of the padding
        // is 128 bits = 16 bytes thus the first part of the padding must also be an integer number
        // of bytes. i.e. (k +1) mod 8 = 0. This saves having to deal with fractions of a byte.
        bytes memory pad1 = new bytes((k + 1) / 8); // make an empty byte array
        pad1[0] = 0x80; // add64 '1' to the front
        bytes memory pad2 = abi.encodePacked(bytes16(uint128(l)));
        return abi.encodePacked(message, pad1, pad2);
    }

    /*
    Parses a padded message for SHA-384, SHA-512, SHA-512/224 and SHA-512/256 into message blocks of 1024 bits
    */
    function parseMessage1024(bytes calldata paddedMessage) public pure returns (bytes[] memory) {
        uint256 nblocks = paddedMessage.length / 128; // divided into 128 byte (1024 bit) blocks
        bytes[] memory messageBlocks = new bytes[](nblocks);
        uint256 j = 0;
        for (uint256 i = 0; i < nblocks * 128; i = i + 128) {
            messageBlocks[j++] = paddedMessage[i:i + 128];
        }
        return messageBlocks;
    }

    /*
    Splits a 1024 bit message block for SHA-384, SHA-512, SHA-512/224 and SHA-512/256 into 16 x 64 bit words
    */
    function parseMessageBlock1024(bytes calldata messageBlock)
        public
        pure
        returns (uint256[16] memory)
    {
        uint256[16] memory messageWords;
        uint256 j = 0;
        for (uint256 i = 0; i < 128; i = i + 8) {
            messageWords[j++] = uint256(uint64(bytes8(messageBlock[i:i + 8])));
        }
        return messageWords;
    }

    /*
    Returns initial hash values for SHA512
    */
    function getInitialHashValuesSha512() public pure returns (uint256[8] memory) {
        uint256[8] memory H;
        H[0] = 0x6a09e667f3bcc908;
        H[1] = 0xbb67ae8584caa73b;
        H[2] = 0x3c6ef372fe94f82b;
        H[3] = 0xa54ff53a5f1d36f1;
        H[4] = 0x510e527fade682d1;
        H[5] = 0x9b05688c2b3e6c1f;
        H[6] = 0x1f83d9abfb41bd6b;
        H[7] = 0x5be0cd19137e2179;
        return H;
    }

    /*
    Returns the sha512 constants
    */
    function getConstantsSha512() public pure returns (uint256[80] memory) {
        return [
            uint256(0x428a2f98d728ae22),
            0x7137449123ef65cd,
            0xb5c0fbcfec4d3b2f,
            0xe9b5dba58189dbbc,
            0x3956c25bf348b538,
            0x59f111f1b605d019,
            0x923f82a4af194f9b,
            0xab1c5ed5da6d8118,
            0xd807aa98a3030242,
            0x12835b0145706fbe,
            0x243185be4ee4b28c,
            0x550c7dc3d5ffb4e2,
            0x72be5d74f27b896f,
            0x80deb1fe3b1696b1,
            0x9bdc06a725c71235,
            0xc19bf174cf692694,
            0xe49b69c19ef14ad2,
            0xefbe4786384f25e3,
            0x0fc19dc68b8cd5b5,
            0x240ca1cc77ac9c65,
            0x2de92c6f592b0275,
            0x4a7484aa6ea6e483,
            0x5cb0a9dcbd41fbd4,
            0x76f988da831153b5,
            0x983e5152ee66dfab,
            0xa831c66d2db43210,
            0xb00327c898fb213f,
            0xbf597fc7beef0ee4,
            0xc6e00bf33da88fc2,
            0xd5a79147930aa725,
            0x06ca6351e003826f,
            0x142929670a0e6e70,
            0x27b70a8546d22ffc,
            0x2e1b21385c26c926,
            0x4d2c6dfc5ac42aed,
            0x53380d139d95b3df,
            0x650a73548baf63de,
            0x766a0abb3c77b2a8,
            0x81c2c92e47edaee6,
            0x92722c851482353b,
            0xa2bfe8a14cf10364,
            0xa81a664bbc423001,
            0xc24b8b70d0f89791,
            0xc76c51a30654be30,
            0xd192e819d6ef5218,
            0xd69906245565a910,
            0xf40e35855771202a,
            0x106aa07032bbd1b8,
            0x19a4c116b8d2d0c8,
            0x1e376c085141ab53,
            0x2748774cdf8eeb99,
            0x34b0bcb5e19b48a8,
            0x391c0cb3c5c95a63,
            0x4ed8aa4ae3418acb,
            0x5b9cca4f7763e373,
            0x682e6ff3d6b2b8a3,
            0x748f82ee5defb2fc,
            0x78a5636f43172f60,
            0x84c87814a1f0ab72,
            0x8cc702081a6439ec,
            0x90befffa23631e28,
            0xa4506cebde82bde9,
            0xbef9a3f7b2c67915,
            0xc67178f2e372532b,
            0xca273eceea26619c,
            0xd186b8c721c0c207,
            0xeada7dd6cde0eb1e,
            0xf57d4f7fee6ed178,
            0x06f067aa72176fba,
            0x0a637dc5a2c898a6,
            0x113f9804bef90dae,
            0x1b710b35131c471b,
            0x28db77f523047d84,
            0x32caab7b40c72493,
            0x3c9ebe0a15c9bebc,
            0x431d67c49c100d4c,
            0x4cc5d4becb3e42b6,
            0x597f299cfc657e2a,
            0x5fcb6fab3ad6faec,
            0x6c44198c4a475817
        ];
    }

    /*
    Implements the shift right function SHRn(x)=x >> n
    */
    function SHR(uint256 n, uint256 x) public pure returns (uint256) {
        x &= truncate64;
        return x >> n;
    }

    /*
    Implements the rotate right function ROTRn(x)=(x >> n)|(x << w - n).
    */
    function ROTR(uint256 n, uint256 x) public pure returns (uint256) {
        x &= truncate64;
        return (x >> n) | (x << (64 - n));
    }

    /*
    Implements the Ch function Ch(x, y,z) = (x & y)^(~x & z)
    */
    function Ch(
        uint256 x,
        uint256 y,
        uint256 z
    ) public pure returns (uint256) {
        return (x & y) ^ (~x & z);
    }

    /*
    Implements the Maj function Maj(x ,y, z)
    */
    function Maj(
        uint256 x,
        uint256 y,
        uint256 z
    ) public pure returns (uint256) {
        return ((x & y) ^ (x & z) ^ (y & z));
    }

    /*
    Implement the big and small sigma functions
    */
    function Sigma0(uint256 x) public pure returns (uint256) {
        return ROTR(28, x) ^ ROTR(34, x) ^ ROTR(39, x);
    }

    function Sigma1(uint256 x) public pure returns (uint256) {
        return ROTR(14, x) ^ ROTR(18, x) ^ ROTR(41, x);
    }

    function sigma0(uint256 x) public pure returns (uint256) {
        return ROTR(1, x) ^ ROTR(8, x) ^ SHR(7, x);
    }

    function sigma1(uint256 x) public pure returns (uint256) {
        return ROTR(19, x) ^ ROTR(61, x) ^ SHR(6, x);
    }

    /*
    replicates the FIPS 180 add for sha512 function by truncating the result to 64 bits
    */
    function add64(uint256 x, uint256 y) public pure returns (uint256) {
        x &= truncate64;
        y &= truncate64;
        return (x + y);
    }

    /*
    Main SHA512 function. Variable definitions and method are as per FIPS180-4
    */
    function sha512(bytes calldata message) public view returns (bytes memory) {
        bytes memory paddedMessage = padMessage1024(message);
        bytes[] memory messageBlocks = this.parseMessage1024(paddedMessage); // external call to deal with calldata conversion for slicing
        uint256 N = messageBlocks.length;
        uint256[80] memory W;
        uint256[8] memory H = getInitialHashValuesSha512();
        uint256[80] memory K = getConstantsSha512();
        for (uint256 i = 0; i < N; i++) {
            // NB FIPS 180-4 numbers from 1..N. WE number from 0..N-1.
            uint256[16] memory M = this.parseMessageBlock1024(messageBlocks[i]);
            // messageShedule
            for (uint256 t = 0; t < 16; t++) {
                W[t] = M[t];
            }
            for (uint256 t = 16; t < 80; t++) {
                W[t] = add64(
                    add64(sigma1(W[t - 2]), W[t - 7]),
                    add64(sigma0(W[t - 15]), W[t - 16])
                );
            }
            uint256[8] memory a;
            for (uint256 j = 0; j < 8; j++) a[j] = H[j];
            for (uint256 t = 0; t < 80; t++) {
                uint256 T1 = add64(
                    add64(a[7], Sigma1(a[4])),
                    add64(add64(Ch(a[4], a[5], a[6]), K[t]), W[t])
                );
                uint256 T2 = add64(Sigma0(a[0]), Maj(a[0], a[1], a[2]));
                a[7] = a[6];
                a[6] = a[5];
                a[5] = a[4];
                a[4] = add64(a[3], T1);
                a[3] = a[2];
                a[2] = a[1];
                a[1] = a[0];
                a[0] = add64(T1, T2);
            }
            for (uint256 j = 0; j < 8; j++) H[j] = add64(a[j], H[j]);
        }
        return
            abi.encodePacked(
                bytes8(uint64(H[0])),
                bytes8(uint64(H[1])),
                bytes8(uint64(H[2])),
                bytes8(uint64(H[3])),
                bytes8(uint64(H[4])),
                bytes8(uint64(H[5])),
                bytes8(uint64(H[6])),
                bytes8(uint64(H[7]))
            );
    }
}
