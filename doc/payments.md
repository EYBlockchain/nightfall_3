# Payments to Proposers

Proposers need paying, both for their services, and as a return on the bond that they stake.
This document explains how that happens.

## Criteria for a payment solution

1) It must be trustless - the Proposer shouldn't have to trust the user to pay
them for their services and, conversely, the user shouldn't have to trust the proposer to
process their transaction after they've taken payment.
2) Payment must not leak any information (to any party, including the Proposer) about the transaction being processed; for example
one should not be able to learn the currency being used in the underlying transaction, nor the
identity of the user, although it's fine (actually essential) to expose how much was paid to the proposer and the
currency used for the payment.
3) The Proposer must know, before processing the transaction, how much they will be paid by the user.
4) The user must have sufficient information to make a rational decision about how much
to pay a Proposer.
5) The user must not become tied to one Proposer i.e. we should not have a situation where
only one proposer is able to take payment for processing the transaction. This would increase
the risk of censorship.
6) The user must have a means to recover from a situation where the payment they offered was so low
that their transaction has become 'stuck' because no Proposer is willing to process it at the price
offered.
7) The Proposer should not have to wait longer than one finalisation period to be able to retrieve their payment.
8) The user must be able to recover their fee payment in the event of a rollback permanently removing their transaction from the
mempool.

## The need for a ZKP solution

We cannot meet the above criteria without incorporating the payment within the ZKP circuit. This is because payments made on-chain
would have to be linked to a ZKP transaction in some way (e.g. via a hash lookup table) and this leaks information about
the sender. This can of course be avoided by using third parties or directly paying a proposer.  However both these approaches
are a form of centralisation and are thus not trustless.

## ZKP approach

The approach is to include payment to a proposer within the existing Polygon-Nightfall ZKP circuits.

The amount paid must be a public variable. This is so that all Proposers can know how much the user is prepared to pay
(criterion 3 above). There is no need for the fee payment to be made in the currency of the underlying transaction, indeed this
is a bad idea because, for a Transfer transaction, it leaks information about the transaction. To save an additional public variable, we constrain
payment to be in Matic.

We must add a fee property to the Transaction struct and two extra commitments and nullifiers, the reasons for which will become apparent below. The fee property contains the amount that the proposer will receive for including the transaction in a block. It must also encode a currency bit (ETH or Matic), or the currency could be a separate property if it can be efficiently packed in the struct.

### Deposit transaction

For a deposit, , the extra public inputs are:
- the Proposer fee (ETH)

The payment sub circuit does nothing specific, it's sufficient that the proposer fee is entwined in the proof. We need this so that the
Proposer cannot change the fee shown in the Transaction struct (doing so would enable a 'proof does not verify' challenge).

The Shield contract will check that the fee in the transaction struct matches that in `msg.value`.

### Transfer and Withdraw transaction

For a Transfer transaction, the extra public inputs are:
- the Proposer fee (Matic)
- the nullifiers for two Matic commitments of total value greater than the proposer fee
- a change commitment hash for a commitment containing the difference between in value the fee and the input commitments
The extra private inputs are:
- paths to the Matic commitments which are being nullified
- ZKP Private key for those commitments
- the change commitment preimage

The sub-circuit checks that the ZKP private key confers ownership of the input fee commitments and their nullifiers, and that
the paths prove the commitments are in the commitment Merkle tree. It then checks the change commitment contains the correct value, i.e.
that it is equal to the difference between the total input fee-commitments value and the fee. finally, it checks that the payment commitments
are Matic ones (`ErcAddress = MATIC_ADDRESS`). Further checks are made for zero commitments (see last section).

### Block proposal

When a block is proposed, the proposeBlock function can calculate the total fee value for this block in ETH (Deposits) and the total fee
value in Matic (Transfers, Withdraws) directly by summing the individual transaction fees.

These values are added to the feebook running total. The feebook is a mapping which holds a `uint` payment value keyed by the `proposerAddress | blockNumberL1 | currency` (`|` is concatenation; alternatively a struct can also be defined if this is more convenient). `currency` is either `0`
for a Deposit transaction (ETH) or `1` for a Transfer of Withdraw (Matic). The fee entry in the mapping must be removed in the event of a successful challenge.
Note that if the Proposer attempts to change the fee in the transaction struct, the proof will not verify.

### Paying the Proposer

When the proposer wishes to be paid, it must call a payment function from its `proposerAddress` passing in the `blockNumberL1` from which it
wishes to be paid. The payment function will work out how much the Proposer is owed, considering only finalised blocks (it knows which entries in the feebook are final because of the `blockNumberL1` in the key - it iterates through all possible keys). The relevant feebook entries will be deleted
and the total paid out to the proposer using a withdraw pattern.

### Recovering a 'stuck' transaction

If the user has offered too little by way of a Proposer fee payment, it is possible that no proposer will process the transaction. we need a way for the
user to recover from this situation and to be able to increase the fee for the transaction to go through.

This is actually simple to arrange.  The user can just create a new transaction, which is otherwise identical to the original one but with a higher fee.  Currently, this would be rejected by Optimist as a duplicate (same commitments and nullifiers) but the will be changed by [insert issue no] and so resubmitting a transaction with a higher fee should 'just work'.

### Rollbacks

If a layer two block is successfully challenged and is rolled back then the user does not lose their fee payment.  This is because their transaction
will either go back into the L2 mempool (e.g. all deposit transactions or transfers with finalised input commitments) or, if it's a dependent transaction
(e.g. a transfer with at least one input that is not finalised), it will be deleted and the user is free to reuse the inputs.

## Zero commitments and nullifiers

A limitation of the above approach is that the transfer/withdraw circuit requires two input Matic commitments even if it would be possible to use
just one (when a commitment of value > fee is available) and it does not allow free transactions.  The latter is an important enterprise use case
where an enterprise is running a proposer node and does not wish to pay for its own transactions.

We can fix this by creating zero value commitments for commitments and nullifiers, and using those. These are defined as:
- for commitments, the `value`, `tokeId` and `hash` properties are zero
- for nullifiers, the hash property is zero

This approach works both for payment commitments and for transaction commitments, so can be used generally as an alternative to multiple,
transaction-specific circuits. The circuit checks must be modified to check that, if the value and tokeniD of an input or output commitment is zero, then:
- the commitment hash is zero
- the nullifier hash is zero for the corresponding input commitment

If these conditions are fulfilled then the path check must be skipped for the zero commitments (because they are not in the Merkle tree).

This method of encoding the commitments and nullifiers has the advantage that it is transparent to Optimist and does not result in a need for code changes (Optimist already filters out zero commitments and nullifiers). It also does not result in zero commitments being stored.  Finally, although it
requires some `if` statements in the circuit, experiment shows that the number of additional constraints this creates is minimal.
