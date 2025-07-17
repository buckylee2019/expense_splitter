#!/bin/bash

# Simple S3 deployment script for expense splitter
set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="expense-splitter-${ENVIRONMENT}"
TEMPLATE_FILE="cloudformation/infrastructure-simple-s3.yaml"

echo "🚀 Deploying Expense Splitter with Simple S3 Setup to ${ENVIRONMENT}..."

# Check if JWT secret exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with JWT_SECRET."
    exit 1
fi

# Source environment variables
source .env

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET not found in .env file."
    exit 1
fi

echo "📦 Packaging Lambda function..."
npm install --production
zip -r lambda-deployment.zip . -x "*.git*" "node_modules/.cache/*" "frontend/*" "*.md" "*.log" "cloudformation/*" "scripts/*" "tests/*"

echo "☁️  Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file ${TEMPLATE_FILE} \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        Environment=${ENVIRONMENT} \
        JWTSecret=${JWT_SECRET} \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2

echo "📋 Getting stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region us-west-2 --query 'Stacks[0].Outputs')
API_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')
LAMBDA_FUNCTION=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="LambdaFunctionName") | .OutputValue')
PHOTOS_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="PhotosBucketName") | .OutputValue')
CLOUDFRONT_DOMAIN=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="PhotosCloudFrontDomain") | .OutputValue')

echo "🔄 Updating Lambda function code..."
aws lambda update-function-code \
    --function-name ${LAMBDA_FUNCTION} \
    --zip-file fileb://lambda-deployment.zip \
    --region us-west-2

echo "⏳ Waiting for function update to complete..."
aws lambda wait function-updated \
    --function-name ${LAMBDA_FUNCTION} \
    --region us-west-2

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 API URL: ${API_URL}"
echo "🔧 Lambda Function: ${LAMBDA_FUNCTION}"
echo "📸 Photos Bucket: ${PHOTOS_BUCKET}"
echo "🌐 CloudFront Domain: ${CLOUDFRONT_DOMAIN}"
echo ""
echo "🎉 Expense Splitter with S3 photo storage is now live!"

# Clean up
rm -f lambda-deployment.zip
