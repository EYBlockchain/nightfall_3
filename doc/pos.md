## Nightfall PoS

Using a similar approach to Polygon proposer selection protocol, with proposer set based on staking,
and Tendermint's proposer selection algorithm, Nightfall will select next proposer.

Terminology:

- **Slots**. Units assigned to proposers based on their stake.
- **Sprint**. The time a proposer is proposing blocks being the current proposer. It will be the
  equivalent as ROTATE_PROPOSER_BLOCKS (L1 blocks).
- **Span**. Unit composed of various sprints in which we use the same proposer set for the Weighted
  Round Robin algorithm to select next current proposer.
- **Proposer set**. Proposers with calculated weights that will be proposers during the sprints of
  next span.
- **Proposer set count**. After shuffling the slots, we take this number of slots to build the
  proposer set.

We need a shuffling the slots at the begining of each span in order to introduce some randomness in
the proposer selection process.

Similar to Polygon approach we define these initial numbers that could be configured by the multisig
administrator contract:

- Minimum stake will be 20K MATIC.
- Block stake every time the proposer propose a block will be 200 MATIC.
- Each proposer slot will be the calculated from the biggest stake divided by 10 in order to have 10
  slots maximum for the proposer with the biggest stake. **1 Slot = MaxProsposerStake / 10 MATIC**
- Proposer set for each span will be built from 10 slots after shuffling all the slots. (Random
  shuffling is employed by Ethereum 2.0 too. It helps to mitigate DoS attacks and collusion among
  nodes) **Proposer set = 10 slots**
- Span will have 10 sprints for a complete rotation of the proposer set. The same number as proposer
  set count. **Span = 10 Sprints**
- Sprint will be equal to ROTATE_PROPOSER_BLOCKS = 32. Probably we could increase this in mainnet.
  **Sprint = 32 Blocks**.
- We will take into account to block the stake of the proposer for the blocks that are still pending
  in the CHALLENGE_PERIOD of the proposer so it could be slashed in case of bad blocks to cover this
  slash. And in the next span this proposer will have less staking power. (total stake - blocked
  stake). Once the CHALLENGE_PERIOD of the block proposed is over then this stake will be restored
  to the proposer. More less in the same way as now but in this case the payment is based on the
  proposer stake instead of paying in every transaction of the block proposed directly.
- If changes are made to the staking of the proposers, we will take this into account in next span
  and not in the current span.

#### Example

- Let's suppose we have 3 proposers, and they are Alice, Bill and Clara.
- Alice staked 5K Matic tokens whereas Bill and Clara staked 2K Matic tokens.
- We define 1K Matic per slot to define the staking power.
- All the proposers are given these slots [ A, A, A, A, A, B, B, C, C ]
- Using historical Ethereum block data as seed, we shuffle this array.
- After shuffling the slots using the seed, say we get this array [ A, B, A, A, C, B, A, A, C]
- Now we pop 5 proposers slots from the top defined by proposer set as [ A, B, A, A, C]
- Hence the proposer set is defined as [ A: 3, B:1, C:1 ].
- Using this proposer set and tendermint's proposer selection algorithm based on the Weighted Round
  Robin we choose a proposer for every sprint (5 sprints for 1 span defined). In every sprint the
  current proposer is proposing blocks during ROTATE_PROPOSER_BLOCKS.

A model that gives a good intuition on how / why the selection algorithm works and it is fair is
that of a priority queue. The proposers move ahead in this queue according to their voting power
(the higher the voting power the faster a proposer moves towards the head of the queue). When the
algorithm runs the following happens:

- All proposers move "ahead" according to their powers: for each proposer, increase the priority by
  the voting power
- First in the queue becomes the proposer: select the proposer with highest priority
- Move the proposer back in the queue: decrease the proposer's priority by the total voting power

## How the economics work

The proposal of the different actors profitability and fees are explained below.

### The Proposer

- Proposer profitability: Fees collected from transfers in L2 block.
  $$
  ProposerProfit = Fee_{tx}·txPerBlock-blockPropose_{gasCost}·gasPrice
  $$
  $$
  RoCE_{perBlock}=\frac{ProposerProfit}{(blockPropose_{gasCost}·gasPrice)+blockStake}
  $$
- Proposers should need a stake to guarantee possible block challenges or idle situation while they
  are proposing blocks.
  $$
    {StakeNeeded} = {idleProposerStake}+\,(blocksCp·blockStake)
  $$
  Where _StakeNeeded_ is the stake needed to cover all these possible penalizations,
  _idleProposerStake_ is the equivalent to the current minimum stake when register, _blocksCp_ are
  the blocks in the CHALLENGE*PERIOD still pending for this proposer and \_blockStake* is the
  BLOCK_STAKE that now proposers are submitting in every block proposal. So the stake the proposer
  has in the State contract is used for the weighted round robin algorithm to select next proposer
  and if you have more amount staked you have higher probability to be elegible as next proposer,
  but also you have to guarantee that you have a minimum amount staked to propose new blocks if they
  are still in the CHALLENGE_PERIOD and are suitable for a challenge. We will manage this blocked
  stake to cover possible challenges.
- The proposer will be incentivated to stake more amount of MATIC as it will increase the
  probability to propose blocks in a Weighted Round Robin algorithm.

### The Challenger

- Challengers profitability.
  $$
    ChallengerProfit_{challengeSuccess} = blockStake-(challenge_{gasCost}·gasPrice)
  $$
  $$
  RoCE_{perChallengeSuccess} = \frac{ChallengerProfit_{challengeSuccess}}{challenge_{gasCost}·gasPrice}
  $$
  $$
  blockStake >> (challenge_{gasCost}·gasPrice)
  $$
  This $blockStake$ will be slashed from the stake of the proposer in case of successful challenge.
  So the proposer will lose this amount of the staking and also will lose power in the weighted
  round robin algorithm for next span as it would be calculated with the adjustment of the new stake
  amount that is less than before. If now is the current proposer he will lose also the turn because
  it will be removed from the proposer set.
- This _blockStake_ should be enough to be interesting for the challenger to create challenges.

## References

- https://wiki.polygon.technology/docs/maintain/validator/core-components/proposers-producers-selection
- https://docs.tendermint.com/master/spec/consensus/proposer-selection.html
