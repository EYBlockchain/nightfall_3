# Ping-Pong Test

This test moves tokens between two entities for an extended period. It is intended that the code is
deployed to two disparate servers and allowed to run there.

## Scripts

All scripts should be run from the directory `test/ping-pong`. Information on all scripts can be
accessed with the `-h` or `--help` argument. Note that running some of the scripts with no arguments
still causes them to do things - so don't do that just to see what happens.

- `./pong-down [-v|--volumes]` This will bring down all running containers and, if the `-v` argument
  is used, will delete all persistent volumes too.
- `./pong-nightfall [-d|--deployer] [-s|stubs] [-r|--ropsten]` This will bring up the nightfall
  containers (client, optimist and dependencies). It is a bit like `./start-nightfall` except it
  won't do contract deployment or trusted-setup unless the `-d` option is specified. It also expects
  a blockchain node to be already running. Without the `-r` option, it will look on `localhost`,
  with the `-r` option it will look for the node url specified in `docker-compose.ropsten.yml`. This
  needs to be set manually. `-s` will use stubbed circuits. That is only useful for local testing.
  Note that the docker containers access localhost via `host.docker.internal` so, if you are not
  using a Mac, you will need to set this to your localhost's external ip address, in the containers'
  `hosts` files.
- `./pong-apps [ -r|--ropsten]`. This will run up the applications that use nightfall to run the
  test. currently there are two (proposer, which will propose blocks; and user-local, which will run
  a very simple deposit test then exit). Run this _after_ nightfall is running.

You can of course control containers individually via docker-compose but you will need to append the
appropriate docker-compose files to your command (e.g.
`-f docker-compose.yml -f docker-compose.host.docker.internal.yml -f docker-compose.stubs.yml`).

### Testing (Mac)

To test locally, run up a local blockchain client (`./ganache-standalone -s` or
`./geth-standalone -s`). The former will be much faster.

Then open two terminals. In the first do:

```sh
cd test/ping-pong
./pong-down -v
./pong-nightfall -d -s
```

Wait until nightfall has run up, then in the other terminal do:

```sh
cd test/ping-pong
./pong-apps
```

You should see the container images being pulled and then some transactions appearing in the
nightfall terminal and then, after about 4 minutes, in the other terminal, the `user-local1` and
`user_local2` containers will exit with the log.info line `Test passed`.

Note, `TEST_LENGTH` variable can be set for `user_local1` and `user_local2` in
`test/ping-pong/docker-compose.yml` to decide how long the test should run for.

### Testing (Linux)

Testing on a Linux machine will require the `/etc/hosts` file in each container to be edited to
point `host.docker.internal` to the external IP address of the host machine. Hopefully someone will
push detailed instructions when they've done this.

# Upgrade test

This is a simple test that upgrading a contract works successfully.  It's not intended to be a
regular test. To test, simply run the script:
```sh
cd test/ping-pong
./upgrade-test.sh
```
It will run the ping-pong test twice, upgrading the `State` contract in between. The only difference
between the two is a constant value `version`, which gets incremented. The first time
the test runs, look for the `info` log output `State contract version is 0.0.1`.  The second time the test
runs, the contract's version will be `0.0.2`. The test takes a little while (~5 mins) so be patient.
The console output should provide helpful hints about progress.
