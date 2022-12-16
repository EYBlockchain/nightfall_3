pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/mux1.circom";

/**
 * Calculate the order in which merkle tree nodes needs to be hashes
 * @input order - {bool} - Whether the path node is the left or right one
 * @input pathNode - {Field} - 
 * @input siblingNode - {siblingNode} - 
 */
template OrderFields() {
    signal input order;
    signal input pathNode;
    signal input siblingNode;

    signal output left;
    signal output right;

    // Calculate the left element
    left <== Mux1()([pathNode, siblingNode], order);

    // Calculate the right element
    right <== Mux1()([siblingNode, pathNode], order);
}

/**
 * Calculate the root for a hash element using its siblingPath
 * @input order - {Uint32} - Order of the hash node into the tree
 * @input hash - {Field} -  
 * @input siblingPath[32] - {Array[Field]} -  
 */
template CalculateRoot() {
    signal input order;
    signal input hash;
    signal input siblingPath[32];
    signal output root;

    // Convert the order to binary
    var orderBits[32] = Num2Bits(32)(order);

    //Initialize poseidonHash variable with the initial value
    var poseidonHash = hash;

    var left, right;

    // Calculate the root using the sibling path
    for(var i = 0; i < 32; i++) {   
        (left, right) = OrderFields()(orderBits[i], poseidonHash, siblingPath[31 - i]);
        poseidonHash = Poseidon(2)([left, right]);
    }

    root <== poseidonHash;
}
