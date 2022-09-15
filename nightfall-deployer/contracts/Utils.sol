// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import './Structures.sol';

library Utils {
    bytes32 public constant ZERO = bytes32(0);
    uint256 constant TRANSACTIONS_BATCH_SIZE = 6; // TODO Change this from 2 to an appropriate value to control stack too deep error

    function hashTransaction(Structures.Transaction calldata t) internal pure returns (bytes32) {
        return keccak256(abi.encode(t));
    }

    function hashBlock(Structures.Block calldata b) internal pure returns (bytes32) {
        return keccak256(abi.encode(b));
    }

    function hashTransactionHashes(Structures.Transaction[] calldata ts)
        public
        pure
        returns (bytes32)
    {
        bytes32 transactionHashesRoot;
        bytes32[] memory transactionHashes = new bytes32[](ts.length);

        for (uint256 i = 0; i < ts.length; i++) {
            transactionHashes[i] = hashTransaction(ts[i]);
        }
        transactionHashesRoot = calculateMerkleRoot(transactionHashes);
        return transactionHashesRoot;
    }

    function compressG1(uint256 x, uint256 y) internal pure returns (uint256) {
        // compute whether y is odd or even and multiply by 2**255
        uint256 parity =
            0x8000000000000000000000000000000000000000000000000000000000000000 * (y % 2);
        // add the parity bit to the x cordinate (x,y are 254 bits long - the final
        // number is 256 bits to fit with an Ethereum word)
        return parity + x;
    }

    function compressG2(
        uint256 xr,
        uint256 xi,
        uint256 yr,
        uint256 yi
    ) internal pure returns (uint256, uint256) {
        return (compressG1(xr, yr), compressG1(xi, yi));
    }

    function compressProof(uint256[8] memory proof) internal pure returns (uint256[4] memory) {
        uint256 a = compressG1(proof[0], proof[1]);
        (uint256 rb, uint256 ib) = compressG2(proof[2], proof[3], proof[4], proof[5]);
        uint256 c = compressG1(proof[6], proof[7]);
        return [a, rb, ib, c];
    }

    // counts the number of non-zero values (useful for counting real commitments and nullifiers)
    function countNonZeroValues(bytes32[3] calldata vals) internal pure returns (uint256) {
        uint256 count;
        if (vals[0] != ZERO) count++;
        if (vals[1] != ZERO) count++;
        return count;
    }

    // counts the number of non-zero commitments in a block containing the ts transactions)
    function countCommitments(Structures.Transaction[] calldata ts)
        internal
        pure
        returns (uint256)
    {
        uint256 count;
        for (uint256 i = 0; i < ts.length; i++) {
            count += countNonZeroValues(ts[i].commitments);
        }
        return count;
    }

    // filters the non-zero commitments in a block containing the ts transactions)
    function filterCommitments(Structures.Transaction[] calldata ts)
        internal
        pure
        returns (bytes32[] memory)
    {
        bytes32[] memory filtered = new bytes32[](countCommitments(ts));
        uint256 count;
        for (uint256 i = 0; i < ts.length; i++) {
            if (ts[i].commitments[0] != ZERO) filtered[count++] = ts[i].commitments[0];
            if (ts[i].commitments[1] != ZERO) filtered[count++] = ts[i].commitments[1];
            if (ts[i].commitments[2] != ZERO) filtered[count++] = ts[i].commitments[2];
        }
        return filtered;
    }

    // gathers public inputs for each tx type
    // required now we have removed the publicInputHash
    function getPublicInputs(
        Structures.Transaction calldata ts,
        uint256[4] memory roots,
        address maticAddress
    ) internal pure returns (uint256[] memory) {
        uint256[] memory inputs = new uint256[](39);
        inputs[0] = uint256(ts.value);
        inputs[1] = uint256(ts.fee);
        inputs[2] = uint256(ts.transactionType);
        inputs[3] = uint256(ts.tokenType);
        inputs[4] = uint256(ts.historicRootBlockNumberL2[0]);
        inputs[5] = uint256(ts.historicRootBlockNumberL2[1]);
        inputs[6] = uint256(ts.historicRootBlockNumberL2[2]);
        inputs[7] = uint256(ts.historicRootBlockNumberL2[3]);
        inputs[8] = uint32(uint256(ts.tokenId) >> 224);
        inputs[9] = uint32(uint256(ts.tokenId) >> 192);
        inputs[10] = uint32(uint256(ts.tokenId) >> 160);
        inputs[11] = uint32(uint256(ts.tokenId) >> 128);
        inputs[12] = uint32(uint256(ts.tokenId) >> 96);
        inputs[13] = uint32(uint256(ts.tokenId) >> 64);
        inputs[14] = uint32(uint256(ts.tokenId) >> 32);
        inputs[15] = uint32(uint256(ts.tokenId));
        inputs[16] = uint256(ts.ercAddress);
        inputs[17] = uint32(uint256(ts.recipientAddress) >> 224);
        inputs[18] = uint32(uint256(ts.recipientAddress) >> 192);
        inputs[19] = uint32(uint256(ts.recipientAddress) >> 160);
        inputs[20] = uint32(uint256(ts.recipientAddress) >> 128);
        inputs[21] = uint32(uint256(ts.recipientAddress) >> 96);
        inputs[22] = uint32(uint256(ts.recipientAddress) >> 64);
        inputs[23] = uint32(uint256(ts.recipientAddress) >> 32);
        inputs[24] = uint32(uint256(ts.recipientAddress));
        inputs[25] = uint256(ts.commitments[0]);
        inputs[26] = uint256(ts.commitments[1]);
        inputs[27] = uint256(ts.commitments[2]);
        inputs[28] = uint256(ts.nullifiers[0]);
        inputs[29] = uint256(ts.nullifiers[1]);
        inputs[30] = uint256(ts.nullifiers[2]);
        inputs[31] = uint256(ts.nullifiers[3]);
        inputs[32] = uint256(ts.compressedSecrets[0]);
        inputs[33] = uint256(ts.compressedSecrets[1]);
        inputs[34] = uint256(roots[0]);
        inputs[35] = uint256(roots[1]);
        inputs[36] = uint256(roots[2]);
        inputs[37] = uint256(roots[3]);
        inputs[38] = uint256(uint160(maticAddress));
        return inputs;
    }

    function calculateMerkleRoot(bytes32[] memory leaves) public pure returns (bytes32 result) {
        assembly {
            let length := mload(leaves)
            let leavesPos := add(leaves, 0x20)
            let transactionHashesPos := mload(0x40)
            for {
                let i := 0
            } lt(i, length) {
                i := add(i, 1)
            } {
                mstore(add(transactionHashesPos, mul(0x20, i)), mload(add(leavesPos, mul(0x20, i))))
            }
            let height := 1
            for {

            } lt(exp(2, height), length) {

            } {
                height := add(height, 1)
            }
            for {
                let i := height
            } gt(i, 0) {
                i := sub(i, 1)
            } {
                for {
                    let j := 0
                } lt(j, exp(2, sub(i, 1))) {
                    j := add(j, 1)
                } {
                    let left := mload(add(transactionHashesPos, mul(mul(0x20, j), 2)))
                    let right := mload(add(transactionHashesPos, add(mul(mul(0x20, j), 2), 0x20)))
                    if eq(and(iszero(left), iszero(right)), 1) {
                        result := 0
                    } // returns bool
                    if eq(and(iszero(left), iszero(right)), 0) {
                        result := keccak256(add(transactionHashesPos, mul(mul(0x20, j), 2)), 0x40)
                    } // returns bool
                    mstore(add(transactionHashesPos, mul(0x20, j)), result)
                }
            }
        }
    }

    function checkPath(
        bytes32[] calldata siblingPath,
        uint256 leafIndex,
        bytes32 node
    ) public pure returns (bool) {
        for (uint256 i = siblingPath.length - 1; i > 0; i--) {
            if (leafIndex % 2 == 0) {
                node = keccak256(abi.encodePacked(node, siblingPath[i]));
            } else {
                node = keccak256(abi.encodePacked(siblingPath[i], node));
            }
            leafIndex = leafIndex >> 1;
        }
        return (siblingPath[0] == node);
    }
}
