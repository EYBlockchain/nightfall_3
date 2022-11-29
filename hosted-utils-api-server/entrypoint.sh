#!/usr/bin/env bash

# change abi file names
cd /app/public
for PROVING_FILE_FOLDERS in * ; do
  if [ -d "${PROVING_FILE_FOLDERS}" ]; then
     echo "PROVING FILE FOLDER : ${PROVING_FILE_FOLDERS}"
  fi
done
md5deep -r -s -b . > hash.txt
echo -e "[" > s3_hash.txt
for PROVING_FILE_FOLDERS in * ; do
  echo $PROVING_FILE_FOLDERS
  if [ -d "${PROVING_FILE_FOLDERS}" ]; then
    HF_ZKEY=$(cat hash.txt | grep ${PROVING_FILE_FOLDERS}.zkey | awk '{print $1}')
    HF_WASM=$(cat hash.txt | grep ${PROVING_FILE_FOLDERS}.wasm | awk '{print $1}')
    echo -e "\t{" >> s3_hash.txt
    echo -e "\t\t\"name\": \"${PROVING_FILE_FOLDERS}\","  >> s3_hash.txt
    echo -e "\t\t\"zkh\": \"${HF_ZKEY}\"," >> s3_hash.txt
    echo -e "\t\t\"zk\": \"circuits/${PROVING_FILE_FOLDERS}/${PROVING_FILE_FOLDERS}.zkey\"," >> s3_hash.txt
    echo -e "\t\t\"wasmh\": \"${HF_WASM}\"," >> s3_hash.txt
    echo -e "\t\t\"wasm\": \"circuits/${PROVING_FILE_FOLDERS}/${PROVING_FILE_FOLDERS}.wasm\"" >> s3_hash.txt
    echo -e "\t}," >> s3_hash.txt
  fi
done
# Remove last line
sed -i '$d' s3_hash.txt
echo -e "\t}" >> s3_hash.txt
echo -e "]" >> s3_hash.txt

exec "$@"
