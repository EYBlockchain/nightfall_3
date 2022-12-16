pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/escalarmulfix.circom";

/**
 * Calculates the nullifier Keys and the zkp Public Keys from the rootKey
 * @input rootKey - {Field} - key from which the other keys are derived
 */
template CalculateKeys() {
    signal input rootKey;

    signal output nullifierKeys;
    signal output zkpPublicKeys[2];

    var private_key_domain = 2708019456231621178814538244712057499818649907582893776052749473028258908910;
    var nullifier_key_domain = 7805187439118198468809896822299973897593108379494079213870562208229492109015;

    // Calculate the zkp private key
    var zkpPrivateKeys = Poseidon(2)([rootKey, private_key_domain]);
   
    // Calculate nullifier key
    nullifierKeys <== Poseidon(2)([rootKey, nullifier_key_domain]);
       
    // Calculate the zkp public key from the nullifier one
    zkpPublicKeys <== EscalarMulFix(256, 
    [16540640123574156134436876038791482806971768689494387082833631921987005038935, 
    20819045374670962167435360035096875258406992893633759881276124905556507972311])(Num2Bits(256)(zkpPrivateKeys)); 
}