
output "load_balancer-address" {
  value = aws_lb.performance_test.dns_name
}
