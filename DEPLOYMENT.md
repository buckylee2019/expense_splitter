# Deployment Guide

## Overview

The `deploy-all.sh` script provides an interactive deployment workflow for the Expense Splitter application. It supports multi-region deployment and dynamically retrieves configuration from CloudFormation outputs.

### Quick Start

#### First-time deployment to default region (us-west-2)
```bash
./deploy-all.sh dev
# Choose option 7: Full setup (backend + S3 + CloudFront + frontend)
```

#### First-time deployment to a different region
```bash
AWS_REGION=us-east-1 ./deploy-all.sh dev
# Choose option 7: Full setup
```

#### Subsequent deployments (after infrastructure is set up)
```bash
./deploy-all.sh dev
# Choose option 3: Both backend and frontend
```

#### View help
```bash
./deploy-all.sh --help
```

### Deployment Architecture

The deployment uses a two-step CloudFormation approach for the frontend:

1. **S3 Bucket** (`frontend-simple.yaml`) - Creates the S3 bucket for static hosting
2. **CloudFront Distribution** (`add-cloudfront.yaml`) - Adds CloudFront CDN on top of S3

This separation allows you to:
- Deploy S3 first and test directly
- Add CloudFront later for production
- Update CloudFront configuration independently

### How It Works

The script now:

1. **Retrieves values from CloudFormation outputs** instead of using hardcoded values:
   - S3 bucket name
   - CloudFront distribution ID
   - API Gateway ID and URL
   - CloudFront domain name

2. **Uses the AWS_REGION environment variable** to determine the deployment region

3. **Automatically adapts** to different environments (dev, staging, prod)

4. **Uses separate CloudFormation stacks** for better modularity:
   - Backend stack (Lambda, API Gateway, DynamoDB)
   - Frontend S3 stack (S3 bucket only)
   - Frontend CloudFront stack (CloudFront distribution)

### Environment Variables

You can customize the deployment using these environment variables:

- `AWS_REGION` - Target AWS region (default: us-west-2)
- `JWT_SECRET` - JWT secret for authentication (auto-generated if not provided)
- `BACKEND_STACK_NAME` - Override backend stack name (default: expense-splitter-{environment})
- `FRONTEND_S3_STACK_NAME` - Override frontend S3 stack name (default: expense-splitter-frontend-new)
- `FRONTEND_CLOUDFRONT_STACK_NAME` - Override CloudFront stack name (default: expense-splitter-cloudfront-{environment})

#### Example with custom stack names
```bash
FRONTEND_S3_STACK_NAME=my-custom-frontend-stack ./deploy-all.sh dev
```

### Default Stack Names

The script uses these CloudFormation stack names by default:
- Backend: `expense-splitter-{environment}`
- Frontend S3: `expense-splitter-frontend-new`
- Frontend CloudFront: `expense-splitter-cloudfront-{environment}`

### Deployment Options

When you run the script, you'll be prompted to choose:

1. **Backend only** - Deploys Lambda function and API Gateway
2. **Frontend only** - Builds and uploads React app to S3, invalidates CloudFront if exists
3. **Both backend and frontend** - Deploys backend and frontend code
4. **Just invalidate CloudFront cache** - Useful for quick frontend updates
5. **Setup frontend infrastructure (S3 bucket)** - Creates S3 bucket for static hosting
6. **Setup CloudFront distribution** - Adds CloudFront CDN on top of existing S3 bucket
7. **Full setup** - Complete first-time deployment (backend + S3 + CloudFront + frontend)

### Example: Deploy to Multiple Regions

#### First-time deployment to us-west-2 (default)
```bash
./deploy-all.sh dev
# Choose option 7 for full setup
```

#### First-time deployment to us-east-1
```bash
AWS_REGION=us-east-1 ./deploy-all.sh dev
# Choose option 7 for full setup
```

#### Update existing deployment in eu-west-1
```bash
AWS_REGION=eu-west-1 ./deploy-all.sh prod
# Choose option 3 to update both backend and frontend
```

#### Deploy only frontend changes
```bash
AWS_REGION=us-west-2 ./deploy-all.sh dev
# Choose option 2 to build and upload frontend only
```

### Manual Deployment Steps

If you prefer to deploy manually or need more control:

#### Step 1: Deploy Backend
```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create deployment package
npm run build
npm run package

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file cloudformation/infrastructure.yaml \
  --stack-name expense-splitter-dev \
  --parameter-overrides Environment=dev JWTSecret="$JWT_SECRET" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2

# Update Lambda function code
LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
  --stack-name expense-splitter-dev \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
  --output text)

aws lambda update-function-code \
  --function-name $LAMBDA_FUNCTION \
  --zip-file fileb://deployment.zip \
  --region us-west-2

aws lambda wait function-updated \
  --function-name $LAMBDA_FUNCTION \
  --region us-west-2
```

#### Step 2: Deploy Frontend S3 Bucket
```bash
aws cloudformation deploy \
  --template-file cloudformation/frontend-simple.yaml \
  --stack-name expense-splitter-frontend-new \
  --parameter-overrides Environment=dev \
  --region us-west-2
```

#### Step 3: Deploy CloudFront Distribution
```bash
# Get the bucket name and API Gateway ID from previous stacks
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name expense-splitter-frontend-new \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text --region us-west-2)

API_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name expense-splitter-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text --region us-west-2)

aws cloudformation deploy \
  --template-file cloudformation/add-cloudfront.yaml \
  --stack-name expense-splitter-cloudfront-dev \
  --parameter-overrides \
      Environment=dev \
      ExistingBucketName=$BUCKET_NAME \
      ApiGatewayId=$API_GATEWAY_ID \
  --region us-west-2
```

#### Step 4: Build and Upload Frontend
```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name expense-splitter-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text --region us-west-2)

cd frontend

# Create production environment file
cat > .env.production << EOT
REACT_APP_API_URL=$API_URL
REACT_APP_REGION=us-west-2
EOT

npm ci
npm run build
aws s3 sync build/ s3://$BUCKET_NAME --delete --region us-west-2
cd ..
```

#### Step 5: Invalidate CloudFront (if deployed)
```bash
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name expense-splitter-cloudfront-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text --region us-west-2)

aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

### Troubleshooting

#### Error: Frontend S3 stack not found
```
⚠️  Frontend S3 stack not found. Please deploy it first.
```

**Solution:** Run option 5 to create the S3 bucket first, or use option 7 for full setup.

#### Error: CloudFront distribution not found
This is normal if you haven't deployed CloudFront yet. The script will skip CloudFront invalidation.

**Solution:** Run option 6 to create the CloudFront distribution.

#### Error: API Gateway ID not found
Make sure the backend stack is deployed first.

**Solution:** Run option 1 to deploy the backend, or option 7 for full setup.

### Notes

- CloudFront distributions are global, but they're created in the region where you deploy the stack
- S3 bucket names must be globally unique - the templates use your AWS account ID to ensure uniqueness
- The script automatically handles region-specific S3 website URLs
- CloudFront can take 15-20 minutes to fully deploy
- CloudFront invalidations can take 5-15 minutes to propagate

### CloudFormation Templates Used

- **Backend**: `cloudformation/infrastructure.yaml`
  - Lambda function, API Gateway, DynamoDB tables, S3 for photos
  
- **Frontend S3**: `cloudformation/frontend-simple.yaml`
  - S3 bucket with static website hosting
  
- **Frontend CloudFront**: `cloudformation/add-cloudfront.yaml`
  - CloudFront distribution with S3 and API Gateway origins

### What the Script Does

The deployment script automates the following:

1. **Validates AWS credentials** - Checks if AWS CLI is configured
2. **Generates JWT secret** - Creates a secure JWT secret if not provided
3. **Creates deployment package** - Runs `npm run build` and `npm run package` for backend
4. **Deploys CloudFormation stacks** - Creates or updates infrastructure
5. **Updates Lambda code** - Uploads the deployment.zip to Lambda
6. **Builds React app** - Runs `npm ci` and `npm run build` in frontend directory
7. **Uploads to S3** - Syncs build files to S3 bucket
8. **Invalidates CloudFront** - Clears CDN cache when CloudFront is deployed
9. **Cleans up** - Removes temporary deployment.zip file

### Deployment Flow

The script retrieves all necessary values from CloudFormation outputs:
- S3 bucket name
- CloudFront distribution ID and domain
- API Gateway ID and URL
- Lambda function name

This means you don't need to hardcode any values - the script adapts to your existing infrastructure automatically.
