# In Band Secret Distribution

## Overview

To ensure a recipient receives the secret information required to spend their commitment, the sender
encrypts the secrets (salt, value, tokenId, ercAddress) of the commitment sent to the recipient and
proves using zkp that they encrypted this correctly with the recipient's public key. El Gamal
encryption over elliptic curves is used for encryption.

## El Gamal Encryption

### Key Creation

Use Elliptic curve (here we use Baby Jubjub curve) `E` over a finite field `Fp` where `p` is a large
prime and `G` is the generator.

Alice then selects a random private key `x` and performs:

```
Y = x . G
```

The dot product represents scalar multiplication over the curve E. A good explanation of arithmetic
over this particular curve can be found
[here](https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/baby-jubjub/baby-jubjub.html).

Alice’s pub key is `(E, p, G, Y)` which she shares this with Bob.

### Encryption

In order to perform encryption of a message `m`, we need this to be represented as a point on the
elliptic curve. We will use [Elligator 2](https://elligator.cr.yp.to/elligator-20130828.pdf) to
perform this hash to curve mapping where each `m` will be mapped to a point `M`.

For every message `M` that Bob wants to encrypt, he picks an ephemeral key `k` which is a random non
zero number in field Fp. Let us assume Bob wants to encrypt three pieces of information M1, M2 and
M3. He will generate the cipher text R0, S0, R1, S1, R2 and S2 as follows:

```
R0 = k1.G
S0 = M1 + k1.Y
R1 = k2.G
S1 = M2 + k2.Y
R2 = k3.G
S2 = = M3 + k3.Y
```

Here S0, S1 and S2 are based on point addition and scalar multiplication.

Bob then sends the cipher text `R0, S0, R1, S1, R2, S2` to Alice by passing these as public inputs
to the proof verification on chain.

### Decryption

Alice then decrypts this by using her private key `x` such as:

```
M0 = S0 - x.R0
M1 = S1 - x.R1
M2 = S2 - x.R2
```

We then use the inversion of the hash to curve which is a curve to hash as defined in Elligator 2 to
recover `m` from `M`.

## Derivation and generation of the various keys involved in encryption, ownership of commitments and spending

The names of the various keys follow the same terminology as zCash in order to make it easy for
those familiar with zCash speciifcation to follow this

Generate random secret keys `ask` and `nsk` which belong to the field with prime
`BN128_GROUP_ORDER`. `ask` will be used along with `nsk` to separate nullifying and proving
ownership. `nsk` is used in a nullifier along with the commitment. Next calculate incoming viewing
key `ivk` and diversified transmission key `pkd` as follows:

```
ivk = MiMC(ask, nsk)
pkd = ivk.G //used in a commitment to describe the owner as well as to encrypt secrets
```

Both `ask` and `nsk` will need to be securely stored separately from each other and should be rolled
from time to time. This way if one of `nsk` or `ask` is leaked, the adversary still cannot provide
proof of ownership which requires `ivk` which in turn requires knowlegde of `ask` or `nsk`
respectively. If both `ask` and `ivk` are leaked, one requires knowledge of `nsk` to nullify. If
both `nsk` and `ivk` are leaked, one requires knowledge of `ask` to show that they can derive `ivk`
to spend.

`pkd` will also be used in the encryption of secrets by a sender. This will need to be a point on
the elliptic curve and we derive this from `ivk` through scalar multiplication. `ivk` will be used
to decrypt the secrets. If `ivk` is leaked and as a result the secrets are known to the adversary,
they will still need knowledge of `ask` and `nsk` to spend a commitment.

### Acknowledgements

Some of the work for in band secret distribution is inspired by zCash. Thankful for their work in
this field.
