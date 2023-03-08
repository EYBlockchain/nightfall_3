
if [[ -z "$ECR_REPO" || -z "${REGION}" ]]; then
  echo "Please specify the environment variables: ECR_REPO, REGION"
  exit 1
fi

## pushes images to ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

# changes to project root
cd ../..

if [ -z "${SKIP_BUILD}"]; then
  if [ "${BUILD_SERVICES}" == *"ganache"* ]; then
    docker pull trufflesuite/ganache:v7.7.3
    docker tag trufflesuite/ganache:v7.7.3 ${ECR_REPO}/blockchain:ganache7.7.3
    docker push ${ECR_REPO}/blockchain:ganache7.7.3
  fi

  if [ "${BUILD_SERVICES}" == *"client"* ]; then
    docker build -t ${ECR_REPO}/nightfall-client:perf-test -f docker/client.Dockerfile .
    docker push ${ECR_REPO}/nightfall-client:perf-test
  fi

  if [ "${BUILD_SERVICES}" == *"worker"* ]; then
    docker build -t ghcr.io/eyblockchain/local-rapidsnark -f docker/rapidsnark.Dockerfile .
    docker build -t ${ECR_REPO}/nightfall-worker:perf-test -f docker/worker.Dockerfile .
    docker push ${ECR_REPO}/nightfall-worker:perf-test
  fi

  if [ "${BUILD_SERVICES}" == *"optimist"* ]; then
    docker build -t ${ECR_REPO}/nightfall-optimist:perf-test -f docker/optimist.Dockerfile .
    docker push ${ECR_REPO}/nightfall-optimist:perf-test
  fi

  if [ "${BUILD_SERVICES}" == *"proposer"* ]; then
    docker build -t ${ECR_REPO}/nightfall-proposer:perf-test -f docker/proposer.Dockerfile .
    docker push ${ECR_REPO}/nightfall-proposer:perf-test
  fi
fi

#
cd test/performance/terraform

if [ -z "${SKIP_TF}"]; then
  # run terraform and exports the load balancer address to PERF_TEST_LOAD_BALANCER env var
  terraform apply -auto-approve > tf_execution.log
  export PERF_TEST_LOAD_BALANCER=$(tail -n 10 tf_execution.log | sed  -n -e 's/^load_balancer-address = //p' | sed 's/"//g')
  export PERF_TEST_S3_ENDPOINT=$(tail -n 10 tf_execution.log | sed  -n -e 's/^s3-url = //p' | sed 's/"//g')
fi

# changes to project root
cd ../../..

if [ -z "${SKIP_DEPLOY}" ]; then
  # sleeps for giving time for the services get up
  sleep 120

  # deploys NF using ./bin/deploy-contracts with a local worker instance and AWS blockchain
  # then uploads the zkeys, verification keys and contracts ABIs to S3 to enable the AWS instances of worker and client to work smoothly
  

fi
