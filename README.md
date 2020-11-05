<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Testing nightfall-client](#testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-client

This code generates a containerised application that can be used to interact with Nightfall_2 via
http endpoints.

## Testing nightfall-client

You'll need Node version >=12.18 so that you have ESM support.

First, pull the latest version of Timber (these instructions were tested with v3.2.0). This is an
important step because Docker won't check to see if the 'latest' version you have locally is up to
date with dockerhub.

```sh
$ docker pull eyblockchain/timber:latest
```

Clone the [nightfall-client](https://github.com/EYBlockchain/nightfall-client) repository. To run
this code in developer mode, you will also need to clone:

- [zokrates-worker](https://github.com/EYBlockchain/zokrates-worker)
- [nightfall-deployer](https://github.com/EYBlockchain/nightfall-deployer)
- [nightfall-timber](https://github.com/EYBlockchain/nightfall-timber)

Make sure you put all of these repositories under a common root in your file system because the
docker-compose yaml assumes they are accessible via `../<appplication>`. Then, in the
`nightfall-client` root directory, locally install the files you'll need for testing via:

```sh
$ npm i
```

Build the docker images (you only need do this once unless you makes changes to package.json). To do
this you will need a personal access token with repo permissions. This is because one of the build
stages of `zokrates-worker` needs to pull a GPR package:

```sh
$ docker-compose build --build-arg GPR_TOKEN=<paste your token here>
```

You'll see some warnings about the build arg not being needed for some of the images. This is true
because it's only used by zokrates-worker so you can safely ignore the warning. If you want to avoid
needing a personal access token, and you aren't going to be working with `zokrates-worker` code,
edit `nightfall-client`'s `docker-compose.yml` file to pull an image of `zokrates-worker`, rather
than build it locally.

Once the build completes run the images up:

```sh
$ docker-compose up
```

If this is the first run, nightfall-deployer will do a trusted setup of the proving circuits. This
takes about 30 mins. Subsequently it will omit this step if it detects a trusted setup.

You may (will) find that the timber service errors and restarts once or twice. This is fine provided
it does finally start (you can tell if it reports that it has subscribed to the NewLeaf and
NewLeaves events). It's because Timber has been configured to `AUTOSTART`, however this will fail
until the Shield contract has been deployed, at which point Timber will be able to obtain a Shield
contract address. Given this situation will not arise in normal use, it's acceptable, although you
can start Timber separately, after the other services are up, if you prefer.

Once the setup is done and the smart contracts are deployed, you will see `nightfall-deployer` exit
with `code 0`. At this point you can run the tests. Open another terminal in the same directory
(root of `nightfall-client`) and run `npm test`.

Once the tests are complete you can run `docker-compose down` or `docker-compose down -v`, although
the latter will require you to re-do the trusted setup. You can also reset the Timber database
without deleting the trusted setup by running the `./kill-timberdb` script. This is useful as the
database can sometimes get out of step if the tests are aborted. A clue that this is the issue will
be that the logging shows `null` leaf values being returned. It's generally simplest to always use
`./kill-timberdb` to restart the environment for all times when you don't want a trusted setup to be
re-done.
