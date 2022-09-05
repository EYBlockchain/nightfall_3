#!/usr/bin/env bash

# change abi file names
cd /app/public
for PROVING_FILE_FOLDERS in * ; do
  if [ -d "${PROVING_FILE_FOLDERS}" ]; then
     echo "PROVING FILE FOLDER : ${PROVING_FILE_FOLDERS}"
     if [ -f ${PROVING_FILE_FOLDERS}/_abi.json ]; then
       echo "${PROVING_FILE_FOLDERS}/_abi.json -> ${PROVING_FILE_FOLDERS}/${PROVING_FILE_FOLDERS}_abi.json"
       mv ${PROVING_FILE_FOLDERS}/_abi.json ${PROVING_FILE_FOLDERS}/${PROVING_FILE_FOLDERS}_abi.json
     fi
  fi
done
md5deep -r -s -b . > hash.txt
echo -e "[" > s3_hash.txt
echo "USE_STUBS: ${USE_STUBS}"
for PROVING_FILE_FOLDERS in * ; do
  if [ -d "${PROVING_FILE_FOLDERS}" ]; then
    skip=1
    if [ "${USE_STUBS}" = 'true' ] && [[ "${PROVING_FILE_FOLDERS}" == *"_stub" ]]; then 
      skip=0
    elif [ "${USE_STUBS}" = 'false' ] && [[ "${PROVING_FILE_FOLDERS}" != *"_stub" ]]; then
      skip=0
    fi
    if [ "${skip}" = "1" ]; then
      continue
    fi
    HF_PK=$(cat hash.txt | grep ${PROVING_FILE_FOLDERS}_pk | awk '{print $1}')
    HF_OUT=$(cat hash.txt | grep ${PROVING_FILE_FOLDERS}_out | awk '{print $1}')
    HF_ABI=$(cat hash.txt | grep ${PROVING_FILE_FOLDERS}_abi.json | awk '{print $1}')
    echo -e "\t\"circuit\": {" >> s3_hash.txt
    echo -e "\t\t\"name\": \"${PROVING_FILE_FOLDERS}\","  >> s3_hash.txt
    echo -e "\t\t\"pkh\": \"${HF_PK}\"," >> s3_hash.txt
    echo -e "\t\t\"pk\": \"circuits/${PROVING_FILE_FOLDERS}/keypair/${PROVING_FILE_FOLDERS}_pk.key\"," >> s3_hash.txt
    echo -e "\t\t\"programh\": \"${HF_OUT}\"," >> s3_hash.txt
    echo -e "\t\t\"program\": \"circuits/${PROVING_FILE_FOLDERS}/artifacts/${PROVING_FILE_FOLDERS}_out\"," >> s3_hash.txt
    echo -e "\t\t\"abih\": \"${HF_ABI}\"," >> s3_hash.txt
    echo -e "\t\t\"abi\": \"circuits/${PROVING_FILE_FOLDERS}/artifacts/${PROVING_FILE_FOLDERS}_abi.json\"," >> s3_hash.txt
    echo -e "\t}," >> s3_hash.txt
  fi
done
# Remove last line
sed -i '$d' s3_hash.txt
echo -e "\t}" >> s3_hash.txt
echo -e "]" >> s3_hash.txt

exec "$@"