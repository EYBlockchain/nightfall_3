#resource "aws_lb_target_group" "performance_test_blockchain" {
#  name        = "performance-test-blockchain-tg"
#  port        = 8546
#  protocol    = "HTTP"
#  vpc_id      = aws_vpc.performance_test.id
#  target_type = "ip"
#
#  health_check {
#    path = "/"
#    matcher = "200-499"
#  }
#}
#
#resource "aws_lb_listener" "performance_test_blockchain" {
#  load_balancer_arn = aws_lb.performance_test.id
#  port              = 8546
#  protocol          = "HTTP"
#
#  default_action {
#    target_group_arn = aws_lb_target_group.performance_test_blockchain.id
#    type             = "forward"
#  }
#}
#
## Grants access to applications in ECS instances
#resource "aws_security_group" "performance_test_nightfall-blockchain-sg" {
#  name        = "performance_test-blockchain-sg"
#  vpc_id      = aws_vpc.performance_test.id
#
#  ingress = [
#    {
#      description      = ""
#      protocol         = "tcp"
#      from_port        = 80
#      to_port          = 8546
#      ipv6_cidr_blocks = []
#      prefix_list_ids  = []
#      security_groups  = []
#      self             = false
#      cidr_blocks      = [ aws_vpc.performance_test.cidr_block ]
#    },
#    {
#      description      = ""
#      protocol         = "tcp"
#      from_port        = 8546
#      to_port          = 8546
#      ipv6_cidr_blocks = []
#      prefix_list_ids  = []
#      security_groups  = []
#      self             = false
#      cidr_blocks      = [ aws_vpc.performance_test.cidr_block ]
#    }
#  ]
#
#  egress {
#    from_port = 0
#    to_port   = 0
#    protocol  = "-1"
#    cidr_blocks = ["0.0.0.0/0"]
#  }
#}
#
#resource "aws_cloudwatch_log_group" "performance_test_blockchain" {
#  name = "/ecs/performance_test_nightfall_blockchain"
#
#  retention_in_days = 7
#
#  tags = {
#    Environment = "performance"
#    Application = "nightfall-blockchain"
#  }
#}
#
## ECS Task definition
#resource "aws_ecs_task_definition" "nightfall-blockchain" {
#  family                   = "nightfall-blockchain-app"
#  network_mode             = "awsvpc"
#  requires_compatibilities = ["FARGATE"]
#  cpu                      = var.TOTAL_CPU_BLOCKCHAIN
#  memory                   = var.TOTAL_MEMORY_BLOCKCHAIN
#  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
#  task_role_arn            = var.ECS_TASK_ROLE
#
#  container_definitions = jsonencode([
#    {
#      "name": "blockchain-ganache",
#      "image": "${var.ECR_REPO}/blockchain:ganache7.7.3",
#      "essential": true,
#      "portMappings": [
#          {
#              "containerPort": 8546,
#              "hostPort": 8546,
#              "protocol": "tcp"
#          }
#      ],
#      "logConfiguration" : { 
#        "logDriver": "awslogs",
#        "options": { 
#            "awslogs-group" : "${aws_cloudwatch_log_group.performance_test_blockchain.name}",
#            "awslogs-region": "${var.REGION}",
#            "awslogs-stream-prefix": "ecs"
#        }
#      },
#      "command": [
#        "--defaultBalanceEther=1000",
#        "--gasLimit=0x3B9ACA00",
#        "--deterministic",
#        "-i 1337",
#        "-p 8546",
#        "-b 1",
#        "--wallet.accounts='0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e,10000000000000000000000'",
#        "--wallet.accounts='0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d,10000000000000000000000'",
#        "--wallet.accounts='0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb,10000000000000000000000'",
#        "--wallet.accounts='0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6,10000000000000000000000'",
#        "--wallet.accounts='0xabf4ed9f30bd1e4a290310d726c7bbdf39cd75a25eebd9a3a4874e10b4a0c4ce,10000000000000000000000'",
#        "--wallet.accounts='0xcbbf1d0686738a444cf9f66fdc96289035c384c4e8d26768f94fa81f3ab6596a,10000000000000000000000'",
#        "--wallet.accounts='0x1da216993fb96745dcba8bc6f2ef5deb75ce602fd92f91ab702d8250033f4e1c,10000000000000000000000'",
#        "--wallet.accounts='0x955ff4fac3c1ae8a1b7b9ff197476de1f93e9f0bf5f1c21ff16456e3c84da587,10000000000000000000000'"
#      ]
#    }
#  ])
#}
#
#resource "aws_ecs_service" "nightfall-blockchain" {
#  name                   = "nightfall-blockchain-service"
#  cluster                = aws_ecs_cluster.performance_test.id
#  task_definition        = aws_ecs_task_definition.nightfall-blockchain.id
#
#  desired_count          = 1
#  launch_type            = "FARGATE"
#  enable_execute_command = true
#
#  network_configuration {
#    security_groups = [aws_security_group.performance_test_nightfall-blockchain-sg.id]
#    subnets         = aws_subnet.performance_test_private.*.id
#  }
#
#  load_balancer {
#    target_group_arn = aws_lb_target_group.performance_test_blockchain.id
#    container_name   = "blockchain-ganache"
#    container_port   = 8546
#  }
#
#  depends_on = [aws_lb_listener.performance_test_blockchain]
#}
#