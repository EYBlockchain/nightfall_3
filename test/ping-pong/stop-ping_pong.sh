#! /bin/bash
for (( i=1; i<=2 ; i++ ))
do
  docker stop proposer_${i}  
  docker stop proposer_optimist_${i}
  docker stop optimist_mongodb_${i}
  docker rm optimist_mongodb_${i}
  sudo rm -rf /var/lib/nightfall/optimist_mongodb_${i}
done