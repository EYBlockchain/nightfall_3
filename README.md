<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [nightfall-client](#nightfall-client)
  - [Testing nightfall-client](#testing-nightfall-client)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# nightfall-client

This code generates a containerised application that can be used to interact with Nightfall_2 via
http endpoints.

## Testing nightfall-client

Clone the repository. To run this code in developer mode, you will also need to clone:

- nightfall-deployer
- nightfall-timber

Make sure you put all of these repositories under a common root in your file system because the
docker-compose yaml assumes they are accessible via `../<appplication>`. Then, in the
`nightfall-client` root directory, locally install the files you'll need for testing via:

```sh
$ npm i
```

build the container images (you only need do this once):

```sh
$ docker-compose build
```

and then run them up:

```sh
$ docker-compose up
```

If this is the first run, nightfall-deployer will do a trusted setup of the proving circuits. This
takes about 30 mins. Subsequently it will omit this step if it detects a trusted setup.

Once the setup is done and the smart contracts are deployed, you will see `nightfall-deployer` exit
with code 0. At this point you can run the tests. Open another terminal in the same directory (root
of `nightfall-client`) and run `npm test`.

Once the tests are complete you can run `docker-compose down` or `docker-compose down -v`, although
the latter will require you to re-do the trusted setup. You can also reset the Timber database
without deleting the trusted setup by running the `./kill-timberdb` script. This is useful as it can
sometimes get out of step if the tests are aborted. A clue that this is the issue will be that the
logging shows `null` leaf values being returned.
