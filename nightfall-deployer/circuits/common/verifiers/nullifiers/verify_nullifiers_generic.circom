pragma circom 2.1.2;

include "../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../node_modules/circomlib/circuits/gates.circom";

include "../../utils/calculate_root.circom";

/**
 * Verifies that a commitment can be reconstructed from its preimage values. As long as the commitment comes from either the ercAddress
 * or from the feeAddress it will be considered valid.If the commitmentHash is zero, it is also considered valid. 
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
template VerifyNullifiersGeneric(N) {
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
    signal input feeAddress;

    signal output valid;
    signal output feeTotal;
    signal output nonFeeTotal;


    signal r[N];

    var nonFeeSum = 0;
    var feeSum = 0;

    for(var i=0; i < N; i++) {
        // Check if the commitment value is zero
        var isNullifierValueZero = IsZero()(oldCommitmentValues[i]);

        // Reconstruct the commitment hash from its preimage values;
        var calculatedCommitmentHash = Poseidon(6)([packedErcAddress, idRemainder, oldCommitmentValues[i], zkpPublicKey[0], zkpPublicKey[1], oldCommitmentSalts[i]]); 
        
        // Calculate the commitment's nullifier
        var poseidonNullifier = Poseidon(2)([nullifierKey,calculatedCommitmentHash]);

        // Reconstruct the commitment hash from its preimage values using the fee address;
        var calculatedCommitmentHashFee = Poseidon(6)([feeAddress, 0, oldCommitmentValues[i], zkpPublicKey[0], zkpPublicKey[1], oldCommitmentSalts[i]]); 

        // Calculate the commitment's fee nullifier
        var poseidonNullifierFee = Poseidon(2)([nullifierKey,calculatedCommitmentHashFee]);
        
        // If value is zero, set nullifier hash value as zero. Otherwise, set it to the poseidon nullifier hash
        var nullifier = Mux1()([poseidonNullifier, 0], isNullifierValueZero);
        
        // If value is zero, set nullifier hash fee value as zero. Otherwise, set it to the poseidon nullifier fee hash
        var nullifierFee = Mux1()([poseidonNullifierFee, 0], isNullifierValueZero);

        // Calculate if the nullifier is equal to the public transaction nullifier hash
        var IsEqualNullifier = IsEqual()([nullifier, nullifiersHashes[i]]);
        
        // Calculate if the nullifier fee is equal to the public transaction nullifier hash
        var IsEqualNullifierFee = IsEqual()([nullifierFee, nullifiersHashes[i]]);

        // Check either one of the two reconstructed nullifiers matches with the public transaction nullifier hash 
        // assert(IsEqualNullifier == 1 || IsEqualNullifierFee == 1);
        r[i] <== OR()(IsZero()(IsEqualNullifier - 1), IsZero()(IsEqualNullifierFee - 1));
        r[i] === 1;

        // Check if the calculated root matches with the public root
        var validCalculatedOldCommitmentHash = Mux1()([calculatedCommitmentHashFee, calculatedCommitmentHash], IsEqualNullifier);
        
        // Calculate the merkle tree root from from the commitment hash and its sibling path
        var calculatedRoot = CalculateRoot()(orders[i], validCalculatedOldCommitmentHash, paths[i]);
       
        // Calculate if the calculated root is equal to the public one
        var IsEqualRoots = IsEqual()([calculatedRoot, roots[i]]);

        // Check that the roots are equal. If nullifierValue is zero it will directly be considered valid
        var isValidRoot = Mux1()([IsEqualRoots, 1], isNullifierValueZero);
        isValidRoot === 1;

        // add up the fees and the commitment values. These can be different coins and so can't be validly added together
        // In the casde where they have the same address, these values will end up equal
        feeSum += IsEqualNullifierFee * oldCommitmentValues[i];
        nonFeeSum += IsEqualNullifier * oldCommitmentValues[i];
    }
    valid <== 1;
    feeTotal <-- feeSum;
    nonFeeTotal <-- nonFeeSum;
}