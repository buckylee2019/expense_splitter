const { docClient } = require('../config/dynamodb');
const { PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.USERS_TABLE_NAME || 'ExpenseSplitter-Users';

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.friends = data.friends || [];
    this.groups = data.groups || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async create(userData) {
    console.log('Creating user with data:', { ...userData, password: '[REDACTED]' });
    console.log('Using table:', TABLE_NAME);
    
    const user = new User(userData);
    
    // Hash password
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 8);
    }

    const params = {
      TableName: TABLE_NAME,
      Item: user,
      ConditionExpression: 'attribute_not_exists(email)'
    };

    try {
      console.log('Sending PutCommand to DynamoDB:', { 
        TableName: params.TableName,
        ConditionExpression: params.ConditionExpression
      });
      await docClient.send(new PutCommand(params));
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    console.log('Finding user by email:', email);
    console.log('Using table:', TABLE_NAME);
    
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    };

    try {
      console.log('Sending QueryCommand to DynamoDB:', {
        TableName: params.TableName,
        IndexName: params.IndexName,
        KeyConditionExpression: params.KeyConditionExpression
      });
      const result = await docClient.send(new QueryCommand(params));
      console.log('Query result:', { 
        found: result.Items && result.Items.length > 0,
        count: result.Items ? result.Items.length : 0
      });
      if (result.Items && result.Items.length > 0) {
        return new User(result.Items[0]);
      }
      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    console.log('Finding user by ID:', id);
    console.log('Using table:', TABLE_NAME);
    
    const params = {
      TableName: TABLE_NAME,
      Key: { id }
    };

    try {
      console.log('Sending GetCommand to DynamoDB:', {
        TableName: params.TableName,
        Key: params.Key
      });
      const result = await docClient.send(new GetCommand(params));
      console.log('Get result:', { found: !!result.Item });
      if (result.Item) {
        return new User(result.Item);
      }
      return null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    
    const params = {
      TableName: TABLE_NAME,
      Item: this
    };

    try {
      console.log('Saving user:', { id: this.id, email: this.email });
      await docClient.send(new PutCommand(params));
      return this;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  toJSON() {
    const user = { ...this };
    delete user.password;
    return user;
  }

  static async searchByEmail(emailQuery, excludeId) {
    console.log('Searching users by email:', { emailQuery, excludeId });
    console.log('Using table:', TABLE_NAME);
    
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'contains(email, :email) AND id <> :excludeId',
      ExpressionAttributeValues: {
        ':email': emailQuery,
        ':excludeId': excludeId
      },
      ProjectionExpression: 'id, #name, email',
      ExpressionAttributeNames: {
        '#name': 'name'
      }
    };

    try {
      console.log('Sending QueryCommand to DynamoDB:', {
        TableName: params.TableName,
        FilterExpression: params.FilterExpression
      });
      const result = await docClient.send(new QueryCommand(params));
      console.log('Search result:', { count: result.Items ? result.Items.length : 0 });
      return result.Items || [];
    } catch (error) {
      console.error('Error searching users by email:', error);
      throw error;
    }
  }
}

module.exports = User;
