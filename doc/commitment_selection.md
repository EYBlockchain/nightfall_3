# Commitment Selection

Current ZKP circuits used in Nightfall_3 are restricted to 4 inputs, which are used to pay for the
transfer or withdrawal and the fees. All of those values are higher than zero. If a transactor's set
of commitment contains primarily low value commitments (dust), they may find it hard to conduct
future transfers.

**Note:** The fee is paid in MATIC in L2 for transfers and withdrawals. Usually some slots from the
input will need to be saved to pay for the fee. However, if the user is transacting MATIC, the fee
will directly be substracted from those commitments, maximizing the number of commitments the user
can use.

In order to select the best suitable commitments, the algorithm will perform as follows:

0. Get all the commitments the user own related to the transacting ercAddress and MATIC address and
   sort them by ascending value.

1. Verify if there is any combination of commitments that suits into the 4 slots

2. Select the commitments used for transacting, giving priority to use the smallest possible
   commitment as well as minimizing the change.

3. If fee is higher than 0 and the user is transacting token other than MATIC, select the
   commitments to pay for the fee

## Verifying commitments set

In order to avoid performing unnecessary calculations, the first thing the algorithm does is to
ensure that the current set of commitments the user has allows him to perform the transaction.

To do so, it first calculates the minimum number of commitments needed for the fee by checking the
highest values of the array. Then, it does the same for the value transacted taking into account the
slots already used for the fee, and checks that the total number of commitments used in this process
is <= 4.

## Selecting transaction commitments

If we reach this part of the algorithm, we are sure that there is at least one commitment subset
that satisfies our needs. When selecting a subset, the algorithm takes several things into account:

- It is always better to use a subset whose sum matches exactly the value
- While possible, it will always try to use the smallest commitments
- In addition, it will keep the change as reduced as possible

The selection is split in two:

### Determining the best commitment subset for each possible subset length

Theoretically, the user could use up to 4 commitments to pay for transaction. However, there are
some limitations:

- The user has to use at least the minimum number of commitments needed (**minC**) determined when
  doing the verification.
- The user cannot use the slots reserved for the fee commitments
- It is possible that the user has less than 4 commitments, reducing the available subsets range.

For each of the possible sizes, we will select the best combination.

To provide an example, imagine that a user has 5 commitments, and that by just using 1 commitment
for the transaction and 1 for the fee would be enough. Therefore, the algorithm would calculate a
subset of a single commitment, a subset of two commitments and a subset containing three
commitments.

For each subset size, the commitments that minimize the change will be selected.

### Ranking all the subsets

Once all the different possible subsets are calculated, the algorithm will rank all of them and pick
the best. To do so, the following rules will be applied:

- Commitments with a smaller change are better
- If two commitments have the same change, the subset with a highest length will be prioritized

The subset that is best ranked will be selected to perform the transaction.

Once the subset of commitments used for the transaction has been decided, the algorithm will repeat
the process to select the fee commitments taking into account the number of slots already filled.

**Note:** This final step will be omitted if the user is transacting MATIC
