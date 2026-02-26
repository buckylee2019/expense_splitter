const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.SETTLEMENTS_TABLE_NAME || 'ExpenseSplitter-Settlements';

class Settlement {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.from = data.from;
    this.to = data.to;
    this.amount = data.amount;
    this.currency = data.currency || 'TWD';
    this.group = data.group;
    this.method = data.method || 'cash';
    this.notes = data.notes;
    this.settledAt = data.settledAt || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.recordedBy = data.recordedBy; // Track who recorded the settlement
    this.isMultiGroupSettlement = data.isMultiGroupSettlement || false; // Flag for multi-group settlements
  }

  static async create(settlementData) {
    const settlement = new Settlement(settlementData);
    
    const params = {
      TableName: TABLE_NAME,
      Item: settlement
    };

    await docClient.send(new PutCommand(params));
    return settlement;
  }

  static async findById(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    try {
      const result = await docClient.send(new GetCommand(params));
      if (result.Item) {
        return new Settlement(result.Item);
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(userId) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: '#from = :userId OR #to = :userId OR #recordedBy = :userId',
      ExpressionAttributeNames: {
        '#from': 'from',
        '#to': 'to',
        '#recordedBy': 'recordedBy'
      },
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    try {
      console.log(`Finding settlements for user: ${userId}`);
      const result = await docClient.send(new ScanCommand(params));
      console.log(`Found ${result.Items ? result.Items.length : 0} settlements`);
      
      // Add user-friendly names for display
      const settlements = result.Items ? await Promise.all(result.Items.map(async item => {
        const settlement = new Settlement(item);
        
        // Get user names for from and to fields
        const User = require('./User');
        try {
          if (settlement.from) {
            const fromUser = await User.findById(settlement.from);
            settlement.fromName = fromUser?.name || fromUser?.email || settlement.from;
          }
          
          if (settlement.to) {
            const toUser = await User.findById(settlement.to);
            settlement.toName = toUser?.name || toUser?.email || settlement.to;
          }
        } catch (err) {
          console.error('Error fetching user details for settlement:', err);
          settlement.fromName = settlement.from;
          settlement.toName = settlement.to;
        }
        
        return settlement;
      })) : [];
      
      return settlements;
    } catch (error) {
      console.error('Error finding settlements by user ID:', error);
      throw error;
    }
  }

  static async findByGroupId(groupId) {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GroupIndex',
      KeyConditionExpression: '#group = :groupId',
      ExpressionAttributeNames: {
        '#group': 'group'
      },
      ExpressionAttributeValues: {
        ':groupId': groupId
      }
    };

    try {
      const result = await docClient.send(new QueryCommand(params));
      
      // Add user names
      const settlements = result.Items ? await Promise.all(result.Items.map(async item => {
        const settlement = new Settlement(item);
        
        const User = require('./User');
        try {
          if (settlement.from) {
            const fromUser = await User.findById(settlement.from);
            settlement.fromName = fromUser?.name || fromUser?.email || settlement.from;
          }
          
          if (settlement.to) {
            const toUser = await User.findById(settlement.to);
            settlement.toName = toUser?.name || toUser?.email || settlement.to;
          }
        } catch (err) {
          console.error('Error fetching user details for settlement:', err);
          settlement.fromName = settlement.from;
          settlement.toName = settlement.to;
        }
        
        return settlement;
      })) : [];
      
      return settlements;
    } catch (error) {
      throw error;
    }
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

  async update() {
    return this.save();
  }

  async delete() {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: this.id }
    };

    await docClient.send(new DeleteCommand(params));
    return true;
  }

  static async deleteById(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    await docClient.send(new DeleteCommand(params));
    return true;
  }
}

module.exports = Settlement;
