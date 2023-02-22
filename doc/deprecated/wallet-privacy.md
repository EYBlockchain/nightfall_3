# Maintaining Privacy with the Nightfall Wallet

When used correctly, the Nightfall wallet can provide fully private transfers
of ERC20 tokens. However, correct use is important. This document describes how to
achieve that.

Nightfall is tested on a Chrome browser. During Beta, mileage may vary on
other browsers.

## Privacy of commitments

Zero Knowledge proofs are computed in the browser, so that your secret keys remain with you, and the
wallet keeps track of any commitments that you own, in its IndexedDb.
Anyone with access to this data can find out which commitments you own, although
they can't steal them without your keys. Keys are only decrypted when you enter the
mnemonic. Thus you should only use the wallet on a machine which you trust.

For now, this data is _not_ exported anywhere. Thus, if you use a browser on a different
machine, you will not have access to your commitments unless you transfer the IndexedDB
contents. We may change this in future, depending on Beta feedback. It's a security versus
convenience debate.

## On-Chain privacy

Recall that Nightfall has three parts to its token lifecycle:

1. Deposit of conventional ERC20 tokens from Ethereum (Layer 1) into the Nightfall
Layer 2.
2. UTXO-like transfer within Layer 2, including possible receipt of change if the
transferred amount is less than the input amount.
3. Withdraw of tokens from Layer 2 to Layer 1.

It's important to understand that Deposit and Withdraw transactions *are not private*. That is because
they interact with Layer 1 and Layer 1 is not private. This means that everyone knows if you
create a Layer 2 commitment and how much it contains. Likewise, if you return a token back
to Layer 1 by destroying a Layer 2 commitment, everyone knows who received it and how much.

Privacy comes entirely from transfers within Layer 2. From the point of view of the
Ethereum blockchain, these are fully private. The only data leaked is your IP address when
you send a transfer transaction to a Block Proposer. 

Remember too that ZKP privacy solutions are, essentially, decentralised coin tumblers, and so privacy
comes from hiding in a crowd.

From this discussion, we can infer some dos and don'ts:

### Dos and don'ts

- Don't deposit a very unique coin value (e.g. 3.1415 USDC) and then withdraw the same
amount. People will be able to guess who you probably sent it to. Likewise don't deposit and
withdraw exceptionally large values.
- Do withdraw different amounts from what you deposit. This makes it harder to guess who you paid.
- Do wait awhile. You should ensure that there are at least a few other transactions between the
deposit and withdraw. If there are no other transactions in the time you make a deposit and withdraw,
people may be able to guess that they are connected.
- Don't make regular or predictable transactions. For example, if a deposit from a particular Ethereum address is always
made at 12:01 on the first of the month and a withdraw is always made to a particular Ethereum
address at 12:05 on the second of the month people may guess that they are related;
 you expose yourself to statistical analysis even if the amounts are uncorrelated.
