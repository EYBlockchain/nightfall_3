#! /bin/bash
set -e

usage()
{
  echo "Usage: ./gen-end_user-certificates.sh [total_users]"
}

if [ -z "$1" ]; then
   usage
   exit 1
fi

mkdir -p user/invalid/expired
mkdir -p user/invalid/unproper-key-usage

# total test users to be created
total_users=$1

for ((i=1; i <= $total_users; i++))
do
  user_name=user$i

  echo "Generating self-signed certificate for user '$user_name'"

  openssl genpkey -outform DER -pkeyopt rsa_keygen_bits:4096 -algorithm RSA -out user/$user_name.priv_key -quiet

  # Attributes to be used with the flag 'addext' - for more info see the command 'man x509v3_config':
  #
  #   keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment, keyAgreement, keyCertSign, cRLSign, encipherOnly, decipherOnly
  #   extendedKeyUsage = serverAuth, clientAuth, codeSigning, emailProtection, timeStamping, OCSPSigning, ipsecIKE, msCodeInd, msCodeCom, msCTLSign, msEFS
  #   subjectKeyIdentifier = hash
  #   authorityKeyIdentifier = keyid, issuer

  # generates a certification request
  openssl req -new \
    -subj "/C=IN/ST=Mumbai/O=Polygon Technology/OU=Nightfall Team/CN=$user_name/emailAddress=$user_name@polygon.technology" \
    -key user/$user_name.priv_key -out user/$user_name.csr

  # generates a valid certificate
  openssl x509 -req \
    -CA root_ca.crt \
    -CAkey root_ca.priv_key \
    -days 1825 \
    -extfile conf/extfile.conf \
    -extensions extensions \
    -outform DER \
    -in user/$user_name.csr \
    -out user/$user_name.crt

  echo -e "\nGenerating one-day certificate"
  # generates a certificate that will expire tomorrow. There isn't how to set a value lower than one (already expired)
  openssl x509 -req \
    -CA root_ca.crt \
    -CAkey root_ca.priv_key \
    -days 1 \
    -extfile conf/extfile.conf \
    -extensions extensions \
    -outform DER \
    -in user/$user_name.csr \
    -out user/invalid/expired/$user_name.crt

  echo -e "\nGenerating certificate with incorrect key usage"

  # generates a new request with the wrong key usage
  openssl x509 -req \
    -CA root_ca.crt \
    -CAkey root_ca.priv_key \
    -days 1825 \
    -extfile conf/extfile-wrong.conf \
    -extensions extensions \
    -outform DER \
    -in user/$user_name.csr \
    -out user/invalid/unproper-key-usage/$user_name.crt

  rm user/$user_name.csr

  echo "---"
done
