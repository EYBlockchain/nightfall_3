
output "blockchain_load_balancer-address" {
  value = var.DEPLOY_BLOCKCHAIN == "true" ? aws_lb.performance_test_blockchain[0].dns_name : ""
}

output "client_load_balancer-address" {
  value = var.DEPLOY_CLIENT == "true" ? aws_lb.performance_test_client[0].dns_name : ""
}

output "worker_load_balancer-address" {
  value = var.DEPLOY_WORKER == "true" ? aws_lb.performance_test_worker[0].dns_name : ""
}

output "optimist_load_balancer-address" {
  value = var.DEPLOY_OPTIMIST == "true" ? aws_lb.performance_test_optimist[0].dns_name : ""
}

output "proposer_load_proposer-address" {
  value = var.DEPLOY_PROPOSER == "true" ? aws_lb.performance_test_proposer[0].dns_name : ""
}
