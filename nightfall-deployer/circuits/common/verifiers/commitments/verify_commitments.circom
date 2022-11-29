pragma circom 2.1.2;

include "../../../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Verifies that a commitment can be reconstructed. If the commitmentHash is zero, 
 * it is also considered valid.
 * @param C - number of commitments
 * @input packedErcAddress - {Uint192} - erc address concatenated with the first 32 bytes of the token id
 * @input idRemainder - {Uint224} - 224 last bits of the token id
 * @input commitmentsHashes[C] - {Array[Field]} - All the commitment hashes to be validated 
 * @input newCommitmentsValues[C] - {Array[Uint252]} - Values corresponding to the preimage of each commitment
 * @input newCommitmentsSalts[C] - {Array[Field]} - Salts corresponding to the preimage of each commitment
 * @input recipientPublicKey[C][2] - {Array[Array[Field]]} - Public key of the owner of each commitment
 */
template VerifyCommitments(C) {
    signal input packedErcAddress;
    signal input idRemainder;
    signal input commitmentsHashes[C];
    signal input newCommitmentsValues[C];
    signal input newCommitmentsSalts[C];
    signal input recipientPublicKey[C][2];

    signal output valid;

    for(var i=0; i < C; i++) {
        // Reconstruct the commitment hash from its preimage values;
        var calculatedCommitmentHash = Poseidon(6)([packedErcAddress, idRemainder, newCommitmentsValues[i], recipientPublicKey[i][0], recipientPublicKey[i][1], newCommitmentsSalts[i]]);
       
        // Check that the reconstructed commitment hash is equal to the public transaction commitment hash
        calculatedCommitmentHash === commitmentsHashes[i];
    }

    valid <== 1;
}
