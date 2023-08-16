pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/gates.circom";

/**
 * Check that there are no duplicate commitments nor nullifiers in the same transaction
 * Note: There might be multiple zero commitments / nullifiers. 
 * @param N - number of nullifiers
 * @param C - number of commitments
 * @input nullifiers[N] - {Array[Field]} - array of nullifier hashes
 * @input commitments[C] - {Array[Field]} - array of commitment hashes
 */
template VerifyDuplicates(N, C) {
    signal input nullifiers[N];
    signal input commitments[C];
    signal output valid;

    signal r[N][N];
    signal s[C][C];


    // Check that there are no nullifiers duplicated
    for(var i = 0; i < N; i++) {
        for(var j = i+1; j < N; j++) {
            // assert(nullifiers[j] == 0 || nullifiers[i] != nullifiers[j]);
            r[i][j] <== OR()(IsZero()(nullifiers[j]), NOT()(IsEqual()([nullifiers[i], nullifiers[j]])));
            r[i][j] === 1;
        }
    }

    // Check that there are no commitments duplicated
    for(var i = 0; i < C; i++) {
         for(var j = i+1; j < C; j++) {
            // assert(commitments[j] == 0 || commitments[i] != commitments[j]);
            s[i][j] <== OR()(IsZero()(commitments[j]), IsEqual()([commitments[i], commitments[j]]));
            s[i][j] === 1;
        }
    }

    valid <== 1;
}