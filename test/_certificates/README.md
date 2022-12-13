# Certificates for Testing

For generating a valid end-user certificate use the script `gen-end_user-certificate.sh` passing over the user's suffix (e.g. `gen-end_user-certificate.sh 1` 
will generate certificate stuff for user `user-1`). The users' certificates are prefixed with `user-` and are suffixed with the user's number that links the user 
that is going to be used for testing.

For generating a bad certificate, a expired one and one with invalid key usage, use the script `gen-end_user-bad-certificate.sh` passing over the user's suffix. The "expired" certificate isn't properly expired, since it is not possible to generate 
a certificate already expired, but it will be valid until the next day.

The good certificates will go under the folder `_certificates/user` while the invalid ones are under the `_certificates/user/invalid` folder.

One should tunning the parameters accordingly with the necessity (e.g. cert key usage, oid, etc). All stuff related to the Certificate Authority (CA) are prefixed by `root_`:
- root_ca.authority_key: contains the Authority Key that is used to initialize the X509 contract;
- root_ca.public_key.modulus: contains the Modulus that that is used to initialize the X509 contract;
- root_ca.pub_key & root_ca.priv_key: the CA pub & private keys respectively.

The root & intermediate certificates are already generated. If a re-generation is needed, one should run `./gen-root_ca-certificate.sh`. Remember that after 
regenerating the root & intermediate CA certs, the users certificate should also be regenerated!

The certificates are by default generated in the DER format.

For seeing the certificate details one can use `openssl` with the following command: `openssl x509 -noout -in user/user-1.crt -text`.