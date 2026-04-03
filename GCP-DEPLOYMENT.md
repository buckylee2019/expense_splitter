# Expense Splitter — GCP 部署文件

## 架構總覽

```
                       使用者
                      ┌──┴──┐
                 前端  │     │  API
                      ▼     ▼
            ┌─────────────┐ ┌──────────────────────┐
            │  Firebase    │ │  Cloud Run           │
            │  Hosting     │ │  asia-east1          │
            │              │ │                      │
            │  React SPA   │ │  Express.js (Node 22)│
            │  splitx-tw   │ │  Container, 0→10     │
            │  .web.app    │ │  512MB, 1 vCPU       │
            └─────────────┘ └──────┬──────┬────────┘
                                   │      │
                                   ▼      ▼
                     ┌──────────────┐ ┌──────────────┐
                     │  Firestore   │ │ Cloud Storage │
                     │  Native mode │ │ Photos Bucket │
                     │  asia-east1  │ │ (Public Read) │
                     │              │ │               │
                     │  users       │ │ groups/{id}/  │
                     │  groups      │ │ users/{id}/   │
                     │  expenses    │ └──────────────┘
                     │  settlements │
                     └──────────────┘
```

## GCP 服務對應

| 元件 | GCP 服務 | 原 AWS 服務 |
|---|---|---|
| 前端託管 | Firebase Hosting (`splitx-tw.web.app`) | S3 + CloudFront |
| 後端 API | Cloud Run (`asia-east1`) | Lambda + API Gateway |
| 資料庫 | Firestore Native mode (`asia-east1`) | DynamoDB |
| 照片儲存 | Cloud Storage (Public bucket) | S3 |
| 密鑰管理 | Secret Manager (`JWT_SECRET`) | Lambda 環境變數 |
| Container Registry | Artifact Registry (`asia-east1`) | — |
| IaC | Terraform | AWS CDK |

## 安全與權限

Cloud Run 使用專屬 Service Account (`expense-splitter-api`):
- `roles/datastore.user` — Firestore 讀寫
- `roles/storage.objectAdmin` — Photos bucket 上傳/刪除
- `roles/secretmanager.secretAccessor` — 讀取 JWT_SECRET

Cloud Run 對外 public (allUsers invoker)，認證由 Express JWT middleware 處理。

## 流量導轉

舊 AWS CloudFront (`d17fwpsfygwwqb.cloudfront.net`) 已設定 CloudFront Function，
所有請求 301 redirect 到 `https://splitx-tw.web.app`。

---

## 部署步驟

### 前置需求

- Google Cloud SDK (`gcloud`)
- Terraform >= 1.5
- Firebase CLI (`firebase`)
- Node.js >= 18

### 1. Terraform 建立基礎設施

```bash
cd terraform

terraform init

# 首次部署
terraform plan -var="project_id=bucky-day-1" -var="jwt_secret=YOUR_SECRET" -out=tfplan
terraform apply tfplan
```

Terraform 管理的資源：
- `main.tf` — Provider + GCP API 啟用
- `cloud_run.tf` — Artifact Registry + Secret Manager + Cloud Run
- `firestore.tf` — Firestore DB (asia-east1) + composite indexes
- `storage.tf` — Photos bucket + Frontend bucket (備用)
- `iam.tf` — Service account + role bindings
- `variables.tf` — project_id, region, jwt_secret
- `outputs.tf` — api_url, frontend_url 等

### 2. Build & Push Docker Image

```bash
# 設定 Docker 認證
gcloud auth configure-docker asia-east1-docker.pkg.dev

# 用 Cloud Build 建置 (不需本地 Docker)
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/bucky-day-1/expense-splitter/api:latest \
  --project=bucky-day-1 \
  --region=asia-east1
```

如果 Cloud Run 尚未建立（首次部署 Terraform image not found 錯誤），
push image 後再跑一次 `terraform plan` + `terraform apply`。

### 3. 部署 Frontend

```bash
# 取得 API URL
API_URL=$(terraform -chdir=terraform output -raw api_url)

# Build React app
cd frontend
REACT_APP_API_URL=$API_URL npm run build
cd ..

# 部署到 Firebase Hosting
firebase deploy --only hosting --project bucky-day-1
```

### 4. 驗證

```bash
# API health check
curl $(terraform -chdir=terraform output -raw api_url)/health

# 瀏覽器打開
# https://splitx-tw.web.app
```

---

## 資料遷移 (DynamoDB → Firestore)

一次性遷移腳本：`scripts/migrate-dynamodb-to-firestore.js`

```bash
# Dry run (只計數，不寫入)
DRY_RUN=true \
AWS_REGION=ap-northeast-1 \
GCP_PROJECT_ID=bucky-day-1 \
USERS_TABLE_NAME=ExpenseSplitter-Users-dev \
GROUPS_TABLE_NAME=ExpenseSplitter-Groups-dev \
EXPENSES_TABLE_NAME=ExpenseSplitter-Expenses-dev \
SETTLEMENTS_TABLE_NAME=ExpenseSplitter-Settlements-dev \
SOURCE_PHOTOS_BUCKET=expense-splitter-photos-dev-ap-northeast-1-467364672998 \
TARGET_PHOTOS_BUCKET=bucky-day-1-expense-splitter-photos \
OLD_CLOUDFRONT_DOMAIN=d90rfzfknzmyz.cloudfront.net \
NEW_PHOTOS_BASE_URL=https://storage.googleapis.com/bucky-day-1-expense-splitter-photos \
node scripts/migrate-dynamodb-to-firestore.js

# 正式遷移 (移除 DRY_RUN)
# 同上指令，移除 DRY_RUN=true
```

功能：
- 4 張 DynamoDB table → Firestore collections (batch write, 每批 500 筆)
- S3 照片 → Cloud Storage (保持相同 key path)
- CloudFront URL 自動改寫為 GCS URL
- 遷移後自動驗證筆數

---

## 更新部署

### 後端更新

```bash
# 重新 build & push image
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/bucky-day-1/expense-splitter/api:latest \
  --project=bucky-day-1 \
  --region=asia-east1

# 更新 Cloud Run (拉取新 image)
gcloud run services update expense-splitter \
  --image asia-east1-docker.pkg.dev/bucky-day-1/expense-splitter/api:latest \
  --region asia-east1 \
  --project bucky-day-1
```

### 前端更新

```bash
API_URL=$(terraform -chdir=terraform output -raw api_url)
cd frontend && REACT_APP_API_URL=$API_URL npm run build && cd ..
firebase deploy --only hosting --project bucky-day-1
```

---

## 重要 URLs

| 服務 | URL |
|---|---|
| Frontend | https://splitx-tw.web.app |
| API | https://expense-splitter-6vjteiok3q-de.a.run.app |
| 舊 URL (自動導轉) | https://d17fwpsfygwwqb.cloudfront.net |
| GCP Console | https://console.cloud.google.com/run?project=bucky-day-1 |
| Firebase Console | https://console.firebase.google.com/project/bucky-day-1 |
