
# Holds the availability zones that are "available"
data "aws_availability_zones" "performance_test" {
  state = "available"
}

resource "aws_vpc" "performance_test" {
  cidr_block = "10.32.0.0/16"
}

resource "aws_subnet" "performance_test_public" {
  count                   = var.TOTAL_INSTANCES_SUBNET
  vpc_id                  = aws_vpc.performance_test.id
  cidr_block              = cidrsubnet(aws_vpc.performance_test.cidr_block, 8, 2 + count.index)
  availability_zone       = data.aws_availability_zones.performance_test.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "performance_test_private" {
  count             = var.TOTAL_INSTANCES_SUBNET
  cidr_block        = cidrsubnet(aws_vpc.performance_test.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.performance_test.names[count.index]
  vpc_id            = aws_vpc.performance_test.id
}

resource "aws_internet_gateway" "performance_test" {
  vpc_id = aws_vpc.performance_test.id
}

resource "aws_route" "internet_access" {
  route_table_id         = aws_vpc.performance_test.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.performance_test.id
}

resource "aws_eip" "performance_test_public" {
  count      = var.TOTAL_INSTANCES_SUBNET
  vpc        = true
  depends_on = [aws_internet_gateway.performance_test]
}

resource "aws_nat_gateway" "performance_test" {
  count         = var.TOTAL_INSTANCES_SUBNET
  subnet_id     = element(aws_subnet.performance_test_public.*.id, count.index)
  allocation_id = element(aws_eip.performance_test_public.*.id, count.index)
}

resource "aws_route_table" "performance_test_private" {
  count  = var.TOTAL_INSTANCES_SUBNET
  vpc_id = aws_vpc.performance_test.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = element(aws_nat_gateway.performance_test.*.id, count.index)
  }
}

resource "aws_route_table_association" "performance_test" {
  count          = var.TOTAL_INSTANCES_SUBNET
  subnet_id      = element(aws_subnet.performance_test_private.*.id, count.index)
  route_table_id = element(aws_route_table.performance_test_private.*.id, count.index)
}

resource "aws_security_group" "performance_test" {
  name        = "performance-test-security-group"
  vpc_id      = aws_vpc.performance_test.id

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "performance_test" {
  name            = "performance-test-lb"
  subnets         = aws_subnet.performance_test_public.*.id
  security_groups = [aws_security_group.performance_test.id]
}

#resource "aws_lb_target_group" "performance_test" {
#  name        = "performance-test-target-group"
#  port        = 80
#  protocol    = "HTTP"
#  vpc_id      = aws_vpc.performance_test.id
#  target_type = "ip"
#
#  health_check {
#    path = "/"
#    mamatcher = "200-499"
#  }
#}
#
#resource "aws_lb_listener" "performance_test" {
#  load_balancer_arn = aws_lb.performance_test.id
#  port              = "80"
#  protocol          = "HTTP"
#
#  default_action {
#    target_group_arn = aws_lb_target_group.performance_test.id
#    type             = "forward"
#  }
#}
