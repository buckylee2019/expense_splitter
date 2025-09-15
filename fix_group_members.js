require('dotenv').config();
const { docClient } = require('./src/config/dynamodb');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const groupId = '827ee490-1c6b-4e04-9f06-35db0d533ea2';

async function fixGroupMembers() {
  try {
    console.log('Fixing group member structure...');
    
    // Convert all string members to proper member objects
    const params = {
      TableName: 'ExpenseSplitter-Groups-dev',
      Key: { id: groupId },
      UpdateExpression: `
        SET members[1] = :member1,
            members[2] = :member2,
            members[3] = :member3,
            members[4] = :member4,
            members[5] = :member5,
            members[6] = :member6,
            members[7] = :member7,
            members[8] = :member8,
            members[9] = :member9,
            members[10] = :member10,
            members[11] = :member11,
            updatedAt = :updatedAt
      `,
      ExpressionAttributeValues: {
        ':member1': { user: 'cd788e61-48f7-44a7-9b24-a55e48252914', joinedAt: new Date().toISOString(), role: 'member' },
        ':member2': { user: '277310d9-a049-4503-b40f-a4254069f1dd', joinedAt: new Date().toISOString(), role: 'member' },
        ':member3': { user: '7604baba-13c1-4162-a434-d1ec8e1a5e61', joinedAt: new Date().toISOString(), role: 'member' },
        ':member4': { user: '991a85d1-deaf-4139-b758-ecee43dd4fb3', joinedAt: new Date().toISOString(), role: 'member' },
        ':member5': { user: 'b05c33b0-1281-4496-a9f3-e2d1acbbb26c', joinedAt: new Date().toISOString(), role: 'member' },
        ':member6': { user: '9d57e516-9fbb-431b-9ca4-e49c03d8ef69', joinedAt: new Date().toISOString(), role: 'member' },
        ':member7': { user: '358768a4-3b7f-4772-ab4f-0654903ae36d', joinedAt: new Date().toISOString(), role: 'member' },
        ':member8': { user: '1bf78c99-8c4a-42d4-82ec-67ff0009deb0', joinedAt: new Date().toISOString(), role: 'member' },
        ':member9': { user: '1480e090-cc74-4c3c-a190-de108373d2f5', joinedAt: new Date().toISOString(), role: 'member' },
        ':member10': { user: 'c32a9608-d01d-4412-989f-3dff22662d43', joinedAt: new Date().toISOString(), role: 'member' },
        ':member11': { user: '6b67d72d-eb22-4003-9c4c-78776aeec5c2', joinedAt: new Date().toISOString(), role: 'member' },
        ':updatedAt': new Date().toISOString()
      }
    };

    await docClient.send(new UpdateCommand(params));
    console.log('✅ Fixed group member structure successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing group members:', error.message);
  }
}

fixGroupMembers();
