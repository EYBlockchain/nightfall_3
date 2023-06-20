# demo-ui

Demo-UI is a thin UI on top of the APIs, it is not intended for production use. Its puprpose it to
test ERC20 operations (Such as Deposit, Transfer and Withdraw) in a bare minimal way.

### Running the demo-ui locally

1.  Install dependencies `npm ci`

2.  Start the app in local development mode. `npm start`

### To run demo-ui with local ganache, follow below steps

1. read nightfall read me and setup and start nightfall `./bin/start-nightfall -g -d`

2. After nightfall app finished starting up i.e seeing `nightfall_3_deployer_1 exited with code 0`
   in logs, start proposer in another terminal `npm run start-proposer`

3. at last start demo-ui app in a new terminal

```sh
cd demo-ui\
npm ci
npm start
```

### UI Walk through

1. Running app will land you to configure page where you enter ERC20 Contract address to which you
   want to use with demo-ui. for example: deployed ERC20 Contract Address is
   0x4315287906f3fcf2345ad1bfe0f682457b041fa7 for local ganache network (setuped when one runs
   `./bin/start-nightfall -g -d`)

2. In configure page you could choose to connect your Metamask to two different networks.

- Mumbai Testnet (click _Mumbai Testnet Polygon_ radio button and then click _Configure_).
- Polygon (click _Polygon_ radio button and then click _Configure_).
- Localhost (no radio button for this choice; to connect to localhost follow bellow Note).

_Note: In case to connect to local ganache please switch manually in Metamask,
implemented-code-logic won't work because metamask sdk expect localhost connection to use port 8545
unlike our ganache instance which is using 8546 i.e rpcURL http://localhost:8546, after manuall
switch, click configure button with ERC20 Contract address_

3. After Configure page (landing screen) next page is the Add User.

- Description: Intention here is user should add/configure Alice and Bob to test all ERC20
  operation.

- fields

  - User Name (any name can be given this is just to distinguish user in further screen/page) for
    example: "Alice"

  - User Menmonic (any valid menmonic, will be used to generate ZKP keys for this user). for testing
    against localhost copy menmonic from config, like `test/e2e/tokens/erc20.test.mjs` does

- Notes

  - User need to do Add user twice before moving to next page which is Deposit page.

  - In between adding/configure two users(Alice and Bob) please do not forget swtich EOA(External
    Owned Account) in Metamask. Otherwise Alice and Bob will end with same EOA.

4. After successful adding two users next page will be Deposit, here user has options in left-hand
   sidebar to swtich to different operations page like Transfer or Withdraw.

5. After each successful operations(Deposit, Transfer and Withdraw) please do not forget to click
   "Make Block Now" Button (in top-left corner in nav bar) this will make block in optimist, and
   should update Alice and Bob balance in righthand sidebar.
