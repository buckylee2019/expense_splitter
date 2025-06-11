const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const config = {
  // AWS Lambda automatically provides AWS_REGION environment variable
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2'
};

console.log('DynamoDB configuration:', {
  region: config.region,
  AWS_REGION: process.env.AWS_REGION,
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
  hasEndpoint: !!process.env.DYNAMODB_ENDPOINT
});

// For local development only
if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
}

// Only use explicit credentials for local development
// In Lambda, we rely on the execution role
if (process.env.NODE_ENV === 'development' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };
}

const client = new DynamoDBClient(config);
const docClient = DynamoDBDocumentClient.from(client);

module.exports = { docClient, client };
