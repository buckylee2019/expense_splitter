#!/bin/bash

set -e

# Configuration
STACK_NAME="expense-splitter-frontend-dev"
REGION="us-west-2"
ENVIRONMENT="dev"
API_URL="https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev"

echo "🚀 Deploying ExpenseSplitter Frontend (Simple S3 Hosting)..."

# Delete existing stack if it exists and is in failed state
echo "🧹 Cleaning up any existing failed stack..."
aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION 2>/dev/null || true
aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $REGION 2>/dev/null || true

# Deploy CloudFormation stack
echo "📦 Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file cloudformation/frontend-simple.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    Environment=$ENVIRONMENT \
  --capabilities CAPABILITY_IAM \
  --region $REGION

echo "✅ Infrastructure deployed successfully!"

# Get stack outputs
echo "📋 Getting stack outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text)

echo "📊 Stack Outputs:"
echo "  Bucket Name: $BUCKET_NAME"
echo "  Website URL: $WEBSITE_URL"

# Build the React app with correct API URL
echo "🔨 Building React application..."
cd frontend

# Create production environment file
cat > .env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_REGION=$REGION
EOF

# Install dependencies and build
npm ci
npm run build

echo "📤 Uploading files to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --region $REGION --delete

echo ""
echo "🎉 Frontend deployed successfully!"
echo ""
echo "🌐 Your website is available at:"
echo "   $WEBSITE_URL"
echo ""
echo "📝 Note: This is HTTP only. For HTTPS, we can add CloudFront later."
