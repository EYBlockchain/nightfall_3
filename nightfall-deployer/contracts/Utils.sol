// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import './Structures.sol';
import 'hardhat/console.sol';

library Utils {
    bytes32 public constant ZERO = bytes32(0);
    uint256 constant TRANSACTIONS_BATCH_SIZE = 6; // TODO Change this from 2 to an appropriate value to control stack too deep error

    function hashTransaction(Structures.Transaction calldata t) internal pure returns (bytes32) {
        return keccak256(abi.encode(t));
    }

    function hashBlock(Structures.Block calldata b) internal pure returns (bytes32) {
        return keccak256(abi.encode(b));
    }

    function hashFrontier(bytes32[33] memory frontier) internal pure returns (bytes32) {
        return keccak256(abi.encode(frontier));
    }

    function getValue(uint256 packedTransactionInfo) internal pure returns (uint112) {
        return uint112(packedTransactionInfo >> 8);
    }

    function getCircuitHash(uint256 packedTransactionInfo) internal pure returns (uint40) {
        return uint40(packedTransactionInfo >> 216);
    }

    function getFee(uint256 packedTransactionInfo) internal pure returns (uint96) {
        return uint96(packedTransactionInfo >> 120);
    }

    function getTokenType(uint256 packedTransactionInfo)
        internal
        pure
        returns (Structures.TokenType)
    {
        return Structures.TokenType(uint8(packedTransactionInfo));
    }

    function getProposer(uint256 packedBlockInfo) internal pure returns (address) {
        return address(uint160(packedBlockInfo));
    }

    function getLeafCount(uint256 packedBlockInfo) internal pure returns (uint32) {
        return uint32(packedBlockInfo >> 224);
    }

    function getBlockNumberL2(uint256 packedBlockInfo) internal pure returns (uint64) {
        return uint64(packedBlockInfo >> 160);
    }

    function getHistoricRoot(uint256[] calldata historicRootBlockNumberL2, uint256 position)
        internal
        pure
        returns (uint64)
    {
        uint256 slot = position / 4;
        uint256 pos = 64 * (3 - (position % 4));
        return uint64(historicRootBlockNumberL2[slot] >> pos);
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
        uint256 parity = 0x8000000000000000000000000000000000000000000000000000000000000000 *
            (y % 2);
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
    function countNonZeroValues(bytes32[] calldata vals) internal pure returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < vals.length; ++i) {
            if (vals[i] != ZERO) ++count;
        }
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
            for (uint256 j = 0; j < ts[i].commitments.length; j++) {
                if (ts[i].commitments[j] != ZERO) filtered[count++] = ts[i].commitments[j];
            }
        }
        return filtered;
    }

    // gathers public inputs for each tx type
    // required now we have removed the publicInputHash
    function getPublicInputs(
        Structures.Transaction calldata ts,
        uint256[] memory roots,
        address maticAddress
    ) internal pure returns (uint256[] memory) {
        uint256 transactionSlots = 17 +
            2 *
            ts.nullifiers.length +
            roots.length +
            ts.commitments.length;
        uint256[] memory inputs = new uint256[](transactionSlots);
        uint256 count = 0;
        inputs[count++] = uint256(getValue(ts.packedInfo));
        inputs[count++] = uint256(getFee(ts.packedInfo));
        inputs[count++] = uint256(getCircuitHash(ts.packedInfo));
        inputs[count++] = uint256(getTokenType(ts.packedInfo));
        for (uint256 i = 0; i < ts.nullifiers.length; ++i) {
            inputs[count++] = uint256(getHistoricRoot(ts.historicRootBlockNumberL2, i));
        }
        inputs[count++] = uint256(ts.ercAddress);
        inputs[count++] = uint32(uint256(ts.tokenId));
        inputs[count++] = uint32(uint256(ts.tokenId) >> 32);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 64);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 96);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 128);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 160);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 192);
        inputs[count++] = uint32(uint256(ts.tokenId) >> 224);
        inputs[count++] = uint32(uint256(ts.recipientAddress));
        for (uint256 i = 0; i < ts.commitments.length; ++i) {
            inputs[count++] = uint256(ts.commitments[i]);
        }
        for (uint256 i = 0; i < ts.nullifiers.length; ++i) {
            inputs[count++] = uint256(ts.nullifiers[i]);
        }
        inputs[count++] = uint256(ts.compressedSecrets[0]);
        inputs[count++] = uint256(ts.compressedSecrets[1]);
        for (uint256 i = 0; i < roots.length; ++i) {
            inputs[count++] = uint256(roots[i]);
        }
        inputs[count++] = uint256(uint160(maticAddress));
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
