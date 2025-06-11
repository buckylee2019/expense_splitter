const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { client } = require('../src/config/dynamodb');

const createTables = async () => {
  const tables = [
    {
      TableName: 'ExpenseSplitter-Users',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'EmailIndex',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
          BillingMode: 'PAY_PER_REQUEST'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ExpenseSplitter-Groups',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ExpenseSplitter-Expenses',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'group', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GroupIndex',
          KeySchema: [
            { AttributeName: 'group', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
          BillingMode: 'PAY_PER_REQUEST'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    },
    {
      TableName: 'ExpenseSplitter-Settlements',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'group', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GroupIndex',
          KeySchema: [
            { AttributeName: 'group', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
          BillingMode: 'PAY_PER_REQUEST'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
  ];

  for (const tableParams of tables) {
    try {
      console.log(`Creating table: ${tableParams.TableName}`);
      await client.send(new CreateTableCommand(tableParams));
      console.log(`✅ Table ${tableParams.TableName} created successfully`);
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log(`⚠️  Table ${tableParams.TableName} already exists`);
      } else {
        console.error(`❌ Error creating table ${tableParams.TableName}:`, error.message);
      }
    }
  }
};

createTables().then(() => {
  console.log('Table creation process completed');
  process.exit(0);
}).catch(error => {
  console.error('Error in table creation process:', error);
  process.exit(1);
});
