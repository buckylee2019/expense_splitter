#!/bin/bash

# Test script to verify API Gateway security restrictions

ENVIRONMENT=${1:-dev}
REGION="us-west-2"

echo "🔍 Testing API Gateway security for environment: $ENVIRONMENT"

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-infrastructure-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region $REGION)

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name expense-splitter-cloudfront-$ENVIRONMENT \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text \
    --region $REGION 2>/dev/null)

echo ""
echo "📍 Testing URLs:"
echo "   Direct API: $API_URL"
echo "   CloudFront: $CLOUDFRONT_URL"

echo ""
echo "🚫 Testing direct API access (should be blocked):"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" || echo "000")
if [ "$HTTP_STATUS" = "403" ]; then
    echo "   ✅ PASS: Direct API access blocked (HTTP $HTTP_STATUS)"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "   ⚠️  WARNING: Connection failed - API might be blocked or unreachable"
else
    echo "   ❌ FAIL: Direct API access allowed (HTTP $HTTP_STATUS)"
fi

if [ ! -z "$CLOUDFRONT_URL" ]; then
    echo ""
    echo "✅ Testing CloudFront API access (should work):"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/api/health" || echo "000")
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "404" ]; then
        echo "   ✅ PASS: CloudFront API access working (HTTP $HTTP_STATUS)"
    elif [ "$HTTP_STATUS" = "000" ]; then
        echo "   ⚠️  WARNING: Connection failed - CloudFront might still be deploying"
    else
        echo "   ❌ FAIL: CloudFront API access not working (HTTP $HTTP_STATUS)"
    fi
else
    echo ""
    echo "⚠️  CloudFront not deployed yet - skipping CloudFront test"
fi

echo ""
echo "📋 Security Test Summary:"
echo "   - Direct API access should return HTTP 403 (Forbidden)"
echo "   - CloudFront API access should return HTTP 200 or 404"
echo "   - If you see connection failures, wait a few minutes for deployment to complete"
