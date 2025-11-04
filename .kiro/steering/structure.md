# Project Structure

## Root Level

- `lambda.js` - AWS Lambda entry point (wraps Express app with serverless-http)
- `src/app.js` - Express application setup with middleware and routes
- `deploy-all.sh` - Unified deployment script for backend and frontend
- `package.json` - Backend dependencies and scripts

## Backend Structure (`src/`)

```
src/
├── app.js                 # Express app configuration
├── config/
│   └── dynamodb.js        # DynamoDB client setup
├── models/                # DynamoDB entity models
│   ├── User.js            # User model with auth methods
│   ├── Group.js           # Group model
│   ├── Expense.js         # Expense model with filtering
│   └── Settlement.js      # Settlement model
├── routes/                # Express route handlers
│   ├── auth.js            # Login, register, token refresh
│   ├── users.js           # User CRUD and search
│   ├── groups.js          # Group management
│   ├── expenses.js        # Expense CRUD with pagination
│   ├── settlements.js     # Settlement tracking
│   ├── balances.js        # Balance calculations
│   └── reports.js         # Analytics and reporting
├── services/              # Business logic layer
│   ├── balanceService.js              # Balance calculations
│   ├── optimizedBalanceService.js     # Optimized debt simplification
│   └── multiGroupSettlementService.js # Cross-group settlements
└── utils/                 # Utility functions
    ├── auth.js            # JWT middleware
    └── s3.js              # S3 upload helpers
```

## Frontend Structure (`frontend/`)

```
frontend/
├── public/                # Static assets
│   └── index.html         # HTML template
├── src/
│   ├── index.js           # React entry point
│   ├── App.js             # Main app component with routing
│   ├── components/        # Reusable UI components
│   │   ├── AddMember.js
│   │   ├── CategoryBadge.js
│   │   ├── CategoryPieChart.js
│   │   ├── CategoryPopup.js
│   │   ├── CategorySelector.js
│   │   ├── MultiGroupSettlementModal.js
│   │   ├── MultiplePaidByPopup.js
│   │   ├── Navbar.js
│   │   ├── PaidByPopup.js
│   │   ├── PopupSelector.js
│   │   ├── SettlementModal.js
│   │   ├── SplitConfigPopup.js
│   │   └── UserPhoto.js
│   ├── contexts/          # React context providers
│   │   └── AuthContext.js # Authentication state
│   ├── data/              # Static data
│   │   └── expenseCategories.js
│   ├── hooks/             # Custom React hooks
│   │   └── useMobileDetection.js
│   ├── pages/             # Page components (routes)
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── Dashboard.js
│   │   ├── Groups.js
│   │   ├── CreateGroup.js
│   │   ├── EditGroup.js
│   │   ├── GroupDetails.js
│   │   ├── AddExpense.js
│   │   ├── EditExpense.js
│   │   ├── ExpenseDetails.js
│   │   ├── Settlements.js
│   │   ├── Reports.js
│   │   └── Profile.js
│   ├── services/          # API integration
│   │   └── api.js         # Axios instance with interceptors
│   ├── styles/            # CSS files
│   │   ├── index.css
│   │   ├── theme.css
│   │   ├── navbar.css
│   │   ├── pagination.css
│   │   ├── responsive.css
│   │   ├── Reports.css
│   │   └── Settlements.css
│   └── utils/             # Frontend utilities
│       └── icons.js
└── package.json           # Frontend dependencies
```

## Infrastructure (`cloudformation/`)

- `infrastructure.yaml` - Main backend stack (Lambda, API Gateway, DynamoDB)
- `frontend-infrastructure.yaml` - Frontend stack (S3, CloudFront)
- Other templates for various deployment configurations

## Testing (`tests/`)

- Manual test scripts for API validation
- Database validation scripts
- Sample images for testing photo uploads

## Key Patterns

- **Models**: Class-based with static methods for CRUD operations
- **Routes**: Express routers with middleware for authentication
- **Services**: Pure business logic separated from route handlers
- **Components**: Functional React components with hooks
- **Contexts**: React Context API for global state (auth)
- **API Layer**: Centralized Axios instance with request/response interceptors
