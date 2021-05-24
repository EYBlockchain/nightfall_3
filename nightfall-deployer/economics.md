# How the economics work

This explanation is built on some experimentally determined numbers and some assumptions about how
the various actors will be incentivised.

## Incentives and Rewards

### The Proposer

The Proposer is incentivised by making money from fees paid by Transactors. Proposers are bonded and
their fee income may be viewed as a return on capital invested as their bond, minus their ongoing
costs of computation:

```
r_p = (f - c_p - g_p) / b ..1
```

Where: `r_p` is the Proposer's rate of return; `f` is the fee income over the period in question;
`c_p` the compute cost over the same period, `g_p` the gas cost over the period; and `b` the bond
amount. Note that the Proposer's income is not risk-free because, although the calculations they
must do to be paid are entirely deterministic and thus should never be incorrect, there is a
possibility that another Proposer will create a bad block, on which they build. If the risk free
rate of return is `R` and they require and extra return, `P`, to compensate them for the risk to
their capital, then we require:

```
r > R + P ..2
```

### The Challenger

The Challenger is incentivised by making money from exposing incorrect proposals. They must stake an
amount of money `s` to challenge and, if their challenge is correct, they get paid the value of the
Proposer's bond, minus their stake (we could change that, but that's how it's currently coded).
Thus, their profit, `p`, in a given period is:

```
p = n_c * (b - s) - c_c - g_c ..3
```

Where: `n_c` is the number of successful challenges they make in the period; `g_c` is the gas cost
and `c_c` is their compute cost. Note that their endeavour is risk-free; their calculations are
entirely deterministic and the only capital investment is their stake for the challenge period `t`.
Thus their requirements are:

```
p/(n_c * s * t) > R
=> [n_c * (b-s) - c_c - g_c]/(n_c * s * t) > R ..4
```

### The Transactor

They are happy to pay for their transaction to be proposed and incorporated into the Shield
contract. They simply require that the fee is 'reasonable' in some way. The value of 'reasonable'
clearly depends on the motivation of the Transactor and cannot be simply determined. We can however
note that:

- The Ethereum network is heavily used, thus sufficient Transactors are prepared to pay a normal
  Ethereum fee (20kGas).
- At least some will pay a premium for privacy. Thus we conjecture that, provided the fee is not
  greater than `m` times a normal fee, where `m ~ 1`, the fee is 'reasonable'.

## Requirements for a Stable system

For the system to operate stably, Transactors must consider that the probability of them losing
money during a transaction is sufficiently low. The ZK element of this solution means that
acceptance into the Shield contract state of even one bad proposal could allow all the money in the
system to be stolen (by false creation of commitment containing all of the funds in the Shield
contract).

It thus follows that the probability of a bad proposal being unchallenged must be held close to zero
(`p_c ~ 1`, where `p_c` is the probability of challenge).

In fact it must be sufficiently close to zero that a bad proposer will not make a profit. This is
achieved when:

```
b > (1-p_c) * v ..5
```

Where v is the amount held in escrow by the Shield contract. for example, if the contract contained
1M ETH, and b = 10 ETH then `1-p_c` = 1e-5. There is a problem here though. If a bad Proposer cannot
win, then there will be no bad Poposals. Thus a Challenger could never make a profit and so there
would be no Challengers, causing `p_c` to fall. This is unfortunately not a negative feedback loop,
which would tend to constrain `p_c` such that:

```
b = (1-p_c) * v ..6
```

This is because the following happens:

Starting from a position where there are no bad proposals, the number of challenges is zero. There
are no challengers, because there is no possibility of a profit for them. Thus, eventually, by
accident or design, a bad Proposal is created. There are no Challengers to observe this however and
thus the bad proposal is accepted. The system is non-linear. There is only feedback when the rate of
bad proposals is > 0. One bad proposal is sufficient to destroy the system.

There are three possible solutions:

1. We could create deliberate but harmless bad proposals, which the Challengers would still get paid
   for finding.
2. We could run an always-on Challenger (a 'Challenger Of Last Resort'). Thus, if you trust this
   Challenger you are content to use the system. If you do not trust the Challenger Of Last Resort,
   then you can of course run your own Challenger. If you make sufficient transactions, this could
   be worthwhile and it also means the solution is not centralised. The Challenger of last resort
   has sufficient interest in the success of the project that they will continue to operate even at
   a loss.
3. We rely on the Proposers to Challenge, because they have an interest in ensuring they do not
   build on a bad block and get successfully challenged.

The first solution is problematic. How do you incentivise production of harmless bad proposals
whilst punishing production of harmful bad proposals, and yet ensure they look identical to
Challengers?

The third solution is also problematic. While Proposers are incentivised to Challenge to avoid
potential losses, rather than requiring a profit, they still may not Challenge if they see no bad
Proposals for a sufficiently long time. It's more likely they will Challenge but that's all.

Thus, we choose option 2 for further examination.

## Valuing the fees and payments

It is difficult to obtain precise values for many of the numbers above. However, we can make an
attempt.

We will make some assumptions:

1. The value held in the Shield contract does not exceed 100k ETH (~\$40M at time of writing).
1. The availability of the Challenger of Last Resort is 99.9% (1:1e3). This is high but perfectly
   achievable with conventional Web2.0 technology.
1. The Challenger Of Last Resort (CLR) expects a return of 10%
1. A Challenger can examine all proposals using a reasonable amount of cloud compute (50p/hr). We
   will soon be able to test this assumption.
1. A Proposer can check transactions and assemble them into blocks using the same reasonable amount
   of cloud compute (50p/hr)
1. There is on average 10 transactions per hour. This is rather an arbitrary figure and comes from
   averaging transaction rate for TrustToken over the last 2 1/2 hrs.
1. The Proposer expects a return on Capital of 4%. Given the CLR method we are using, the actual
   probability of a bad block is small. Thus, the risk premium `P` demanded by the Proposer should
   be small. The Proposer might arguably expect a normal Risk free return on capital of 2% (current
   Gilt rate) but dealing with zkp on a Blockchain is hardly the same as buying a guilt. A stock
   market return of 4% is more reasonable.

### The Proposer Bond

If the CLR has 99.9% availability then `1-p_c` = 1e-3. Thus the bond value b should be (eq 5)

```
b > 1e-3 \* 1e5 = 100 ETH
```

Note that the Proposer bond should ideally scale with Shield contract value.

### The Challenger's fee

We assume that there is only one CLR and no other Challengers. We ignore the CLR's gas cost because
the probability of having to make a challenge is so small (<1e-3). Thus, the cost of being a
Challenger is simply 50p/hr. So a Transactor ought to pay 5p for the Challenger's services (10
tx/hr).

### The Proposer's fee

Proposers share the fees paid out by Transactors equally (on average) because they each get the same
time to be the currentProposer. This means that there ought to be just one proposer because if there
is more than one, Transactors can reduce their fees until all the Proposers except one (the one with
the lowest compute cost) drop out of the competition. This remaining proposer will need to cover
their compute costs and gas costs, and make a reasonable return on their capital:

- compute costs 50p/hr => 5p/tx
- ROC at 4% per annum on 100 ETH @ £400/ETH = 18p/hr => 1.8p/tx
- State update costs - in the worst case we will need to store: 2 nullifiers, a new root, two
  Frontier updates. This is 20 _ 2 + 20 + 2 _ 5 = 70 kGas + 20k tx cost. This is 90kGas, including
  the tx cost. Thus, the Gas estimate ~ 100kGas/proposal (TBC by experiment). At 100GWei per Gas
  that works out at £4/tx.

### The Transactor's payment

We see from above that the Transactor has to pay ~£6 for a transaction. This is mainly the
Proposer's fee (~100kGas) plus the Transactor's Gas costs ()~30kGas measured) to post the
transaction i.e ~ 130kGas in total.

## Benefits of a rollup

The gas costs are considerably below those of a conventional Nightfall MiMC transaction (2MGas) and
even a SHA transaction (700kGas). However, given the current costs of using Ethereum, the
transaction cost is still too high for many use cases.

We could consider rolling up the transactions. This means, in effect, we will not post new state
after each transaction is proposed but only after `n` transactions. How big can `n` be? If a block
of transactions is challenged as being incorrect, then the nature of the challenge determines what
we do:

- If the challenge is one of incorrect computation (proof does not verify, public hash is
  incorrect), then we simply need to check the purportedly incorrect transaction, because there is
  no dependency on prior state.
- If the challenge is that a root or nullifier list is incorrect, then we have two choices: we can
  compute the root or list from the point of the last valid state update to the point of the
  challenge, or we can include a Merkle-root value in each transaction for the commitments and
  nullifiers, which will mean we only need to compute from the prior transaction. As these can be
  call-data, the cost of doing so is low.

This approach will reduce the cost of the Proposer's work considerably. In fact it's not clear what
the new limitation on cost would be, and rollups could be large.
