# Expense Splitter

A Splitwise-like application for splitting expenses among friends and groups.

## Features

- User authentication and management
- Create and manage groups
- Add and split expenses
- Track balances and settlements
- Multiple split methods (equal, exact amounts, percentages)
- Expense categories and descriptions
- Settlement tracking

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: AWS DynamoDB
- **Authentication**: JWT tokens
- **Deployment**: AWS Lambda + API Gateway
- **Testing**: Jest and Supertest

## Project Structure

```
expense-splitter/
├── src/
│   ├── models/          # DynamoDB models
│   ├── controllers/     # Route handlers
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── config/          # Configuration files
│   └── app.js           # Main application file
├── cloudformation/      # AWS CloudFormation templates
├── scripts/             # Deployment and setup scripts
├── tests/               # Test files
├── lambda.js            # Lambda handler
└── package.json
```

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. For local development with DynamoDB Local:
   ```bash
   # Install and run DynamoDB Local
   java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
   
   # Create tables
   node scripts/create-tables.js
   
   # Start development server
   npm run dev
   ```

## AWS Deployment

### Quick Deploy

```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to staging environment
npm run deploy:staging

# Deploy to production environment
JWT_SECRET="your-secure-secret" npm run deploy:prod
```

### Manual Deployment

See [deploy-guide.md](deploy-guide.md) for detailed deployment instructions.

## AWS Setup

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js and npm installed

### What Gets Deployed
- **Lambda Function**: Runs the Express.js application
- **API Gateway**: REST API endpoint
- **DynamoDB Tables**: User data, groups, expenses, settlements
- **IAM Roles**: Proper permissions for Lambda to access DynamoDB

### Environment Variables (AWS)
The CloudFormation template automatically sets:
- `NODE_ENV`: Environment name
- `AWS_REGION`: AWS region
- `JWT_SECRET`: JWT signing secret
- `USERS_TABLE_NAME`: DynamoDB Users table name
- `GROUPS_TABLE_NAME`: DynamoDB Groups table name
- `EXPENSES_TABLE_NAME`: DynamoDB Expenses table name
- `SETTLEMENTS_TABLE_NAME`: DynamoDB Settlements table name

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/search?email=query` - Search users by email

### Groups
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/members` - Add member to group

### Expenses
- `GET /api/expenses` - Get user's expenses
- `POST /api/expenses` - Create new expense
- `GET /api/expenses/:id` - Get expense details

### Settlements
- `GET /api/settlements` - Get settlements
- `POST /api/settlements` - Record settlement

### Balances
- `GET /api/balances` - Get user balances
- `GET /api/balances?groupId=id` - Get balances for specific group

## Example Usage

### Local Development
```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
```

### AWS Deployment
```bash
# Replace with your actual API Gateway URL
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/dev"

# Health check
curl $API_URL/health

# Register a user
curl -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
```

## Development Commands

- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run build` - Install production dependencies
- `npm run package` - Create deployment package

## Deployment Commands

- `npm run deploy:dev` - Deploy to development environment
- `npm run deploy:staging` - Deploy to staging environment
- `npm run deploy:prod` - Deploy to production environment

## Cleanup

To delete AWS resources:
```bash
./scripts/cleanup.sh dev     # Delete dev environment
./scripts/cleanup.sh staging # Delete staging environment
./scripts/cleanup.sh prod    # Delete prod environment
```

## Cost Estimation

### AWS Free Tier Eligible:
- **Lambda**: 1M requests/month + 400,000 GB-seconds
- **API Gateway**: 1M API calls/month
- **DynamoDB**: 25GB storage + 25 read/write capacity units

### After Free Tier:
- **Lambda**: ~$0.20 per 1M requests
- **API Gateway**: ~$3.50 per 1M requests
- **DynamoDB**: Pay-per-request pricing (~$1.25 per million reads/writes)

For a small application with moderate usage, expect $5-20/month.

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Environment-specific deployments
- IAM roles with minimal required permissions
- DynamoDB tables isolated per environment

## Monitoring

- **CloudWatch Logs**: Lambda function logs
- **CloudWatch Metrics**: API Gateway and Lambda metrics
- **DynamoDB Metrics**: Table performance monitoring
- **Health Check Endpoint**: `/health` for uptime monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
