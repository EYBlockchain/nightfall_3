# Nightfall Whitelisting adaptions

Nightfall now incorporates the ability to manage a whitelist of accounts. It is an abstract contract, intended to be subclassed by a form of Whitelist Manager contract (currentyl `X509.sol` performs this role). When whitelisting is enabled, only accounts that are added to the whitelist are able to move funds from Layer 1 to Layer 2 and to withdraw Layer 1 funds from the Shield contract.

## Enabling Whitelisting

To enable whitelisting, the deployer container should have its `WHITELISTING` environment variable set to `enable`. Setting the `WHITELISTING` variable to anything else will desable whitlisting.

## Operating Whitelisting

All whitelisting functionality is managed by the contract `Whitelist.sol`, the functions therein are self-explanatory.
