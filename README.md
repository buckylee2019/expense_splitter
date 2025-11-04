# SplitX Application

A full-stack application for splitting expenses among friends and groups.

## 專案架構 (Project Architecture)

### 系統架構圖 (System Architecture)

```mermaid
graph TB
    subgraph "前端層 Frontend Layer"
        CF[CloudFront CDN]
        S3[S3 Static Hosting]
        React[React Application]
    end
    
    subgraph "API 層 API Layer"
        APIGW[API Gateway]
        Lambda[Lambda Function<br/>Express.js]
    end
    
    subgraph "資料層 Data Layer"
        DDB[(DynamoDB)]
        S3Storage[(S3 Storage<br/>User Avatars)]
    end
    
    subgraph "認證 Authentication"
        JWT[JWT Tokens]
        BCrypt[BCrypt<br/>Password Hashing]
    end
    
    User[使用者 User] --> CF
    CF --> S3
    S3 --> React
    React --> APIGW
    APIGW --> Lambda
    Lambda --> JWT
    Lambda --> BCrypt
    Lambda --> DDB
    Lambda --> S3Storage
    
    style CF fill:#ff6b35
    style React fill:#61dafb
    style Lambda fill:#ff9900
    style DDB fill:#4053d6
    style S3Storage fill:#569a31
```

### 應用程式架構 (Application Architecture)

```mermaid
graph LR
    subgraph "React Frontend"
        Pages[Pages<br/>Login/Dashboard/Groups]
        Components[Components<br/>Navbar/Forms/Modals]
        Services[Services<br/>API Client]
        Context[Context<br/>Auth State]
    end
    
    subgraph "Express Backend"
        Routes[Routes<br/>Auth/Users/Groups/Expenses]
        Models[Models<br/>User/Group/Expense]
        ServicesB[Services<br/>Balance/Settlement]
        Utils[Utils<br/>Auth/S3]
    end
    
    Pages --> Components
    Pages --> Services
    Pages --> Context
    Services --> Routes
    Routes --> Models
    Routes --> ServicesB
    Routes --> Utils
    
    style Pages fill:#61dafb
    style Routes fill:#68a063
    style Models fill:#f0db4f
```

### 資料模型關係 (Data Model Relationships)

```mermaid
erDiagram
    USER ||--o{ GROUP_MEMBER : "belongs to"
    GROUP ||--o{ GROUP_MEMBER : "has"
    GROUP ||--o{ EXPENSE : "contains"
    USER ||--o{ EXPENSE : "paid by"
    EXPENSE ||--o{ SPLIT : "split into"
    USER ||--o{ SPLIT : "owes"
    USER ||--o{ SETTLEMENT : "from/to"
    GROUP ||--o{ SETTLEMENT : "within"
    
    USER {
        string id PK
        string email
        string name
        string passwordHash
        string avatarUrl
        timestamp createdAt
    }
    
    GROUP {
        string id PK
        string name
        array members
        string createdBy
        timestamp createdAt
    }
    
    EXPENSE {
        string id PK
        string groupId FK
        string description
        number amount
        string currency
        string category
        string paidBy
        array splits
        timestamp date
    }
    
    SETTLEMENT {
        string id PK
        string groupId FK
        string fromUser FK
        string toUser FK
        number amount
        string currency
        timestamp date
    }
```

### 部署流程 (Deployment Flow)

```mermaid
flowchart TD
    Start([開始部署]) --> Choice{選擇部署類型}
    
    Choice -->|Backend| BuildBE[建置 Backend<br/>npm install]
    Choice -->|Frontend| BuildFE[建置 Frontend<br/>npm run build]
    Choice -->|Both| BuildBoth[建置兩者]
    
    BuildBE --> PackageLambda[打包 Lambda<br/>deployment.zip]
    PackageLambda --> UpdateLambda[更新 Lambda 函數]
    UpdateLambda --> TestAPI[測試 API]
    
    BuildFE --> BuildReact[React 建置<br/>create-react-app]
    BuildReact --> UploadS3[上傳到 S3]
    UploadS3 --> InvalidateCF[清除 CloudFront 快取]
    
    BuildBoth --> PackageLambda
    BuildBoth --> BuildReact
    
    TestAPI --> Success([部署完成])
    InvalidateCF --> Success
    
    style Start fill:#90EE90
    style Success fill:#90EE90
    style BuildBE fill:#FFD700
    style BuildFE fill:#87CEEB
```


## Deployment Instructions

We've consolidated all deployment scripts into a single `deploy-all.sh` script that can handle both backend and frontend deployments.
### Using the Unified Deployment Script

```bash
# Make the script executable if needed
chmod +x deploy-all.sh

# Run the deployment script
./deploy-all.sh [environment]
```

The script will prompt you to choose what you want to deploy:
1. Backend only
2. Frontend only
3. Both backend and frontend
4. Just invalidate CloudFront cache

### Environment Options

- `dev` (default): Development environment
- `staging`: Staging environment
- `prod`: Production environment

Example:
```bash
# Deploy to development environment (default)
./deploy-all.sh

# Deploy to production environment
./deploy-all.sh prod
```

## Application URLs

After deployment, your application will be available at:

- **API URL**: https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev
- **S3 Website**: http://expense-splitter-frontend-224425919845.s3-website-us-west-2.amazonaws.com
- **CloudFront URL (HTTPS)**: https://dwt4ijd80bt6i.cloudfront.net

## Recent Changes

- Fixed issue with edit expense button not showing for all users
- Consolidated deployment scripts into a single unified script
- Updated CloudFront distribution to point to the correct S3 bucket
- Added proper bucket policies for public access

## Troubleshooting

If you encounter issues with the CloudFront distribution showing stale content:
1. Run the deployment script and choose option 4 to invalidate the CloudFront cache
2. Wait 5-15 minutes for the changes to propagate through the CloudFront network
3. Try accessing the site in an incognito/private browsing window or clear your browser cache

For any other issues, check the CloudWatch logs for the Lambda function or contact support.
