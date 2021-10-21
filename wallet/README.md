## Wallet
Nightfall_3 provides a Wallet to exercise its features. To use it:

- Generate browser version of SDK:
```
cd cli
npm install
npm run build
```
- Deploy nightfall (only ganache for now) from Nightfall's root folder
```
./start-nightfall -g -s
```
- In a different terminal, start proposer from Nightfall's root folder once Nightfall deployment is finished
(you will see this `nightfall_3-deployer-1 exited with code 0`).

```
./proposer
```

- In a different terminal, start the liquitidy provider from Nightfall's root folder. Liquidity provider is needed to use `instant withdraw` feature
```
./liquidity-provider
```

- Launch wallet.
```
cd wallet
npm install
npm start
```

- When the wallet starts, you will have the option to enter your private key on connecting with metamask wallet installed in your browser. If you select the latter, you need to have previously configured your metamask wallet to operate with Nightfall's deployment on localhost

### Configuring Metamask to work with Nightfall on localhost
1. Open Metamask wallet
2. Import Account and paste the private key. While we are working on localhost, we will be using a test account with private key `0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e`
3. Next step is to configure Nightfall's RPC network. Go to `Settings->Networks->Add Network`
4. Enter the following information and press `Savle`
- `Network Name` : nightfall-localhost
- `New RPC URL` : http://localhost:8546
- `Chain ID`: 1337
5. Select the new imported account and the new created network



### Limitations
- You cannot run the wallet and a separate version of the SDK (CLI for example) in parallel as nonces will get mixed.
- If you select Metamask as your wallet, you need to reset the nonce every time you restart Nightfall, as Metamask will keep previous nonce whereas ganache has reset it. If nonce is not reset, you will see an error message after signing the transaction. To reset the nonce in metamask:
1. Open Metamask in browser
2. Settings->Advance->Reset Account

- Initial balances shown by the wallet are fake. 
- Only ERC20 tokens work for now. When you start the wallet, select the ERC20 token and perform some deposits. Then click on `Reload` button to
see the real balance.
- Transactions only accept amounts less or equal than 10. Anything larger produces an error. Need to investigate why. For now, keep amounts below this threshold.
- Direct transactions are not implemented
- Instant withdraw is selected when doing a withdraw only. Once submitted the instant withdraw request,the wallet requests a simple withdraw and inmediatelly after converts this withdraw into an instant withdraw. Wallet will attempt to send the instant withdraw request up to 10 times, once every 10 seconds. It is likely that during this period, you need to request a simpler transaction (deposit, withdraw or transfer) so that the original withdraw is processed by the processor and the instant withdraw can be carried out.
- Tested with node version v14.18.0