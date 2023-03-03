
resource "aws_security_group" "performance_test_docdb_sg" {
  vpc_id = aws_vpc.performance_test.id
  name   = "performance-test-docdb-sg"

  egress = [
    {
      description      = "Allows access to anywhere"
      cidr_blocks      = [ "0.0.0.0/0", ]
      from_port        = 0
      ipv6_cidr_blocks = []
      prefix_list_ids  = []
      protocol         = "-1"
      security_groups  = []
      self             = false
      to_port          = 0
    }
  ]
 ingress                = [
   {
     description      = "Allows access from the VPC subnets"
     cidr_blocks      = [ "10.32.0.0/16", ]
     from_port        = 27017
     ipv6_cidr_blocks = []
     prefix_list_ids  = []
     protocol         = "tcp"
     security_groups  = []
     self             = false
     to_port          = 27017
   }
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    "Name" = "performance_test_docdb_sg"
  }
}

resource "aws_docdb_subnet_group" "performance_test" {
  name       = "performance_test-subnet-group"
  subnet_ids = aws_subnet.performance_test_public.*.id

  tags = {
    Name = "Perf test docdb subnet group"
  }

}

resource "aws_docdb_cluster" "performance_test" {
  cluster_identifier   = "performance-test-docdb-cluster"
  engine               = "docdb"
  master_username      = "xpto"
  master_password      = "PerfTesting"
  skip_final_snapshot  = true
  vpc_security_group_ids = [ aws_security_group.performance_test_docdb_sg.id ]
  db_subnet_group_name = aws_docdb_subnet_group.performance_test.name
}

resource "aws_docdb_cluster_instance" "performance_test" {
  count              = 1
  identifier         = "docdb-cluster-nf-${count.index}"
  cluster_identifier = aws_docdb_cluster.performance_test.id
  instance_class     = "db.r5.large"
  availability_zone  = data.aws_availability_zones.performance_test.names[count.index]
}
