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
- -e|--environment : Set Nightfall environment. Possible values are `mainnet` and `testnet`. If `environment` is not configured, it is assumed that optimist is to be attached to the Nightfall environment that results from launching `./start-nightfall.sh`


## Configuration
File `optimist.env` contains the configuration variables needed:
- **MONGO_INITDB_ROOT_USERNAME** : MongoDb username. Not required
- **MONGO_INITDB_ROOT_PASSWORD** : MongoDb password. Not required
- **OPTIMIST_HOST** : Host where this optimist can be found=localhost
 OPTIMIST_PORT=9091
 OPTIMIST_WS_PORT=9090
 MONGO_PORT=27019