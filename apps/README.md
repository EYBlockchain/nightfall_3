# Apps - Challenger and Proposer

## Requirements

This applications runs in docker containers so you will need Docker installed and Docker Compose
v3.5.

This code generates a containerised Challenger application and a containerised Proposer application.

The following instructions explain how run and deploy Challenger and proposer applications.

# Proposer app

## Run the Proposer app

to use the Proposer app it is necessary to configure some variables, which otherwise will take the default value. the variables to be set are the following:

`ENVIRONMENT`: selected environment, otherwise default value is `localhost`
`LOG_LEVEL`: selected log level, otherwise default is `debug`
`LOG_HTTP_PAYLOAD_ENABLED`: enable the http payload log, can be `true` or `false`, default is `true`
`LOG_HTTP_FULL_DATA`: enable the http full data log, can be `true` or `false`, default is `false`
`BLOCKCHAIN_WS_HOST`: selected Blockchain WS Host, otherwise default value is `blockchain`
`BLOCKCHAIN_PORT`: selected Blockchain port, otherwise default is `8546`
`ENABLE_QUEUE`: enable or disable queue, default is `1`
`OPTIMIST_HOST`: Optimism host to which you want to connect, default value is `optimist`
`OPTIMIST_PORT`: Optimism port to which you want to connect, default value is `80`
`OPTIMIST_WS_PORT`: Optimist WS port, default is `8080`
`CLIENT_HOST`: Client host to which you want to connect, default value is `client`
`CLIENT_PORT`: Client port to which you want to connect, default value is `8080`
`PROPOSER_HOST`: Proposer host to which you want to connect
`PROPOSER_PORT`: Proposer port to which you want to connect 

it is possible to run the Proposer with:
```
npm run start-proposer
```

which goes to run docker compose up of the `docker-compose.apps.yml`

# Challenger app

## Build the Challenger app

to build the Challenger app it is necessary to configure some variables, which otherwise will take the default value. the variables to be set are the following:

`ENVIRONMENT`: selected environment, otherwise default value is `localhost`
`LOG_LEVEL`: selected log level, otherwise default is `debug`
`LOG_HTTP_PAYLOAD_ENABLED`: enable the http payload log, can be `true` or `false`, default is `true`
`LOG_HTTP_FULL_DATA`: enable the http full data log, can be `true` or `false`, default is `false`
`BLOCKCHAIN_WS_HOST`: selected Blockchain WS Host, otherwise default value is `blockchain`
`BLOCKCHAIN_PORT`: selected Blockchain port, otherwise default is `8546`
`ENABLE_QUEUE`: enable or disable queue, default is `1`
`OPTIMIST_HOST`: Optimism host to which you want to connect, default value is `optimist`
`OPTIMIST_PORT`: Optimism port to which you want to connect, default value is `80`
`OPTIMIST_WS_PORT`: Optimist WS port, default is `8080`
`CLIENT_HOST`: Client host to which you want to connect, default value is `client`
`CLIENT_PORT`: Client port to which you want to connect, default value is `8080`
`CHALLENGER_PORT`: Challenger port to which you want to connect 

it is possible to run the Challenger with:
```
npm run start-challenger
```

which goes to run docker compose up of the `docker-compose.apps.yml`

it is also possible to generate a standalone proposer+challenger with:
```
npm run start-proposer-challenger
```