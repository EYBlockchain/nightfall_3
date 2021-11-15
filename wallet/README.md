# Wallet

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
See [here](https://github.com/EYBlockchain/nightfall_3/wallet/test/README.md) for information on how to launc tests.
