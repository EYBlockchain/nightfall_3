# G16 Simulation Extractability

## What is it?

The Groth-16 Zero-Knowledge Proof system has a malleability which allows an observer, given a valid
proof, to create a different but also valid proof without knowing the witness.

For example, say one user claims a token by providing a G16 proof demonstrating they have completed
some challenge. An attacker could use this malleability to provide another valid proof without
completing the challenge. Ensuring that users do not replay proofs does _not_ protect against this
kind of attack.

The proof system GM17 addresses this malleability but at the cost of longer computation time and
higher verification gas usage. We previously used GM17 for Nightfall, but switched to G16 for
efficiency.

## Attack prevention

Requiring signed proofs would protect against this attack. Since an adversary cannot change the
witness, they cannot change a signing public key (assuming it is part of that witness) and hence
have no way to create a valid signed proof. Similarly, using the prover's Ethereum address as a
public input prevents other users from exploiting their proofs. However, that user could still
malleate their _own_ proofs.

Nullifiers by design prevent double spending and replaying certain data. As long as the proof's
witness contains a unique piece of data, nullifying it ensures G16 proofs cannot be exploited.

## Application to Nightfall

In short, Nightfall's design means it cannot be attacked with the G16 malleability. The use of
nullifiers means that an attacker is prevented from spending any commitments they don't own, and
having separate circuits for minting and spending means maliciously 'replaying' a deposit
transaction is fruitless.

To explain in a bit more detail, an attacker _could_ use the malleability to create a valid but
different proof for transferring or withdrawing commitments. However, they cannot change the
commitments' nullifiers, and so their transaction will fail.

They additionally can't front-run a malleated withdraw transaction with their own address since the
recipient address is part of the witness. Similarly, they cannot change any details of a transfer,
so front-running it would only allow the original recipient access to their commitment faster.

A deposit proof has no nullifiers, but an attacker cannot force an innocent user to deposit twice or
claim any deposited tokens.

While there is no check against duplicate commitments, all an attacker could do with a malleated
deposit proof is create an identical commitment they cannot spend and deposit their own tokens for
it!

---

Thanks to @dwebchapey for research into this topic. More discussion can be found
[here](https://github.com/EYBlockchain/nightfall_3/issues/298).
