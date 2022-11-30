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
  #-subj "/C=/ST=/O=Polygon Technology/OU=Nightfall Team/CN=Polygon Technology CA/emailAddress="

# outputs the authority key with the correct padding
{ echo "0x"; printf %064s $(openssl x509 -noout -in root_ca.crt -text -ext authorityKeyIdentifier | tail -n 1 | sed 's/ //g' | sed 's/://g') | sed 's/ /0/g'; } | tr -d '\n'> root_ca.authority_key
