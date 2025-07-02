#!/bin/bash

# Secure deployment script for ExpenseSplitter with CloudFront-only API access
# This script deploys in the correct order to ensure API Gateway is secured

set -e

ENVIRONMENT=${1:-dev}
REGION="us-west-2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🚀 Starting secure deployment for environment: $ENVIRONMENT"
echo "📍 Region: $REGION"
echo "🔐 Account ID: $ACCOUNT_ID"

# Step 1: Deploy infrastructure without CloudFront restriction first
echo ""
echo "📦 Step 1: Deploying infrastructure (without CloudFront restriction)..."
aws cloudformation deploy \
    --template-file cloudformation/infrastructure.yaml \
    --stack-name expense-splitter-infrastructure-$ENVIRONMENT \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        JWTSecret=$(openssl rand -base64 32) \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

# Get API Gateway ID
API_GATEWAY_ID=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-infrastructure-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
    --output text \
    --region $REGION)

echo "✅ Infrastructure deployed. API Gateway ID: $API_GATEWAY_ID"

# Step 2: Deploy CloudFront with API Gateway integration
echo ""
echo "📦 Step 2: Deploying CloudFront distribution with API integration..."
aws cloudformation deploy \
    --template-file cloudformation/add-cloudfront.yaml \
    --stack-name expense-splitter-cloudfront-$ENVIRONMENT \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        ExistingBucketName=expense-splitter-frontend-$ENVIRONMENT-$ACCOUNT_ID \
        ApiGatewayId=$API_GATEWAY_ID \
    --region $REGION

# Get CloudFront Distribution ID
CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-cloudfront-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text \
    --region $REGION)

echo "✅ CloudFront deployed. Distribution ID: $CLOUDFRONT_ID"

# Step 3: Update infrastructure with CloudFront restriction
echo ""
echo "🔒 Step 3: Securing API Gateway (CloudFront-only access)..."
aws cloudformation deploy \
    --template-file cloudformation/infrastructure.yaml \
    --stack-name expense-splitter-infrastructure-$ENVIRONMENT \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        JWTSecret=$(aws ssm get-parameter --name "/expense-splitter/$ENVIRONMENT/jwt-secret" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || openssl rand -base64 32) \
        CloudFrontDistributionId=$CLOUDFRONT_ID \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo "✅ API Gateway secured - now only accessible via CloudFront"

# Step 4: Deploy Lambda function
echo ""
echo "📦 Step 4: Deploying Lambda function..."
cd /workshop/expense-splitter

# Create deployment package
echo "📦 Creating deployment package..."
zip -r deployment.zip . -x "node_modules/*" "frontend/*" ".git/*" "*.md" "cloudformation/*" "scripts/*" "tests/*"

# Update Lambda function
FUNCTION_NAME="expense-splitter-$ENVIRONMENT"
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION

echo "✅ Lambda function updated"

# Step 5: Deploy frontend
echo ""
echo "📦 Step 5: Deploying frontend..."
cd frontend

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Upload to S3
BUCKET_NAME="expense-splitter-frontend-$ENVIRONMENT-$ACCOUNT_ID"
echo "📤 Uploading to S3 bucket: $BUCKET_NAME"
aws s3 sync build/ s3://$BUCKET_NAME/ --delete --region $REGION

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_ID \
    --paths "/*" \
    --region $REGION

# Get final URLs
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-cloudfront-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text \
    --region $REGION)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-cloudfront-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiURL`].OutputValue' \
    --output text \
    --region $REGION)

echo ""
echo "🎉 Secure deployment completed successfully!"
echo ""
echo "📱 Application URLs:"
echo "   Frontend (HTTPS): $CLOUDFRONT_URL"
echo "   API (via CloudFront): $API_URL"
echo ""
echo "🔒 Security Status:"
echo "   ✅ API Gateway is now restricted to CloudFront traffic only"
echo "   ✅ Direct API access is blocked"
echo "   ✅ All traffic goes through HTTPS via CloudFront"
echo ""
echo "⚠️  Note: It may take 5-15 minutes for CloudFront changes to propagate globally"
