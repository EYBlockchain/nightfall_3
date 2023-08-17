# Nightfall Deployment

This document describes how to deploy Nightfall so that others can use it after they run up their nightfall nodes. That is, it describes how to deploy the smart contract set and the trusted setup data, with appropriate configurations.

## Preliminaries

[ ] You should be working on a machine which is fully set up for Nightfall development.

[ ] You will need the Github Large File Storage [software](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage) installed if you don't already have it.

### Manual Logging

[ ] Create a copy of this file and annotate it as the deployment proceeds (also check off the check boxes [ ]), to create a Captain's log of the deployment.

### Github Repository

[ ] Create a deployment branch in case you need to push some code changes (this could be necessary for the first deployment). Work in this branch. Once the branch is merged back to master, at the end of the deployment, you should Tag the code appropriately.

### Blockchain node

[ ] Ensure you can connect to a synchronised blockchain node, exposing a websocket or http port, connected to the chain onto which you wish to deploy. One way to do this if you have Geth installed is with `geth attach <ws | http>://<host>:<port>`

Node connected to <ws://20.22.165.59:8546> (not reachable on EY networks)

[ ] Check that the chain Id is correct.  If you are attached with Geth you can do `net.version` it should be 80001 for Mumbai and 137 for Polygon PoS.

## Configuration

### Generate a fresh key pair for the deployment

[ ] We do not use an HSM for deployment, thus this key should only be used for the deployment, because the private key is exposed on the host. The easiest way to generate a private key and address is to use Metamask, generate a new account and export the private key.

### Set the Truffle configuration

[ ] Write the chain configuration in the `networks` section of `nightfall/deployer/truffle-config.js, or edit an existing configuration

[ ]  Check that the gasPrice default is adequate for the chain that you are deploying to.

### Set Environment variables

Note, there is a pre-populated script `bin/mumbai-deployment.env` for the mumbai network to create all of the variables needed.  This saves having to set them individually and is less error-prone:

```sh
source mumbai-deployment.env <my-private-key>
```

[ ] `ETH_NETWORK` with the name of your chain configuration (e.g.`export ETH_NETWORK=mychainconfig`)

[ ] `ETH_PRIVATE_KEY` with the private key of the account which is doing the deployment. Do NOT place `0x` at the begining of the key string. Do not use this account for anything else because this appoach is not fully secure.

[ ] `MULTISIG_APPROVERS='0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002,0x0000000000000000000000000000000000000003,0x0000000000000000000000000000000000000004'`. This is to ensure a fully decentalised deployment becuase no one will be able to use the Multisig.

[ ] `BLOCKCHAIN_URL` to equal the blockchain node RPC port that you are using (as above).

[ ] `WHITELISTING=enable`. This step should be unnecessary because whitelisting is enabled by default but it guards against an accidental deployment with developer settings enabled (`-d`).

[ ] `NF_SERVICES_TO_START='deployer,worker'`

[ ] `DEPLOY_MOCK_TOKENS=false`. This disables deployment of the test ERCx contracts, to save Gas.

[ ] `ENVIRONMENT`. The name that you are giving your deployment environment (as described in the ENVIRONMENTS object in `config/default.js`). This is often the same as `ETH_NETWORK` but we allow for multiple environments with the same chain.

[ ] `FEE_L2_TOKEN_ID`. This is the name of the ERC20 contract from which Proposer fees will be taken. It can be any contract for which you have a balance. The default is `Matic` but on a Matic-native chain, this will not work. Wrapped Matic (`WMATIC`) is a suitable alternative. Whichever ERC20 contract is used, it must exist in the `RESTRICTIONS` part of the contract under the relevant `ETH_NETWORK`; it cannot be added after deployment.

[ ] If you are deploying to a chain that does not have a Chainalysis Sanctions contract (such as `mumbai`), then you need to set `DEPLOY_MOCKED_SANCTIONS_CONTRACT=true` otherwise the Shield contract will revert when it goes looking for this contract.

[ ] Ensure that the account has sufficient funds to deploy all of the contracts (> 1ETH if the price is 20GWei/gas, otherwise scale with the gas price; >1 Matic for Polygon PoS).

### Set config items

You need to set some config items to match the `ETH_NETWORK` name that you have used. Edit `config/default.js`.  Specifically:

```js
X509:
RESTRICTIONS:tokens
ENVIRONMENTS
```

At this stage `ENVIRONMENTS:` only requires `the chainId` to be set.  Other variables are needed for deploying nightfall node containers. See the next two sections for more details on these items. If sections corresponding to your `ETH_NETWORK` name do not exist, you will need to create them.

### Add x509 trust roots and acceptable certificate profiles

Note, the following is only required for a production deployment. For deployment on the testnet, the private key of the test CA should be made available so that users can create their own (insecure) certificates for test purposes.

[ ] Record whether this is a production or test deployment and proceed accordingly. *Failure to use the correct procedure will result either in an insecure production deployment or a test deployment that cannot easily be used.* [ ] Production [ ] Test

[ ] For each CA that is going to be used for identification, add the RSA public key of the trust root to `RSA_TRUST_ROOTS` in the default config. You may wish to include a private trust root to enable direct issuing of certificates by a specific organisation.

[ ] Update the `certificatePolicyOids` and `extendedKeyUsageOids` for each end-user Certificate Profile for each CA. The Oids to use should be available from the CA in their Certificate Profiles, which they should publish. Information about how to encode the OIDs is contained in `doc/adding_certificates.md`.

[ ] Add test certificates and corresponding test private keys for each CA to the x509 unit test, and ensure it passes. If you do not have a suitable private key, you will only be able to check that the certifiate parses correctly.  This carries some risk that a real key will fail.

[ ] *If this is a production deployment, ensure that the test trust root has been removed from the `RSA_TRUST_ROOTS` list, otherwise the deployment will be insecure.*

#### Set up restrictions for the amount of currency that can be transferred in a single transaction

[ ] Add restriction values to each ERC20 that the deployment will interact with in the `config/default.js` file's `RESTRICTONS: tokens` section. Use `-1` to turn off a restriction.

### Set on-chain Config.sol items

[ ] Edit `Config.sol` to change values for the proof of stake operation so that they are suitable for the network being deployed to (the comments give suitable values), specifically:

- `minimumStake` - the smallest amount that someone can stake in order to become a proposer
- `blockStake` - the amount that a proposer puts at risk when proposing a block (and the amount that a Challenger receives on successful challenge).

### Remove any existing build folders

[ ] From within `nightfall-deployer` run `rm -r build`
[ ] From within `nightfall-deployer` run `rm -r .openzeppelin`

(you may find these don't exist; that's fine)

### Clear any saved folders from any previous run

[ ] From within the nightfall root directory run:

```sh
rm -r proving_files
rm -r build
rm -r .openzeppelin
rm -r mumbai
rm mumbai.tar.gz
rm -r cache
rm -r artifacts
```

(you may find these don't exist; that's fine)

### Remove any existing volumes

[ ] Rather than deleting just the volumes, we'll do a full prune to make our system as clean as possible

```sh
docker system prune --volumes
```

[ ] check they are gone:

```sh
docker volume ls # should return an empty volume list
```

### Make sure your artifacts repo is current

```sh
cd ../nightfall-artifacts
git pull
cd -
```

## Run the deployment

### Perform npm link

[ ] This will take on board any changes to common files

```sh
cd common-files
npm link
cd ..
npm link @polygon-nightfall/common-files
cd cli
npm link @polygon-nightfall/common-files
cd ..
```

### Build the containers

We include a build step so that we are not dependent on any local bind mount.  This makes the deploy a little more reproducible.

[ ] Run `bin/setup-nightfall`

### Deploy

The contracts can be deployed using the deployer and worker containers. It's useful to keep a log file:

[ ] Run `bin/start-nightfall -n | tee deploy.log` *NB: do not use the `-g -d` arguments that you may be habituated with*.

[ ] Once you see the line `nightfall_3-deployer-1 exited with code 0` you can cntl-c to exit the deployment.

## Save trusted setup and contract data

The deployment will have created a `build` volume, a `.openzeppelin` volume and a `proving_files` volume. We need to copy the data from these to serve it out to deployed nightfall nodes. It's fine to shut the containers down at this stage because the volumes will persist.

[ ] Execute:

```sh
mkdir -p build && docker run --rm -v nightfall_3_build:/nightfall_3_build -w /nightfall_3_build busybox \
  tar cf - . \
| tar xvf - -C build

mkdir -p .openzeppelin && docker run --rm -v nightfall_3_.openzeppelin:/nightfall_3_.openzeppelin -w /nightfall_3_.openzeppelin busybox \
  tar cf - . \
| tar xvf - -C .openzeppelin

mkdir -p proving_files && docker run --rm -v nightfall_3_proving_files:/nightfall_3_proving_files -w /nightfall_3_proving_files busybox \
  tar cf - . \
| tar xvf - -C proving_files
```

This will copy the volumes into folders in the nightfall root directory so that they can be provided to organisations who wish to run a nightfall node.  Note that all of this information can be public domain.

## Add phase 2 contributions for production deploys

This step is only required for production deployment.

[ ] Decide on an ordered list of contributors. They must be able to install `snarkjs` on their machines.

[ ] Extract all of the `.zkeys` from the `proving_files` directoy and make them available for download (~126MB). There are seven of these.  Rename them `1.zkey, 2.zkey...7.zkey` and zip them into `zkeys.zip` to make it easier for contributors to process them.

[ ] Send [instructions](./phase2.md) to each participant in turn. Verify each contribution as it is received and update the downloadable `.zkey` files with each contribution as it is received, before sending out the instructions to the next participant.

[ ] When all contributions have been incorporated into the `.zkey` files, complete the phase 2 for each `.zkey` with a random beacon. Use the hash of a future Ethereum block, recording the block number on Ethereum before it is created.

[ ] Verify each key using `snarkjs`.

[ ] Make a new copy of the `proving_files` and overwite the `.zkeys` with the output `.zkeys` from the phase 2 reference string generation.

## Serve contract and trusted setup artifacts

[ ] When the deployment has completed, you will have a set of contract artifacts (contract ABIs and addresses) in your `build` directory, a similar set of artifacts supporting Openzepplin upgradeability (which we disable for a decentralised reployment by making the controlling Multisig contract unaccessible) in the `.openzeppelin` directory and a set of proving keys and binaries for the ZKP circuits in the `proving_files` directory. These must be made available to a publically accessible URL.

[ ] The current method for serving out the data is to tar the files and upload them to the `nightfall-artifacts` repo. First tar and zip the artifact files:

```sh
mkdir mumbai
mv proving_files/ build/ .openzeppelin/ mumbai/
tar czvf mumbai.tar.gz mumbai
shasum mumbai.tar.gz | tee mumbai.sha # useful for being sure you have the correct file put it in a file called sha.txt and push it
```

[ ] Then push the tar archive to the `nightfall-artifacts` repo.
