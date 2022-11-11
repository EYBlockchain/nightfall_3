[![openapi friendly](https://img.shields.io/badge/openapi-friendly)](https://swagger.io/specification/)

# Optimist

To launch a stand alone optimist:

1. Copy `optimist.copy.env` to `optimist.env`
2. Configure variables in `optimist.env`
3. Launch optimist

```
./start-optimist.sh [OPTIONS]
```

`OPTIONS` include:

- -d|--delete : Delete mondodb contents
- -e|--environment : Set Nightfall environment. Possible values are `mainnet` and `testnet`. If
  `environment` is not configured, it is assumed that optimist is to be attached to the Nightfall
  environment that results from launching `./start-nightfall`

4. To stop optimist:

```
./stop-optimist.sh
```

## Configuration

File `optimist.env` contains the configuration variables needed. When launching
`./start-optimist.sh`, two containers, mongoDb and optimist, are deployed.

- **MONGO_INITDB_ROOT_USERNAME** : MongoDb username.
- **MONGO_INITDB_ROOT_PASSWORD** : MongoDb password.
- **MONGO_PORT** : Port where MongoDb is served.
- **OPTIMIST_PORT** : HTTP optimist port
- **OPTIMIST_WS_PORT** : WebSocket optimist port
- **BLOCKCHAIN_URL** : Websocket Web3 URL (wss://web3.test.com). Alternatively, one can pass a host
  and a port so that it Web3 websocket can be found at ws://${BLOCKCHAIN_WS_HOST}:${BLOCKCHAIN_PORT}
- **BLOCKCHAIN_WS_HOST** : Websocket Web3 host (i.e, localhost)
- **BLOCKCHAIN_PORT** : Websocket Web3 port (8546)

## Operation

Scripts provided can spin an optimist and connect it to an existing testnet or mainntet nightfall
deployment. In this case, one needs to have access to Web3 node. Alternatively, the optimist can
connect to the sandbox environment provided by `./start-nightfall` script. In this case, it is not
necessary to provide `BLOCKCHAIN_URL` parameters. The same ganache node will be automatically
configured.

## Applications

This stand alone optimist have been thought to be used with `nightfall_3/apps` applications. This
folder includes several applications that use the optimist to provide certain applications such as:

- Proposer
- Challenger
- Synchronizer

In order to configure the optimist in one of these roles:

1.  Launch optimist with `./start-optimist.sh`
2.  Ensure `optimist.env` is configured.
3.  Go to the folder including the role you need (`apss/proposer`) and launch `npm start`
