<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [zokrates-zexe-microservice](#zokrates-zexe-microservice)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
  - [Docker Image](#docker-image)
  - [Building an new Docker Image](#building-an-new-docker-image)
  - [Testing](#testing)
  - [Endpoints](#endpoints)
    - [`loadCircuit`](#loadcircuit)
    - [`generateKeys`](#generatekeys)
    - [`generateProof`](#generateproof)
    - [`vk`](#vk)
  - [Zokrates - writing & testing `.zok` circuit files](#zokrates---writing--testing-zok-circuit-files)
    - [a) mounting to zokrates in the terminal (recommended)](#a-mounting-to-zokrates-in-the-terminal-recommended)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# zokrates-zexe-microservice

## Prerequisites

1. Install [Docker for Mac](https://www.docker.com/docker-mac), or
   [Docker for Windows](https://www.docker.com/docker-windows)

## Getting Started

1. Clone this repository to your computer:
   `git clone git@github.com:EYBlockchain/zokrates-zexe-microservice.git`
1. Run:

```sh
cd zokrates-zexe-microservice
npm install
```

```sh
docker-compose build
docker-compose up -d
```

When docker is done building, the API will be available at `http://localhost:8080`.

## Docker Image

There is also a docker image of this `zokrates-zexe-microservice`. It can be pulled from GitHub:

```sh
docker pull docker.pkg.github.com/eyblockchain/zokrates-zexe-microservice/zokrates_zexe_microservice:<tag>
```

You will need a GitHub token with package read permission so that you can log in to
`docker.pkg.github.com` to pull the image. The instructions on how to make one of these are
[here](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).
To log in to docker:

## Building an new Docker Image

There is no automated build of the Docker image stored in the package repository. Thus, if you do
`git push` the Docker image **will not** be updated. This is because the image is build on top of
the `zokrates-zexe` image and it is not possible to credential github actions to pull that image (it
appears to be a limitation of Github currently). Thus, you must build it manually following these
instructions:

- Edit the first line of the Dockerfile so that the image is built `FROM` the correct zokrates-zexe
  image (normally this will be the most recent image available), then;

- ```sh
  $ git push
  $ docker build -t docker.pkg.github.com/eyblockchain/zokrates-zexe-microservice/zokrates_zexe_microservice:<tag> .
  $ docker push docker.pkg.github.com/eyblockchain/zokrates-zexe-microservice/zokrates_zexe_microservice:<tag>
  ```

````
_It is strongly recommended that the tag used is the commit hash of the git commit from which this image is built._

```sh
$ cat /path/to/TOKEN.txt | docker login https://docker.pkg.github.com -u USERNAME --password-stdin
````

Where `TOKEN.txt` contains your token.

## Testing

To test using the postman collection:

```sh
docker-compose up -d
npm test
```

To build and test without docker-compose:

```sh
docker build .  (note the image id)
docker run -p 8080:80 -e PROVING_SCHEME='gm17' <image id>
npm test
```

## Endpoints

Run the following instruction to ensure that the service is up:

`docker-compose up -d`

This should spin up a container called `api`. `api` contains RESTful endpoints for interacting with
the service.

The `api` service is a RESTful service that makes use of the `@eyblockchain/zokrates-zexe.js`
package, and has the following endpoints.

To be able to leverage the service, mount the `.zok` file(s) to
`/app/circuits/path/to/parent-dir/file.zok`, and run each of the instructions below per file. This
service can be exposed via a port set in the `docker-compose.yml` (`http://localhost:8080` in all
the example commands which follow).

### `loadCircuit`

This is a post instruction that takes a .zok file and uploads it. It will be stored in
`./circuits/`.

**Request body:**

`form-data`: key = `circuit`, value = `<file to upload>`

### `generateKeys`

This is a POST instruction that runs `compile`, `setup` and `exportVerifier` instructions.

**Request body:**

- `filepath`: the path of the `.zok` file (relative to `/app/circuits/`). E.g. for a file at
  `/app/circuits/path/to/test.zok` the filepath is `path/to/test.zok`.
- `curve`: specify one of: `[alt_bn128, bls12_381, bls12_377, bw6_761]`
- `provingScheme`: specify one of: `[g16, gm17, pghr13]`. Note: zexe functionality currently only
  works with `gm17`.
- `backend`: specify one of: `zexe`, `bellman`.

**Example:**

`curl -d '{"filepath": "path/to/test.zok", "curve": "bls12_377", "provingScheme": "gm17", "backend": "zexe"}' -H "Content-Type: application/json" -X POST http://localhost:8080/generate-keys`

Alternatively, the POSTMAN application can be used to run these curl requests. E.g. with body:

```json
{
  "filepath": "path/to/test.zok",
  "curve": "bls12_377",
  "provingScheme": "gm17",
  "backend": "zexe"
}
```

Note: All the resultant files from this step are stored in a new sub-directory of the `output`
directory, called `${circuitName}` (where, for example, if the `circuitName` is `test`, the output
files are stored in a dir `app/output/test/`).

### `generateProof`

This is a POST instruction that runs `compute-witness` and `generate-proof` instructions.

**Request body:**

- `folderpath`: the path of the circuit folder (relative to `/app/outputs/`). E.g. for a folder at
  `/app/outputs/path/to/test` the folderpath is `path/to/test`. The folder contains the keys related
  to the circuit
- `inputs`: array of the arguments the the `main()` function of the circuit.

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
  "backend": "zexe"
}
```

Note: All of the resultant files from this step are stored in the same sub-directory of the `output`
directory, called `path/to/test` (where, for example, if the folderpath is `test/circuit`, the
output files are stored in a dir `app/output/test/circuit`).

### `vk`

This is a GET request, to retrieve a vk from disk. (Note: a trusted setup will have to have taken
place for the vk to exist).

**Request body:**

- `folderpath`: the path of the circuit folder (relative to `/app/outputs/`). E.g. for a folder at
  `/app/outputs/path/to/test` the folderpath is `path/to/test`. The folder contains the keys related
  to the circuit

**Example:**

`curl -d '{"folderpath": "path/to/test"}' -H "Content-Type: application/json" -X GET http://localhost:8080/vk`

Alternatively, the POSTMAN application can be used to run these curl requests. E.g. with body:

```json
{
  "folderpath": "path/to/test"
}
```

## Zokrates - writing & testing `.zok` circuit files

### a) mounting to zokrates in the terminal (recommended)

To test a particular `.zok` file manually in the terminal:

(You might need to do
`docker pull docker.pkg.github.com/eyblockchain/zokrates-zexe-microservice/zokrates_zexe_microservice:latest`
if you haven't already).

`cd path/to/parent-dir-of-zok-file/`

`docker run -v $PWD:/home/zokrates/code -ti docker.pkg.github.com/eyblockchain/zokrates-zexe-microservice/zokrates_zexe_microservice:latest /bin/bash`
(mounting to `/code` ensures the outputs from zokrates don't overwrite / mix with our local
machine's files).

`./zokrates compile -c bls12_377 -i code/<circuitName>.zok`

`./zokrates setup -b zexe -proving-scheme gm17`

`./zokrates compute-witness -a <inputs>`

`./zokrates generate-proof -b zexe -proving-scheme gm17`
