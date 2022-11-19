<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [worker](#worker)
  - [Prerequisites](#prerequisites)
  - [Getting Started - Development](#getting-started---development)
  - [Getting Started - Docker Image](#getting-started---docker-image)
  - [Testing](#testing)
  - [Endpoints](#endpoints)
    - [`load-circuits`](#load-circuits)
    - [`generate-keys`](#generate-keys)
    - [`generate-proof`](#generate-proof)
    - [`vk`](#vk)
    - [`verify`](#verify)
  - [Circom - writing & testing `.circom` circuit files](#circom---writing--testing-circom-circuit-files)
    - [a) mounting to circom in the terminal (recommended)](#a-mounting-to-circom-in-the-terminal-recommended)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# worker

## Prerequisites

1. Install [Docker for Mac](https://www.docker.com/docker-mac), or
   [Docker for Windows](https://www.docker.com/docker-windows)

## Getting Started - Development

1. Run:

```sh
cd worker
npm install
```

```sh
docker-compose build --no-cache --build-arg NPM_TOKEN=${NPM_TOKEN}
docker-compose up -d
```

When docker is done building, the http:// API will be available at `http://localhost:8080`.

## Getting Started - Docker Image

There is also a docker image of `worker`. It can be pulled from GitHub:

```sh
docker pull docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:<version>
```

You will need a GitHub token with package read permission so that you can log in to
`docker.pkg.github.com` to pull the image. The instructions on how to make one of these are
[here](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).

Once available, you can run the docker image with the following command

```sh
docker run -p 8080:80 docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:<version>
```

## Testing

To test locally:

```sh
docker-compose up -d
npm test
```

To build and test without docker-compose:

```sh
docker build --build-arg NPM_TOKEN=${NPM_TOKEN} .  (note the image id)
docker run -p 8080:80 -v $PWD/output:/app/output -v $PWD/circuits:/app/circuits <image id>
npm test
```

To test using the published Docker image:

```sh
docker run -p 8080:80 -v $PWD/output:/app/output -v $PWD/circuits:/app/circuits docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:<version>
```

## Endpoints

Run the following instruction to ensure that the service is up:

`docker-compose up -d`

This should spin up a container called `api`. `api` contains RESTful endpoints for interacting with
the service.

The `api` service is a RESTful service that makes use of the `@eyblockchain/zokrates-zexe.js`
package, and has the following endpoints.

To be able to leverage the service, mount the `.zok` file(s) to `/app/circuits/path/to/file.zok` or
load them via the `load-circuits` endpoint (see below). If using the `load-circuits` enpoint, you
can also use a `.tar` archive of `.zok` files to quickly load several files.

This service lists on container port 80 and can be exposed via a port set in the
`docker-compose.yml` (`http://localhost:8080` in all the example commands which follow).

### `load-circuits`

This is a post instruction that takes a `.zok` or a `.tar` archive of `.zok` files and uploads
it/them. It/they will be stored in `./circuits/`.

If a tar file was used, the unpacked files will be in a subdirectory,named after the tar file, with
the `.tar` extension removed.

**Request body:**

`form-data`: key = `circuits`, value = `<file to upload>`

### `generate-keys`

This is a POST instruction that runs `compile`, `setup` and `exportVerifier` instructions.

**Request body:**

- `filepath`: the path of the `.zok` file (relative to `/app/circuits/`). E.g. for a file at
  `/app/circuits/path/to/test.zok` the filepath is `path/to/test.zok`.
- `curve`: specify one of: `[bn128, bls12_381]`
- `provingScheme`: specify one of: `[g16, gm17, pghr13]`.
- `backend`: specify one of: `libsnark`, `bellman`.

Note, Nightfall currently uses `[ bn128, libsnark, gm17]`

**Example:**

`curl -d '{"filepath": "path/to/test.zok", "curve": "bn128", "provingScheme": "gm17", "backend": "libsnark"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys`

Alternatively, the POSTMAN application can be used to run these curl requests. E.g. with body:

```json
{
  "filepath": "path/to/test.zok",
  "curve": "bn128",
  "provingScheme": "gm17",
  "backend": "libsnark"
}
```

Note: All the resultant files from this step are stored in a new sub-directory of the `output`
directory, called `${circuitName}` (where, for example, if the `circuitName` is `test`, the output
files are stored in a dir `app/output/test/`).

### `generate-proof`

This is a POST instruction that runs `compute-witness` and `generate-proof` instructions.

**Request body:**

- `folderpath`: the path of the circuit folder (relative to `/app/outputs/`). E.g. for a folder at
  `/app/outputs/path/to/test` the folderpath is `path/to/test`. The folder contains the keys related
  to the circuit
- `inputs`: array of the arguments for the witness computation.

The `/app/circuits/output` dir has the outputs of these steps copied from within the container. When
the `generate-proof` instruction is run, the corresponding `proof.json` is stored in the
`/app/circuits/output` dir.

**Example:**

`curl -d '{"folderpath": "path/to/test", "inputs": [6, 3, 2]}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-proof`

Alternatively, the POSTMAN application can be used to run these curl requests. E.g. with body:

```json
{
  "folderpath": "path/to/test",
  "inputs": [6, 32, 2],
  "provingScheme": "gm17",
  "backend": "libsnark"
}
```

Note: All of the resultant files from this step are stored in the same sub-directory of the `output`
directory, called `path/to/test` (where, for example, if the folderpath is `test/circuit`, the
output files are stored in a dir `app/output/test/circuit`).

### `vk`

This is a GET request, to retrieve a vk from disk. (Note: a trusted setup will have to have taken
place for the vk to exist).

**query parameters:**

- `folderpath`: the path of the circuit folder (relative to `/app/outputs/`). E.g. for a folder at
  `/app/outputs/path/to/test` the folderpath is `path/to/test`. The folder contains the keys related
  to the circuit

**Example:**

`curl -H "Content-Type: application/json" -X GET http://localhost:8080/vk?folderpath=test`

Alternatively, the POSTMAN application can be used to run these curl requests. E.g. with params:

key: "folderpath", value: "test"

### `verify`

This is a POST request to verify a proof offchain. It does not require any trusted setup because all
of the data that zokrates-worker needs is contained within the POST. The inputs are somewhat lengthy
however so testing with curl or Postman is awkward. However, the JSON inputs are as follows:

```
{
  "vk": // the verifying key JSON in the same format as the ZoKrates file
  "proof": // the proof JSON in the same format as the ZoKrates proof file
  "provingScheme": // "gm17", "g16" etc, as ZoKrates command line,
  "backend": // "ark", "libsnark" etc, as ZoKrates command line,
  "curve": // "bn128", "bls12_377" etc, as ZoKrates command line,
  "inputs": // if the proof does not have an 'inputs' property, it can be added here
}
```

## Zokrates - writing & testing `.zok` circuit files

### a) mounting to zokrates in the terminal (recommended)

To test a particular `.zok` file manually in the terminal:

(You might need to do
`docker pull docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_zexe_worker:<version>` if
you haven't already).

`cd path/to/parent-dir-of-zok-file/`

`docker run -v $PWD:/home/zokrates/code -ti docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:<version> /bin/bash`
(mounting to `/code` ensures the outputs from zokrates don't overwrite / mix with our local
machine's files).

`./zokrates compile -c bn128 -i code/<circuitName>.zok`

`./zokrates setup -b libsnark -proving-scheme gm17`

`./zokrates compute-witness -a <inputs>`

`./zokrates generate-proof -b libsnark -proving-scheme gm17`
