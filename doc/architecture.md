# Nightfall_3

Nightfall_3 makes the [nightfall](https://github.com/EYBlockchain/nightfall) solution more developer
friendly and much more Gas efficient. A developer can use Nightfall_3 to make ZKP transactions
without ever having to worry about the underlying cryptography: no hashes to generate, no
commitments to manage, no salts... As far as possible it's just like transferring a conventional
ERCx token.

The use of an optimistic rollup reduces the Gas use by a factor of approximately 80. This has become
increasingly necessary in the current climate of high ETH values and high Gas costs.

You may be wondering what happened to Nightfall_2. Nightfall_2 has no rollup capability and so we
decided to move directly to Nightfall_3.

To achieve that we've made a number of changes.

- The `nightlite` library has been withdrawn. It had two main drawbacks: a developer using the
  library still had to do a _large_ amount of work to generate ZKP transactions and these required
  considerable knowledge of how ZKPs work; and the advent of the `Timber` Merkle tree manager
  required the library to access a `Timber` microservice before it could be used. This created a
  really odd dependency for the library.
- The GUI has been removed. It's pointless except as a technology demonstrator but requires
  significant code maintenance.
- The Circom components have been factored out to a separate microservice that pulls
  proof-generation work from a queue. The proof generation is the main rate limiting step (by far).
  This architecture enables easy autoscaling of Circom workers.
- A `nightfall-client` microservice has been created when enables ZKP transactions to be enacted
  with simple API calls. This is the endpoint for creating transactions with Nightfall ZKPs.

The container infrastructure is summarised in this image. Volume mounts are shown too:
![here](nightfall_3_architecture.png)

## Infrastructure

Nightfall_3 comprises five containerised microservices. These are stored in a monorepo for
convenience and can be brought up using a docker-compose yaml file for development purposes.

## The Nightfall_3 Microservices

The set of services that together form Nighfall_2 are as follows:

- _`nightfall-client`_: The endpoint for making ZKP transactions. Calls to this API allow Deposit
  (to Layer 2), Transfer (within Layer 2) and Withdraw (removal back to Layer 1). No computation of
  crypto primitives, tracking of commitments or other ZKP weirdness is required to use the service.
  Commitment data is optionally stored in a volume mounted to the `nightfall-client` so the caller
  does not need to manage this data unless they really want to. In a multi-user situation, each
  organisation/unit would deploy their own nightfall-client.
- _`circom-microservice`_: Encapsulates the Circom binary and allows interaction through simple API
  calls (`/generate-zkp-keys`, `/generate-proof`, `/verify`). The user never needs to interact
  directly with this container though. It interfaces via AMQP and operates as a worker for
  `nightfall-client`'s work queue, sharing state between all instances of the microservice. In a
  multi-user situation, each organisation/unit would deploy multiple `circom-microservices` attached
  to a `nightfall-client` and would autoscale their number. It also exposes an http interface.
- _`timber`_: The Timber microservice is similar to the existing
  [microservice](https://github.com/EYBlockchain/timber) but has additional functionality to enable
  rollback of the commitment database in the case of a successful challenge and compatibility with a
  Layer 2 Block . Timber manages an off-chain commitment Merkle tree. This approach is _much_
  cheaper than holding all of the tree on-chain. Again, the user never interacts directly with this
  container. There would be one of these for each organisation in a multiuser situation, unless more
  were required for resilience.
- _`nightfall-deployer`_: A container that initialises the Nightfall solution and then exits. It
  compiles and deploys the Solidity contracts to the blockchain, and compiles the ZKP dsls and
  performs a trusted setup. There would only ever be one ephemeral instance of `nightfall-deployer`
  for each main net deployment.
- _`nightfall-optimist`_: Is the main endpoint for Proposers and Challengers. It listens to
  blockchain events to determine when transactions have been posted (or sent directly) and
  automatically assembles them into Layer 2 Blocks when one of the Proposer addresses it is managing
  is the active Proposer. It also listens to Block proposal events and check each Layer 2 Block that
  is posted to the blockchain. If any are flawed, it automatically launches a challenge. It is
  possible to disable either of the Proposer or Challenger functionalities if required to suit
  individual implementations (for example one may wish to be a Challenger but not a Proposer or to
  use a separate pod for issuing Challenges).

Note that `nightfall_3` does not hold any Ethereum private keys, for security reasons. Therefore,
calls to its endpoints return an unsigned Ethereum Layer 1 transaction when it needs to change the
blockchain state. It expects these to be signed by the calling application and submitted to the
blockchain on its behalf. `nightfall-optimist`, `nightfall-client` and `timber` only listen to the
blockchain; they never directly change its state.
