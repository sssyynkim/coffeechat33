# Output the name of the referenced S3 bucket
output "s3_bucket_name" {
  description = "The name of the existing S3 bucket"
  value       = data.aws_s3_bucket.existing_bucket.bucket  # Outputs the bucket name
}

# Output the name of the referenced DynamoDB table
output "dynamodb_table_name" {
  description = "The name of the existing DynamoDB table"
  value       = data.aws_dynamodb_table.existing_table.name  # Outputs the DynamoDB table name
}
