# Wallet

## Testing ERC Contracts
For testing purposes, account `0x9C8B2276D490141Ae1440Da660E470E7C0349C63` with privateKey `0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e` has been setup in testnet wit some 
Ether and some ERC tokens.
The following is the list of test ERC contracts deployed:
- 0xb5acbe9a0f1f8b98f3fc04471f7fe5d2c222cb44 => ERC20 contract
- 0x103ac4b398bca487df8b27fd484549e33c234b0d => ERC721 contract. Existing token Ids are 1,2, and 3
- 0x9635c600697587dd8e603120ed0e76cc3a9efe4c => ERC1155 contract. Existing token Ids are 1 through 4.

When starting the wallet, you can add the address of these tokens if they do not appear by default.

## How is nightfall's mnemonic stored?
When connecting with Metamask to your nightfall account for the first time, you will be prompted to enter a twelve word
mnemonic. This mnemonic is used by nightfall to generate your personal set of keys that will allow you to operate on nighrfall.
You need to save this 12 word seed in a safe place, as it is the only way to recover your nightfall account.
This wallet offers a backup, but this backup is only a convenient way to log in to your account without entering the mnemonic, and
must no be relied to provide a permanent backup.
If you select to backup your nightfall mnemonic, it will be encrypted in local storage using as a key the result of hashing as signed message via Metamask. When logging back, you will be request to sign a message to decript the mnemonic and unlock your metamask account.

## How to generate different keys from a single mnemonic?
When you login to nightfall, you will be using account index 0. You can select a different index in `Account Settings` to use a different set of keys.

## Tests
See [here](https://github.com/EYBlockchain/nightfall_3/wallet/test/README.md) for information on how to launch tests.
