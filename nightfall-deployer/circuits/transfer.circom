pragma circom 2.1.2;

include "./common/utils/calculate_keys.circom";
include "./common/utils/array_uint32_to_bits.circom";
include "./common/verifiers/verify_duplicates.circom";
include "./common/verifiers/commitments/verify_commitments_generic.circom";
include "./common/verifiers/commitments/verify_commitments.circom";
include "./common/verifiers/nullifiers/verify_nullifiers.circom";
include "./common/verifiers/nullifiers/verify_nullifiers_generic.circom";
include "./common/verifiers/verify_encryption.circom";

include "../node_modules/circomlib/circuits/bitify.circom";

/**
 * Checks that a transfer transaction is valid
 * @input value - {Uint112} - Set to zero
 * @input fee - {Uint96} 
 * @input circuitHash - {Uint40}
 * @input tokenType - {Uint8} It is zero 
 * @input historicRootBlockNumberL2[N] - {Array[Field]}
 * @input tokenId[8] - {Array[Uint32]} - Contains the ephemeral public key used for KemDem compressed
 * @input ercAddress - {Field} - Contains the packedErc encrypted
 * @input recipientAddress - {Field} - Contains the tokenId encrpyted
 * @input commitments[C] - {Array[Field]}
 * @input nullifiers[N] - {Array[Field]}
 * @input compressedSecrets[2] - {Array[Field]} - Contains the value and salt encrypted
 * @input roots[N] - {Array[Field]}
 * @input feeAddress - {Uint160}
 * @input rootKey - {Field}
 * @input nullifiersValues[N] - {Array[Field]}
 * @input nullifiersSalts[N] - {Array[Field]}
 * @input paths[N][32] - {Array[Array[Field]]}
 * @input orders[N] - {Array[Uint32]}
 * @input commitmentsValues[C] - {Array[Field]}
 * @input commitmentsSalts[C] - {Array[Field]}
 * @input recipientPublicKey[C][2] - {Array[Array[Field]]}
 * @input packedErcAddressPrivate - {Uint192} - Contains the packedErcAddress of the token transferred
 * @input idRemainderPrivate - {Uint224} - Contains the idRemainder of the token transferred
 * @input ephemeralKey - {Field}
 */
template Transfer(N,C) {
    signal input value;
    signal input fee;
    signal input circuitHash;
    signal input tokenType;
    signal input historicRootBlockNumberL2[N];
    signal input ercAddress;
    signal input tokenId[8];
    signal input recipientAddress;
    signal input commitments[C];
    signal input nullifiers[N];
    signal input compressedSecrets[2];
    signal input roots[N];
    signal input feeAddress;
    signal input rootKey;
    signal input nullifiersValues[N];
    signal input nullifiersSalts[N];
    signal input paths[N][32];
    signal input orders[N];
    signal input commitmentsValues[C];
    signal input commitmentsSalts[C];
    signal input recipientPublicKey[C][2];
    signal input packedErcAddressPrivate;
    signal input idRemainderPrivate;
    signal input ephemeralKey;
    
    // Check that the transaction does not have nullifiers nor commitments duplicated
    var checkDuplicates = VerifyDuplicates(N,C)(nullifiers, commitments);
    checkDuplicates === 1;

    // Check that the ercAddress is different than zero (it contains one of the 4 encrypted KemDem values)
    assert(ercAddress != 0);

    // Check that the recipientAddress is different than zero (it contains the second cipher text)
    assert(recipientAddress != 0);

    // Check that at least one of the compressed secrets is not zero
    assert(compressedSecrets[0] != 0 || compressedSecrets[1] != 0);

    // Check that value is zero
    value === 0;

    // Check that the first commitment is different than zero
    assert(commitments[0] != 0);

    // Check that the first nullifier is different than zero
    assert(nullifiers[0] != 0);

    // Convert the nullifiers values to numbers and calculate its sum
    var nullifiersSum = 0;
    for(var i = 0; i < N; i++) {
        nullifiersSum += nullifiersValues[i];
        var nullifierValueBits[254] = Num2Bits(254)(nullifiersValues[i]);
        nullifierValueBits[253] === 0;
        nullifierValueBits[252] === 0;
    }
    
    // Convert the commitment values to numbers and calculate its sum
    var commitmentsSum = 0;
    for(var i = 0; i < C; i++) {
        commitmentsSum += commitmentsValues[i];
        var commitmentValueBits[254] = Num2Bits(254)(commitmentsValues[i]);
        commitmentValueBits[253] === 0;
        commitmentValueBits[252] === 0;
    }

    // Check that the value holds
    nullifiersSum === commitmentsSum + fee;

    // Calculate the nullifierKeys and the zkpPublicKeys from the root key
    var nullifierKeys, zkpPublicKeys[2];
    (nullifierKeys, zkpPublicKeys) = CalculateKeys()(rootKey);
     
    // Check that the first nullifier is valid and corresponds to the packedErcAddress
    var checkNullifier = VerifyNullifiers(1)(packedErcAddressPrivate, idRemainderPrivate, nullifierKeys, zkpPublicKeys, [nullifiers[0]], [roots[0]],
        [nullifiersValues[0]], [nullifiersSalts[0]], [paths[0]], [orders[0]]);

    checkNullifier === 1;

    // Check that the other nullifiers are valid either using a ercAddress commitment, a feeAddress commitment or if value is zero
    component checkGenericNullifiers = VerifyNullifiersGeneric(N - 1);
    checkGenericNullifiers.packedErcAddress <== packedErcAddressPrivate;
    checkGenericNullifiers.idRemainder <== idRemainderPrivate;
    checkGenericNullifiers.feeAddress <== feeAddress;
    checkGenericNullifiers.nullifierKey <== nullifierKeys;
    checkGenericNullifiers.zkpPublicKey <== zkpPublicKeys;
    for(var i = 1; i < N; i++) {
        checkGenericNullifiers.nullifiersHashes[i - 1] <== nullifiers[i];
        checkGenericNullifiers.oldCommitmentValues[i - 1] <== nullifiersValues[i];
        checkGenericNullifiers.oldCommitmentSalts[i - 1] <== nullifiersSalts[i];
        checkGenericNullifiers.roots[i - 1] <== roots[i];
        checkGenericNullifiers.orders[i - 1] <== orders[i];
        checkGenericNullifiers.paths[i - 1] <== paths[i];
    }
    checkGenericNullifiers.valid === 1;

    // Check that the first commitment is valid and corresponds to the packedErcAddress
    var checkCommitment = VerifyCommitments(1)(packedErcAddressPrivate, idRemainderPrivate, [commitments[0]],[commitmentsValues[0]], [commitmentsSalts[0]], [recipientPublicKey[0]]);
    checkCommitment === 1;

    // Check that the other commitments are valid either using the ercAddress, the feeAddress or if value is zero
    component checkGenericCommitments = VerifyCommitmentsGeneric(C - 1);
    checkGenericCommitments.packedErcAddress <== packedErcAddressPrivate;
    checkGenericCommitments.idRemainder <== idRemainderPrivate;
    checkGenericCommitments.feeAddress <== feeAddress;
    for(var i = 1; i < C; i++) {
        checkGenericCommitments.commitmentsHashes[i - 1] <== commitments[i];
        checkGenericCommitments.newCommitmentsValues[i - 1] <== commitmentsValues[i];
        checkGenericCommitments.newCommitmentsSalts[i - 1] <== commitmentsSalts[i];
        checkGenericCommitments.recipientPublicKey[i - 1][0] <== recipientPublicKey[i][0];
        checkGenericCommitments.recipientPublicKey[i - 1][1] <== recipientPublicKey[i][1];
    }
    checkGenericCommitments.valid === 1;

    // Verify the withdraw change
    assert(commitmentsValues[C - 2] == 0 || (
        zkpPublicKeys[0] == recipientPublicKey[C - 2][0] && zkpPublicKeys[1] == recipientPublicKey[C - 2][1]));
    
    // Verify the fee change
    assert(commitmentsValues[C - 1] == 0 || (
        zkpPublicKeys[0] == recipientPublicKey[C - 1][0] && zkpPublicKeys[1] == recipientPublicKey[C - 1][1]));


    var tokenIdBits[256] = ArrayUint32ToBits(8)(tokenId);
    // Check that the encryption of the recipient's commitment preimage was performed appropiately
    var checkEncryption = VerifyEncryption()([ercAddress, recipientAddress, compressedSecrets[0], compressedSecrets[1]], packedErcAddressPrivate, idRemainderPrivate,
        commitmentsValues[0], commitmentsSalts[0], recipientPublicKey[0], tokenIdBits, ephemeralKey);
    checkEncryption === 1;
}

component main {public [value, fee, circuitHash, tokenType, historicRootBlockNumberL2, tokenId, ercAddress, recipientAddress, commitments, nullifiers, compressedSecrets,roots, feeAddress]} = Transfer(4,3);

