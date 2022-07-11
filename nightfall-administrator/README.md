# Administration and the MultiSig contract

This container implements administrator functionality i.e. it enables one to call restricted
functions that are protected by the `onlyOwner` modifier. To provide further protection, `onlyOwner`
functions can only be called via a multisig contract, which in turn will only make the call
if it has been approved by a quorum of keyholders.

## Overview of operation

There are two types of role involved in the multisig. All of them have an ethereum private key but only
the executor role needs their account to have Ether:

- Approvers:  Approvers use their Ethereum private key to sign over a proposed transaction, nonce and executor address.
An EIP-712 signature is used.  This effectively give their approval for a specific transaction to be sent once
(the nonce ensures the latter) by a specific address (the executor).

- Executor: When enough Approvers have signed a transaction, the Executor gathers all the signatures and sends
the transaction and signatures to the multisig contract's `execute` function.  This function will check all the approvals
and, if satisfied, will execute the transaction, which will normally result in a function call to an
`onlyOwner` function in another contract. The multisig will have previously been set as the `Owner`.

It is allowable for an Executor to be an Approver, and this approach makes operation a little simpler.

The number of Approvers required to authorise a transaction and their Ethereum addresses are set at
contract deployment in the `default.js` config file `MULTISIG` section.

## Operation

Exec into a running administrator container (if you are running a local instance of nightfall, you can do this in a terminal with
`docker-compose exec administrator bash`). From here you can run the `./admin` application, which is used
by both the Approvers and the Executor. This will start a UI.

The UI will ask if you wish to create or add a signed transaction. If you have a transaction that an Approver
has previously signed, you can choose `add` and import it into the container's database. If not, you can
create a transaction by working through the `create` menus. When you create a signed transaction, it will be
stored in the container's database and also printed (in stringified JSON) to the terminal. You can copy it from
here and `add` it to another `./admin` instance (the reason you may want to do that is discussed later).

As soon as enough signed transactions of the same type, nonce and Executor address are stored in the database, the approval
threshold will be reached and the UI will ask for the Executor's private key. Once this is given, the transaction will be sent
to the multisig contract for execution and the process is complete.

### nonces

The multisig increments a nonce state variable each time it executes a transaction.  This nonce must be included in the signed
data that each approver creates. This prevents the Executor from being able to replay an approved transaction. However, it
means that each Approver must add the nonce to the data they sign. If they don't know the nonce, but the `administrator` container
is connected to a blockchain node on the right chain, then the `./admin` application can read it directly from the blockchain.

### testing

The application can be tested by running up a local instance of nightfall. In this case test keys are used.  For convenience, these
are copied here (they are needed for input to `./admin`):

Test addresses:

0x9C8B2276D490141Ae1440Da660E470E7C0349C63

0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0

0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9

0x4789FD18D5d71982045d85d5218493fD69F55AC4

Corresponding test private Keys:

0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e

0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d

0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb

0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6

## Security and Multiple instances

It is possible to conduct a multisig transaction using a single instance of the administrator container.
To use it this way, each Approver would exec into the container and run the `./admin` application, enter their private key and compose
the (identical) transaction. The signed transaction printed to the screen can be ignored because the transactions will
be stored in the administrator container's database. Once the approval threshold
is reached, the application will ask for the Executor's private key (which must match the Executor address that the Approvers have
been using) and, once this is entered, the transaction will be executed on the blockchain.

It may be that more signatures are created than are needed but that's ok, only the first ones will be used (enough to reach threshold).

This is easy, and useful for testing but has several drawbacks. One is that all participants must be granted access the the running administrator
container, and the other is that all their private keys are exposed on the same server.  The private keys are held only
in memory but nevertheless, compromise of this server risks exposure of all the multisig keys.

A better way to operate is for the Executor to distribute their address and the current nonce to all the Approvers
and to have them create a signed transaction by running a local instance of nightfall (strictly, only the administrator container is needed
but it expects a blockchain connection - we may remove this restriction in future). It's important that they use the supplied nonce of course.

Once an Approver has created a signed transaction, they can copy it from the screen and submit it to the Executor by any convenient means. It's
not particularly sensitive because the only information it contains is the possibility that a particular admin function may be called in
the near future. The Executor can then `add` these data to their local administrator container (which MUST be connected to the relevant blockchain).

Note that if an Executor is not an approver, they can still trigger a transaction _provided there are sufficient approvals_ in the database. If they
are not an approver, they should hit return when asked for an Approver private key.

## Removing the multisig

It may be necessary to remove control from the multisig contract.  This should be a rare event but it enables software that is not directly compatible with a multisig to be used (an example is upgrading a contract using `nightfall-deployer`)

The multisig can be removed and replaced with a single account by selecting `Transfer ownership` from the Admin menu and transferring ownership to a single account key.  Multisig approval is required to remove the multisig of course.
