#!/bin/bash

set -e

# Configuration
ENVIRONMENT=${1:-dev}
BACKEND_STACK_NAME=${BACKEND_STACK_NAME:-"expense-splitter-$ENVIRONMENT"}
FRONTEND_S3_STACK_NAME=${FRONTEND_S3_STACK_NAME:-"expense-splitter-frontend-new"}
FRONTEND_CLOUDFRONT_STACK_NAME=${FRONTEND_CLOUDFRONT_STACK_NAME:-"expense-splitter-cloudfront-$ENVIRONMENT"}
REGION=${AWS_REGION:-us-west-2}

# Show usage if --help is passed
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: ./deploy-all.sh [environment]"
  echo ""
  echo "Environment: dev (default), staging, or prod"
  echo ""
  echo "Optional environment variables to override stack names:"
  echo "  BACKEND_STACK_NAME              - Backend CloudFormation stack name"
  echo "  FRONTEND_S3_STACK_NAME          - Frontend S3 bucket stack name"
  echo "  FRONTEND_CLOUDFRONT_STACK_NAME  - Frontend CloudFront stack name"
  echo "  AWS_REGION                      - AWS region (default: us-west-2)"
  echo ""
  echo "Example with custom frontend stack:"
  echo "  FRONTEND_S3_STACK_NAME=my-custom-frontend-stack ./deploy-all.sh dev"
  echo ""
  exit 0
fi

# These will be retrieved from CloudFormation outputs
BUCKET_NAME=""
CLOUDFRONT_DISTRIBUTION_ID=""
CLOUDFRONT_DOMAIN=""
API_URL=""
API_GATEWAY_ID=""

# Function to display section headers
section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Function to deploy backend
deploy_backend() {
  section "DEPLOYING BACKEND API ($ENVIRONMENT)"
  
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
      --stack-name $BACKEND_STACK_NAME \
      --parameter-overrides \
          Environment=$ENVIRONMENT \
          JWTSecret="$JWT_SECRET" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region $REGION

  echo "📋 Getting stack outputs..."
  LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
      --stack-name $BACKEND_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
      --output text)

  API_URL=$(aws cloudformation describe-stacks \
      --stack-name $BACKEND_STACK_NAME \
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

  echo "✅ Backend deployment completed successfully!"
  echo ""
  echo "🌐 API URL: $API_URL"
  echo "🔧 Lambda Function: $LAMBDA_FUNCTION"

  # Clean up
  rm -f deployment.zip
}

# Function to deploy frontend S3 bucket
deploy_frontend_s3() {
  section "DEPLOYING FRONTEND S3 BUCKET"
  
  echo "☁️  Deploying S3 bucket stack..."
  aws cloudformation deploy \
      --template-file cloudformation/frontend-simple.yaml \
      --stack-name $FRONTEND_S3_STACK_NAME \
      --parameter-overrides Environment=$ENVIRONMENT \
      --region $REGION

  echo "📋 Getting S3 bucket name..."
  BUCKET_NAME=$(aws cloudformation describe-stacks \
      --stack-name $FRONTEND_S3_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
      --output text)

  echo "✅ S3 bucket created successfully!"
  echo "🌐 Bucket: $BUCKET_NAME"
}

# Function to deploy CloudFront distribution
deploy_cloudfront() {
  section "DEPLOYING CLOUDFRONT DISTRIBUTION"
  
  # Get bucket name if not already set
  if [ -z "$BUCKET_NAME" ]; then
    echo "📋 Retrieving S3 bucket name..."
    BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name $FRONTEND_S3_STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
        --output text)
  fi
  
  # Get API Gateway ID if not already set
  if [ -z "$API_GATEWAY_ID" ]; then
    echo "📋 Retrieving API Gateway ID..."
    API_GATEWAY_ID=$(aws cloudformation describe-stacks \
        --stack-name $BACKEND_STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
        --output text)
  fi
  
  echo "☁️  Deploying CloudFront distribution..."
  aws cloudformation deploy \
      --template-file cloudformation/add-cloudfront.yaml \
      --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
      --parameter-overrides \
          Environment=$ENVIRONMENT \
          ExistingBucketName=$BUCKET_NAME \
          ApiGatewayId=$API_GATEWAY_ID \
      --region $REGION

  echo "📋 Getting CloudFront details..."
  CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
      --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
      --output text)
  
  CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
      --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
      --output text)

  echo "✅ CloudFront distribution created successfully!"
  echo "🌐 CloudFront URL: https://$CLOUDFRONT_DOMAIN"
}

# Function to deploy frontend (build and upload)
deploy_frontend() {
  section "DEPLOYING FRONTEND TO S3"
  
  # Get bucket name if not already set
  if [ -z "$BUCKET_NAME" ]; then
    echo "📋 Retrieving S3 bucket name..."
    if aws cloudformation describe-stacks --stack-name $FRONTEND_S3_STACK_NAME --region $REGION > /dev/null 2>&1; then
      BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name $FRONTEND_S3_STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
        --output text)
    else
      echo "⚠️  Frontend S3 stack not found. Please deploy it first."
      echo "    Run option 5 or use: cloudformation/frontend-simple.yaml"
      exit 1
    fi
  fi
  
  # Get API URL if not already set
  if [ -z "$API_URL" ]; then
    echo "📋 Retrieving backend API URL..."
    API_URL=$(aws cloudformation describe-stacks \
      --stack-name $BACKEND_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
      --output text)
  fi
  
  # Get CloudFront domain if it exists
  if [ -z "$CLOUDFRONT_DOMAIN" ]; then
    if aws cloudformation describe-stacks --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME --region $REGION > /dev/null 2>&1; then
      CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
        --output text)
    fi
  fi
  
  echo "🔨 Building React application..."
  cd frontend

  # Create production environment file
  cat > .env.production << EOT
REACT_APP_API_URL=$API_URL
REACT_APP_REGION=$REGION
EOT

  # Install dependencies and build
  npm ci
  npm run build

  echo "📤 Uploading files to S3..."
  aws s3 sync build/ s3://$BUCKET_NAME --region $REGION --delete

  echo "✅ Frontend deployment completed successfully!"
  echo ""
  echo "🌐 S3 Website URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
  if [ -n "$CLOUDFRONT_DOMAIN" ]; then
    echo "🌐 CloudFront URL: https://$CLOUDFRONT_DOMAIN"
  fi
  
  # Return to project root
  cd ..
}

# Function to update CloudFront
update_cloudfront() {
  section "UPDATING CLOUDFRONT DISTRIBUTION"
  
  # Get CloudFront distribution ID if not already set
  if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "📋 Retrieving CloudFront distribution ID..."
    CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
      --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
      --output text)
    
    CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
      --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME \
      --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
      --output text)
  fi
  
  echo "🔄 Creating CloudFront cache invalidation..."
  aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*"

  echo "✅ CloudFront invalidation created successfully!"
  echo ""
  echo "🌐 CloudFront URL: https://$CLOUDFRONT_DOMAIN"
  echo "⏳ Please allow 5-15 minutes for changes to propagate through CloudFront"
}

# Main deployment flow
main() {
  section "EXPENSE SPLITTER DEPLOYMENT"
  echo "Environment: $ENVIRONMENT"
  echo "Region: $REGION"
  echo ""
  echo "Stack Names:"
  echo "  Backend: $BACKEND_STACK_NAME"
  echo "  Frontend S3: $FRONTEND_S3_STACK_NAME"
  echo "  Frontend CloudFront: $FRONTEND_CLOUDFRONT_STACK_NAME"
  echo ""
  
  # Ask what to deploy
  echo "What would you like to deploy?"
  echo "1) Backend only"
  echo "2) Frontend only (build and upload to S3)"
  echo "3) Both backend and frontend"
  echo "4) Just invalidate CloudFront cache"
  echo "5) Setup frontend infrastructure (S3 bucket)"
  echo "6) Setup CloudFront distribution"
  echo "7) Full setup (backend + S3 + CloudFront + frontend)"
  
  read -p "Enter your choice (1-7): " choice 
  
  case $choice in
    1)
      deploy_backend
      ;;
    2)
      deploy_frontend
      if aws cloudformation describe-stacks --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME --region $REGION > /dev/null 2>&1; then
        update_cloudfront
      fi
      ;;
    3)
      deploy_backend
      deploy_frontend
      if aws cloudformation describe-stacks --stack-name $FRONTEND_CLOUDFRONT_STACK_NAME --region $REGION > /dev/null 2>&1; then
        update_cloudfront
      fi
      ;;
    4)
      update_cloudfront
      ;;
    5)
      deploy_frontend_s3
      ;;
    6)
      deploy_cloudfront
      ;;
    7)
      deploy_backend
      deploy_frontend_s3
      deploy_cloudfront
      deploy_frontend
      ;;
    *)
      echo "Invalid choice. Exiting."
      exit 1
      ;;
  esac
  
  section "DEPLOYMENT COMPLETE"
  echo "✅ All requested components have been deployed successfully!"
  echo ""
  
  # Display relevant URLs based on what was deployed
  if [ -n "$API_URL" ]; then
    echo "🌐 API URL: $API_URL"
  fi
  
  if [ -n "$BUCKET_NAME" ]; then
    echo "🌐 S3 Website: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
  fi
  
  if [ -n "$CLOUDFRONT_DOMAIN" ]; then
    echo "🌐 CloudFront URL: https://$CLOUDFRONT_DOMAIN"
  fi
  
  echo ""
  echo "📍 Region: $REGION"
  echo "🎉 Expense Splitter is now live on AWS!"
}

# Run the main function
main
