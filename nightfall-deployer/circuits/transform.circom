pragma circom 2.1.0;

include "./common/utils/calculate_keys.circom";
include "./common/utils/array_uint32_to_bits.circom";
include "./common/verifiers/verify_duplicates.circom";
include "./common/verifiers/commitments/verify_commitments.circom";
include "./common/verifiers/commitments/verify_commitments_optional.circom";
include "./common/verifiers/nullifiers/verify_nullifiers.circom";
include "./common/verifiers/nullifiers/verify_nullifiers_optional.circom";
include "./common/verifiers/verify_encryption.circom";

include "../node_modules/circomlib/circuits/bitify.circom";

/**
 * Checks that a tranform transaction is valid
 * @input value - {Uint112}
 * @input fee - {Uint96}
 * @input transactionType - {Uint8}
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
 *
 * @input packedInputAddressesPrivate - {Array[Field]} 
 * @input packedInputIdRemaindersPrivate - {Array[Uint256]} 
 * @input packedInputValuesPrivate - {Array[Field]} 
 * @input packedOutputAddressesPrivate - {Array[Field]} 
 * @input packedOutputIdRemaindersPrivate - {Array[Uint256]} 
 * @input packedOutputValuesPrivate - {Array[Field]} 
 */

template Transform(N,C, I, O) {
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
    
    signal input inputPackedAddressesPrivate[I];
    signal input inputIdRemaindersPrivate[I];
    signal input inputValuesPrivate[I];
    signal input outputPackedAddressesPrivate[O];
    signal input outputIdRemaindersPrivate[O];
    signal input outputValuesPrivate[O];
    
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
    assert(recipientAddress == 0);

    // Check that the first nullifier is different than zero
    assert(nullifiers[0] != 0);

    // Convert the nullifiers values to numbers and calculate its sum
    var nullifiersSum = 0;
    for (var i = 0; i < N; i++) {
        nullifiersSum += nullifiersValues[i];
        var nullifierValueBits[254] = Num2Bits(254)(nullifiersValues[i]);
        nullifierValueBits[253] === 0;
        nullifierValueBits[252] === 0;
    }
    
    // Convert the commitment values to numbers and calculate its sum
    // ignore the last commitment since it is for the output token
    var commitmentsSum = 0;
    for (var i = 0; i < C - 1; i++) {
        commitmentsSum += commitmentsValues[i];
        var commitmentValueBits[254] = Num2Bits(254)(commitmentsValues[i]);
        commitmentValueBits[253] === 0;
        commitmentValueBits[252] === 0;
    }

    var inputValuesSum = 0;
    for (var i = 0; i < I; i++) {
      inputValuesSum += inputValuesPrivate[i];
    }

    // Check that the value holds
    nullifiersSum === commitmentsSum + fee + inputValuesSum;

    // Calculate the nullifierKeys and the zkpPublicKeys from the root key
    var nullifierKeys, zkpPublicKeys[2];
    (nullifierKeys, zkpPublicKeys) = CalculateKeys()(rootKey);

    // commitment order
    // inputs -> fee -> outputs
    
    // verify the input tokens
    for (var i = 0; i < I; i++) {
      // Check that the top most two bits of all packed ercAddresses are equal to 1
      var ercAddressBits[254] = Num2Bits(254)(inputPackedAddressesPrivate[i]);
      ercAddressBits[253] === 1;
      ercAddressBits[252] === 1;

      // Check that the values do not overflow
      var valuePrivateBits[254] = Num2Bits(254)(inputValuesPrivate[i]);
      valuePrivateBits[253] === 0;
      valuePrivateBits[252] === 0;

      // Check that the input nullifiers are valid
      var checkInputNullifier = VerifyNullifiers(1)(inputPackedAddressesPrivate[i], inputIdRemaindersPrivate[i], nullifierKeys, zkpPublicKeys, [nullifiers[i]], [roots[i]], [nullifiersValues[i]], [nullifiersSalts[i]], [paths[i]], [orders[i]]);
      checkInputNullifier === 1;

      // Check that input commitments are valid
      var checkInputCommitment = VerifyCommitmentsOptional(1)(inputPackedAddressesPrivate[i], inputIdRemaindersPrivate[i], [commitments[i]], [commitmentsValues[i]], [commitmentsSalts[i]], [recipientPublicKey[i]]);
      checkInputCommitment === 1;
    }

    // Check that the fee nullfier is valid
    var checkFeeNullifier = VerifyNullifiers(1)(feeAddress, 0, nullifierKeys, zkpPublicKeys, [nullifiers[I]], [roots[I]], [nullifiersValues[I]], [nullifiersSalts[I]], [paths[I]], [orders[I]]);
    checkFeeNullifier === 1;
    
    // Check that the fee Commitment is valid
      var checkFeeCommitment = VerifyCommitmentsOptional(1)(feeAddress, 0, [commitments[I]], [commitmentsValues[I]], [commitmentsSalts[I]], [recipientPublicKey[I]]);
      checkFeeCommitment === 1;

    // verify the output tokens
    for (var i = 0; i < O; i++) {
      // Check that the top most two bits of all packed ercAddresses are equal to 1
      var ercAddressBits[254] = Num2Bits(254)(outputPackedAddressesPrivate[i]);
      ercAddressBits[253] === 1;
      ercAddressBits[252] === 1;

      // Check that the values do not overflow
      var valuePrivateBits[254] = Num2Bits(254)(outputValuesPrivate[i]);
      valuePrivateBits[253] === 0;
      valuePrivateBits[252] === 0;
      
      // There are no nullifiers for the output tokens
      
      // Check the output commitments
      var checkOutputCommitment = VerifyCommitments(1)(outputPackedAddressesPrivate[i], outputIdRemaindersPrivate[i], [commitments[I+1+i]], [commitmentsValues[I+1+i]], [commitmentsSalts[I+1+i]], [recipientPublicKey[I+1+i]]);
      checkOutputCommitment === 1;
    }
}

component main {public [value, fee, circuitHash, tokenType, historicRootBlockNumberL2, tokenId, ercAddress, recipientAddress, commitments, nullifiers, compressedSecrets,roots, feeAddress]} = Transform(3, 4, 2, 1);

