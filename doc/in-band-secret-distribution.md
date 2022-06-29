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

Using BIP39 genenerate a 12 word `mnemonic` and from this generate a `seed` by calling `mnemonicToSeedSync`.
Then following the standards of BIP32 and BIP44, generate a `rootKey` based on this `seed` and `path`.

```
zkpPrivateKey = mimc(rootKey, 2708019456231621178814538244712057499818649907582893776052749473028258908910)
where 2708019456231621178814538244712057499818649907582893776052749473028258908910 is keccak256(`zkpPrivateKey`) % BN128_GROUP_ORDER

nullifierKey = mimc(rootKey, 7805187439118198468809896822299973897593108379494079213870562208229492109015n)
where 7805187439118198468809896822299973897593108379494079213870562208229492109015n is keccak256(`nullifierKey`) % BN128_GROUP_ORDER

zkpPublicKey = zkpPrivateKey * G
```

The apps which will use the `zkpKeys` to generate these keys can store the `rootKey` in different devices by splitting
this into shares using Shamir Secret Sharing. If either `rootKey` or `mnemonic` is compromised, then the adversary
can calculate the `zkpPrivateKey` and `nullifierKey`. The `zkpPrivateKey` can be used to decrypt secrets of a commitment
whilst the `nullifierKey` can be used to spend the commitment. Hence `rootKey` and `mnemonic` must be stored very securely.
It is also recommended to store `zkpPrivateKey` and `nullifierKey` separately to avoid theft of commitments in case one of these
is compromised. 
