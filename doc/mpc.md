# Multiparty Computation

At Nightfall, we use Multiparty Computation to generate the trusted setup for the circuits. This
ensures all circuits are safe and trustless.

The MPC envolves two phases:

- Phase 1, common to all circuits. We use we use the Perpetual Powers of Tau (PPOT) ceremony since
  it ensures that if at least one participant of the ceremony is honest, then the result is forcibly
  trustablke.
- Phase 2, which is circuit-specific and needs to be generated upon deployment.

## Radix files

The radix files are the MPC params that are calculated from the latest response file from PPOT.
These radix files have specific depths depending on the number of constraints for each circuit, and
can take a while to compute. They're also quite big in size so we shouldn't commit them to git.
Instead, we store them in a publicly accessible S3 bucket, and the `zokrates-worker` fetches them
synchonously if they're not present in the docker volume.

Does this mean you have to trust these radix files? No! Because you can start the process on your
own, and create your own radix files. You don't need to trust anybody.

## How can I not trust people

You are able to bring your own keys to the table. For that, you need to get the latest response from
the [PPOT ceremony](https://github.com/weijiekoh/perpetualpowersoftau) and download the
`new_challenge` file, rename it to `challenge` and run the little `mpc.sh` script you'll find
[here](https://github.com/EYBlockchain/nightfall_3/blob/master/zokrates-worker/src/mpc.sh). This
script will spit out a bunch of radix files like `phase1radix2m2`, `phase1radix2m3`...
`phase1radix2m(n)` where `n` should be the depth of the circuit we're using.

This means number of constraints, which you can get by running `zokrates compile` to compile the
circuits, and then `zokrates inspect` on the compiled circuits, which should spit out the number of
constraints. You should pick a value of `n` for which `2^n` is bigger than the number of
constraints. For example, at the time of writing, the compiled `deposit` circuit has `84766`
constraints so we need to pick up the `phase1radix2m17` as `2^16 < 84766 < 2^17`.

You should rename these radix files to the name of the circuits, and host them somewhere. IPFS, S3
buckets, your own webserver, whatever you want.

Lastly, don't forget to modify the env variable `RADIX_FILES_URL` to point to the URL where you'll
get the radix files.
