# Checking sanctions list

Nightfall automatically checks the Chainalysis sanctions screening oracle [contract](https://go.chainalysis.com/chainalysis-oracle-docs.html#:~:text=The%20Chainalysis%20oracle%20is%20a,included%20in%20a%20sanctions%20designation).

Although this check arguably forms part of a KYC check, it is not done via the KYC interface. This is because the sanctions contract already exposes its own interface, and manages its own blacklisting, thus there is nothing for Nightfall to do, other than to check the mapping held by the Chainalysis contract via the `SanctionsListInterface.sol` interface.

When testing, Nightfall uses a stub contract to simulate the Chainalysis one.  This has one sanctions-listed user (set in the default config's `TEST_OPTIONS` section) for test purposes. Nightfall will autmatically deploy this stub if the default config `SANCTIONS_CONTRACT` constant is set to anything other than an Ethereum address, in which case it will not deploy a stub but will call the sanctions list interface at that address.


