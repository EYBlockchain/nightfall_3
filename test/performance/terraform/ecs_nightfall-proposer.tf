resource "aws_lb" "performance_test_proposer" {
  count              = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  name               = "performance-test-proposer-lb"
  load_balancer_type = "application"
  subnets            = aws_subnet.performance_test_public.*.id
  security_groups    = [aws_security_group.performance_test.id]
  idle_timeout       = 300
}

resource "aws_lb_target_group" "performance_test_proposer" {
  count       = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  name        = "performance-test-proposer-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.performance_test.id
  target_type = "ip"

  health_check {
    path     = "/healthcheck"
    protocol = "HTTP"
  }
}

resource "aws_lb_listener" "performance_test_proposer" {
  count             = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  load_balancer_arn = aws_lb.performance_test_proposer[count.index].id
  port              = 8080
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_lb_target_group.performance_test_proposer[count.index].id
    type             = "forward"
  }
}

# Grants access to applications in ECS instances
resource "aws_security_group" "performance_test_nightfall-proposer-sg" {
  count       = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  name        = "performance_test-proposer-sg"
  vpc_id      = aws_vpc.performance_test.id

  ingress = [
    {
      description      = ""
      protocol         = "tcp"
      from_port        = 8080
      to_port          = 8080
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

resource "aws_cloudwatch_log_group" "performance_test_proposer" {
  count             = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  name              = "/ecs/performance_test_nightfall_proposer"
  retention_in_days = 7

  tags = {
    Environment = "performance"
    Application = "nightfall-proposer"
  }
}

# ECS Task definition
resource "aws_ecs_task_definition" "nightfall-proposer" {
  count                    = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  family                   = "nightfall-proposer-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.TOTAL_CPU_PROPOSER
  memory                   = var.TOTAL_MEMORY_PROPOSER
  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
  task_role_arn            = var.ECS_TASK_ROLE

  container_definitions = jsonencode([
    {
      "name": "nightfall-proposer",
      "image": "${var.ECR_REPO}/nightfall-proposer:perf-test",
      "essential": true,
      "portMappings": [
          {
              "containerPort": 8080,
              "hostPort": 8080,
              "protocol": "tcp"
          }
      ],
      "logConfiguration" : { 
        "logDriver": "awslogs",
        "options": { 
            "awslogs-group" : "${aws_cloudwatch_log_group.performance_test_proposer[count.index].name}",
            "awslogs-region": "${var.REGION}",
            "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
          {
              "name": "ENVIRONMENT",
              "value": "${var.ENVIRONMENT}"
          },
          {
              "name": "LOG_LEVEL",
              "value": "debug"
          },
          {
              "name": "LOG_HTTP_PAYLOAD_ENABLED",
              "value": "true"
          },
          {
              "name": "LOG_HTTP_FULL_DATA",
              "value": "false"
          },
          {
              "name": "NODE_ENV",
              "value": "testing"
          },
          {
              "name": "BLOCKCHAIN_WS_HOST",
              "value": "${aws_lb.performance_test_blockchain[0].dns_name}"
          },
          {
              "name": "BLOCKCHAIN_PORT",
              "value": "8546"
          },
          {
              "name": "BLOCKCHAIN_PATH",
              "value": ""
          },
          {
              "name": "GAS_ESTIMATE_ENDPOINT",
              "value": "${var.GAS_ESTIMATE_ENDPOINT}"
          },
          {
              "name": "GAS_MULTIPLIER",
              "value": "2"
          },
          {
              "name": "GAS_PRICE",
              "value": "20000000000"
          },
          {
              "name": "GAS",
              "value": "8000000"
          },
          {
              "name": "MAX_ROTATE_TIMES",
              "value": "2"
          },
          {
              "name": "TIMER_CHANGE_PROPOSER_SECOND",
              "value": "30"
          },
          {
              "name": "OPTIMIST_HOST",
              "value": "${aws_lb.performance_test_optimist[0].dns_name}"
          },
          {
              "name": "OPTIMIST_HTTP_PORT",
              "value": "80"
          },
          {
              "name": "OPTIMIST_WS_URL",
              "value": "ws://${aws_lb.performance_test_optimist[0].dns_name}"
          },
          {
              "name": "OPTIMIST_WS_PORT",
              "value": "8080"
          },
          {
              "name": "OPTIMIST_HTTP_HOST",
              "value": "${aws_lb.performance_test_optimist[0].dns_name}"
          },
          {
              "name": "PROPOSER_HOST",
              "value": "${aws_lb.performance_test_proposer[0].dns_name}"
          },
          {
              "name": "PROPOSER_PORT",
              "value": "8080"
          }
      ]
   }
  ])
}

resource "aws_ecs_service" "nightfall-proposer" {
  count                  = var.DEPLOY_PROPOSER == "true" ? 1 : 0
  name                   = "nightfall-proposer-service"
  cluster                = aws_ecs_cluster.performance_test.id
  task_definition        = aws_ecs_task_definition.nightfall-proposer[count.index].id

  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    security_groups = [aws_security_group.performance_test_nightfall-proposer-sg[count.index].id]
    subnets         = aws_subnet.performance_test_private.*.id
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.performance_test_proposer[count.index].id
    container_name   = "proposer-ganache"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.performance_test_proposer]
}
