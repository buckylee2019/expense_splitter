// Test script to check settlements API response
const https = require('https');

const API_URL = 'https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev';

// You'll need to replace this with a valid JWT token from your app
const JWT_TOKEN = 'your_jwt_token_here';

const options = {
  hostname: 'xro5pxx6oi.execute-api.us-west-2.amazonaws.com',
  port: 443,
  path: '/dev/api/settlements',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Headers:', res.headers);
    
    try {
      const settlements = JSON.parse(data);
      console.log('\nSettlements Response:');
      console.log(JSON.stringify(settlements, null, 2));
      
      if (Array.isArray(settlements) && settlements.length > 0) {
        const firstSettlement = settlements[0];
        console.log('\nFirst settlement analysis:');
        console.log('- from:', firstSettlement.from);
        console.log('- fromName:', firstSettlement.fromName);
        console.log('- to:', firstSettlement.to);
        console.log('- toName:', firstSettlement.toName);
        console.log('- group:', firstSettlement.group);
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();

console.log('Testing settlements API...');
console.log('Note: You need to replace JWT_TOKEN with a valid token from your app');
