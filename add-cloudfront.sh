#!/bin/bash

set -e

# Configuration
STACK_NAME="expense-splitter-cloudfront-dev"
REGION="us-west-2"
ENVIRONMENT="dev"
BUCKET_NAME="expense-splitter-frontend-dev-224425919845"

echo "🚀 Adding CloudFront to ExpenseSplitter Frontend..."

# Deploy CloudFormation stack
echo "📦 Deploying CloudFront stack..."
aws cloudformation deploy \
  --template-file cloudformation/add-cloudfront.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    Environment=$ENVIRONMENT \
    ExistingBucketName=$BUCKET_NAME \
  --capabilities CAPABILITY_IAM \
  --region $REGION

echo "✅ CloudFront deployed successfully!"

# Get stack outputs
echo "📋 Getting stack outputs..."
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text)

HTTPS_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text)

S3_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3WebsiteURL`].OutputValue' \
  --output text)

echo ""
echo "📊 CloudFront Configuration:"
echo "  Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""
echo "🌐 Your website URLs:"
echo "  HTTPS (CloudFront): $HTTPS_URL"
echo "  HTTP (S3 Direct):   $S3_URL"
echo ""
echo "🔄 Creating cache invalidation..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --region $REGION

echo ""
echo "🎉 CloudFront setup complete!"
echo ""
echo "📝 Important Notes:"
echo "  • CloudFront distribution may take 5-15 minutes to fully deploy"
echo "  • Use the HTTPS URL for production access"
echo "  • The S3 URL will still work for direct access"
echo "  • All traffic is now served over HTTPS with global CDN"
echo ""
echo "✨ Features added:"
echo "  ✅ HTTPS encryption"
echo "  ✅ Global CDN (faster loading worldwide)"
echo "  ✅ Automatic HTTP to HTTPS redirect"
echo "  ✅ SPA routing support (404 → index.html)"
echo "  ✅ Security headers"
echo "  ✅ Optimized caching"
