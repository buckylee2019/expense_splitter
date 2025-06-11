#!/bin/bash

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="expense-splitter-$ENVIRONMENT"
REGION=${AWS_REGION:-us-east-1}

echo "🗑️  Cleaning up Expense Splitter deployment ($ENVIRONMENT environment)"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION > /dev/null 2>&1; then
    echo "❌ Stack $STACK_NAME does not exist in region $REGION"
    exit 1
fi

echo "⚠️  This will delete all resources including DynamoDB tables and data!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "🔄 Deleting CloudFormation stack..."
aws cloudformation delete-stack \
    --stack-name $STACK_NAME \
    --region $REGION

echo "⏳ Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name $STACK_NAME \
    --region $REGION

echo "✅ Cleanup completed successfully!"
echo "All resources for $ENVIRONMENT environment have been deleted."
