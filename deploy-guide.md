# AWS Deployment Guide

This guide will help you deploy the Expense Splitter application to AWS using Lambda, API Gateway, and DynamoDB.

## Prerequisites

1. **AWS CLI installed and configured**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and default region
   ```

2. **Node.js and npm installed**

3. **Required permissions**: Your AWS user/role needs permissions for:
   - CloudFormation
   - Lambda
   - API Gateway
   - DynamoDB
   - IAM (for creating roles)

## Quick Deployment

### 1. Deploy to Development Environment

```bash
cd expense-splitter
npm install
npm run deploy:dev
```

### 2. Deploy to Staging Environment

```bash
npm run deploy:staging
```

### 3. Deploy to Production Environment

```bash
JWT_SECRET="your-super-secure-jwt-secret" npm run deploy:prod
```

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy Infrastructure

```bash
aws cloudformation deploy \
    --template-file cloudformation/infrastructure.yaml \
    --stack-name expense-splitter-dev \
    --parameter-overrides \
        Environment=dev \
        JWTSecret="your-jwt-secret-here" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1
```

### 3. Package and Deploy Code

```bash
# Create deployment package
npm run package

# Get Lambda function name from CloudFormation
LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
    --output text)

# Update Lambda function code
aws lambda update-function-code \
    --function-name $LAMBDA_FUNCTION \
    --zip-file fileb://deployment.zip
```

## What Gets Deployed

### AWS Resources Created:

1. **DynamoDB Tables**:
   - `ExpenseSplitter-Users-{env}` - User accounts
   - `ExpenseSplitter-Groups-{env}` - Groups and memberships
   - `ExpenseSplitter-Expenses-{env}` - Expense records
   - `ExpenseSplitter-Settlements-{env}` - Settlement records

2. **Lambda Function**:
   - Runs the Express.js application
   - 512MB memory, 30-second timeout
   - Environment variables for database table names

3. **API Gateway**:
   - REST API with proxy integration
   - Routes all requests to Lambda function
   - Public endpoint (no authentication at API Gateway level)

4. **IAM Role**:
   - Lambda execution role with DynamoDB permissions
   - CloudWatch Logs permissions

### Environment Variables Set:

- `NODE_ENV`: Environment name (dev/staging/prod)
- `AWS_REGION`: AWS region
- `JWT_SECRET`: JWT signing secret
- `USERS_TABLE`: DynamoDB Users table name
- `GROUPS_TABLE`: DynamoDB Groups table name
- `EXPENSES_TABLE`: DynamoDB Expenses table name
- `SETTLEMENTS_TABLE`: DynamoDB Settlements table name

## Testing the Deployment

After deployment, you'll get an API URL. Test it:

```bash
# Health check
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/health

# Register a user
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}'
```

## Environment Management

### Development Environment
- Stack: `expense-splitter-dev`
- Tables: `ExpenseSplitter-*-dev`
- For testing and development

### Staging Environment
- Stack: `expense-splitter-staging`
- Tables: `ExpenseSplitter-*-staging`
- For pre-production testing

### Production Environment
- Stack: `expense-splitter-prod`
- Tables: `ExpenseSplitter-*-prod`
- For live application

## Monitoring and Logs

### CloudWatch Logs
Lambda function logs are available in CloudWatch:
```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/expense-splitter
```

### DynamoDB Metrics
Monitor table performance in the AWS Console:
- DynamoDB → Tables → Select table → Metrics tab

## Updating the Application

To update the deployed application:

```bash
# Make your code changes, then redeploy
npm run deploy:dev
```

This will:
1. Update the Lambda function code
2. Apply any infrastructure changes
3. Keep existing data in DynamoDB tables

## Cleanup

To delete all resources and avoid charges:

```bash
# Delete development environment
./scripts/cleanup.sh dev

# Delete staging environment
./scripts/cleanup.sh staging

# Delete production environment
./scripts/cleanup.sh prod
```

⚠️ **Warning**: This will delete all data in the DynamoDB tables!

## Cost Optimization

### DynamoDB
- Uses PAY_PER_REQUEST billing mode
- Only pay for actual read/write requests
- No minimum charges

### Lambda
- Free tier: 1M requests/month + 400,000 GB-seconds
- After free tier: $0.20 per 1M requests + $0.0000166667 per GB-second

### API Gateway
- Free tier: 1M API calls/month
- After free tier: $3.50 per million API calls

## Security Considerations

1. **JWT Secret**: Use a strong, unique secret for each environment
2. **API Authentication**: The API uses JWT tokens for authentication
3. **DynamoDB**: Tables are private, only accessible via Lambda
4. **IAM**: Lambda has minimal required permissions

## Troubleshooting

### Common Issues:

1. **Deployment fails with permissions error**:
   - Ensure your AWS user has required permissions
   - Check IAM policies

2. **Lambda function timeout**:
   - Check CloudWatch logs for errors
   - Increase timeout if needed (max 15 minutes)

3. **DynamoDB access denied**:
   - Verify Lambda execution role has DynamoDB permissions
   - Check table names in environment variables

4. **API Gateway 502 errors**:
   - Check Lambda function logs
   - Verify function is returning proper HTTP response format

### Getting Help:

- Check CloudWatch Logs for detailed error messages
- Use AWS X-Ray for distributed tracing (if enabled)
- Monitor DynamoDB metrics for performance issues
