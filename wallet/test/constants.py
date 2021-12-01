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
   #"url": "http://localhost:8546",
   "url": "http://blockchain1:8546",
   "chainId": "1337",
   "ticker": "ETH",
}

networkConfigRopsten = {
   "name": "Ropsten Test Network",
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
  "erc20": "0xb5acbe9a0f1f8b98f3fc04471f7fe5d2c222cb44",
  "erc1155": "0x9635c600697587dd8e603120ed0e76cc3a9efe4c",
  "erc721": "0x103ac4b398bca487df8b27fd484549e33c234b0d",
}

BALANCE_INTERVAL = 30000