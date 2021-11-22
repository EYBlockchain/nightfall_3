<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Building and testing nightfall-client](#building-and-testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-adversary

This introduces a service called nightfall-adversary which will only be used for writing bad block
tests. This removed the need for creating bad blocks at an application level and makes it easier to
write positive and negative tests for nightfall with its native optimist services (suggestion to
merge adversary into optimist below). Adversary is similar to optimist in most ways except at any
time can be given a block config by calling the endpoint `/proposer/config` which provides a list of
block types to be created by the adversary

The various types are

```
- 'ValidBlock'
- 'IncorrectRoot'
- 'DuplicateTransaction'
- 'InvalidDepositTransaction'
- 'IncorrectHistoricRoot'
- 'IncorrectProof'
- 'DuplicateNullifier'
- 'IncorrectLeafCount'
```

An example of how the block config could look

```
const blockConfig = [
  'ValidBlock',
  'ValidBlock',
  'IncorrectRoot',
  'DuplicateTransaction',
  'InvalidDepositTransaction',
  'IncorrectHistoricRoot',
  'IncorrectProof',
  'DuplicateNullifier',
  'IncorrectLeafCount',
  'ValidBlock',
];
```

Adversary also has the capacity to ignore `IncorrectHistoricRoot` and `DuplicateNullifier` if there
are no transfer or withdraw transactions in mempool. It will retain this config to apply on a later
block. If no block config is submitted or if the block config is empty, adversary will continue to
make valid blocks.

Look at the `adversary-script.mjs` to see how to instantiate a nightfall adversary app and send
block config. This can be run by calling `npm run adv`. Negative tests using nightfall-adversary can
use the following tools

- `waitForProposer` - registers proposer and waits for this proposer to be current proposer again
  after they are removed due to a successful challenges
- `waitForSufficientBalance` - waits for sufficient balance from pending transactions or creates a
  deposit with sufficient balance, that could be used before a transfer transaction.
