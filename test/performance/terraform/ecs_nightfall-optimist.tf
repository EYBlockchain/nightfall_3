resource "aws_lb" "performance_test_optimist" {
  count              = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  name               = "performance-test-optimist-lb"
  load_balancer_type = "application"
  subnets            = aws_subnet.performance_test_public.*.id
  security_groups    = [aws_security_group.performance_test.id]
  idle_timeout       = 300
}

resource "aws_lb_target_group" "performance_test_optimist" {
  count       = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  name        = "performance-test-optimist-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.performance_test.id
  target_type = "ip"

  health_check {
    path     = "/healthcheck"
    protocol = "HTTP"
  }
}

resource "aws_lb_listener" "performance_test_optimist" {
  count             = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  load_balancer_arn = aws_lb.performance_test_optimist[count.index].id
  port              = 8080
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_lb_target_group.performance_test_optimist[count.index].id
    type             = "forward"
  }
}

# Grants access to applications in ECS instances
resource "aws_security_group" "performance_test_nightfall-optimist-sg" {
  count       = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  name        = "performance_test-optimist-sg"
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

resource "aws_cloudwatch_log_group" "performance_test_optimist" {
  count             = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  name              = "/ecs/performance_test_nightfall_optimist"
  retention_in_days = 7

  tags = {
    Environment = "performance"
    Application = "nightfall-optimist"
  }
}

# ECS Task definition
resource "aws_ecs_task_definition" "nightfall-optimist" {
  count                    = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  family                   = "nightfall-optimist-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.TOTAL_CPU_OPTIMIST
  memory                   = var.TOTAL_MEMORY_OPTIMIST
  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
  task_role_arn            = var.ECS_TASK_ROLE

  container_definitions = jsonencode([
    {
      "name": "nightfall-optimist",
      "image": "${var.ECR_REPO}/nightfall-optimist:perf-test",
      "essential": true,
      "portMappings": [
          {
              "containerPort": 8080,
              "hostPort": 8080,
              "protocol": "tcp"
          },
          {
              "containerPort": 80,
              "hostPort": 80,
              "protocol": "tcp"
          }
      ],
      "logConfiguration" : {
        "logDriver": "awslogs",
        "options": {
            "awslogs-group" : "${aws_cloudwatch_log_group.performance_test_optimist[count.index].name}",
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
              "name": "BLOCKCHAIN_WS_HOST",
              "value": "${aws_lb.performance_test_blockchain[0].dns_name}"
          },
          {
              "name": "BLOCKCHAIN_PORT",
              "value": "8546"
          },
          {
              "name": "CONTRACT_FILES_URL",
              "value": "${var.CONTRACT_FILES_URL}"
          },
          {
              "name": "ENVIRONMENT",
              "value": "${var.ENVIRONMENT}"
          },
          {
              "name": "GAS_PRICE",
              "value": "20000000000"
          },
          {
              "name": "HASH_TYPE",
              "value": "poseidon"
          },
          {
              "name": "IS_CHALLENGER",
              "value": "true"
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
              "name": "MONGO_URL",
              "value": "${aws_docdb_cluster.performance_test[0].endpoint}"
          },
          {
              "name": "NODE_ENV",
              "value": "testing"
          }

      ]
   }
  ])
}

resource "aws_ecs_service" "nightfall-optimist" {
  count                  = var.DEPLOY_OPTIMIST == "true" ? 1 : 0
  name                   = "nightfall-optimist-service"
  cluster                = aws_ecs_cluster.performance_test.id
  task_definition        = aws_ecs_task_definition.nightfall-optimist[count.index].id

  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    security_groups = [aws_security_group.performance_test_nightfall-optimist-sg[count.index].id]
    subnets         = aws_subnet.performance_test_private.*.id
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.performance_test_optimist[count.index].id
    container_name   = "nightfall-optimist"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.performance_test_optimist]
}
