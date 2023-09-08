pragma circom 2.1.2;

include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/gates.circom";

template isTokenIdZero() {
    signal input tokenId[8];
    signal output isZero;

    signal a0 <== IsZero()(tokenId[0]);
    signal a1 <== IsZero()(tokenId[1]);
    signal a2 <== IsZero()(tokenId[2]);
    signal a3 <== IsZero()(tokenId[3]);
    signal a4 <== IsZero()(tokenId[4]);
    signal a5 <== IsZero()(tokenId[5]);
    signal a6 <== IsZero()(tokenId[6]);
    signal a7 <== IsZero()(tokenId[7]);
    isZero <== AND()(AND()(AND()(a0, a1), AND()(a2, a3)), AND()(AND()(a4, a5), AND()(a6, a7)));
}