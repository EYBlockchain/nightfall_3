# Pub-Sub Test

This test deploys a publisher node that will receive events from the proposer, and will publish
them to a client-less subsciber using AWS IOT publishing services. Events published are proposed blocks
that contain transactions from two users. 

## Scripts

All scripts should be run from the directory `test/pub-sub`. Information on all scripts can be
accessed with the `-h` or `--help` argument. Note that running some of the scripts with no arguments
still causes them to do things - so don't do that just to see what happens.

- `./pub-down [-v|--volumes]` This will bring down all running containers and, if the `-v` argument
  is used, will delete all persistent volumes too.
- `./pub-nightfall [-d|--deployer] [-s|stubs] [-r|--ropsten]` This will bring up the nightfall
  containers (client, optimist and dependencies). It is a bit like `./start-nightfall` except it
  won't do contract deployment or trusted-setup unless the `-d` option is specified. It also expects
  a blockchain node to be already running. Without the `-r` option, it will look on `localhost`,
  with the `-r` option it will look for the node url specified in `docker-compose.ropsten.yml`. This
  needs to be set manually. `-s` will use stubbed circuits. That is only useful for local testing.
  Note that the docker containers access localhost via `host.docker.internal` so, if you are not
  using a Mac, you will need to set this to your localhost's external ip address, in the containers'
  `hosts` files.
- `./pub-apps [ -r|--ropsten]`. This will run up the applications that use nightfall to run the
test. currently there are two (proposer, which will propose blocks; a publisher node, which will
publish events received from the proposer, and a subsciber node, which will receive the updates 
sent by the publisher). Run this _after_ nightfall is running.

You can of course control containers individually via docker-compose but you will need to append the
appropriate docker-compose files to your command (e.g.
`-f docker-compose.yml -f docker-compose.host.docker.internal.yml -f docker-compose.stubs.yml`).

### Testing (Mac)

To test locally, run up a local blockchain client (`./ganache-standalone -s` or
`./geth-standalone -s`). The former will be much faster.

Then open two terminals. In the first do:

```sh
cd test/pub-sub
./pub-down -v
./pub-nightfall -d -s
```

Wait until nightfall has run up, then in the other terminal do:

```sh
cd test/pub-sub
./pub-apps 
```

You should see the container images being pulled and then some transactions appearing in the
nightfall terminal and then, after about 4 minutes, in the other terminal, the `publisher` and
`subscriber` containers will exit with the log.info line `Test passed`.


### Testing (Linux)

Testing on a Linux machine will require the `/etc/hosts` file in each container to be edited to
point `host.docker.internal` to the external IP address of the host machine. Hopefully someone will
push detailed instructions when they've done this.


### Configuring Permissions
Publishing uses IoT AWS service. To be allowed to send and receive messages trough AWS, we need to
download some keys from a lambda funtion deployed in AWS. To check if this lambda function is operational,
open `test/pub-sub/docker-compose.host.docker.internal.yml` as try to call the endpoint in `PUBLISHER_KEYS_URL`.
If this endpoint provides key information you can skip this step. Otherwise, you will need to
deploy the lambda function to provide keys.

1 - Ensure you have valid AWS credentials deployed
```
aws configure
```
2 - Create AWS IOT Role
```
cd admin/create-role
npm i
node index.js
```

3 - Create AWS Lambda function that generates temporary keys
```
cd admin
npm install serverless -g
serverless deploy
```
This step generates an Endpoint. You should copy that endpoint and add it to
`test/pub-sub/docker-compose.host.docker.internal.yml` as `PUBLISHER_KEYS_URL`



