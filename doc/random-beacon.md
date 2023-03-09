# How the Random Beacon value was generated

For the MPC Phase 2 setup, we use a random beacon to finalise the contributions.  This was done by posting the number of a future Ethereum mainnet block into the data field of a transaction, and then using the blockhash of the future block as the random beacon when the block came into being.

The transaction recording the posting of the blocknumber was [0x26c0872cd302b5eccd6e0e7451a5a608fdba82c9091238629b435130de3e3844](https://etherscan.io/tx/0x26c0872cd302b5eccd6e0e7451a5a608fdba82c9091238629b435130de3e3844) in block 16776388 and the future block number was 16776480 (0xfffd20).

The hash of the future block was: [0x1e0c4ac8bb3127e12c05b172c2498f5e6932bf4174b8d73e7f826d078bbe5295](https://etherscan.io/block/16776480)
