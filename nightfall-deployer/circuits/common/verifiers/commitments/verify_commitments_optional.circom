pragma circom 2.1.2;
include "../../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../../node_modules/circomlib/circuits/mux1.circom";

/**
 * Verifies that a commitment can be reconstructed from its preimage values. If the commitmentHash is zero, 
 * it is also considered valid.
 * Note: This function cannot be used to validate an ERC721 commitment
 * @param C - number of commitments
 * @input packedErcAddress - {Uint192} - erc address concatenated with the first 32 bytes of the token id
 * @input idRemainder - {Uint224} - 224 last bits of the token id
 * @input commitmentsHashes[C] - {Array[Field]} - All the commitment hashes to be validated 
 * @input newCommitmentsValues[C] - {Array[Uint252]} - Values corresponding to the preimage of each commitment
 * @input newCommitmentsSalts[C] - {Array[Field]} - Salts corresponding to the preimage of each commitment
 * @input recipientPublicKey[C][2] - {Array[Array[Field]]} - Public key of the owner of each commitment
 */
template VerifyCommitmentsOptional(C) {
    signal input packedErcAddress;
    signal input idRemainder;
    signal input commitmentsHashes[C];
    signal input newCommitmentsValues[C];
    signal input newCommitmentsSalts[C];
    signal input recipientPublicKey[C][2];

    signal output valid;


    for(var i=0; i < C; i++) {

        // Check if the commitment value is zero
        var isCommitmentValueZero = IsZero()(newCommitmentsValues[i]);

        // Reconstruct the commitment hash from its preimage values;
        var calculatedCommitmentHash = Poseidon(6)([packedErcAddress, idRemainder, newCommitmentsValues[i], recipientPublicKey[i][0], recipientPublicKey[i][1], newCommitmentsSalts[i]]);

        // If value is zero, set commitment hash value as zero. Otherwise, set it to the calculated hash
        var commitment = Mux1()([calculatedCommitmentHash, 0], isCommitmentValueZero);
        
        // Check that the reconstructed commitment hash is equal to the public transaction commitment hash
        commitment === commitmentsHashes[i];
    }

    valid <== 1;
}
