# Technology Stack

## Backend

- **Runtime**: Node.js with Express.js
- **Deployment**: AWS Lambda with serverless-http wrapper
- **Database**: AWS DynamoDB with DocumentClient
- **Storage**: AWS S3 for user avatars
- **Authentication**: JWT tokens with bcrypt password hashing
- **API Gateway**: AWS API Gateway for Lambda integration

### Key Backend Libraries

- `express` - Web framework
- `serverless-http` - Lambda adapter for Express
- `@aws-sdk/client-dynamodb` & `@aws-sdk/lib-dynamodb` - DynamoDB operations
- `@aws-sdk/client-s3` - S3 file storage
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `express-validator` - Request validation
- `uuid` - ID generation

## Frontend

- **Framework**: React 18
- **Build Tool**: Create React App (react-scripts)
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **Charts**: Chart.js with react-chartjs-2
- **Icons**: Flaticon UI icons

### Frontend Configuration

- API URL configured via `REACT_APP_API_URL` environment variable
- JWT token stored in localStorage
- Automatic token injection via Axios interceptors
- 401 response handling with automatic redirect to login

## Infrastructure

- **IaC**: AWS CloudFormation templates
- **CDN**: CloudFront distribution for frontend
- **Hosting**: S3 static website hosting
- **Region**: us-west-2 (default)

### DynamoDB Tables

- `ExpenseSplitter-Users` - User accounts with EmailIndex GSI
- `ExpenseSplitter-Groups` - Group information
- `ExpenseSplitter-Expenses` - Expense records with GroupIndex GSI
- `ExpenseSplitter-Settlements` - Settlement transactions

## Common Commands

### Backend Development
```bash
npm start              # Start Express server locally
npm run dev            # Start with nodemon for hot reload
npm run build          # Install production dependencies
npm run package        # Create deployment.zip for Lambda
```

### Frontend Development
```bash
cd frontend
npm start              # Start React dev server (port 3000)
npm run build          # Create production build
```

### Deployment
```bash
./deploy-all.sh [env]  # Interactive deployment script
# Options: dev (default), staging, prod
# Prompts for: backend only, frontend only, both, or CloudFront invalidation
```

### Testing
```bash
npm test               # Run Jest tests
npm run test:watch     # Run tests in watch mode
```

## Code Conventions

- ES6+ JavaScript (CommonJS for backend, ES modules for frontend)
- Async/await for asynchronous operations
- Model classes for DynamoDB entities (User, Group, Expense, Settlement)
- Service layer for business logic (balanceService, settlementService)
- Route handlers in separate files under `src/routes/`
- Environment variables for configuration (dotenv)
- 10MB body parser limit for photo uploads
