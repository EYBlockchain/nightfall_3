// Copyright (c) 2018 HarryR
// License: LGPL-3.0+
// SPDX-License-Identifier: LGPL-3.0+
pragma solidity >=0.5.0 <7.0.0;

/**
* Implements MiMC-p/p over the BLS12_377 sub group order used by zkSNARKs
*
* See: https://eprint.iacr.org/2016/492.pdf
*
* Round constants are generated in sequence from a seed
*/
contract MiMC_BLS12_377
{
    uint public zero = 0;
    /**
    * MiMC-p/p with exponent of 11
    *
    * Recommended at least 74 rounds
    */
    function MiMCp_bls12_377(
        uint256 in_x,
        uint256 in_k,
        uint256 in_seed,
        uint256 round_count
    )
        private pure returns(uint256 out_x)
    {
        assembly {
            if lt(round_count, 1) { revert(0, 0) }

            // Initialise round constants, k will be hashed
            let c := mload(0x40)
            mstore(0x40, add(c, 32))
            mstore(c, in_seed)

            let localQ := 8444461749428370424248824938781546531375899335154063827935233455917409239041

            // Further n-2 subsequent rounds include a round constant
            for { let i := round_count } gt(i, 0) { i := sub(i, 1) } {
                // c = H(c)
                mstore(c, keccak256(c, 32))

                // x = pow(x + c_i, 7, p) + k
                let t := addmod(addmod(in_x, mload(c), localQ), in_k, localQ) // t = x + c_i + k
                let a := mulmod(t, t, localQ) // t^2
                let b := mulmod(a, a, localQ) // t^4
                let d := mulmod(b, b, localQ) // t^8
                let e := mulmod(d, a, localQ) // t^10
                in_x := mulmod(e, t, localQ) // t^11
            }

            // Result adds key again as blinding factor
            out_x := addmod(in_x, in_k, localQ)
        }
    }

    function MiMCp_mp_bls12_377(
        uint256[] memory in_x,
        uint256 in_k,
        uint256 in_seed,
        uint256 round_count
    )
        private pure returns (uint256)
    {
        uint256 r = in_k;
        uint256 localQ = 8444461749428370424248824938781546531375899335154063827935233455917409239041;
        uint256 i;
        for( i = 0; i < in_x.length; i++ )
        {
            r = (r + (in_x[i] % localQ) + MiMCp_bls12_377(in_x[i], r, in_seed, round_count)) % localQ;
        }
        return r;
    }

    function Hash_bls12_377( uint256[] memory in_msgs, uint256 in_key )
        private pure returns (uint256)
    {
        bytes4 seed = 0x6d696d63; //this is 'mimc' in hex
        return MiMCp_mp_bls12_377(
            in_msgs, in_key,
            uint256(keccak256(abi.encodePacked(seed))),
            74
        );
    }

    function mimc_bls12_377( uint[] memory in_msgs ) public pure returns (uint) {
        return Hash_bls12_377( in_msgs, 0 );
    }

    function mimcHash( uint[] memory in_msgs ) public pure returns (uint) {
      return mimc_bls12_377(in_msgs);
    }
  }
