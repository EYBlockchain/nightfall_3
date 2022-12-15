#! /bin/bash
set -e

echo "Generating self-signed root CA certificate"

#openssl genrsa -out root_ca.priv_key 4096
openssl genpkey -outform DER -pkeyopt rsa_keygen_bits:4096 -algorithm RSA -out root_ca.priv_key -quiet
openssl rsa -in root_ca.priv_key -pubout -out root_ca.pub_key

# outputs the modulus pre-pending 00 to the value
{ echo "0x00"; openssl rsa -in root_ca.pub_key -pubin -modulus -noout | sed 's/Modulus=//g'; } | tr -d "\n" > root_ca.pub_key.modulus

openssl req -new -x509 \
  -days 1825 \
  -key root_ca.priv_key \
  -out root_ca.crt \
  -addext keyUsage=keyCertSign,cRLSign

# outputs the authority key with the correct padding
{ echo "0x"; printf %064s $(openssl x509 -noout -in root_ca.crt -text -ext authorityKeyIdentifier | tail -n 1 | sed 's/ //g' | sed 's/://g') | sed 's/ /0/g'; } | tr -d '\n'> root_ca.authority_key

###### generates an intermediate certificate
openssl genpkey -outform DER -pkeyopt rsa_keygen_bits:4096 -algorithm RSA -out intermediate_ca.priv_key -quiet

# generates a certification request
openssl req -new \
  -subj "/C=IN/ST=Mumbai/O=Intermediate CA/OU=Nightfall Team/CN=Intermediate CA/emailAddress=intermediate_ca@ca.com" \
  -addext keyUsage=keyCertSign,cRLSign \
  -key intermediate_ca.priv_key \
  -out intermediate_ca.csr

# generates a valid certificate
openssl x509 -req \
  -CA root_ca.crt \
  -CAkey root_ca.priv_key \
  -days 1825 \
  -extfile conf/ca_extfile.conf \
  -extensions extensions \
  -outform DER \
  -in intermediate_ca.csr \
  -out intermediate_ca.crt

rm intermediate_ca.csr
