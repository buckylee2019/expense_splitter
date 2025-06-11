const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.EXPENSES_TABLE_NAME || 'ExpenseSplitter-Expenses';

class Expense {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.description = data.description;
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.category = data.category;
    this.paidBy = data.paidBy;
    this.group = data.group;
    this.splits = data.splits || [];
    this.splitType = data.splitType;
    this.date = data.date || new Date().toISOString();
    this.notes = data.notes;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(expenseData) {
    const expense = new Expense(expenseData);
    
    const params = {
      TableName: TABLE_NAME,
      Item: expense
    };

    await docClient.send(new PutCommand(params));
    return expense;
  }

  static async findById(id) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    try {
      const result = await docClient.send(new GetCommand(params));
      if (result.Item) {
        return new Expense(result.Item);
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(userId) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'paidBy = :userId OR contains(splits, :userId)',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    try {
      const result = await docClient.send(new ScanCommand(params));
      return result.Items ? result.Items.map(item => new Expense(item)) : [];
    } catch (error) {
      throw error;
    }
  }

  static async findByUserIdAndExpenseId(userId, expenseId) {
    const expense = await Expense.findById(expenseId);
    if (!expense) return null;

    const isRelated = expense.paidBy === userId || 
                     expense.splits.some(split => split.user === userId);

    return isRelated ? expense : null;
  }

  static async findByGroupId(groupId) {
    // First try using the GSI
    try {
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

      const result = await docClient.send(new QueryCommand(params));
      return result.Items ? result.Items.map(item => new Expense(item)) : [];
    } catch (error) {
      console.error('GSI query failed, falling back to scan:', error);
      
      // Fallback to scan if GSI fails
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: '#group = :groupId',
        ExpressionAttributeNames: {
          '#group': 'group'
        },
        ExpressionAttributeValues: {
          ':groupId': groupId
        }
      };

      const result = await docClient.send(new ScanCommand(params));
      return result.Items ? result.Items.map(item => new Expense(item)) : [];
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

  static async updateSettlementStatus(expenseIds, userId, settled = true) {
    // In DynamoDB, we need to update each expense individually
    const updatePromises = expenseIds.map(async (expenseId) => {
      const expense = await Expense.findById(expenseId);
      if (expense) {
        const splitIndex = expense.splits.findIndex(split => split.user === userId);
        if (splitIndex !== -1) {
          expense.splits[splitIndex].settled = settled;
          await expense.save();
        }
      }
    });

    await Promise.all(updatePromises);
  }
}

module.exports = Expense;
