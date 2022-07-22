# Adversary

Nightfall adversary is meant to be an adversarial block proposer that creates a combination of good and bad blocks. This is built for testing purposes. It is created using generative metaprogramming by copying nightfall-optimist code and injecting the code that creates bad blocks and bad transactions during block creation and transactions selection respectively. It creates blocks of type

- ValidBlock
- ValidTransaction
- IncorrectTreeRoot
- IncorrectLeafCount
- DuplicateCommitment
- DuplicateNullifier
- IncorrectProof

## How to build nightfall adversary

In the root folder, call
```
npm run build-adversary
```
This will create nightfall-adversary source code in `test/adversary/nightfall-adversary`.

To run a container of adversary during deployment of nightfall, specify `-a`
```
./start-nightfall -g -a
```

## How to test

To start the test,
```
npm ci
npm run adversary-test
```

If the test runs successfully, it means that a user has the correct balance after accommodating for good/bad blocks proposed and rollbacks from bad blocks that contain the user's transaction. Bad block types to be used in this tes are defined in files *`test/adversary/adversary-code/database.mjs`* and *`test/adversary/adversary-code/block.mjs`*. A successful test run also implies that a challenger has spotted these bad blocks and challenged them successfully.

This functionality is tested by `adversary-test` job in `check-PRs.yml` github action for every PR.

## Note

The nightfall adversary code is written such that it picks bad block or bad transaction type in the order as defined in `database.mjs` and `block.mjs` files. This order avoids the adversary from randomly picking

- `DuplicateNullifier` when there are no spent transactions whose nullifiers can be duplicated
- `DuplicateCommitment` when there are no transactions to duplicate
- `IncorrectLeafCount` when there is no prior block
- `IncorrectTreeRoot` when there are no 2 prior blocks

This logic will later be replaced such that type of bad block to be generated will be picked automatically and randomly by nightfall adversary. This update depends on having a script that seeds the deployment with the first two L2 blocks and at least two transfers in the second blocks. This is being handled in the [issue](https://github.com/EYBlockchain/nightfall_3/issues/521)
