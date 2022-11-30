# Certificates for Testing

For generating the certificates use the script `gen-user-certs.sh`. One should tunning the parameters accordingly with the necessity (e.g. total_users, cert key usage, etc).
All information related to the Certificate Authority are prefixed by 'root_':
- root_ca.authority_key: contains the Authority Key that is used to initialize the X509 contract;
- root_ca.public_key.modulus: contains the Modulus that that is used to initialize the X509 contract;
- root_ca.crt: the X509 CA certificate;
- root_ca.pub_key & root_ca.priv_key: the CA pub & private keys respectively.

The certificates are by default generated in the DER format.

The users' certificates are prefixed with `user` and are suffixed with the user's number that links the user that is going to be used for testing.

The good certificates are under this folder (`_certificates/user`) while the invalid ones are under the `_certificates/user/invalid` folder.
