# nightfall-client

## GET /healthcheck

Used to test if the server is up.

### Parameters:

None

### Response

status code 200.

## POST /incoming-viewing-key

subscribe to block proposed event with the provided incoming viewing key for optimist2 such that
this key will be used to decrypt secrets send to the blockchain as part of a transfer transaction

### Parameters

```js
{
  zkpPrivateKeys: // the array of private keys which will be used to decrypt messages
  nullifierKeys: // the array of secrets required to create nullifier for a commitment being spent. Required to store nullifier for a commitment being created in DB
}
```

### Response

`status:` to show if the subscription with the key is a `success`

## GET /contract-address/{contractName}

Used to get the address of a particular blockchain contract. This is mostly for testing use.

### Parameters

`contractName:` The name of the solidity contract (case sensitive) without the `.sol` extension,
e.g. `Shield`.

### Response

`address:` The requested contract address, as a hex string

## POST /deposit

Creates a transaction to make Layer 2 token from a Layer 1 ERC20, ERC721 or ERC1155 token.

### Parameters

```js
{
  ercAddress: // the address of the Layer 1 ERCx token contract
  tokenType: // type of token - ERC20/ERC721/ERC1155
  tokenId: // the ID of the token ('0x00' for ERC20 tokens)
  value: // the value of the token ('0x00' for ERC721 tokens)
  fee: // the amount that the transactor will pay to a proposer to incorporate the transaction in a Layer 2 block.
}
```

### Response

`txDataToSign:` abi-encoded transaction data. This should be signed and sent to the blockchain by
the calling application, along with the fee for the Proposer (as `msg.value`). Note that the
Shield.sol contract will attempt to take the value being transacted into escrow (whether an
ERC20/1155 value or an ERC721 non fungible token). Thus, before the deposit endpoint is called, the
Shield contract must be approved by the user to make the withdrawal (using the relevant ERCx
`approve` function).

## POST /transfer

Creates a transaction to transfer ownership of a ZKP-shielded asset between two owners (identified
by their zkp public key).

### Parameters

```js
{
  offchain: // sends the transfer transaction directly to a proposer instead of the smart contract if set to true
  ercAddress: // the address of the ERCx contract holding the equivalent Layer 1 tokens
  tokenType: // type of token - ERC20/ERC721/ERC1155
  value: // value of token to be sent
  tokenID: // the identity of the token to be transferred (`0x00 for an ERC20`)
  compressedZkpPublicKey: // recipients' respective compressed zkp public key
  fee: // amount to pay proposer
}
```

### Response

`txDataToSign:` abi-encoded transaction data. This should be signed and sent to the blockchain by
the calling application, along with the fee for the Proposer (as `msg.value`).

## POST /withdraw

Creates a transaction to convert a ZKP-shielded token back to a conventional Layer 1 token. A
current limitation is that a ZKP commitment of the exact value must exist. You may need to make a
transfer to yourself of the exact value you wish to withdraw, if there isn't already a commitment of
the correct value.

### Parameters

```js
{
  offchain: // sends the transfer transaction directly to a proposer instead of the smart contract if set to true
  ercAddress: // the address of the ERCx contract holding the equivalent Layer 1 tokens
  tokenType: // type of token - ERC20/ERC721/ERC1155
  tokenID: // the identity of the token to be transferred (`0x00 for an ERC20`)
  value: // value of token to be withdrawn
  recipientAddress: // Ethereum address of the Layer 1 token recipient
  fee: // amount to pay proposer
}
```

### Response

`txDataToSign:` abi-encoded transaction data. This should be signed and sent to the blockchain by
the calling application, along with the fee for the Proposer (as `msg.value`).

# nightfall-optimist

## POST /proposer/register

Creates a transaction to register a Proposer, so that they can start producing blocks.

## Parameters

```js
{
  address: // the address of the proposer to register, as a hex string
}
```

## Response

`txDataToSign:` abi-encoded transaction data. This should be signed and sent to the blockchain by
the calling application (along with the proposer bond value).

## POST /challenger/add

Adds the address of a challenger that this `nightfall-optimist` instance should create challenges
for. This information is needed so that `nightfall-optimist` can check that a challenge commit has
been posted to the blockchain successfully, and therefore it can send the reveal. Multiple
challenger addresses can be added.

## Parameters

```js
{
  challenger: // the address of the challenger
}
```

## Response

`txDataToSign:` abi-encoded transaction data. This should be signed and sent to the blockchain by
the calling application.

# Notes

- Unless otherwise stated, all values should be formatted as 32 byte hex strings, padding with
  leading zeros as needed and preceeded by `0x`. The `general-number` package provides a convenient
  method for converting various types to 32 byte strings.
- Unsigned challenge transactions and Layer 2 block creation transactions are emitted by a websocket
  from `nightfall-optimist` back to the Challenger/Proposer. These must be signed and sent to the
  blockchain to either raise a challenger or to create a new block. This cannot be done by
  `nightfall-optimist` because it does not have access to Ethereum private keys. See the test suite
  `adversary.test.mjs` for an example of this working. The basic code is:

```js
connection = new WebSocket(optimistWsUrl);
connection.onopen = () => {
  connection.send('challenge');
  connection.send('blocks');
};
connection.onmessage = async message => {
  // let txReceipt;
  txQueue.push(async () => {
    const msg = JSON.parse(message.data);
    const { type, txDataToSign } = msg;
    if (type === 'block') {
      //sign a block transaction and send to blockchain
    else if type === 'challenge'
      //sign a challenge transaction and send to blockchain
```
