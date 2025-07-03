#!/bin/bash

# ExpenseSplitter Deployment Configuration
# Edit these values to match your AWS resources

# AWS Configuration
export AWS_REGION="us-west-2"
export AWS_PROFILE="default"  # Change if using a specific AWS profile

# Lambda Configuration
export LAMBDA_FUNCTION_NAME="expense-splitter-dev"

# S3 Configuration
export S3_BUCKET="expense-splitter-frontend-224425919845"

# CloudFront Configuration
export CLOUDFRONT_DISTRIBUTION_ID="E3E393KBDDAGKU"

# API Gateway Configuration
export API_GATEWAY_ID="xro5pxx6oi"
export API_STAGE="dev"

# Application URLs (auto-generated)
export API_BASE_URL="https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com/${API_STAGE}"
export CLOUDFRONT_URL="https://dwt4ijd80bt6i.cloudfront.net"
export S3_WEBSITE_URL="http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"

# Deployment Options
export DEFAULT_TIMEOUT=30
export ENABLE_VERBOSE_LOGGING=false
export AUTO_COMMIT=false
