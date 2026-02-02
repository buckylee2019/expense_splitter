#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || process.env.ENVIRONMENT || 'dev';
const region = process.env.AWS_REGION || 'us-east-1';

const backendStack = new BackendStack(app, `ExpenseSplitter-Backend-${env}`, {
  env: { region },
  environment: env,
  description: 'ExpenseSplitter Backend - Lambda, API Gateway, DynamoDB',
});

new FrontendStack(app, `ExpenseSplitter-Frontend-${env}`, {
  env: { region },
  environment: env,
  apiGateway: backendStack.apiGateway,
  description: 'ExpenseSplitter Frontend - S3, CloudFront',
});
