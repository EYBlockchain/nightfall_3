# MongiDb databases used by nightfall-client

## nightfall_commitments

This database holds the `wallets` collection, which contains the user's secrets, indexed by their
zkp public key. Needless to say, this information is sensitive and should be protected appropriately
as compromise would enable all of their tokens to be stolen.

```js
keyData = {
  _id: zkpPublicKey
  zkpPrivateKey: zkpPrivateKey
}
```
