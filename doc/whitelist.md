# Nightfall Whitelisting adaptions

Nightfall now incorporates the ability to manage a whitelist of accounts. It is an abstract contract, intended to be subclassed by a form of Whitelist Manager contract (currentyl `X509.sol` performs this role). When whitelisting is enabled, only accounts that are added to the whitelist are able to move funds from Layer 1 to Layer 2 and to withdraw Layer 1 funds from the Shield contract. Further, only whitelisted accounts may act as Proposers or Challengers.

## Enabling Whitelisting

To enable whitelisting, the deployer container should have its `WHITELISTING` environment variable set to `enable`. Setting the `WHITELISTING` variable to anything else will desable whitlisting.

## Operating Whitelisting

All whitelisting functionality is managed by the contract `Whitelist.sol`, the functions therein are self-explanatory.

## Identifying users to the Proposer

The Proposer may require that all users for whom it accepts transactions must be whitelisted. This is in fact the default unless the environment variable ANONYMOUS_USER is set in the Proposer container. Unless this variable is set, the Proposer will expect the user to sign the submitted off-chain transaction wirh their Ethereum signing key. The Proposer will do an ecrrecover on the signature and require that the recovered address is whitelisted before processing the transaction. The user's nf3 class will automatically sign offchain transactions unless the ANNONYMOUS_USER environment variable is set there.
