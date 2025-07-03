#!/bin/bash

# Quick Deploy Script for ExpenseSplitter
# Simple wrapper for common deployment scenarios

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 ExpenseSplitter Quick Deploy${NC}"
echo "=================================="
echo ""
echo "Choose deployment option:"
echo "1) Full deployment (backend + frontend + CloudFront)"
echo "2) Frontend only (faster for UI changes)"
echo "3) Backend only (for API changes)"
echo "4) Test deployment status"
echo "5) Emergency fix (full deploy + commit)"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo -e "${BLUE}Running full deployment...${NC}"
        ./deploy.sh
        ;;
    2)
        echo -e "${BLUE}Deploying frontend only...${NC}"
        ./deploy.sh --frontend-only
        ;;
    3)
        echo -e "${BLUE}Deploying backend only...${NC}"
        ./deploy.sh --backend-only
        ;;
    4)
        echo -e "${BLUE}Testing deployment...${NC}"
        ./deploy.sh --test-only
        ;;
    5)
        echo -e "${BLUE}Emergency deployment with commit...${NC}"
        ./deploy.sh --commit
        ;;
    *)
        echo "Invalid choice. Please run again and select 1-5."
        exit 1
        ;;
esac
