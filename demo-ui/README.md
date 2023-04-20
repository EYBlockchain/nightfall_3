# demo-ui
Demo-UI is a thin UI on top of the APIs, it is not intended for production use. Its puprpose it to test ERC20 operations (Such as Deposit, Transfer and Withdraw) in a bare minimal way.

### Running the demo-ui locally

1.  Install dependencies `npm ci`

2.  Start the app in local development mode. `npm start`


### UI Walk through

1. Running app will land you to configure page where you enter ERC20 Contract address to which you want use demo-ui with.
    for example: deployed ERC20 Contract Address is 0x4315287906f3fcf2345ad1bfe0f682457b041fa7 for localhost network (setuped when one runs `./bin/start-nightfall -g -d`)

2. In configure page you could choose to connect your Metamask to two different networks.

  - Mumbai Testnet (click *Mumbai Testnet Ploygon* radio button and then click *Configure*).
  - Polygon (click *Ploygon* radio button and then click *Configure*).
  - Localhost (no radio button for this choice; to connect to localhost follow bellow Note).

  *Note: In case to connect to local ganache please switch manually in Metamask, code configure won't work because metamask sdk expect localhost connection to use port 8545 unlike our ganache instance which is using 8546 i.e rpcURL http://localhost:8546, after manuall switch click configure button with ERC20 Contract address*

3. After Configure page (landing screen) next page is the Add User.

  - Description:
      Intention here is user should add/configure Alice and Bob to test all ERC20 operation.

  - fields
    - User Name  (any name can be given this is just to distinguish user in further screen/page)
      for example: "Alice"

    - User Menmonic  (any valid menmonic, will be used to generate ZKP keys for this user).
      for testing against localhost copy menmonic from config, like `test/e2e/tokens/erc20.test.mjs` does

  - Notes
    - User need to do Add user twice before moving to next page which is Deposit page.
        This restriction in Add user page is added so that user can configure Alice and Bob both before starting ERC20 operation.

    - In between adding/configure two users(Alice and Bob) please do not forget swtich EOA(External Owned Account) in Metamask. Otherwise Alice and Bob will end with same EOA.

4. After successful adding two users next page will be Deposit, here user has options in left-hand sidebar to swtich to different operations page like Transfer or Withdraw.

5. After each successful operations(Deposit, Transfer and Withdraw) please do not forget to click "Make Block Now" Button (in top-left corner in nav bar) this will make block in optimist, and should update Alice and Bob balance in righthand sidebar.
