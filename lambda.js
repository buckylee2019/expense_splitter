const serverless = require('serverless-http');
const app = require('./src/app');

// AWS Lambda automatically sets AWS_REGION, so we don't need to override it
// Map CloudFormation environment variables to the names expected by our app
if (process.env.USERS_TABLE_NAME) {
  // Already correctly named
}
if (process.env.GROUPS_TABLE_NAME) {
  // Already correctly named  
}
if (process.env.EXPENSES_TABLE_NAME) {
  // Already correctly named
}
if (process.env.SETTLEMENTS_TABLE_NAME) {
  // Already correctly named
}

module.exports.handler = serverless(app);
