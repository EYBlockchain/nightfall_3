
if [[ -z "$ECR_REPO" || -z "${REGION}" ]]; then
  echo "Please specify the environment variables: ECR_REPO, REGION"
  exit 1
fi

# changes to project root
cd ../..

docker pull trufflesuite/ganache:v7.7.3
docker tag trufflesuite/ganache:v7.7.3 ${ECR_REPO}/blockchain:ganache7.7.3

docker build -t ${ECR_REPO}/nightfall-client:perf-test -f docker/client.Dockerfile .
docker build -t ${ECR_REPO}/nightfall-worker:perf-test -f docker/worker.Dockerfile .
docker build -t ${ECR_REPO}/nightfall-optimist:perf-test -f docker/optimist.Dockerfile .
docker build -t ${ECR_REPO}/nightfall-proposer:perf-test -f docker/proposer.Dockerfile .

## pushes images to ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

docker push ${ECR_REPO}/nightfall-client:perf-test
docker push ${ECR_REPO}/nightfall-worker:perf-test
docker push ${ECR_REPO}/nightfall-optimist:perf-test
docker push ${ECR_REPO}/nightfall-proposer:perf-test
docker push ${ECR_REPO}/blockchain:ganache7.7.3

#
cd test/perf/terraform

terraform apply -auto-approve

# changes to project root
cd ../../..

# deploys NF
