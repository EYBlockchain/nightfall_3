#! /bin/bash

if [[ -z "$ECR_REPO" || -z "${AWS_REGION}" || -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "Please specify the environment variables: ECR_REPO, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
  exit 1
fi

generateHashes()
{
  for entry in "$1"/*
  do
    if [ -f "$entry" ]; then
      md5sum ${entry//.\//}
    else
      cd $entry
      generateHashes "."
      cd ..
    fi
  done
}

# changes to project root
cd ../..

if [ -z "${SKIP_BUILD}" ]; then
  ## pushes images to ECR
  aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

  echo -e "\nBuilding services...\n"

  if [[ "${BUILD_SERVICES}" == *"ganache"* ]]; then
    docker pull trufflesuite/ganache:v7.7.3
    docker tag trufflesuite/ganache:v7.7.3 ${ECR_REPO}/blockchain:ganache7.7.3
    docker push ${ECR_REPO}/blockchain:ganache7.7.3
  fi

  if [[ "${BUILD_SERVICES}" == *"client"* ]]; then
    docker build -t ${ECR_REPO}/nightfall-client:perf-test -f docker/client.Dockerfile .
    docker push ${ECR_REPO}/nightfall-client:perf-test
  fi

  if [[ "${BUILD_SERVICES}" == *"optimist"* ]]; then
    docker build -t ${ECR_REPO}/nightfall-optimist:perf-test -f docker/optimist.Dockerfile .
    docker push ${ECR_REPO}/nightfall-optimist:perf-test
  fi

  if [[ "${BUILD_SERVICES}" == *"proposer"* ]]; then
    docker build -t ${ECR_REPO}/nightfall-proposer:perf-test -f docker/proposer.Dockerfile .
    docker push ${ECR_REPO}/nightfall-proposer:perf-test
  fi
  
  if [[ "${BUILD_SERVICES}" == *"worker"* ]]; then
    docker build -t ghcr.io/eyblockchain/local-rapidsnark -f docker/rapidsnark.Dockerfile .
    docker build -t ${ECR_REPO}/nightfall-worker:perf-test -f docker/worker.Dockerfile .
    docker push ${ECR_REPO}/nightfall-worker:perf-test
  fi
fi

cd test/performance/terraform

if [ -z "${SKIP_TF}" ]; then

  echo -e "\nDeploying blockchain...\n"

  # Disable the deployment of all services, except blockchain
  export TF_VAR_DEPLOY_CLIENT="false"
  export TF_VAR_DEPLOY_OPTIMIST="false"
  export TF_VAR_DEPLOY_PROPOSER="false"
  export TF_VAR_DEPLOY_WORKER="false"

  # run terraform and exports the load balancer address to PERF_TEST_LOAD_BALANCER env var
  # Deploys Blockchain & S3 resources
  terraform apply -auto-approve > tf_execution.log

  export PERF_TEST_LOAD_BALANCER_BLOCKCHAIN=$(tail -n 10 tf_execution.log | sed  -n -e 's/^blockchain_load_balancer-address = //p' | sed 's/"//g')

  # sleeps for giving time for the services get up
  sleep 60

  # changes to project root
  cd ../../..
  
  echo -e "\nDeploying contracts...\n"

  # Deploys NF using ./bin/deploy-contracts with a local worker instance and AWS blockchain
  BLOCKCHAIN_URL="ws://$PERF_TEST_LOAD_BALANCER_BLOCKCHAIN:8546" ./bin/deploy-contracts ./test/performance/.env.deployment.perf-test

  # Waits until deployer has finished its work
  docker wait nightfall_3_deployer_1

  npm run nightfall-down

  echo -e "\nPublishing files to S3...\n"

  # then uploads the zkeys, verification keys and contracts ABIs to S3 to enable the AWS instances of worker and client to work smoothly
  cd test/performance/

  rm -rf temp-files
  mkdir -p temp-files

  # circuit files
  cp -rf ../../docker/volumes/proving_files temp-files/

  # generates the hash.txt file
  cd temp-files/proving_files
  generateHashes "." > hash.txt
  
  # Uploads the circuit files to S3
  s3cmd sync . s3://nightfall-perf-test/circuits/

  cd ../..

  # contract files
  cp -rf ../../docker/volumes/build temp-files/

  # generates the hash.txt file
  cd temp-files/build
  generateHashes "." > hash.txt

  # Uploads the contract files
  s3cmd sync . s3://nightfall-perf-test/contracts/

  cd ../..

  echo -e "\nDeploying remaining services...\n"

  # Deploys the remaining services
  export TF_VAR_DEPLOY_CLIENT="true"
  export TF_VAR_DEPLOY_OPTIMIST="true"
  export TF_VAR_DEPLOY_PROPOSER="true"
  export TF_VAR_DEPLOY_WORKER="true"

  terraform apply -auto-approve

  echo -e "\n** Process finished! **"
fi
