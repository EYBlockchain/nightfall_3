// globals.d.ts
declare module globalThis {
    var config = {
        BN128_GROUP_ORDER: bigint,
        BABYJUBJUB: {
            JUBJUBA: bigint,
            JUBJUBD: bigint,
            INFINITY: [bigint,bigint],
            GENERATOR: [bigint, bigint],
            JUBJUBE: bigint,
            JUBJUBC: bigint,
            MONTA: bigint,
            MONTB: bigint,
        },
        COMMITMENTS_DB: string,
        TIMBER_COLLECTION: string,
        SUBMITTED_BLOCKS_COLLECTION: string,
        TRANSACTIONS_COLLECTION: string,
        COMMITMENTS_COLLECTION: string,
        KEYS_COLLECTION: string,
        CIRCUIT_COLLECTION: string,
        CIRCUIT_HASH_COLLECTION: string,
    }
}
