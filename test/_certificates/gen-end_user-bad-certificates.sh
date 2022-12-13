#! /bin/bash
set -e

usage()
{
  echo "Usage: ./gen-end_user-certificates.sh [user_suffix]"
}

if [ -z "$1" ]; then
   usage
   exit 1
fi

mkdir -p user/invalid/expired
mkdir -p user/invalid/unproper-key-usage

user_name=user-$1

echo "Generating self-signed certificate for user '$user_name'"

openssl genpkey -outform DER -pkeyopt rsa_keygen_bits:4096 -algorithm RSA -out user/invalid/$user_name.priv_key -quiet

# generates a certification request
openssl req -new \
  -subj "/C=IN/ST=Mumbai/O=Polygon Technology/OU=Nightfall Team/CN=$user_name/emailAddress=$user_name@polygon.technology" \
  -config conf/oid.conf \
  -key user/invalid/$user_name.priv_key -out user/invalid/$user_name.csr

echo -e "\nGenerating one-day certificate"
# generates a certificate that will expire tomorrow. There isn't how to set a value lower than one (already expired)
openssl x509 -req \
  -CA intermediate_ca.crt \
  -CAkey intermediate_ca.priv_key \
  -days 1 \
  -extfile conf/extfile.conf \
  -extensions extensions \
  -outform DER \
  -in user/invalid/$user_name.csr \
  -out user/invalid/expired/$user_name.crt

echo -e "\nGenerating certificate with incorrect key usage"

# generates a new request with the wrong key usage
openssl x509 -req \
  -CA intermediate_ca.crt \
  -CAkey intermediate_ca.priv_key \
  -days 1825 \
  -extfile conf/extfile-wrong.conf \
  -extensions extensions \
  -outform DER \
  -in user/invalid/$user_name.csr \
  -out user/invalid/unproper-key-usage/$user_name.crt

rm user/invalid/$user_name.csr user/invalid/$user_name.priv_key

echo "---"
