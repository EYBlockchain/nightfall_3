# How to upgrade contracts

NB: NOT YET IMPLEMENTED

At least initially, we retain the ability to upgrade the nightfall contracts following deployment.
We use the Openzeppelin [Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/) Hardhat plugin
to do that.  Make sure you have read the details before attempting an upgrade because there are some
specifics around the structure of the contract that need to be addressed.

## The approach

We use `deployer` to upgrade contracts. `deployer` has three scripts stored in its scripts folder
The first two scripts perform a 'normal' deployment of the nightfall contract suite. They
do however make sure that all contracts (but not libraries) are deployed with a proxy to enable them to
be upgraded at a later date. The fourth migration is used to upgrade contracts.

In a normal deployment run, `deployer` will only run the first two scripts. If, however, its
`UPGRADE` environment variable is set to <anything at all>, then the first two scripts will be ignored
and the subsequent script run.

The upgrade script requires editing to include the contracts that you wish to upgrade (unless they have
the same name as the original contracts). Then, running deployer will result in the contracts being upgraded.

Don't forget that the solidity source code is contained within the `deployer` container. Therefore, it is necessary
to rebuild the container to incorporate any changes to the contract code.

Note that libraries are not proxied. They contain no state, and so we freely re-deploy and re-link them each time.
It may be cheaper to proxy them but this adds significantly to the number of proxy contracts.

## Testing

Please see the README in the ping-pong test directory.
