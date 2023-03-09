resource "aws_lb" "performance_test_worker" {
  count              = var.DEPLOY_WORKER == "true" ? 1 : 0
  name               = "performance-test-worker-lb"
  load_balancer_type = "application"
  subnets            = aws_subnet.performance_test_public.*.id
  security_groups    = [aws_security_group.performance_test.id]
  idle_timeout       = 300
}

resource "aws_lb_target_group" "performance_test_worker" {
  count       = var.DEPLOY_WORKER == "true" ? 1 : 0
  name        = "performance-test-worker-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.performance_test.id
  target_type = "ip"

  health_check {
    path     = "/healthcheck"
    protocol = "HTTP"
  }
}

resource "aws_lb_listener" "performance_test_worker" {
  count             = var.DEPLOY_WORKER == "true" ? 1 : 0
  load_balancer_arn = aws_lb.performance_test_worker[count.index].id
  port              = 80
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_lb_target_group.performance_test_worker[count.index].id
    type             = "forward"
  }
}

resource "aws_security_group" "performance_test_nightfall-worker-sg" {
  count  = var.DEPLOY_WORKER == "true" ? 1 : 0
  name   = "performance_test-worker-sg"
  vpc_id = aws_vpc.performance_test.id

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
    }
  ]

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "performance_test_worker" {
  count = var.DEPLOY_WORKER == "true" ? 1 : 0
  name  = "/ecs/performance_test_nightfall_worker"

  retention_in_days = 7

  tags = {
    Environment = "performance"
    Application = "nightfall-worker"
  }
}

# ECS Task definition
resource "aws_ecs_task_definition" "nightfall-worker" {
  count                    = var.DEPLOY_WORKER == "true" ? 1 : 0
  family                   = "nightfall-worker-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2", "FARGATE"]
  cpu                      = var.TOTAL_CPU_WORKER
  memory                   = var.TOTAL_MEMORY_WORKER
  execution_role_arn       = var.ECS_TASK_EXECUTION_ROLE
  task_role_arn            = var.ECS_TASK_ROLE

  container_definitions = jsonencode([
    {
      "name": "nightfall-worker",
      "image": "${var.ECR_REPO}/nightfall-worker:perf-test",
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
            "awslogs-group" : "${aws_cloudwatch_log_group.performance_test_worker[count.index].name}",
            "awslogs-region": "${var.REGION}",
            "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
          {
              "name": "LOG_LEVEL",
              "value": "debug"
          },
          {
              "name": "NODE_ENV",
              "value": "testing"
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
              "name": "ENVIRONMENT",
              "value": "${var.ENVIRONMENT}"
          },
          {
              "name": "CIRCUIT_FILES_URL",
              "value": "${var.CIRCUIT_FILES_URL}"
          }
      ]
    }
  ])
}

resource "aws_ecs_service" "nightfall-worker" {
  count                  = var.DEPLOY_WORKER == "true" ? 1 : 0
  name                   = "nightfall-worker-service"
  cluster                = aws_ecs_cluster.performance_test.id
  task_definition        = aws_ecs_task_definition.nightfall-worker[count.index].id

  desired_count          = var.TOTAL_INSTANCES_WORKER
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = aws_subnet.performance_test_private.*.id
    security_groups  = [
      aws_security_group.performance_test_nightfall-worker-sg[count.index].id,
      aws_security_group.performance_test.id
    ]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.performance_test_worker[count.index].id
    container_name   = "nightfall-worker"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.performance_test_worker]
}

#################################################################
# The following lines are enabled only when using launchType = 'EC2'
resource "aws_iam_role" "performance_test-ecs" {
  count              = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  name               = "ecsInstanceRole"
  assume_role_policy = data.aws_iam_policy_document.ecs_policy_agent.json
}

data "aws_iam_policy_document" "ecs_policy_agent" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "iam_PassRole" {
  count = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  name  = "iam_PassRole"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "iam:PassRole",
        ]
        Effect   = "Allow"
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iam_PassRole" {
  count      = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  role       = aws_iam_role.performance_test-ecs[count.index].name
  policy_arn = aws_iam_policy.iam_PassRole[count.index].arn
}

resource "aws_iam_policy" "ecs_startTask" {
  count = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  name  = "ecs_startTask"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ecs:StartTask",
        ]
        Effect   = "Allow"
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_startTask" {
  count      = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  role       = aws_iam_role.performance_test-ecs[count.index].name
  policy_arn = aws_iam_policy.ecs_startTask[count.index].arn
}

resource "aws_iam_role_policy_attachment" "ecs_agent" {
  count      = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  role       = aws_iam_role.performance_test-ecs[count.index].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_role" {
  count = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  name  = "ecs-agent"
  role  = aws_iam_role.performance_test-ecs[count.index].name
}

data "template_file" "user_data" {
  template = base64encode("${file("${path.module}/ec2-userdata.tpl")}")
}

resource "aws_launch_configuration" "performance_test_nightfall-worker" {
  count = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
  name                        = "performance-test"
  image_id                    = "ami-0a9d0b31a17ab6ef5" # Amazon ECS-optimized Amazon Linux 2 AMI - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html
  iam_instance_profile        = aws_iam_instance_profile.ecs_role[count.index].name
  security_groups             = [ aws_security_group.performance_test_nightfall-worker-sg[count.index].id ]
  user_data                   = "${data.template_file.user_data.rendered}"
  instance_type               = "t2.xlarge"
  associate_public_ip_address = true
  key_name                    = "performance"
}

resource "aws_autoscaling_group" "performance_test_nightfall-worker" {
    count                     = var.LAUNCH_TYPE_WORKER == "EC2" ? 1 : 0
    name                      = "asg"
    vpc_zone_identifier       = aws_subnet.performance_test_private.*.id
    launch_configuration      = aws_launch_configuration.performance_test_nightfall-worker[count.index].name
    desired_capacity          = var.TOTAL_INSTANCES_WORKER
    min_size                  = 1
    max_size                  = 10
    health_check_grace_period = 300
    health_check_type         = "EC2"
}
