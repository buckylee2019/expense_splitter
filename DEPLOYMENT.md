# ExpenseSplitter Deployment Guide

This guide explains how to use the automated deployment scripts for the ExpenseSplitter application.

## 🚀 Quick Start

### Option 1: Interactive Quick Deploy
```bash
./quick-deploy.sh
```
This will show you a menu with common deployment options.

### Option 2: Direct Deployment
```bash
# Full deployment (recommended)
./deploy.sh

# Frontend only (faster for UI changes)
./deploy.sh --frontend-only

# Backend only (for API changes)
./deploy.sh --backend-only
```

## 📋 Available Scripts

### 1. `deploy.sh` - Main Deployment Script

**Full deployment:**
```bash
./deploy.sh
```

**Options:**
- `--backend-only` - Deploy only the Lambda function
- `--frontend-only` - Deploy only the frontend to S3 and CloudFront
- `--no-cloudfront` - Skip CloudFront invalidation (faster)
- `--commit` - Automatically commit changes to git after deployment
- `--test-only` - Only run deployment tests
- `--help` - Show help message

**Examples:**
```bash
# Deploy everything and commit changes
./deploy.sh --commit

# Quick frontend update without CloudFront invalidation
./deploy.sh --frontend-only --no-cloudfront

# Test current deployment status
./deploy.sh --test-only
```

### 2. `quick-deploy.sh` - Interactive Menu

Simple interactive script for common scenarios:
```bash
./quick-deploy.sh
```

Menu options:
1. Full deployment (backend + frontend + CloudFront)
2. Frontend only (faster for UI changes)
3. Backend only (for API changes)
4. Test deployment status
5. Emergency fix (full deploy + commit)

### 3. `dev-tools.sh` - Development Utilities

**Check system status:**
```bash
./dev-tools.sh status
```

**View recent logs:**
```bash
./dev-tools.sh logs
```

**Test API endpoints:**
```bash
./dev-tools.sh test-api
```

**Other commands:**
```bash
./dev-tools.sh invalidate    # Invalidate CloudFront cache only
./dev-tools.sh build         # Build frontend locally
./dev-tools.sh serve         # Start local development server
./dev-tools.sh env           # Show configuration
./dev-tools.sh urls          # Show application URLs
./dev-tools.sh clean         # Clean up build artifacts
```

## ⚙️ Configuration

Edit `deploy-config.sh` to customize your deployment settings:

```bash
# AWS Configuration
export AWS_REGION="us-west-2"
export LAMBDA_FUNCTION_NAME="expense-splitter-dev"
export S3_BUCKET="expense-splitter-frontend-224425919845"
export CLOUDFRONT_DISTRIBUTION_ID="E3E393KBDDAGKU"
export API_GATEWAY_ID="xro5pxx6oi"
```

## 🔄 Common Workflows

### Making Frontend Changes
```bash
# 1. Make your changes to frontend code
# 2. Quick deploy frontend only
./deploy.sh --frontend-only
```

### Making Backend Changes
```bash
# 1. Make your changes to backend code
# 2. Deploy backend only
./deploy.sh --backend-only
```

### Emergency Deployment
```bash
# Deploy everything and commit changes
./deploy.sh --commit
```

### Development Testing
```bash
# Start local development server
./dev-tools.sh serve

# In another terminal, check logs
./dev-tools.sh logs

# Test API endpoints
./dev-tools.sh test-api
```

## 🌐 Application URLs

After deployment, your application will be available at:

- **CloudFront (Recommended):** https://dwt4ijd80bt6i.cloudfront.net
- **S3 Direct:** http://expense-splitter-frontend-224425919845.s3-website-us-west-2.amazonaws.com
- **API:** https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev

## 🔧 Troubleshooting

### Login Issues
If you get "405 Method Not Allowed" errors:
```bash
# Check if API is responding
./dev-tools.sh test-api

# Full redeploy to fix configuration issues
./deploy.sh
```

### CloudFront Not Updating
```bash
# Force CloudFront cache invalidation
./dev-tools.sh invalidate

# Or deploy with fresh invalidation
./deploy.sh --frontend-only
```

### Lambda Function Issues
```bash
# Check Lambda logs
./dev-tools.sh logs

# Redeploy backend
./deploy.sh --backend-only
```

### Check Overall Status
```bash
# Get status of all AWS resources
./dev-tools.sh status
```

## 📝 Script Features

### Automated Checks
- ✅ Dependency verification (AWS CLI, npm, git)
- ✅ Lambda function deployment status
- ✅ CloudFront invalidation completion
- ✅ API endpoint testing
- ✅ S3 bucket accessibility

### Error Handling
- ✅ Exit on any error
- ✅ Colored output for easy reading
- ✅ Detailed error messages
- ✅ Rollback-friendly (no destructive operations)

### Performance Optimizations
- ✅ Parallel operations where possible
- ✅ Skip unnecessary steps with flags
- ✅ Efficient CloudFront invalidation
- ✅ Smart dependency checking

## 🎯 Best Practices

1. **Use `--frontend-only` for UI changes** - Much faster than full deployment
2. **Test locally first** - Use `./dev-tools.sh serve` for development
3. **Check logs after deployment** - Use `./dev-tools.sh logs` to verify
4. **Use `--commit` for releases** - Automatically commits successful deployments
5. **Monitor status** - Use `./dev-tools.sh status` to check health

## 🚨 Emergency Procedures

### Complete System Recovery
```bash
# 1. Full redeploy
./deploy.sh --commit

# 2. Verify all systems
./dev-tools.sh status

# 3. Test functionality
./dev-tools.sh test-api
```

### Quick Rollback
```bash
# 1. Revert git changes
git reset --hard HEAD~1

# 2. Redeploy previous version
./deploy.sh
```

---

## 📞 Support

If you encounter issues:
1. Check `./dev-tools.sh status` for system health
2. Review `./dev-tools.sh logs` for error details
3. Try `./deploy.sh --test-only` to verify configuration
4. Use `./deploy.sh --help` for all available options
