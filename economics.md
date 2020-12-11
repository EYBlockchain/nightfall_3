# How the economics work

This explanation is built on some experimentally determined numbers and some assumptions about how
the various actors will be incentivised.

## Incentives and Rewards

### The Proposer

The Proposer is incentivised by making money from fees paid by Transactors. Proposers are bonded and
their fee income may be viewed as a return on capital invested as their bond, minus their ongoing
costs of computation:

```
r_p = (f - c_p) / b
```

Where: `r_p` is the Proposer's rate of return; `f` is the fee income over the period in question;
`c_p` the compute cost over the same period; and `b` the bond amount. Note that the Proposer's
income is not risk-free because, although the calculations they must do to be paid are entirely
deterministic and thus should never be incorrect, there is a possibility that another Proposer will
create a bad block, on which they build. If the risk free rate of return is `R` and they require and
extra return, `P`, to compensate them for the risk to their capital, then we require:

```
r > R + P
```

### The Challenger

The Challenger is incentivised by making money from exposing incorrect proposals. They must stake an
amount of money `s` to challenge and, if their challenge is correct, they get paid the value of the
Proposer's bond, minus their stake (we could change that, but that's how it's currently coded).
Thus, their profit, `p`, in a given period is:

```
p = n_c * (b - s) - c_c
```

Where: `n_c` is the number of successful challenges they make in the period; and `c_c` is their
compute cost. Note that their endeavour is risk-free; their calculations are entirely deterministic
and the only capital investment is their stake for the challenge period `t`. Thus their requirements
are:

```
p/(n_c * s * t) > R
=> [n_c * (b-s) - c_c]/(n_c * s * t) > R
```
