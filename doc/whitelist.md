# Nightfall Whitelisting adaptions

Nightfall now incorporates the ability to manage a whitelist of accounts in support of KYC (Know Your Customer). When whitelisting is enabled, only accounts that are added to the whitelist are able to move funds from Layer 1 to Layer 2 and to withdraw Layer 1 funds from the Shield contract.

Whitelisting can be controlled either externally to the blockchain or via a smart contract.  Nightfall is agnostic about how KYC is applied.

## Enabling Whitelisting

To enable whitelisting, the deployer container should have its `WHITELISTING` environment variable set to `enable`. Setting the `WHITELISTING` variable to anything else will desable whitlisting.

## Operating Whitelisting

The KYC adaptions have recognise a new actor, the whitelist manager. A whitelist manager is able to whitelist users and to remove them from the whitelist. Each whitelist manager manager has a group ID associated with them, and users are added to the whitelist managers group ID when they are whitelisted. In practice, the group ID currently has little effect, other than acting as a grouping variable; all whitelisted users can interact, regardless of their group ID.

Whitelist managers are created/removed by the contract owner (multisig). They can also operate as normal Nightfall users, thus they are able to whitelist themselves.

All whitelisting functionality is managed by the contract `Whitelist.sol`, the functions therein are self-explanatory.

Note that all users are, by default members of the null group (group ID = 0). Members of this group are NOT whitelisted when whitelisting is enabled. Membership of any other group confirs whitlisted status.