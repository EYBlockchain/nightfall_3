#
## Grants access to applications in ECS instances
#resource "aws_security_group" "performance_test_nightfall-client-sg" {
#  name        = "performance_test-client-sg"
#  vpc_id      = aws_vpc.performance_test.id
#
#  ingress {
#      description      = "Allows access to nightfall-client port"
#      protocol         = "tcp"
#      from_port        = 8080
#      to_port          = 8080
#      ipv6_cidr_blocks = []
#      prefix_list_ids  = []
#      security_groups  = []
#      self             = false
#      cidr_blocks      = ["0.0.0.0/0"]
#  }
#
#  egress {
#    from_port = 0
#    to_port   = 0
#    protocol  = "-1"
#    cidr_blocks = ["0.0.0.0/0"]
#  }
#}
#
### Load balancer settings
#resource "aws_lb" "performance_test_nf-client_lb" {
#  name            = "performance-test-nf-client-lb"
#  subnets         = aws_subnet.performance_test_public.*.id
#  security_groups = [aws_security_group.performance_test_nightfall-client-sg.id]
#}
#
#resource "aws_lb_target_group" "performance_test_client_tg" {
#  name        = "nightfall-client-tg"
#  port        = 8080
#  protocol    = "HTTP"
#  vpc_id      = aws_vpc.performance_test.id
#  target_type = "ip"
#}
#
#resource "aws_lb_listener" "performance_test_client_listener" {
#  load_balancer_arn = aws_lb.performance_test_nf-client_lb.arn
#  port              = "8080"
#  protocol          = "HTTP"
#
#  default_action {
#    target_group_arn = aws_lb_target_group.performance_test_client_tg.id
#    type             = "forward"
#  }
#}
###
#
#resource "aws_cloudwatch_log_group" "performance_test_client" {
#  name = "performance_test_nightfall_client"
#  retention_in_days = 7
#
#  tags = {
#    Environment = "performance"
#    Application = "nightfall-client"
#  }
#}
#
## ECS Task definition
#resource "aws_ecs_task_definition" "nightfall-client" {
#  family                   = "nightfall-client-app"
#  network_mode             = "awsvpc"      # none, bridge, awsvpc, and host
#  requires_compatibilities = ["FARGATE"]   # EC2 or FARGATE
#  cpu                      = var.total_cpu_client
#  memory                   = var.total_memory_client
#  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
#
#  container_definitions = jsonencode([
#    {
#      name               = "nightfall-client"
#      image              = "${var.ECR_REPO}/nightfall-client:perf-test"
#      essential          = true
#      portMappings = [
#        {
#          containerPort = 8080
#          hostPort      = 8080
#        }
#      ],
#      "logConfiguration" : { 
#        "logDriver": "awslogs",
#        "options": { 
#            "awslogs-group" : "/ecs/${aws_cloudwatch_log_group.performance_test_client.name}",
#            "awslogs-region": "${var.REGION}",
#            "awslogs-stream-prefix": "ecs"
#        }
#      },
#      "environment": [
#          {
#              "name": "AUTOSTART_RETRIES",
#              "value": "${var.AUTOSTART_RETRIES}"
#          },
#          {
#              "name": "ENABLE_QUEUE",
#              "value": "0"
#          },
#          {
#              "name": "GAS_ESTIMATE_ENDPOINT",
#              "value": "${var.GAS_ESTIMATE_ENDPOINT}"
#          },
#          {
#              "name": "BLOCKCHAIN_URL",
#              "value": "ws://${aws_lb.performance_test_nf-blockchain_lb.dns_name}"
#          },
#          {
#              "name": "CIRCOM_WORKER_HOST",
#              "value": "${var.CIRCOM_WORKER_HOST}"
#          },
#          {
#              "name": "ENVIRONMENT",
#              "value": "${var.ENVIRONMENT}"
#          },
#          {
#              "name": "MONGO_URL",
#              "value": "${aws_docdb_cluster.performance_test.endpoint}"
#          }
#      ]
#    }
#  ])
#}
#
#resource "aws_ecs_service" "nightfall-client" {
#  name            = "nightfall-client-service"
#  cluster         = aws_ecs_cluster.performance_test.id
#  task_definition = aws_ecs_task_definition.nightfall-client.id
#  desired_count   = var.total_instances_client
#  launch_type     = "FARGATE"
#
#  network_configuration {
#    security_groups = [aws_security_group.performance_test_nightfall-client-sg.id]
#    subnets         = aws_subnet.performance_test_public.*.id
#  }
#
#  load_balancer {
#    target_group_arn = aws_lb_target_group.performance_test_client_tg.id
#    container_name   = "nightfall-client"
#    container_port   = 8080
#  }
#
#  depends_on = [aws_lb_listener.performance_test_client_listener]
#}
