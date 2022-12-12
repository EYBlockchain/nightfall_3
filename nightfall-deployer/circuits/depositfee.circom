pragma circom 2.1.2;

include "./common/utils/calculate_keys.circom";
include "./common/verifiers/verify_duplicates.circom";
include "./common/verifiers/commitments/verify_commitments_optional.circom";
include "./common/verifiers/commitments/verify_commitments.circom";
include "./common/verifiers/nullifiers/verify_nullifiers_optional.circom";
include "./common/utils/array_uint32_to_bits.circom";

include "../node_modules/circomlib/circuits/bitify.circom";

/**
 * Checks that a deposit transaction is valid
 * @input value - {Uint112}
 * @input fee - {Uint96} 
 * @input circuitHash - {Uint40}
 * @input tokenType - {Uint8}
 * @input historicRootBlockNumberL2[N] - {Array[Field]}
 * @input tokenId[8] - {Array[Uint32]}
 * @input ercAddress - {Uint160}
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
 */
template DepositFee(N,C) {
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

    // Check that the transaction does not have nullifiers nor commitments duplicated
    var checkDuplicates = VerifyDuplicates(N,C)(nullifiers, commitments);
    checkDuplicates === 1;

    // Check that compressed secrets is zero
    compressedSecrets[0] === 0;
    compressedSecrets[1] === 0;
    
    // Check that ercAddress is different than zero
    assert(ercAddress != 0);

    var tokenIdBits[256] = ArrayUint32ToBits(8)(tokenId);
    var tokenIdNum = Bits2Num(256)(tokenIdBits);
    //Check that combination id and value matches the token type
    //ERC20 -> Value > 0 and Id == 0
    //ERC721 -> Value == 0
    //ERC1155 -> Value > 0
    assert((tokenType == 1 && value == 0) || (tokenType != 1 && value != 0));
    assert((tokenType == 0 && tokenIdNum == 0) || tokenType != 0);

    recipientAddress === 0;

    // Check that the first commitment is different than zero
    assert(commitments[0] != 0);
    
    // Convert the commitment values to numbers and calculate its sum
    var commitmentsSum = 0;
    for(var i = 0; i < C; i++) {
        commitmentsSum += commitmentsValues[i];
        var commitmentValueBits[254] = Num2Bits(254)(commitmentsValues[i]);
        commitmentValueBits[253] === 0;
        commitmentValueBits[252] === 0;
    }

    // Convert the nullifiers values to numbers and calculate its sum
    var nullifiersSum = 0;
    for(var i = 0; i < N; i++) {
        nullifiersSum += nullifiersValues[i];
        var nullifierValueBits[254] = Num2Bits(254)(nullifiersValues[i]);
        nullifierValueBits[253] === 0;
        nullifierValueBits[252] === 0;
    }

    // Check that the commitments sum is equal to the value
    commitmentsSum + fee === value + nullifiersSum;

    // Calculate the token Id remainder without the 4 top bytes
    component idRemainder = Bits2Num(224);
    for(var i = 0; i < 224; i++) {
        idRemainder.in[i] <== tokenIdBits[i];
    }

    // Calculate the packed erc address by packing the top 4 bytes of the token id into the ercAddress field
    // (address only uses 160 bits and the Shield contract prevents creation of something with more than 160 bits
    var packedErcAddress = ercAddress + tokenId[0] * 1461501637330902918203684832716283019655932542976;

    // Check that the commitments are valid
    var checkCommitments = VerifyCommitments(1)(packedErcAddress, idRemainder.out, [commitments[0]], [commitmentsValues[0]], [commitmentsSalts[0]], [recipientPublicKey[0]]);
    checkCommitments === 1;

    var checkCommitmentsFee = VerifyCommitmentsOptional(1)(feeAddress, 0, [commitments[1]], [commitmentsValues[1]], [commitmentsSalts[1]], [recipientPublicKey[1]]);
    checkCommitmentsFee === 1;

    // Calculate the nullifierKeys and the zkpPublicKeys from the root key
    var nullifierKeys, zkpPublicKeys[2];
    (nullifierKeys, zkpPublicKeys) = CalculateKeys()(rootKey);

    
    // Check that the nullifiers are valid either using the feeAddress or if value is zero
    var checkNullifier = VerifyNullifiersOptional(N)(feeAddress, 0, nullifierKeys, zkpPublicKeys, nullifiers, roots,
        nullifiersValues, nullifiersSalts, paths, orders);
    checkNullifier === 1;

    // Verify the fee change
    assert(commitmentsValues[1] == 0 || (
        zkpPublicKeys[0] == recipientPublicKey[1][0] && zkpPublicKeys[1] == recipientPublicKey[1][1]));
}

component main {public [value, fee, circuitHash, tokenType, historicRootBlockNumberL2, tokenId, ercAddress, recipientAddress, commitments, nullifiers, compressedSecrets, roots, feeAddress]} = DepositFee(2,2);



