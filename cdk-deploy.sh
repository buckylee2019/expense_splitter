#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}🚀 ExpenseSplitter CDK Deployment${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check dependencies
command -v npm &> /dev/null || { echo "❌ npm not found"; exit 1; }
command -v aws &> /dev/null || { echo "❌ AWS CLI not found"; exit 1; }

# Install backend dependencies (for Lambda)
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
npm ci --omit=dev

# Install CDK dependencies
echo -e "${BLUE}📦 Installing CDK dependencies...${NC}"
npm install --prefix cdk

# Deploy CDK stacks
echo -e "${BLUE}☁️  Deploying CDK stacks...${NC}"
npx cdk deploy --all --require-approval never -c env=$ENVIRONMENT --app "npx ts-node cdk/bin/cdk.ts"

# Get outputs
BACKEND_STACK="ExpenseSplitter-Backend-$ENVIRONMENT"
FRONTEND_STACK="ExpenseSplitter-Frontend-$ENVIRONMENT"

BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $FRONTEND_STACK --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name $FRONTEND_STACK --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name $FRONTEND_STACK --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' --output text)

# Build and deploy frontend
echo -e "${BLUE}🔨 Building frontend...${NC}"
echo "REACT_APP_API_URL=https://$CLOUDFRONT_DOMAIN" > frontend/.env.production
npm ci --prefix frontend
npm run build --prefix frontend

echo -e "${BLUE}📤 Uploading to S3...${NC}"
aws s3 sync frontend/build/ s3://$BUCKET_NAME --delete --region $REGION

echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*" > /dev/null

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "🌐 Website: ${BLUE}https://$CLOUDFRONT_DOMAIN${NC}"
echo -e "🔗 API: ${BLUE}https://$CLOUDFRONT_DOMAIN/api${NC}"
