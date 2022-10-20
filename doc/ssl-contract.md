Ethereum uses the EC secp256k1 curve.

Could just have a CA directly add addresses to a whitelist. Extend this idea so that you can have chains of addresses, each added by the next one up in the turust heirachy.

ssl certs x509 signing algos.

lightweight certs.

ens blockchain native certs


register westlad.co.uk

get westlad.co.uk ssl cert

use DNSSEC integration to register

<my address>.westlad.co.uk on ENS


1) provide identity authentication cert to kyc contract (associates identity with domain). These are all at the level of mydomain.xyz
2) once authenticated, mydomain.xyz can add any number of sub domains, associating them with an address, there is no need for an ssl cert
3) mydomain.xyz takes on the role of a registrar when the do that; they are responsible for subdomain.mydomain.xyz. This pattern can continue recursively.

Effectively, therefore we create a hierachy of Ethereum addresses, each address points to the address that added it to the contract, until we get to the root key, at which point we are able to resolve the domain that added it.
