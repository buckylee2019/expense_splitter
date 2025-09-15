require('dotenv').config();
const User = require('./src/models/User');

const users = [
  { name: '阿凱', email: 'akai@example.com' },
  { name: 'Maggie', email: 'maggie@example.com' },
  { name: 'Ryan', email: 'ryan@example.com' },
  { name: 'Brandon', email: 'brandon@example.com' },
  { name: 'KiKi', email: 'kiki@example.com' },
  { name: 'Summer', email: 'summer@example.com' },
  { name: 'Josie', email: 'josie@example.com' },
  { name: 'Cindy', email: 'cindy@example.com' },
  { name: 'Mick', email: 'mick@example.com' },
  { name: 'Owen', email: 'owen@example.com' },
  { name: 'Lewis', email: 'lewis@example.com' }
];

async function createUsers() {
  console.log('Creating users in DynamoDB...');
  console.log('Table name:', process.env.USERS_TABLE_NAME);
  
  for (const userData of users) {
    try {
      const user = await User.create({
        ...userData,
        password: 'password123' // Default password
      });
      console.log(`✅ Created user: ${user.name} (${user.email}) - ID: ${user.id}`);
    } catch (error) {
      console.error(`❌ Failed to create user ${userData.name}:`, error.message);
    }
  }
  
  console.log('\n🎉 User creation completed!');
}

createUsers();
