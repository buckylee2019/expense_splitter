import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface BackendStackProps extends cdk.StackProps {
  environment: string;
}

export class BackendStack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // DynamoDB Tables
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `ExpenseSplitter-Users-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    const groupsTable = new dynamodb.Table(this, 'GroupsTable', {
      tableName: `ExpenseSplitter-Groups-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const expensesTable = new dynamodb.Table(this, 'ExpensesTable', {
      tableName: `ExpenseSplitter-Expenses-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    expensesTable.addGlobalSecondaryIndex({
      indexName: 'GroupIndex',
      partitionKey: { name: 'group', type: dynamodb.AttributeType.STRING },
    });

    const settlementsTable = new dynamodb.Table(this, 'SettlementsTable', {
      tableName: `ExpenseSplitter-Settlements-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    settlementsTable.addGlobalSecondaryIndex({
      indexName: 'GroupIndex',
      partitionKey: { name: 'group', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for Photos
    const photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `expense-splitter-photos-${environment}-${this.region}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [{
        noncurrentVersionExpiration: cdk.Duration.days(30),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront for Photos
    const photosDistribution = new cloudfront.Distribution(this, 'PhotosDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(photosBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `CloudFront for group photos - ${environment}`,
    });

    // Lambda Function
    const lambdaFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: `expense-splitter-${environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../'), {
        exclude: ['cdk', 'cdk.out', 'cdk-deploy.sh', 'frontend', 'tests', 'cloudformation', '*.md', '.git', '.gitignore', '.env*', 'assets', 'scripts', 'deploy*.sh', 'quick-deploy.sh'],
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        NODE_ENV: environment,
        JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production-use-secrets-manager',
        USERS_TABLE_NAME: usersTable.tableName,
        GROUPS_TABLE_NAME: groupsTable.tableName,
        EXPENSES_TABLE_NAME: expensesTable.tableName,
        SETTLEMENTS_TABLE_NAME: settlementsTable.tableName,
        PHOTOS_BUCKET_NAME: photosBucket.bucketName,
        PHOTOS_CLOUDFRONT_DOMAIN: photosDistribution.distributionDomainName,
      },
    });

    // Grant permissions
    usersTable.grantReadWriteData(lambdaFunction);
    groupsTable.grantReadWriteData(lambdaFunction);
    expensesTable.grantReadWriteData(lambdaFunction);
    settlementsTable.grantReadWriteData(lambdaFunction);
    photosBucket.grantReadWrite(lambdaFunction);

    // API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'Api', {
      restApiName: `expense-splitter-api-${environment}`,
      description: 'API for Expense Splitter Application',
      deployOptions: { stageName: environment },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    this.apiGateway.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiGateway.url,
      description: 'API Gateway URL',
    });
    new cdk.CfnOutput(this, 'PhotosCloudFrontDomain', {
      value: photosDistribution.distributionDomainName,
      description: 'CloudFront Domain for Photos',
    });
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: lambdaFunction.functionName,
      description: 'Lambda Function Name',
    });
  }
}
