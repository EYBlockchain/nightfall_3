pragma circom 2.1.2;

include "./common/utils/calculate_keys.circom";
include "./common/utils/array_uint32_to_bits.circom";
include "./common/verifiers/verify_duplicates.circom";
include "./common/verifiers/commitments/verify_commitments_optional.circom";
include "./common/verifiers/commitments/verify_commitments.circom";
include "./common/verifiers/nullifiers/verify_nullifiers_optional.circom";
include "./common/verifiers/verify_encryption.circom";

include "../node_modules/circomlib/circuits/bitify.circom";

/**
 * Checks that a tokenise transaction is valid
 * @input value - {Uint112}
 * @input fee - {Uint96}
 * @input circuitHash - {Uint40}
 * @input tokenType - {Uint8}
 * @input historicRootBlockNumberL2[N] - {Array[Field]}
 * @input tokenId[8] - {Array[Uint32]}
 * @input ercAddress - {Field}
 * @input recipientAddress - {Field}
 * @input commitments[C] - {Array[Field]}
 * @input nullifiers[N] - {Array[Field]}
 * @input compressedSecrets[2] - {Array[Field]}
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
 * @input packedErcAddressPrivate - {Field}
 * @input idRemainderPrivate - {Uint256}
 * @input valuePrivate - {Field}
 */
template Tokenise(N,C) {
    signal input value;
    signal input fee;
    signal input circuitHash;
    signal input tokenType;
    signal input historicRootBlockNumberL2[N];
    signal input tokenId[8];
    signal input ercAddress;
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
    signal input valuePrivate;
    
    // Check that the transaction does not have nullifiers nor commitments duplicated
    var checkDuplicates = VerifyDuplicates(N,C)(nullifiers, commitments);
    checkDuplicates === 1;

    // Check that ercAddress is zero
    ercAddress === 0;

    // Check that compressed secrets is zero
    compressedSecrets[0] === 0;
    compressedSecrets[1] === 0;

    // Check that value is zero
    value === 0;

    // Check that tokenId is zero
    var tokenIdBits[256] = ArrayUint32ToBits(8)(tokenId);
    var tokenIdNum = Bits2Num(256)(tokenIdBits);
    tokenIdNum === 0;
    
    // Check that the recipient address is zero
    recipientAddress === 0;

    // Check that the first commitment is different than zero
    assert(commitments[0] != 0);
 
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

    // Check that value doesn't overflow
    var valuePrivateBits[254] = Num2Bits(254)(valuePrivate);
    valuePrivateBits[253] === 0;
    valuePrivateBits[252] === 0;

    // Check that the value holds
    nullifiersSum + valuePrivate === commitmentsSum + fee;

    // Calculate the nullifierKeys and the zkpPublicKeys from the root key
    var nullifierKeys, zkpPublicKeys[2];
    (nullifierKeys, zkpPublicKeys) = CalculateKeys()(rootKey);
    
    // Check that the top most two bits of the packed ercAddress are equal to 1
    var ercAddressBits[254] = Num2Bits(254)(packedErcAddressPrivate);
    ercAddressBits[253] === 1;
    ercAddressBits[252] === 1;
    
    // Check that the nullifiers are valid either using the feeAddress or if value is zero
    var checkNullifier = VerifyNullifiersOptional(N)(feeAddress, 0, nullifierKeys, zkpPublicKeys, nullifiers, roots,
        nullifiersValues, nullifiersSalts, paths, orders);
    checkNullifier === 1;

    // Check that the first commitment is valid and corresponds to the packedErcAddress
    var checkCommitment = VerifyCommitments(1)(packedErcAddressPrivate, idRemainderPrivate, [commitments[0]],[commitmentsValues[0]], [commitmentsSalts[0]], [recipientPublicKey[0]]);
    checkCommitment === 1;

    // Check that the second commitment is valid and corresponds either to the feeAddress or it is zero
    var checkCommitmentFee = VerifyCommitmentsOptional(1)(feeAddress, 0, [commitments[1]],[commitmentsValues[1]], [commitmentsSalts[1]], [recipientPublicKey[1]]);
    checkCommitmentFee === 1;

    // Verify the fee change
    assert(commitmentsValues[1] == 0 || (
        zkpPublicKeys[0] == recipientPublicKey[1][0] && zkpPublicKeys[1] == recipientPublicKey[1][1]));
}

component main {public [value, fee, circuitHash, tokenType, historicRootBlockNumberL2, tokenId, ercAddress, recipientAddress, commitments, nullifiers, compressedSecrets,roots, feeAddress]} = Tokenise(2,2);

