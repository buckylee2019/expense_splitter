#!/bin/bash

# ExpenseSplitter Deployment Script
# Automates the complete deployment process for frontend and backend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LAMBDA_FUNCTION_NAME="expense-splitter-dev"
S3_BUCKET="expense-splitter-frontend-224425919845"
CLOUDFRONT_DISTRIBUTION_ID="E3E393KBDDAGKU"
API_GATEWAY_ID="xro5pxx6oi"
REGION="us-west-2"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install Node.js and npm."
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        log_error "git not found. Please install git."
        exit 1
    fi
    
    log_success "All dependencies found"
}

deploy_backend() {
    log_info "Deploying backend Lambda function..."
    
    # Create deployment package
    local timestamp=$(date +%s)
    local zip_file="lambda-deployment-${timestamp}.zip"
    
    log_info "Creating deployment package: $zip_file"
    zip -r "$zip_file" src/ node_modules/ package.json lambda.js > /dev/null
    
    # Deploy to Lambda
    log_info "Updating Lambda function: $LAMBDA_FUNCTION_NAME"
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file "fileb://$zip_file" \
        --region "$REGION" > /dev/null
    
    # Wait for function to be ready
    log_info "Waiting for Lambda function to be ready..."
    local status="InProgress"
    while [ "$status" = "InProgress" ]; do
        sleep 2
        status=$(aws lambda get-function \
            --function-name "$LAMBDA_FUNCTION_NAME" \
            --region "$REGION" \
            --query 'Configuration.LastUpdateStatus' \
            --output text)
    done
    
    if [ "$status" = "Successful" ]; then
        log_success "Lambda function deployed successfully"
    else
        log_error "Lambda function deployment failed with status: $status"
        exit 1
    fi
    
    # Clean up
    rm "$zip_file"
}

deploy_frontend() {
    log_info "Deploying frontend..."
    
    # Navigate to frontend directory
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Build the frontend
    log_info "Building frontend..."
    npm run build
    
    # Deploy to S3
    log_info "Uploading to S3 bucket: $S3_BUCKET"
    aws s3 sync build/ "s3://$S3_BUCKET" --delete --region "$REGION"
    
    # Navigate back
    cd ..
    
    log_success "Frontend deployed to S3"
}

invalidate_cloudfront() {
    log_info "Invalidating CloudFront distribution..."
    
    local invalidation_id=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    log_info "Invalidation created with ID: $invalidation_id"
    log_info "Waiting for invalidation to complete..."
    
    # Wait for invalidation to complete
    local status="InProgress"
    while [ "$status" = "InProgress" ]; do
        sleep 5
        status=$(aws cloudfront get-invalidation \
            --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
            --id "$invalidation_id" \
            --query 'Invalidation.Status' \
            --output text)
        echo -n "."
    done
    echo ""
    
    if [ "$status" = "Completed" ]; then
        log_success "CloudFront invalidation completed"
    else
        log_warning "CloudFront invalidation status: $status"
    fi
}

test_deployment() {
    log_info "Testing deployment..."
    
    # Test API Gateway
    local api_url="https://${API_GATEWAY_ID}.execute-api.${REGION}.amazonaws.com/dev"
    log_info "Testing API Gateway: $api_url"
    
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" "$api_url/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
    
    if [ "$api_response" = "400" ]; then
        log_success "API Gateway is responding (expected 400 for empty request)"
    else
        log_warning "API Gateway response code: $api_response"
    fi
    
    # Test CloudFront
    local cloudfront_url="https://dwt4ijd80bt6i.cloudfront.net"
    log_info "Testing CloudFront: $cloudfront_url"
    
    local cf_response=$(curl -s -o /dev/null -w "%{http_code}" "$cloudfront_url")
    
    if [ "$cf_response" = "200" ]; then
        log_success "CloudFront is serving content"
    else
        log_warning "CloudFront response code: $cf_response"
    fi
}

commit_changes() {
    if [ "$1" = "--commit" ]; then
        log_info "Committing changes to git..."
        
        git add -A
        
        if git diff --staged --quiet; then
            log_info "No changes to commit"
        else
            local commit_message="Automated deployment - $(date '+%Y-%m-%d %H:%M:%S')"
            git commit -m "$commit_message"
            log_success "Changes committed: $commit_message"
        fi
    fi
}

show_urls() {
    echo ""
    log_success "Deployment completed successfully!"
    echo ""
    echo -e "${GREEN}Application URLs:${NC}"
    echo -e "  CloudFront: ${BLUE}https://dwt4ijd80bt6i.cloudfront.net${NC}"
    echo -e "  S3 Direct:  ${BLUE}http://${S3_BUCKET}.s3-website-${REGION}.amazonaws.com${NC}"
    echo -e "  API:        ${BLUE}https://${API_GATEWAY_ID}.execute-api.${REGION}.amazonaws.com/dev${NC}"
    echo ""
    echo -e "${GREEN}Available Features:${NC}"
    echo "  ✅ Weight-based expense splitting"
    echo "  ✅ User profile management"
    echo "  ✅ Payment icon favicon"
    echo "  ✅ All core functionality"
    echo ""
}

show_help() {
    echo "ExpenseSplitter Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backend-only    Deploy only the backend Lambda function"
    echo "  --frontend-only   Deploy only the frontend to S3 and CloudFront"
    echo "  --no-cloudfront   Skip CloudFront invalidation"
    echo "  --commit          Commit changes to git after deployment"
    echo "  --test-only       Only run deployment tests"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full deployment"
    echo "  $0 --frontend-only    # Deploy only frontend"
    echo "  $0 --backend-only     # Deploy only backend"
    echo "  $0 --commit           # Deploy and commit changes"
    echo ""
}

# Main deployment function
main() {
    local backend_only=false
    local frontend_only=false
    local no_cloudfront=false
    local commit=false
    local test_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend-only)
                backend_only=true
                shift
                ;;
            --frontend-only)
                frontend_only=true
                shift
                ;;
            --no-cloudfront)
                no_cloudfront=true
                shift
                ;;
            --commit)
                commit=true
                shift
                ;;
            --test-only)
                test_only=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo -e "${GREEN}🚀 ExpenseSplitter Deployment Script${NC}"
    echo "================================================"
    
    if [ "$test_only" = true ]; then
        test_deployment
        exit 0
    fi
    
    check_dependencies
    
    if [ "$backend_only" = true ]; then
        deploy_backend
    elif [ "$frontend_only" = true ]; then
        deploy_frontend
        if [ "$no_cloudfront" = false ]; then
            invalidate_cloudfront
        fi
    else
        # Full deployment
        deploy_backend
        deploy_frontend
        if [ "$no_cloudfront" = false ]; then
            invalidate_cloudfront
        fi
    fi
    
    test_deployment
    
    if [ "$commit" = true ]; then
        commit_changes --commit
    fi
    
    show_urls
}

# Run main function with all arguments
main "$@"
