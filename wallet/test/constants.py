# default network testnet
walletUrlLocalhost = "http://localhost:3000/login"
walletUrlDocker = "http://wallet-test:3010/login"
walletUrlRopsten = "https://wallet.testnet.nightfall3.com"

metamaskConfig = {
   "mnemonic": "acquire security drum seed else able huge innocent tiger narrow drift blame",
   "password": "12345678",
}

networkConfigLocalhost = {
   "name": "ganache-nightfall",
   "type": "Custom RPC",
   "url": "http://localhost:8546",
   "chainId": "1337",
   "ticker": "ETH",
}

networkConfigDocker = {
   "name": "ganache-nightfall",
   "type": "Custom RPC",
   "url": "http://blockchain1:8546",
   "chainId": "1337",
   "ticker": "ETH",
   "explorer": "https://ropsten.etherscan.io",
}

networkConfigRopsten = {
   "name": "Ropsten Test Network",
   "type": "testnet",
   "url": "https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
   "chainId": "3",
   "ticker": "ETH",
}

deleteNetworkConfig = {
    "name": "Localhost 8545",
}

ethAccount1Params = {
  "ethereumAddress": "0xDd369AF1Bd4D8fEBEf2cE1716AfEC592e00553AA",
  "privateKey": "0xb861522aeeff651a048a53f27c67a429d42465d95d0915bab453ad554a8cf07a",
  "name": "Account 1",
}

ethAccount2Params = {
  "ethereumAddress": "0x9C8B2276D490141Ae1440Da660E470E7C0349C63",
  "privateKey": "0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e",
  "name": "Account 2",
}

tokens = {
  "erc20": "0xf05e9fb485502e5a93990c714560b7ce654173c3",
  "erc1155": "0x4f3c4f8d4575cf73c2faf9f36cc505e19e65b9c0",
  "erc721": "0x4f3c4f8d4575cf73c2faf9f36cc505e19e65b9c0",
}

BALANCE_INTERVAL = 30000