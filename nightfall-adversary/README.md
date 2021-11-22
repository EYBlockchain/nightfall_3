<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Building and testing nightfall-client](#building-and-testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-adversary

This introduces a service called nightfall-adversary which will only be used for writing bad block
tests. Adversary is similar to optimist but at any time can be given a block config by calling the
endpoint `/proposer/config` Block config is an array of block types that the adversary has to
create. The various types are

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
  'IncorrectPublicInputHash',
  'IncorrectProof',
  'DuplicateNullifier',
  'IncorrectLeafCount',
  'ValidBlock',
];
```

Adversary also has the capacity to ignore `IncorrectHistoricRoot` and `DuplicateNullifier` if there
are no transfer or withdraw transactions in mempool. It will retain this and use later. If no block
config is submitted or if the block config is empty, adversary will continue to make valid blocks

Look at the `sdk-neg-http.mjs` to see how to instantiate a nightfall adversary app and send block
config. Negative tests using nightfall-adversary can use the following tools

- `waitForProposer` - registers proposer and waits for this proposer to be current proposer again
  after they are removed due to a successful challenges
- `waitForSufficientBalance` - waits for sufficient balance from pending transactions or creates a
  deposit with sufficient balance, that could be used before a transfer transaction.
