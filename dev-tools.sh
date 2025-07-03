#!/bin/bash

# Development Tools for ExpenseSplitter
# Helpful commands for development and debugging

set -e

source ./deploy-config.sh

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo -e "${GREEN}ExpenseSplitter Development Tools${NC}"
    echo "=================================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  logs          Show recent Lambda function logs"
    echo "  status        Check status of all AWS resources"
    echo "  test-api      Test API endpoints"
    echo "  invalidate    Invalidate CloudFront cache only"
    echo "  build         Build frontend locally"
    echo "  serve         Serve frontend locally for development"
    echo "  env           Show environment configuration"
    echo "  urls          Show all application URLs"
    echo "  clean         Clean up deployment artifacts"
    echo ""
}

show_logs() {
    echo -e "${BLUE}Fetching recent Lambda logs...${NC}"
    
    local log_group="/aws/lambda/${LAMBDA_FUNCTION_NAME}"
    local stream=$(aws logs describe-log-streams \
        --log-group-name "$log_group" \
        --order-by LastEventTime \
        --descending \
        --max-items 1 \
        --query 'logStreams[0].logStreamName' \
        --output text)
    
    if [ "$stream" != "None" ]; then
        aws logs get-log-events \
            --log-group-name "$log_group" \
            --log-stream-name "$stream" \
            --start-time $(($(date +%s) * 1000 - 300000)) \
            --query 'events[].message' \
            --output text
    else
        echo "No recent logs found"
    fi
}

check_status() {
    echo -e "${BLUE}Checking AWS resource status...${NC}"
    echo ""
    
    # Lambda status
    echo -e "${YELLOW}Lambda Function:${NC}"
    local lambda_status=$(aws lambda get-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --query 'Configuration.LastUpdateStatus' \
        --output text 2>/dev/null || echo "ERROR")
    echo "  Status: $lambda_status"
    
    # S3 bucket status
    echo -e "${YELLOW}S3 Bucket:${NC}"
    if aws s3 ls "s3://$S3_BUCKET" >/dev/null 2>&1; then
        local file_count=$(aws s3 ls "s3://$S3_BUCKET" --recursive | wc -l)
        echo "  Status: Accessible ($file_count files)"
    else
        echo "  Status: ERROR - Cannot access bucket"
    fi
    
    # CloudFront status
    echo -e "${YELLOW}CloudFront Distribution:${NC}"
    local cf_status=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --query 'Distribution.Status' \
        --output text 2>/dev/null || echo "ERROR")
    echo "  Status: $cf_status"
    
    # API Gateway status
    echo -e "${YELLOW}API Gateway:${NC}"
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
    if [ "$api_response" = "400" ]; then
        echo "  Status: Responding (HTTP $api_response)"
    else
        echo "  Status: Unexpected response (HTTP $api_response)"
    fi
}

test_api() {
    echo -e "${BLUE}Testing API endpoints...${NC}"
    
    local base_url="$API_BASE_URL"
    
    echo "Testing: $base_url/api/auth/login"
    curl -s -X POST "$base_url/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{}' | head -100
    echo ""
    
    echo "Testing: $base_url/api/auth/register"
    curl -s -X POST "$base_url/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{}' | head -100
    echo ""
}

invalidate_only() {
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    
    local invalidation_id=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    echo "Invalidation created: $invalidation_id"
    echo "This may take 5-15 minutes to complete."
}

build_frontend() {
    echo -e "${BLUE}Building frontend...${NC}"
    cd frontend
    npm run build
    cd ..
    echo -e "${GREEN}Frontend built successfully${NC}"
}

serve_frontend() {
    echo -e "${BLUE}Starting local development server...${NC}"
    echo "Frontend will be available at: http://localhost:3000"
    echo "Press Ctrl+C to stop"
    cd frontend
    npm start
}

show_env() {
    echo -e "${GREEN}Current Configuration:${NC}"
    echo "======================"
    echo "AWS Region: $AWS_REGION"
    echo "Lambda Function: $LAMBDA_FUNCTION_NAME"
    echo "S3 Bucket: $S3_BUCKET"
    echo "CloudFront ID: $CLOUDFRONT_DISTRIBUTION_ID"
    echo "API Gateway ID: $API_GATEWAY_ID"
    echo ""
    echo -e "${GREEN}URLs:${NC}"
    echo "API Base: $API_BASE_URL"
    echo "CloudFront: $CLOUDFRONT_URL"
    echo "S3 Website: $S3_WEBSITE_URL"
}

show_urls() {
    echo -e "${GREEN}Application URLs:${NC}"
    echo "=================="
    echo -e "CloudFront: ${BLUE}$CLOUDFRONT_URL${NC}"
    echo -e "S3 Direct:  ${BLUE}$S3_WEBSITE_URL${NC}"
    echo -e "API:        ${BLUE}$API_BASE_URL${NC}"
}

clean_artifacts() {
    echo -e "${BLUE}Cleaning up deployment artifacts...${NC}"
    rm -f lambda-deployment-*.zip
    rm -rf frontend/build
    echo -e "${GREEN}Cleanup completed${NC}"
}

# Main function
case "$1" in
    logs)
        show_logs
        ;;
    status)
        check_status
        ;;
    test-api)
        test_api
        ;;
    invalidate)
        invalidate_only
        ;;
    build)
        build_frontend
        ;;
    serve)
        serve_frontend
        ;;
    env)
        show_env
        ;;
    urls)
        show_urls
        ;;
    clean)
        clean_artifacts
        ;;
    *)
        show_help
        ;;
esac
