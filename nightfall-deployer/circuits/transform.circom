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
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

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
 * @input packedOutputAddressesPrivate - {Array[Field]} 
 * @input packedOutputIdRemaindersPrivate - {Array[Uint256]} 
 */

template Transform(N,C) {
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
    
    signal input inputPackedAddressesPrivate[N];
    signal input inputIdRemaindersPrivate[N];

    signal input outputPackedAddressesPrivate[C];
    signal input outputIdRemaindersPrivate[C];
    
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

    // check that none of the values overflow
    for (var i = 0; i < N; i++) {
      var nullifierValueBits[254] = Num2Bits(254)(nullifiersValues[i]);
      nullifierValueBits[253] === 0;
      nullifierValueBits[252] === 0;
    }
    for (var i = 0; i < C; i++) {
      var commitmentValueBits[254] = Num2Bits(254)(commitmentsValues[0]);
      commitmentValueBits[253] === 0;
      commitmentValueBits[252] === 0;
    }

    // check the fee nullifiers and fee commitments by looking at the input addresses
    var feeNullifiersSum = 0;
    for (var i = 0; i < N; i++) {
      var isFee = inputPackedAddressesPrivate[i] == feeAddress;
      feeNullifiersSum += nullifiersValues[i] * isFee;
    }

    var feeCommitmentSum = 0;
    for (var i = 0; i < C; i++) {
      var isFee = outputPackedAddressesPrivate[i] == feeAddress;
      feeCommitmentSum += commitmentsValues[i] * isFee;
    }

    // Check that the value holds
    var feeIsCovered = feeNullifiersSum - feeCommitmentSum - fee;

    // Calculate the nullifierKeys and the zkpPublicKeys from the root key
    var nullifierKeys, zkpPublicKeys[2];
    (nullifierKeys, zkpPublicKeys) = CalculateKeys()(rootKey);

    // Check the nullifiers
    for (var i = 0; i < N; i++) {
      // Check that the top most two bits of all packed ercAddresses are equal to 1
      // Unless the address is the fee address or zero
      var ercAddressBits[254] = Num2Bits(254)(inputPackedAddressesPrivate[i]);

      var isFee = IsEqual()([inputPackedAddressesPrivate[i], feeAddress]);
      var isL2 = AND()(ercAddressBits[253], ercAddressBits[252]);


      // the only types of valid nullifiers are L2 and fee
      // if a provided commitment falls outside these two categories
      // verify nullifiers will fail unless the value is 0
      var isSet = XOR()(isFee, isL2);

      // Check that the input nullifiers are valid
      var checkInputNullifier = VerifyNullifiersOptional(1)(
        inputPackedAddressesPrivate[i] * isSet, 
        inputIdRemaindersPrivate[i], 
        nullifierKeys, 
        zkpPublicKeys, 
        [nullifiers[i]], 
        [roots[i]], 
        [nullifiersValues[i]], 
        [nullifiersSalts[i]], 
        [paths[i]], 
        [orders[i]]
      );
      checkInputNullifier === 1;
    }

    // verify the commitments 
    for (var i = 0; i < C; i++) {
      // Check that the top most two bits of all packed ercAddresses are equal to 1
      // Unless the address is the fee address or zero
      var ercAddressBits[254] = Num2Bits(254)(outputPackedAddressesPrivate[i]);

      var isFee = IsEqual()([outputPackedAddressesPrivate[i], feeAddress]);
      var isL2 = AND()(ercAddressBits[253], ercAddressBits[252]);

      var isSet = XOR()(isFee, isL2);

      // Check the output commitments
      var checkOutputCommitment = VerifyCommitmentsOptional(1)(
        outputPackedAddressesPrivate[i] * isSet,
        outputIdRemaindersPrivate[i],
        [commitments[i]], 
        [commitmentsValues[i]], 
        [commitmentsSalts[i]], 
        [recipientPublicKey[i]]
      );
      checkOutputCommitment === 1;
    }
}

component main {public [value, fee, circuitHash, tokenType, historicRootBlockNumberL2, tokenId, ercAddress, recipientAddress, commitments, nullifiers, compressedSecrets,roots, feeAddress]} = Transform(4, 6);

