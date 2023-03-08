resource "aws_lb" "performance_test_client" {
  count              = var.DEPLOY_CLIENT == "true" ? 1 : 0
  name               = "performance-test-client-lb"
  load_balancer_type = "application"
  subnets            = aws_subnet.performance_test_public.*.id
  security_groups    = [aws_security_group.performance_test.id]
  idle_timeout       = 300
}

resource "aws_lb_target_group" "performance_test_client" {
  count       = var.DEPLOY_CLIENT == "true" ? 1 : 0
  name        = "performance-test-client-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.performance_test.id
  target_type = "ip"

  health_check {
    path     = "/healthcheck"
    protocol = "HTTP"
  }
}

resource "aws_lb_listener" "performance_test_client" {
  count             = var.DEPLOY_CLIENT == "true" ? 1 : 0
  load_balancer_arn = aws_lb.performance_test_client[count.index].id
  port              = 80
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_lb_target_group.performance_test_client[count.index].id
    type             = "forward"
  }
}

# Grants access to applications in ECS instances
resource "aws_security_group" "performance_test_nightfall-client-sg" {
  count       = var.DEPLOY_CLIENT == "true" ? 1 : 0
  name        = "performance_test-client-sg"
  vpc_id      = aws_vpc.performance_test.id

  ingress = [
    {
      description      = ""
      protocol         = "tcp"
      from_port        = 80
      to_port          = 80
      ipv6_cidr_blocks = []
      prefix_list_ids  = []
      security_groups  = []
      self             = false
      cidr_blocks      = [ aws_vpc.performance_test.cidr_block ]
    },
    {
      description      = ""
      protocol         = "tcp"
      from_port        = 80
      to_port          = 80
      ipv6_cidr_blocks = []
      prefix_list_ids  = []
      security_groups  = []
      self             = false
      cidr_blocks      = [ aws_vpc.performance_test.cidr_block ]
    }
  ]

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "performance_test_client" {
  count             = var.DEPLOY_CLIENT == "true" ? 1 : 0
  name              = "/ecs/performance_test_nightfall_client"
  retention_in_days = 7

  tags = {
    Environment = "performance"
    Application = "nightfall-client"
  }
}

# ECS Task definition
resource "aws_ecs_task_definition" "nightfall-client" {
  count                    = var.DEPLOY_CLIENT == "true" ? 1 : 0
  family                   = "nightfall-client-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.TOTAL_CPU_CLIENT
  memory                   = var.TOTAL_MEMORY_CLIENT
  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
  task_role_arn            = var.ECS_TASK_ROLE

  container_definitions = jsonencode([
    {
      "name": "nightfall-client",
      "image": "${var.ECR_REPO}/nightfall-client:perf-test",
      "essential": true,
      "portMappings": [
          {
              "containerPort": 80,
              "hostPort": 80,
              "protocol": "tcp"
          }
      ],
      "logConfiguration" : { 
        "logDriver": "awslogs",
        "options": { 
            "awslogs-group" : "${aws_cloudwatch_log_group.performance_test_client[count.index].name}",
            "awslogs-region": "${var.REGION}",
            "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
          {
              "name": "AUTOSTART_RETRIES",
              "value": "${var.AUTOSTART_RETRIES}"
          },
          {
              "name": "ENABLE_QUEUE",
              "value": "0"
          },
          {
              "name": "GAS_ESTIMATE_ENDPOINT",
              "value": "${var.GAS_ESTIMATE_ENDPOINT}"
          },
          {
              "name": "CLIENT_URL",
              "value": "ws://${aws_lb.performance_test_blockchain[0].dns_name}"
          },
          {
              "name": "CIRCOM_WORKER_HOST",
              "value": "${var.CIRCOM_WORKER_HOST}"
          },
          {
              "name": "ENVIRONMENT",
              "value": "${var.ENVIRONMENT}"
          },
          {
              "name": "MONGO_URL",
              "value": "${aws_docdb_cluster.performance_test[0].endpoint}"
          },
          {
              "name": "CONTRACT_FILES_URL",
              "value": "${var.CONTRACT_FILES_URL}"
          }
      ]
   }
  ])
}

resource "aws_ecs_service" "nightfall-client" {
  count                  = var.DEPLOY_CLIENT == "true" ? 1 : 0
  name                   = "nightfall-client-service"
  cluster                = aws_ecs_cluster.performance_test.id
  task_definition        = aws_ecs_task_definition.nightfall-client[count.index].id

  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    security_groups = [aws_security_group.performance_test_nightfall-client-sg[count.index].id]
    subnets         = aws_subnet.performance_test_private.*.id
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.performance_test_client[count.index].id
    container_name   = "client-ganache"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.performance_test_client]
}
