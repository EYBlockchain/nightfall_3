# Checking sanctions list

When submitting a transaction, Nightfall automatically checks the sender address against Chainalysis sanctions screening oracle [contract](https://go.chainalysis.com/chainalysis-oracle-docs.html#:~:text=The%20Chainalysis%20oracle%20is%20a,included%20in%20a%20sanctions%20designation).

Although this check arguably forms part of a KYC check, it is not done via the KYC interface. This is because the sanctions contract already exposes its own interface, and manages its own blacklisting, thus there is nothing for Nightfall to do, other than to check the mapping held by the Chainalysis contract via the `SanctionsListInterface.sol` interface.

When testing, Nightfall can use a stub contract to simulate the Chainalysis one. This has one sanctions-listed user (set in the default config's `TEST_OPTIONS` section) for test purposes. The environment variable `DEPLOY_MOCKED_SANCTIONS_CONTRACT` allows one to control which contract will be used in the deployment - setting to `true` will make Nightfall to use the stub (mocked contract), while setting it to `false` will make it to use the Chainalysis one.
