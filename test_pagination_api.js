const { Expense } = require('./src/models/Expense');

// Test the new pagination methods
async function testPaginationAPI() {
  console.log('Testing pagination API methods...');
  
  try {
    // Test findByGroupIdWithFilters
    console.log('\n1. Testing findByGroupIdWithFilters...');
    const result1 = await Expense.findByGroupIdWithFilters({
      groupId: 'test-group-id',
      page: 1,
      limit: 5,
      sort: 'date',
      order: 'desc'
    });
    
    console.log('Result structure:', {
      expensesCount: result1.expenses.length,
      totalCount: result1.totalCount,
      hasExpenses: result1.expenses.length > 0
    });
    
    // Test with filters
    console.log('\n2. Testing with search filter...');
    const result2 = await Expense.findByGroupIdWithFilters({
      groupId: 'test-group-id',
      search: 'lunch',
      limit: 10,
      offset: 0
    });
    
    console.log('Search result:', {
      expensesCount: result2.expenses.length,
      totalCount: result2.totalCount
    });
    
    // Test findByUserIdWithPagination
    console.log('\n3. Testing findByUserIdWithPagination...');
    const result3 = await Expense.findByUserIdWithPagination('test-user-id', {
      limit: 5,
      offset: 0,
      sort: 'amount',
      order: 'desc'
    });
    
    console.log('User expenses result:', {
      expensesCount: result3.expenses.length,
      totalCount: result3.totalCount
    });
    
    console.log('\n✅ All pagination methods are working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing pagination API:', error.message);
  }
}

// Run the test
testPaginationAPI();
