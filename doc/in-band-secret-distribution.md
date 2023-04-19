# In Band Secret Distribution

## Overview

To ensure a recipient receives the secret information required to spend their commitment, the sender
encrypts the secrets (salt, value, tokenId, ercAddress) of the commitment sent to the recipient and
proves using zkp that they encrypted this correctly with the recipient's public key. We use the 
KEM-DEM hybrid encryption paradigm.

## KEM-DEM Hybrid Encryption

### Key Creation

Use Elliptic curve (here we use Baby Jubjub curve) `E` over a finite field `Fp` where `p` is a large
prime and `G` is the generator.

Alice generates a random ephemeral asymmetric key-pair $(x_e, Q_e)$:  
$$ x_e \; \leftarrow\; \{0, 1\}^{256} \qquad Q_e \coloneqq x_eG $$

These keys are only used once, and are unique to this transaction.

### Encryption

The encryption process involves 2 steps: a KEM step to derive a symmetric encryption key from a shared secret, and a DEM step to encrypt the plaintexts using the encryption key.

### Key Encapsulation Method (Encryption)
Using the previously generated asymmetric private key, we obtain a shared secret, $key_{DH}$, using standard Diffie-Hellman. This is hashed alongside the ephemeral public key to obtain the encryption key.
$$ key_{DH} \coloneqq x_eQ_r \qquad key_{enc} \coloneqq H_{K}(key_{DH} \; + \;Q_e)$$

where  
$Q_r$ is the recipient's public key  
$H_{K}(x) \coloneqq \text{MIMC}(Domain_{K}, x)$  
$Domain_{K} \coloneqq \text{to\_field}(\text{SHA256}(\text{'nightfall-kem'}))$


### Data Encapsulation Method (Encryption)
For circuit efficiency, the encryption used is a block cipher in counter mode where the cipher algorithm is a mimc hash. Given the ephemeral keys are unique to each transaction, there is no need for a nonce to be included. The encryption of the $i^{th}$ message is as follows:  

$$ c_i \coloneqq H_{D}(key_{enc} + i) + p_i$$  

where  
$H_{D}(x) \coloneqq \text{MIMC}(Domain_{D}, x)$  
$Domain_{D} \coloneqq \text{to\_field}(\text{SHA256}(\text{'nightfall-dem'}))$   

The sender then provides the recipient with $(Q_e, \text{ciphertexts})$. These are included as part of the transaction struct sent on-chain.

### Decryption
In order to decrypt, the recipient performs a slightly modified version of the KEM-DEM steps.
### Key Encapsulation Method (Decryption)
Given $Q_e$, the recipient is able to calculate the encryption key locally by performing the following steps.

$$key_{DH} \coloneqq x_eQ_e \qquad key_{enc} \coloneqq H_{K}(key_{DH} \; + \;Q_e)$$  

where  
$Q_e$ is the ephemeral public key  
$H_{K}(x) \coloneqq \text{MIMC}(Domain_{K}, x)$  
$Domain_{K} \coloneqq \text{to\_field}(\text{SHA256}(\text{'nightfall-kem'}))$

### Data Encapsulation Method (Decryption)
With $key_{enc}$ and an array of ciphertexts, the $i_{th}$ plaintext can be recovered with the following:  

$$p_i \coloneqq c_i - H_{D}(key_{enc} + i)$$  

where  
$H_{D}(x) \coloneqq \text{MIMC}(Domain_{D}, x)$  
$Domain_{D} \coloneqq \text{to\_field}(SHA256(\text{'nightfall-dem'}))$


## Derivation and generation of the various keys involved in encryption, ownership of commitments and spending

Using BIP39 generate a 12 word `mnemonic` and from this generate a `seed` by calling `mnemonicToSeedSync`.
Then following the standards of BIP32 and BIP44, generate a `rootKey` based on this `seed` and `path`.

```
zkpPrivateKey = mimc(rootKey, 2708019456231621178814538244712057499818649907582893776052749473028258908910)
where 2708019456231621178814538244712057499818649907582893776052749473028258908910 is keccak256(`zkpPrivateKey`) % BN128_GROUP_ORDER

nullifierKey = mimc(rootKey, 7805187439118198468809896822299973897593108379494079213870562208229492109015n)
where 7805187439118198468809896822299973897593108379494079213870562208229492109015n is keccak256(`nullifierKey`) % BN128_GROUP_ORDER

zkpPublicKey = zkpPrivateKey * G
```

The apps which will use the `ZkpKeys` to generate these keys can store the `rootKey` in different devices by splitting
this into shares using Shamir Secret Sharing. If either `rootKey` or `mnemonic` is compromised, then the adversary
can calculate the `zkpPrivateKey` and `nullifierKey`. The `zkpPrivateKey` can be used to decrypt secrets of a commitment
whilst the `nullifierKey` can be used to spend the commitment. Hence `rootKey` and `mnemonic` must be stored very securely.
It is also recommended to store `zkpPrivateKey` and `nullifierKey` separately to avoid theft of commitments in case one of these
is compromised.
