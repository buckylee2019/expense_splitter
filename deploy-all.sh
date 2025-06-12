#!/bin/bash

set -e

# Configuration
ENVIRONMENT=${1:-dev}
STACK_NAME="expense-splitter-$ENVIRONMENT"
REGION=${AWS_REGION:-us-west-2}
BUCKET_NAME="expense-splitter-frontend-224425919845"
CLOUDFRONT_DISTRIBUTION_ID="E3E393KBDDAGKU"
API_URL="https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev"

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

  echo "✅ Backend deployment completed successfully!"
  echo ""
  echo "🌐 API URL: $API_URL"
  echo "🔧 Lambda Function: $LAMBDA_FUNCTION"

  # Clean up
  rm -f deployment.zip
}

# Function to deploy frontend
deploy_frontend() {
  section "DEPLOYING FRONTEND TO S3"
  
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

  # Ensure bucket has public read policy
  echo "🔒 Setting bucket policy..."
  cat > /tmp/bucket-policy.json << EOT
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOT

  aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json --region $REGION

  echo "✅ Frontend deployment completed successfully!"
  echo ""
  echo "🌐 S3 Website URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
  
  # Return to project root
  cd ..
}

# Function to update CloudFront
update_cloudfront() {
  section "UPDATING CLOUDFRONT DISTRIBUTION"
  
  echo "🔄 Creating CloudFront cache invalidation..."
  aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --region $REGION

  echo "✅ CloudFront invalidation created successfully!"
  echo ""
  echo "🌐 CloudFront URL: https://dwt4ijd80bt6i.cloudfront.net"
  echo "⏳ Please allow 5-15 minutes for changes to propagate through CloudFront"
}

# Main deployment flow
main() {
  section "EXPENSE SPLITTER DEPLOYMENT"
  echo "Environment: $ENVIRONMENT"
  echo "Region: $REGION"
  
  # Ask what to deploy
  echo "What would you like to deploy?"
  echo "1) Backend only"
  echo "2) Frontend only"
  echo "3) Both backend and frontend"
  echo "4) Just invalidate CloudFront cache"
  
  read -p "Enter your choice (1-4): " choice 
  
  case $choice in
    1)
      deploy_backend
      ;;
    2)
      deploy_frontend
      update_cloudfront
      ;;
    3)
      deploy_backend
      deploy_frontend
      update_cloudfront
      ;;
    4)
      update_cloudfront
      ;;
    *)
      echo "Invalid choice. Exiting."
      exit 1
      ;;
  esac
  
  section "DEPLOYMENT COMPLETE"
  echo "✅ All requested components have been deployed successfully!"
  echo ""
  echo "🌐 API URL: $API_URL"
  echo "🌐 S3 Website: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
  echo "🌐 CloudFront URL: https://dwt4ijd80bt6i.cloudfront.net"
  echo ""
  echo "🎉 Expense Splitter is now live on AWS!"
}

# Run the main function
main
