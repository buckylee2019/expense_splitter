#!/bin/bash

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="expense-splitter-$ENVIRONMENT"
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Deploying Expense Splitter to AWS ($ENVIRONMENT environment)"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "🔑 Generated JWT Secret: $JWT_SECRET"
fi

echo "📦 Creating deployment package..."
npm run build
npm run package

echo "☁️  Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file cloudformation/infrastructure.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        JWTSecret="$JWT_SECRET" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo "📋 Getting stack outputs..."
LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
    --output text)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

echo "🔄 Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $LAMBDA_FUNCTION \
    --zip-file fileb://deployment.zip \
    --region $REGION

echo "⏳ Waiting for function update to complete..."
aws lambda wait function-updated \
    --function-name $LAMBDA_FUNCTION \
    --region $REGION

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 API URL: $API_URL"
echo "🔧 Lambda Function: $LAMBDA_FUNCTION"
echo ""
echo "Test the deployment:"
echo "curl $API_URL/health"

# Clean up
rm -f deployment.zip

echo ""
echo "🎉 Expense Splitter is now live on AWS!"
