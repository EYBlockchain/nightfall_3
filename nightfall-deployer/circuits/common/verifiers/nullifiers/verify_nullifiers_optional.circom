pragma circom 2.1.2;

include "../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../node_modules/circomlib/circuits/poseidon.circom";

include "../../utils/calculate_root.circom";

/**
 * Verifies that a nullifier can be reconstructed.If the nullifierHash is zero, 
 * it is also considered valid.
 * @param N - number of nullifiers
 * @input packedErcAddress - {Uint192} - erc address concatenated with the first 32 bytes of the token id
 * @input idRemainder - {Uint224} - 224 last bits of the token id
 * @input nullifierKey - {Field} - key used to nullify a commitment
 * @input zkpPublicKey[2] - {Array[Field]} - zkp key of the commitment's owner
 * @input nullifiersHashes[N] - {Array[Field]} - All the nullifiers hashes to be validated
 * @input roots[N] - {Array[Field]} - Merkle tree root for each nullified commitment 
 * @input oldCommitmentsValues[N] - {Array[Uint252]} - Values corresponding to the preimage of each nullified commitment
 * @input oldCommitmentsSalts[N] - {Array[Field]} - Salts corresponding to the preimage of each nullified commitment
 * @input paths[N][32] - {Array[Array[Field]]} - Sibling paths for the nullified commitments
 * @input orders[N] - {Array[Uint32]} - Orders of the nullified commitment in the merkle tree 
 */
template VerifyNullifiersOptional(N) {
    signal input packedErcAddress;
    signal input idRemainder;
    signal input nullifierKey;
    signal input zkpPublicKey[2];
    signal input nullifiersHashes[N];
    signal input roots[N];
    signal input oldCommitmentValues[N];
    signal input oldCommitmentSalts[N];
    signal input paths[N][32];
    signal input orders[N];

    signal output valid;

    for(var i=0; i < N; i++) {
        // Check if the commitment value is zero
        var isNullifierValueZero = IsZero()(oldCommitmentValues[i]);

        // Reconstruct the commitment hash from its preimage values;
        var calculatedCommitmentHash = Poseidon(6)([packedErcAddress, idRemainder, oldCommitmentValues[i], zkpPublicKey[0], zkpPublicKey[1], oldCommitmentSalts[i]]);    

        // Calculate the commitment's nullifier
        var poseidonNullifier = Poseidon(2)([nullifierKey,calculatedCommitmentHash]);
       
        // If value is zero, set nullifier hash value as zero. Otherwise, set it to the poseidon nullifier hash
        var nullifier = Mux1()([poseidonNullifier, 0], isNullifierValueZero);
       
        // Check that the reconstructed nullifier hash is equal to the public nullifier hash
        nullifiersHashes[i] === nullifier;
        
        // Calculate the merkle tree root from from the commitment hash and its sibling path
        var calculatedRoot = CalculateRoot()(orders[i], calculatedCommitmentHash, paths[i]);
        
        // Check if the calculated root matches with the public root
        var isEqualRoots = IsEqual()([calculatedRoot, roots[i]]);
        
        // Check that the root is valid
        var isValidRoot = Mux1()([isEqualRoots, 1], isNullifierValueZero);
        isValidRoot === 1;
    }

    valid <== 1;
}