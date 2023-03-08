#
#resource "aws_s3_bucket" "performance-test" {
#  bucket = "performance-test"
#  force_destroy = true
#}
#
#data "aws_iam_policy_document" "nightfall-mp-server_policy" {
#  statement {
#    principals {
#      type = "Service"
#      identifiers = ["cloudfront.amazonaws.com"]
#    }
#    actions = [
#      "s3:GetObject",
#    ]
#    resources = [
#      aws_s3_bucket.performance-test.arn,
#      "${aws_s3_bucket.performance-test.arn}/*",
#    ]
#    condition {
#      test = "StringLike"
#      variable = "AWS:SourceArn"
#      values = [
#        aws_cloudfront_distribution.distribution.arn
#      ]
#    }
#    effect = "Allow"
#  }
#}
#
#resource "aws_s3_bucket_policy" "server_policy" {
#  bucket = aws_s3_bucket.nightfall-mpc.id
#  policy = data.aws_iam_policy_document.nightfall-mp-server_policy.json
#}
#
#resource "aws_s3_bucket_cors_configuration" "server" {
#  bucket = aws_s3_bucket.nightfall-mpc.id
#
#  cors_rule {
#    allowed_headers = ["*"]
#    allowed_methods = ["GET", "PUT", "POST", "HEAD", "DELETE"]
#    allowed_origins = ["*"]
#    expose_headers  = []
#    max_age_seconds = 3000
#  }
#}
