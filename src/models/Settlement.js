const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.SETTLEMENTS_TABLE_NAME || 'ExpenseSplitter-Settlements';

class Settlement {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.from = data.from;
    this.to = data.to;
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.group = data.group;
    this.expenses = data.expenses || [];
    this.method = data.method || 'cash';
    this.notes = data.notes;
    this.settledAt = data.settledAt || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
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
      FilterExpression: '#from = :userId OR #to = :userId',
      ExpressionAttributeNames: {
        '#from': 'from',
        '#to': 'to'
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
      const settlements = result.Items ? result.Items.map(item => {
        const settlement = new Settlement(item);
        // Add any additional processing here if needed
        return settlement;
      }) : [];
      
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
      return result.Items ? result.Items.map(item => new Settlement(item)) : [];
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
}

module.exports = Settlement;
