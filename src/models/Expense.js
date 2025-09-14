const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.EXPENSES_TABLE_NAME || 'ExpenseSplitter-Expenses';

class Expense {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.description = data.description;
    this.amount = data.amount;
    this.currency = data.currency || 'TWD';
    this.category = data.category;
    this.paidBy = data.paidBy;
    this.isMultiplePayers = data.isMultiplePayers || false;
    this.group = data.group;
    this.splits = data.splits || [];
    this.splitType = data.splitType;
    this.date = data.date || new Date().toISOString();
    this.notes = data.notes;
    this.project = data.project; // New field for MOZE compatibility
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
    // DynamoDB doesn't support complex filtering on nested arrays easily
    // So we'll scan all expenses and filter in application code
    const params = {
      TableName: TABLE_NAME
    };

    try {
      const result = await docClient.send(new ScanCommand(params));
      const allExpenses = result.Items ? result.Items.map(item => new Expense(item)) : [];
      
      // Filter expenses where user is either the payer or in the splits
      // Handle both 'user' and 'userId' fields in splits for backward compatibility
      return allExpenses.filter(expense => {
        const isPayer = expense.paidBy === userId;
        const isInSplits = expense.splits.some(split => 
          split.user === userId || split.userId === userId
        );
        return isPayer || isInSplits;
      });
    } catch (error) {
      throw error;
    }
  }

  static async findByUserIdAndExpenseId(userId, expenseId) {
    const expense = await Expense.findById(expenseId);
    if (!expense) return null;

    // Check if user is related to this expense (either as payer or in splits)
    // Handle both 'user' and 'userId' fields for backward compatibility
    const isRelated = expense.paidBy === userId || 
                     expense.splits.some(split => 
                       split.user === userId || split.userId === userId
                     );

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

  static async update(id, updateData) {
    const params = {
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET',
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
      ReturnValues: 'ALL_NEW'
    };

    const updates = [];
    Object.keys(updateData).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      params.ExpressionAttributeNames[attrName] = key;
      params.ExpressionAttributeValues[attrValue] = updateData[key];
      updates.push(`${attrName} = ${attrValue}`);
    });

    params.UpdateExpression += ' ' + updates.join(', ');

    try {
      const result = await docClient.send(new UpdateCommand(params));
      return new Expense(result.Attributes);
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

  static async findByGroupIdWithFilters(options) {
    const {
      groupId,
      startDate,
      endDate,
      search,
      category,
      minAmount,
      maxAmount,
      sort = 'date',
      order = 'desc',
      limit = 20,
      offset = 0
    } = options;

    try {
      // Build filter expression
      let filterExpression = '';
      const expressionAttributeNames = { '#group': 'group' };
      const expressionAttributeValues = { ':groupId': groupId };
      const filterConditions = [];

      // Date range filter
      if (startDate) {
        filterConditions.push('#date >= :startDate');
        expressionAttributeNames['#date'] = 'date';
        expressionAttributeValues[':startDate'] = startDate;
      }
      if (endDate) {
        filterConditions.push('#date <= :endDate');
        expressionAttributeNames['#date'] = 'date';
        expressionAttributeValues[':endDate'] = endDate;
      }

      // Search in description
      if (search) {
        filterConditions.push('contains(#description, :search)');
        expressionAttributeNames['#description'] = 'description';
        expressionAttributeValues[':search'] = search;
      }

      // Category filter
      if (category) {
        filterConditions.push('#category = :category');
        expressionAttributeNames['#category'] = 'category';
        expressionAttributeValues[':category'] = category;
      }

      // Amount range filters
      if (minAmount !== undefined) {
        filterConditions.push('#amount >= :minAmount');
        expressionAttributeNames['#amount'] = 'amount';
        expressionAttributeValues[':minAmount'] = minAmount;
      }
      if (maxAmount !== undefined) {
        filterConditions.push('#amount <= :maxAmount');
        expressionAttributeNames['#amount'] = 'amount';
        expressionAttributeValues[':maxAmount'] = maxAmount;
      }

      if (filterConditions.length > 0) {
        filterExpression = filterConditions.join(' AND ');
      }

      // Try GSI query first
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'GroupIndex',
        KeyConditionExpression: '#group = :groupId',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ScanIndexForward: order === 'asc'
      };

      if (filterExpression) {
        params.FilterExpression = filterExpression;
      }

      const result = await docClient.send(new QueryCommand(params));
      let items = result.Items || [];

      // Sort by the specified field (DynamoDB GSI might not support all sort fields)
      if (sort !== 'date') {
        items.sort((a, b) => {
          const aVal = a[sort];
          const bVal = b[sort];
          if (order === 'desc') {
            return bVal > aVal ? 1 : -1;
          }
          return aVal > bVal ? 1 : -1;
        });
      }

      // Apply pagination
      const totalCount = items.length;
      const paginatedItems = items.slice(offset, offset + limit);

      return {
        expenses: paginatedItems.map(item => new Expense(item)),
        totalCount
      };

    } catch (error) {
      console.error('GSI query failed, falling back to scan:', error);
      
      // Fallback to scan
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: '#group = :groupId',
        ExpressionAttributeNames: { '#group': 'group' },
        ExpressionAttributeValues: { ':groupId': groupId }
      };

      const result = await docClient.send(new ScanCommand(params));
      let items = result.Items || [];

      // Apply filters manually
      if (startDate) {
        items = items.filter(item => item.date >= startDate);
      }
      if (endDate) {
        items = items.filter(item => item.date <= endDate);
      }
      if (search) {
        items = items.filter(item => 
          item.description && item.description.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (category) {
        items = items.filter(item => item.category === category);
      }
      if (minAmount !== undefined) {
        items = items.filter(item => item.amount >= minAmount);
      }
      if (maxAmount !== undefined) {
        items = items.filter(item => item.amount <= maxAmount);
      }

      // Sort
      items.sort((a, b) => {
        const aVal = a[sort];
        const bVal = b[sort];
        if (order === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });

      // Apply pagination
      const totalCount = items.length;
      const paginatedItems = items.slice(offset, offset + limit);

      return {
        expenses: paginatedItems.map(item => new Expense(item)),
        totalCount
      };
    }
  }

  static async findByUserIdWithPagination(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      sort = 'date',
      order = 'desc'
    } = options;

    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'contains(splits, :userId) OR paidBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const result = await docClient.send(new ScanCommand(params));
    let items = result.Items || [];

    // Sort
    items.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (order === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Apply pagination
    const totalCount = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      expenses: paginatedItems.map(item => new Expense(item)),
      totalCount
    };
  }
}

module.exports = Expense;
