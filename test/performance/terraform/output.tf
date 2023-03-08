
output "blockchain_load_balancer-address" {
  value = var.DEPLOY_WORKER == "true" ? aws_lb.performance_test_blockchain[0].dns_name : ""
}

output "worker_load_balancer-address" {
  value = var.DEPLOY_WORKER == "true" ? aws_lb.performance_test_worker[0].dns_name : ""
}

# TODO create output for S3 with the name "s3-url"
