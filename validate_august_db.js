const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-west-2" });

const users = {
  "e37a8e21-75b4-4460-8c9f-a7ec79b1ac68": "Bucky Lee",
  "ecbf2c5d-c573-47e1-8a4c-2d2959fda386": "Jean", 
  "1092cf2f-d948-403a-896e-4012ad1a9ee0": "Emily",
  "d331c950-1e1f-4525-a726-1b2ed68472bb": "Charlotte"
};

async function validateAugustExpenses() {
  try {
    const command = new ScanCommand({
      TableName: "ExpenseSplitter-Expenses-dev",
      FilterExpression: "#grp = :groupId AND begins_with(#dt, :month)",
      ExpressionAttributeNames: {
        "#dt": "date",
        "#grp": "group"
      },
      ExpressionAttributeValues: {
        ":groupId": { S: "dc0ed97e-5f01-45a2-a15e-aba179bc218f" },
        ":month": { S: "2025-08" }
      }
    });

    const result = await client.send(command);
    const balances = {};
    
    // Initialize balances
    Object.keys(users).forEach(id => balances[id] = 0);
    
    result.Items.forEach(item => {
      const paidBy = item.paidBy.S;
      const amount = parseFloat(item.amount.N);
      
      // Add what they paid
      balances[paidBy] += amount;
      
      // Subtract what they owe
      item.splits.L.forEach(split => {
        const userId = split.M.userId.S;
        const splitAmount = parseFloat(split.M.amount.N);
        balances[userId] -= splitAmount;
      });
      
      // Validate splits
      const splitSum = item.splits.L.reduce((sum, split) => sum + parseFloat(split.M.amount.N), 0);
      if (Math.abs(splitSum - amount) > 0.01) {
        console.log(`ERROR: ${item.description.S} - Amount ${amount} vs splits ${splitSum}`);
      }
    });
    
    console.log("August 2025 Balances (from DynamoDB):");
    Object.entries(balances).forEach(([id, balance]) => {
      console.log(`${users[id]}: ${balance > 0 ? '+' : ''}${balance.toFixed(2)} TWD`);
    });
    
    const total = Object.values(balances).reduce((sum, bal) => sum + bal, 0);
    console.log(`\nTotal balance: ${total.toFixed(2)} (should be 0)`);
    console.log(`Expenses found: ${result.Items.length}`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

validateAugustExpenses();
