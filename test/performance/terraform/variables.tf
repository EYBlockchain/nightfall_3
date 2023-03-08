variable "REGION" {
  default = "eu-west-2"
}

variable "ECR_REPO" {
  default = "950711068211.dkr.ecr.eu-west-2.amazonaws.com"
}

## TODO capitalise all the var names
variable "ECS_TASK_EXECUTION_ROLE" {
  default = "arn:aws:iam::950711068211:role/perfTestTaskExecutionRole"
}

variable "ECS_TASK_ROLE" {
  default = "arn:aws:iam::950711068211:role/perfTestTaskRole"
}

variable "TOTAL_INSTANCES_SUBNET" {}

variable "DEPLOY_CLIENT" {
  default = "true"
}
variable "TOTAL_INSTANCES_CLIENT" {
  default = "2"
}
variable "TOTAL_CPU_CLIENT" {
  default = "2048"
}
variable "TOTAL_MEMORY_CLIENT" {
  default = "4096"
}

variable "DEPLOY_WORKER" {
  default = "true"
}
variable "TOTAL_INSTANCES_WORKER" {
  default = "1"
}
variable "TOTAL_CPU_WORKER" {
  default = "2048"
}
variable "TOTAL_MEMORY_WORKER" {
  default = "4096"
}
variable "LAUNCH_TYPE_WORKER" {
  default = "FARGATE"
}

variable "DEPLOY_OPTIMIST" {
  default = "true"
}
variable "TOTAL_INSTANCES_OPTIMIST" {
  default = "1"
}
variable "TOTAL_CPU_OPTIMIST" {
  default = "2048"
}
variable "TOTAL_MEMORY_OPTIMIST" {
  default = "4096"
}

variable "DEPLOY_PROPOSER" {
  default = "true"
}
variable "TOTAL_INSTANCES_PROPOSER" {
  default = "1"
}
variable "TOTAL_CPU_PROPOSER" {
  default = "2048"
}
variable "TOTAL_MEMORY_PROPOSER" {
  default = "4096"
}

variable "DEPLOY_BLOCKCHAIN" {
  default = "true"
}
variable "TOTAL_CPU_BLOCKCHAIN" {
  default = "2048"
}
variable "TOTAL_MEMORY_BLOCKCHAIN" {
  default = "4096"
}

## env vars for the apps

variable "AUTOSTART_RETRIES" {
  default = "100000"
}

variable "CIRCUIT_FILES_URL" {
  default = ""
}

variable "CONTRACT_FILES_URL" {
  default = ""
}

variable "ENVIRONMENT" {
  default = "aws"
}

variable "LOG_LEVEL" {
  default = "info"
}

variable "LOG_HTTP_PAYLOAD_ENABLED" {
  default = "true"
}

variable "LOG_HTTP_FULL_DATA" {
  default = "false"
}

variable "GAS_ESTIMATE_ENDPOINT" {
  default = "https://vqxy02tr5e.execute-api.us-east-2.amazonaws.com/production/estimateGas"
}

variable "GAS" {
  default = "8000000"
}

variable "GAS_PRICE" {
  default = "20000000000"
}

variable "GAS_MULTIPLIER" {
  default = "2"
}

variable "BLOCKCHAIN_URL" {
  default = "wss://web3-ws.perf.polygon-nightfall.technology"
}

variable "BLOCKCHAIN_PORT" {
  default = "8546"
}

variable "BLOCKCHAIN_PATH" {
  default = ""
}

variable "BLOCKCHAIN_WS_HOST" {
  default = "web3-ws.perf.polygon-nightfall.technology"
}

variable "OPTIMIST_WS_HOST" {
  default = "optimist-ws.perf.polygon-nightfall.technology"
}

variable "OPTIMIST_WS_PORT" {
  default = "8080"
}

variable "OPTIMIST_HTTP_URL" {
  default = "optimist-api.perf.polygon-nightfall.technology"
}

variable "OPTIMIST_HTTP_HOST" {
  default = "optimist-api.perf.polygon-nightfall.technology"
}

variable "OPTIMIST_HTTP_PORT" {
  default = "80"
}

variable "PROPOSER_HOST" {
  default = "proposer.perf.polygon-nightfall.technology"
}

variable "PROPOSER_PORT" {
  default = "8082"
}

variable "TIMER_CHANGE_PROPOSER_SECOND" {
  default = "30"
}

variable "MAX_ROTATE_TIMES" {
  default = "2"
}

variable "CIRCOM_WORKER_HOST" {
  default = "worker.perf.polygon-nightfall.technology"
}

variable "ENABLE_QUEUE" {
  default = "0"
}

variable "RABBITMQ_HOST" {
  default = "amqp://TBD"
}

variable "RABBITMQ_PORT" {
  default = "5672"
}