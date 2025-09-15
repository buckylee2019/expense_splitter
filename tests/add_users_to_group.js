require('dotenv').config();
const Group = require('./src/models/Group');

const groupId = '827ee490-1c6b-4e04-9f06-35db0d533ea2';
const userIds = [
  'cd788e61-48f7-44a7-9b24-a55e48252914', // 阿凱
  '277310d9-a049-4503-b40f-a4254069f1dd', // Maggie
  '7604baba-13c1-4162-a434-d1ec8e1a5e61', // Ryan
  '991a85d1-deaf-4139-b758-ecee43dd4fb3', // Brandon
  'b05c33b0-1281-4496-a9f3-e2d1acbbb26c', // KiKi
  '9d57e516-9fbb-431b-9ca4-e49c03d8ef69', // Summer
  '358768a4-3b7f-4772-ab4f-0654903ae36d', // Josie
  '1bf78c99-8c4a-42d4-82ec-67ff0009deb0', // Cindy
  '1480e090-cc74-4c3c-a190-de108373d2f5', // Mick
  'c32a9608-d01d-4412-989f-3dff22662d43', // Owen
  '6b67d72d-eb22-4003-9c4c-78776aeec5c2'  // Lewis
];

async function addUsersToGroup() {
  try {
    console.log(`Adding ${userIds.length} users to group ${groupId}...`);
    
    for (const userId of userIds) {
      const memberData = {
        user: userId,
        joinedAt: new Date().toISOString(),
        role: 'member'
      };
      await Group.addMember(groupId, memberData);
      console.log(`✅ Added user ${userId} to group`);
    }
    
    console.log('\n🎉 All users added to group successfully!');
  } catch (error) {
    console.error('❌ Error adding users to group:', error.message);
  }
}

addUsersToGroup();
