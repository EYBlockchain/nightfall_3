# Testing a Decentralised Network on Georli

This document describes how to run a real world test of a network of deployed Optimists, Clients, Users, Proposers and Challengers. The purpose of the test is to gain confidence that a fully decentralised network can operate without issues.

## Design criteria

### Multiple Clients and Optimists.

Mutliple, independent Clients and Optimists each with one Proposer, Challenger or User (as appropriate). This will more accurately reflect a real-world deployment. Some Optimists will have an attached Proposer and Challenger, some just a Challenger. There must be no more than one of each type of application attached to an Optimist.  Each Client should have a single user attached. Multiple users are allowable but complicate the test for minimal extra coverage. For simplicity, this document refers to an Optimist with attached Proposer and/or Challenger as a 'Nightfall Node'.

### Adversaries

After initial tests, we will also deploy Adversarial Clients, able to generate malicious transactions (e.g replays, proofs that do not verify...) and Lazy Optimists, which will uncritically assemble the 

### Independent Infrastructure

Each Client and Nightfall-Node should run on completely separate virtual infrastructure. It is allowable to share a database instance (e.g. a MongoDB instance), provided the databases that the instance contains are not themselves shared.

### Independent Test Scripts

Each User will be an identical but otherwise independent test script. . The alternative approach of having an over-arching test-runner is rejected because, although it simplifies orchestration of the test, it introduces an element of syncronisation that does not exist in the real world.  Using completely independent test runners forces asynchronous behaviour and it ensures that no User benefits from access to information that they would not have in real-world applications. Whilst there is no requirement 

A corollary of this approach is that each User application will not know when the test has finished because it has no direct view of the progress of other users. 

## Test requirements

The tests will be divided into two campaigns. The first tests basic functionality and reliability, the second is an adversarial test campaign which tests the ability of the network to detect and neutralise malicious transactions.

### Functionality and reliability testing

This is similar to the existing Ping Pong test but has a few significant differences as described beliow. The User application should be in the form of a script. It can run within the Mocha framework but this is not required; recall that each instance of the script runs independently of the others. Each script should do the following:

1. Be provided with a list of the addresses of other Users participating in the test
2. Have its Ethereum address loaded with sufficient funds to run the test
2. Have its Matic balance loaded with sufficient funds to run the test (assuming we use mattic to pay the Proposer and as the currency being transferred)
2. Present a valid end user certificate to `X509.sol` and register its Etherum address
3. Connect to its Client and generate ZKP keys
3. Deposit sufficient Matic into layer 2 to run the tests
3. Start the following test sequence:
    1. At random times (averaging once every 5 minutes, capped at 20 minutes) transfer a random amount of Matic to a randomly chosen User address (on average this can be a very small amount and capped to a still-small maximum  perhaps 100 times the average), recording details of each transaction (amount, recipient, timestamp)
    1. Record details of any transfers received (amount, timestamp)
    1. When it has performed n transfer transactions, wait enough time to reasonably allow all other uses to complete their transactions.
    1. Report each transaction that it has sent and each received to a central endpoint
    1. Withdraw its balance back to layer 1.

Once all reports are received, the endpoint code should perform a reconciliation and report the results.

The test should be run multiple times, doubling n each time and starting with a test run of a few minutes until tests exceed a week in duration with no failures at the end.

### Adversary testing

To keep databases consistent through rollbacks, we will use the 'Adversarial Client, Lazy Optimist' method of creating bad blocks. The test will be similar to the above, with the following additions:

1. An Adversarial User, Client and Lazy Optimist will be deployed.  There need only be one of each.
2. The test will be setup and run as above, however the adversarial User will create bad transactions of different types and send them to the Lazy Optimist, which will incorporate them into blocks
3. The bad blocks should be detected by the Challengers and successfully rolled back, enabling the test to complete successfully as previously.

