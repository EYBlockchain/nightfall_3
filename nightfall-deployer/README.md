<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [nightfall-deployer](#nightfall-deployer)
  - [Running as a stand-alone container](#running-as-a-stand-alone-container)
  - [Running in development mode](#running-in-development-mode)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-deployer

<sub><sup>Part of the [nightfall_2](https://github.com/EYBlockchain/nightfall_2)
project.</sup></sub>

`nightfall-deployer` should be used to build a docker image. When the resulting container is run up
it will:

- Try to deploy the smart contracts contained in `/app/contracts` to an ethereum client, which it
  will look for (by default) at `openethereum:8545`. Thus there should normally be a docker
  container with this hostname. It will not deploy the contracts if there are already deployment
  artefacts in its `/app/build` folder.
- Check for the existence of a running `zokrates_worker`, deploy the circuits in the `/app/circuits`
  folder to the zokrates*worker and perform a trusted setup of the circuits. It will \_not* perform
  a trusted setup if an outer verification key already exists in the zokrates_zexe_microservice
  `proving_files` volume, unless this behaviour is over-ridden by setting `ALWAYS_DO_TRUSTED_SETUP`
  (see below). Note that the circuits are placed in the zokrates_zexe_microservice container by
  mounting a `circuits` volume common to both containers, and not via http://.
- Register the outer verification vk with ZVM.sol.

There are several environment variables that can be used to modify the container's behaviour. Most
of these should be left at the default value unless you really know what you are doing:

| Environment variable          | Purpose                                                                       | Possible values                                              | Default                            |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| CIRCUITS_HOME                 | Where Deployer looks for its circuits to deploy                               | Any valid folder name                                        | /app/circuits                      |
| INNER_CHECKS_VK_TEMPLATE_PATH | Path to the inner vk template                                                 | Any valid path to a template file                            | zvm/2in2out/inner-checks-vk.zokm   |
| INNER_CHECKS_VK_PATH          | Path to circuit defining the inner-checks vk                                  | Any valid path to a suitable .zok file                       | zvm/2in2out/inner-checks-vk.zok    |
| INNER_CHECKS_PATH             | Path to the inner-checks circuit                                              | Any valid path to a .zok file that does inner-circuit checks | zvm/2in2out/inner-checks.zok       |
| OUTER_VERIFICATION_PATH       | Path to the outer verification circuit                                        | Any valid path to a .zok file that does outer verification   | zvm/2in2out/outer-verification.zok |
| ALWAYS_DO_TRUSTED_SETUP       | If true, trusted setup will proceed, even if an outer verification key exists | Boolean                                                      | false                              |
| ZOKRATES_HOST                 | The hostname of the container providing the zokrates_zexe_microservice        | Any valid hostname                                           | zokrates                           |
| CONTRACT_ARTIFACTS            | Path to the parent directory of the ZVM contract build json file              | Any valid location                                           | /app/build/contracts/              |
| BLOCKCHAIN_WS_HOST            | URL of the blockchain client                                                  | Any valid URL                                                | ws://openethereum                  |
| BLOCKCHAIN_PORT               | Port to connect to the blockchain host on                                     | Any valid port number                                        | 8546                               |
| LOG_LEVEL                     | logging level                                                                 | error, warn, info, http, verbose, debug, silly               | debug                              |
| ETH_NETWORK                   | sets the ethereum network selected from truffle-config.js                     | openethereum, development, ganache                           | openethereum                       |

## Running as a stand-alone container

This is the default: run up the container and mount a volume containing your contracts to
`/app/contracts` and circuits to `/app/circuits`. Optionally mount a volume to /build if you want to
retain your build artefacts. Mount the zokrates_zexe_microservice `proving_files` volume to
`/app/proving_files`

## Running in development mode

If you want to mount the local contracts and circuits folders then an easy way to do that is with:

```sh
$ docker-compose up
```

This will also pull a test version of openethereum with bls12_377 and bw6_761 precompiles and a
zokrates_zexe_microservice, and deploy to those.
