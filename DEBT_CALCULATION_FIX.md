# Debt Calculation Fix - Dashboard Debt Aggregation

## Problem Description
The dashboard was not properly aggregating debts from different groups. Instead of showing:
- **Expected**: You should get back 3313.38 from Emily, and Charlotte owes Jean 0.6
- **Incorrect**: Charlotte owes you 3313.98 (incorrectly consolidated)

## Root Cause Analysis
The issue was in the **optimized balance calculation algorithm**:

1. **Incomplete Settlement Handling**: The `calculateNetBalances` function had inconsistent logic for fetching settlements between group-specific and global calculations
2. **Duplicate Code**: There was duplicate code in the function that caused confusion and potential bugs
3. **Incorrect Aggregation**: The algorithm wasn't properly aggregating debts across multiple groups while maintaining accuracy

## Solution Implemented

### 1. **Fixed calculateNetBalances Function**
- **Proper Settlement Fetching**: For global calculations, use `Settlement.findByUserId(userId)` to get all settlements involving the user
- **Group-Specific Settlements**: For group calculations, use `Settlement.findByGroupId(groupId)` to get only settlements within that group
- **Removed Duplicate Code**: Cleaned up the function to eliminate confusion

### 2. **Restored Optimization by Default**
- Dashboard now uses **optimized calculation by default** (`useOptimized = true`)
- This ensures proper debt aggregation across multiple groups
- Removed the warning message since optimization now works correctly

### 3. **Updated User Interface**
- Button tooltip now explains: "Using optimized transfers (aggregates debts across groups for fewer transactions)"
- Removed confusing warning messages about optimization issues

## Code Changes

### Backend (`src/services/optimizedBalanceService.js`)
```javascript
/**
 * Calculate net balance for each user (what they're owed minus what they owe)
 */
const calculateNetBalances = async (userId, groupId = null) => {
  // Get expenses based on scope
  let expenses;
  if (groupId) {
    // For group-specific calculations, get all expenses in the group
    expenses = await Expense.findByGroupId(groupId);
  } else {
    // For global calculations, get all expenses involving the current user
    expenses = await Expense.findByUserId(userId);
  }

  // ... expense processing logic ...

  // Apply settlements to adjust net balances
  let settlements;
  if (groupId) {
    settlements = await Settlement.findByGroupId(groupId);
  } else {
    // For global view, get all settlements involving the current user
    settlements = await Settlement.findByUserId(userId);
  }

  // ... settlement processing logic ...
};
```

### Frontend (`frontend/src/pages/Dashboard.js`)
```javascript
// Default to optimized for proper debt aggregation
const [useOptimized, setUseOptimized] = useState(true);

// Updated tooltip
title={useOptimized ? 'Using optimized transfers (aggregates debts across groups for fewer transactions)' : 'Using direct transfers (shows individual debt per expense)'}
```

## How It Works Now

1. **Global Debt Aggregation**: Dashboard properly aggregates all debts across different groups
2. **Optimized Transfers**: Uses debt optimization algorithm to minimize the number of transactions needed
3. **Accurate Calculations**: Maintains accuracy while providing the benefit of fewer transfers
4. **Group-Specific Views**: Group details still show group-specific balances correctly

## Benefits

1. **Proper Debt Aggregation**: Dashboard now correctly shows consolidated debts across all groups
2. **Fewer Transactions**: Optimization reduces the number of transfers needed to settle all debts
3. **Maintained Accuracy**: All calculations remain mathematically correct
4. **Better User Experience**: Users see the most efficient way to settle their debts

## Example
Instead of showing multiple individual debts:
- You owe Charlotte $100 (from Group A)
- You owe Charlotte $50 (from Group B)
- Charlotte owes you $30 (from Group C)

The dashboard now shows the optimized result:
- You owe Charlotte $120 (net result: $100 + $50 - $30)

This provides a clearer picture of actual debts while minimizing the number of transactions needed.

---

**Status**: ✅ Deployed and Live
**Deployment Date**: August 3, 2025
**URLs**: 
- API: https://xro5pxx6oi.execute-api.us-west-2.amazonaws.com/dev
- Frontend: https://dwt4ijd80bt6i.cloudfront.net

The dashboard should now properly aggregate debts from different groups and show the correct optimized debt relationships.
