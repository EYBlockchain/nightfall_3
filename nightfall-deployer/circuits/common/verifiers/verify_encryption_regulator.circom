pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/pointbits.circom";

include "../utils/kem_dem.circom";

/**
 * Verifies that the encryption of the commitment preimage values for the recipient was performed properly.
 * @input cipherText[4] - {Array[Field]} - 
 * @input packedErcAddress - {Uint192} - erc address concatenated with the first 32 bytes of the token id
 * @input idRemainder - {Uint224} - 224 last bits of the token id
 * @input newCommitmentValue - {Uint252} - Value of the preimage of the new commitment
 * @input newCommitmentSalt - {Field} - Salt of the preimage of the new commitment
 * @input recipientPublicKey[2] - {Array[Field]} - Public key of the commitment's recipient
 * @input ephemeralPublicKeyCompressed[256] - {Array[Bool]} - Contains the ephemeral public key compressed
 * @input ephemeralKey - {Field} - Key used by the sender to create the shared key (KemDem)
 */
template VerifyEncryptionRegulator() {
    signal input cipherText[4];
    signal input packedErcAddress;
    signal input idRemainder;
    signal input newCommitmentValue;
    signal input newCommitmentSalt;
    signal input sharedPubSender[2];
    signal input sharedPubRecipientCompressed[256];
    signal input ephemeralKey;
    signal input nonce;

    signal output valid;
    
    var cipherTextKemDem[4], sharedPublicKey[2];
    
    // Calculate Kem Dem encryption for 3 peers including regulator
    (cipherTextKemDem, sharedPublicKey) = KemDemReg(4)(ephemeralKey, sharedPubSender, 
        [packedErcAddress, idRemainder, newCommitmentValue, newCommitmentSalt], nonce);

    // Verify that the encryption matches with the encrypted values stored in the public transaction
    cipherText[0] === cipherTextKemDem[0];
    cipherText[1] === cipherTextKemDem[1];
    cipherText[2] === cipherTextKemDem[2];
    cipherText[3] === cipherTextKemDem[3];

    // Check that the compressed ephemeral public key obtained from the kem dem algorithm matches with the one stored in the sharedPubRecipientCompressed
    // var compressedPoint[256] = Point2Bits_Strict()(sharedPublicKey);
    // compressedPoint === sharedPubRecipientCompressed;
    
    valid <== 1;

}