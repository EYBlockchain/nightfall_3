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

mkdir -p user

user_name=user-$1

echo "Generating self-signed certificate for user '$user_name'"

openssl genpkey -outform DER -pkeyopt rsa_keygen_bits:4096 -algorithm RSA -out user/$user_name.priv_key -quiet

# generates a certification request
openssl req -new \
  -subj "/C=IN/ST=Mumbai/O=Polygon Technology/OU=Nightfall Team/CN=$user_name/emailAddress=$user_name@polygon.technology" \
  -key user/$user_name.priv_key -out user/$user_name.csr

# generates a valid certificate
openssl x509 -req \
  -CA intermediate_ca.crt \
  -CAkey intermediate_ca.priv_key \
  -days 1825 \
  -extfile conf/extfile.conf \
  -extensions extensions \
  -outform DER \
  -in user/$user_name.csr \
  -out user/$user_name.crt

rm user/$user_name.csr
