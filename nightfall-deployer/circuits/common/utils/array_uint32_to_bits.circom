pragma circom 2.1.0;

include "../../../node_modules/circomlib/circuits/bitify.circom";

template ArrayUint32ToBits(N) {
    signal input in[N];
    signal output out[32*N];

    for(var i = 0; i < N; i++) {
        var bits32[32] = Num2Bits(32)(in[i]);
        for(var j = 0; j < 32; j++) {
            out[32*i + j] <== bits32[j];
        }
    }    
}