pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/escalarmulany.circom";
include "../../../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../../../node_modules/circomlib/circuits/bitify.circom";

/**
 * Calculates the shared encryption Key
 * @input ephemeralKey[256] - {Array[Bool]} -
 * @input recipientPub[2] - {Array[Field]} - public key of the recipient
 */
template Kem() {
    signal input ephemeralKey[256];
    signal input recipientPub[2];

    signal output encryptionKey;

    // Calculate the shared secret
    var sharedSecret[2] = EscalarMulAny(256)(ephemeralKey, recipientPub);

    // domain_kem = field(SHA256('nightfall-kem'))
    var domain_kem = 21033365405711675223813179268586447041622169155539365736392974498519442361181;

    // Calculate the encryption key
    encryptionKey <== Poseidon(3)([sharedSecret[0], sharedSecret[1], domain_kem]);
}

/**
 * Encrypt the plain texts using the encryption key
 * @param N - number of plain texts to encrypt
 * @input encryption key - {Field} - Key used to encrypt the plain texts
 * @input plainText[N] - {Array[Field]} - array of fields that will be encrpyted
 */
template Dem(N) {
    signal input encryptionKey;
    signal input plainText[N];

    signal output cipherText[N];

    // domain_dem = field(SHA256('nightfall-dem'))
    var domain_dem = 1241463701002173366467794894814691939898321302682516549591039420117995599097;

    for(var i = 0; i < N; i++) {
        //Encrypt each field using the encryption key
        var poseidon = Poseidon(3)([encryptionKey, domain_dem, i]);
        cipherText[i] <== poseidon + plainText[i];
    }
}

/**
 * Implements the KemDem algorithm: Calculates the shared encryption Key and then encrypts the fields
 * @param N - number of plain texts to cipher
 * @input ephemeralKey - {Array[Bool]} -
 * @input recipientPub[2] - {Array[Field]} - public key of the recipient
 * @input plainText[N] - {Array[Field]} - array of fields that will be encrpyted
 */
template KemDem(N) {
    signal input ephemeralKey;
    signal input recipientPub[2];
    signal input plainText[N];

    signal output cipherText[N];
    signal output ephemeralPublicKey[2];

    // Get the binary representation of the ephemeral Key
    var ephemeralKeyBits[256] = Num2Bits(256)(ephemeralKey);
   
    // Calculate the encryption key
    var encryptionKey = Kem()(ephemeralKeyBits, recipientPub);
    
    // Encrpyt the plain texts using the encryption key
    cipherText <== Dem(N)(encryptionKey, plainText);
    
    // Calculate the ephemeral Public key
    ephemeralPublicKey <== EscalarMulFix(256, 
        [16540640123574156134436876038791482806971768689494387082833631921987005038935, 
        20819045374670962167435360035096875258406992893633759881276124905556507972311])(ephemeralKeyBits);
}