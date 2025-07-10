const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.GROUPS_TABLE_NAME || 'ExpenseSplitter-Groups';

class Group {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description;
    this.photo = data.photo || null; // Legacy field for backward compatibility
    this.photoUrl = data.photoUrl || null; // New field for S3 URLs
    this.members = data.members || [];
    this.createdBy = data.createdBy;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(groupData) {
    const group = new Group(groupData);
    
    const params = {
      TableName: TABLE_NAME,
      Item: group
    };

    await docClient.send(new PutCommand(params));
    return group;
  }

  static async findById(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    try {
      const result = await docClient.send(new GetCommand(params));
      if (result.Item) {
        return new Group(result.Item);
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(userId) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true
      }
    };

    try {
      const result = await docClient.send(new ScanCommand(params));
      const groups = result.Items ? result.Items.map(item => new Group(item)) : [];
      
      // Filter groups where user is a member
      return groups.filter(group => 
        group.members.some(member => 
          typeof member === 'object' ? member.user === userId : member === userId
        )
      );
    } catch (error) {
      throw error;
    }
  }

  static async findByUserIdAndGroupId(userId, groupId) {
    const group = await Group.findById(groupId);
    if (!group) return null;

    const isMember = group.members.some(member => 
      typeof member === 'object' ? member.user === userId : member === userId
    );

    return isMember ? group : null;
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    
    const params = {
      TableName: TABLE_NAME,
      Item: this
    };

    await docClient.send(new PutCommand(params));
    return this;
  }

  addMember(userId, role = 'member') {
    const existingMember = this.members.find(member => 
      typeof member === 'object' ? member.user === userId : member === userId
    );

    if (!existingMember) {
      this.members.push({
        user: userId,
        role: role,
        joinedAt: new Date().toISOString()
      });
    }
  }

  removeMember(userId) {
    this.members = this.members.filter(member => 
      typeof member === 'object' ? member.user !== userId : member !== userId
    );
  }

  isAdmin(userId) {
    const member = this.members.find(member => 
      typeof member === 'object' ? member.user === userId : member === userId
    );
    return member && member.role === 'admin';
  }

  static async addMember(groupId, memberData) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: groupId },
      UpdateExpression: 'SET members = list_append(if_not_exists(members, :empty_list), :new_member), updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':new_member': [memberData],
        ':empty_list': [],
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await docClient.send(new UpdateCommand(params));
      return new Group(result.Attributes);
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    await docClient.send(new DeleteCommand(params));
  }
}

module.exports = Group;
