# demo-ui

### Running the demo-ui locally

1. Install dependencies `npm ci`

2. Start the app in local development mode. `npm start`

#### Notes

1. demo-ui app for now is only configured to work  with ERC20.

2. running app will land you to configure page where you enter ERC20 Contract address to which you want use demo-ui with.

3. In configure page you could choose to connect your Metamask to two different networks.

    - Mumbai Testnet (click *Mumbai Testnet Ploygon* radio button and then click *Configure*).
    - Polygon (click *Ploygon* radio button and then click *Configure*).
    - Localhost (no radio button for this choice; to connect to localhost follow bellow Note).

    *Note: In case to connect to local ganache please switch manually in Metamask, code configure won't work because metamask sdk expect localhost connection to use port 8545 unlike our ganache instance which is using 8546 i.e rpcURL http://localhost:8546, after manuall switch click configure button with ERC20 Contract address*
