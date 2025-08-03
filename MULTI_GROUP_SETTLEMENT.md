# Multi-Group Settlement Feature

## Overview

The Multi-Group Settlement feature enables users to settle aggregated balances from the Dashboard that span across multiple groups. This implements **Option 2: Automatic Settlement Distribution** which provides the best user experience while maintaining data integrity.

## Problem Solved

Previously, users could only settle debts within individual group pages. When the Dashboard showed aggregated balances (e.g., "Charlotte owes you $100 total" combining debts from Group A and Group B), there was no way to settle this aggregated amount directly.

## Solution Implementation

### Frontend Components

#### 1. MultiGroupSettlementModal (`frontend/src/components/MultiGroupSettlementModal.js`)
- Specialized modal for handling settlements that span multiple groups
- Shows breakdown of how the settlement will be distributed across groups
- Fetches group breakdown data to display proportional distribution
- Provides clear UI indicating this is a multi-group settlement

#### 2. Dashboard Integration (`frontend/src/pages/Dashboard.js`)
- Added "Settle" buttons to each balance item in the Dashboard
- Integrated MultiGroupSettlementModal for cross-group settlements
- Maintains existing single-group settlement functionality

### Backend Implementation

#### 1. Group Breakdown Endpoint (`/api/balances/breakdown/:userId`)
- **Route**: `GET /api/balances/breakdown/:userId`
- **Purpose**: Provides detailed breakdown of balances between current user and target user across all shared groups
- **Response**: Array of groups with their respective balance amounts and currencies

#### 2. Multi-Group Settlement Endpoint (`/api/settlements/multi-group`)
- **Route**: `POST /api/settlements/multi-group`
- **Purpose**: Creates multiple individual settlements proportionally distributed across groups
- **Logic**: 
  1. Identifies all groups where both users are members
  2. Calculates current outstanding balances in each group
  3. Distributes the settlement amount proportionally based on outstanding balances
  4. Creates individual settlement records for each group
  5. Maintains group-specific settlement integrity

#### 3. Settlement Model Updates (`src/models/Settlement.js`)
- Added `isMultiGroupSettlement` flag to track settlements created via multi-group process
- Maintains backward compatibility with existing settlement records

### Key Features

#### Proportional Distribution Algorithm
```javascript
// Calculate total outstanding amount across all groups
const totalOutstanding = relevantGroups.reduce((sum, item) => sum + Math.abs(item.balance.amount), 0);

// Distribute settlement amount proportionally
for (const { group, balance } of relevantGroups) {
  const groupProportion = Math.abs(balance.amount) / totalOutstanding;
  const groupSettlementAmount = parseFloat(amount) * groupProportion;
  
  // Create individual settlement for this group
  // ...
}
```

#### Data Integrity
- Each settlement is tied to a specific group (maintains existing database structure)
- Settlement direction is determined by balance type (who owes whom)
- Amounts are rounded to 2 decimal places to prevent floating-point errors
- Only creates settlements for significant amounts (> 0.01)

#### User Experience
- Clear indication that settlement spans multiple groups
- Visual breakdown showing which groups will be affected
- Automatic calculation of proportional distribution
- Success feedback with refresh of dashboard data

### API Endpoints

#### Get Group Breakdown
```
GET /api/balances/breakdown/:userId
Authorization: Bearer <token>

Response:
{
  "groups": [
    {
      "groupId": "group-123",
      "groupName": "Trip to Japan",
      "currencies": [
        {
          "currency": "TWD",
          "amount": 1500.00,
          "type": "you_owe"
        }
      ]
    }
  ]
}
```

#### Create Multi-Group Settlement
```
POST /api/settlements/multi-group
Authorization: Bearer <token>
Content-Type: application/json

{
  "toUserId": "user-456",
  "amount": 2000.00,
  "method": "bank_transfer",
  "notes": "Multi-group settlement with John",
  "currencies": [
    {
      "currency": "TWD",
      "amount": 2000.00,
      "type": "you_owe"
    }
  ]
}

Response:
{
  "message": "Multi-group settlement recorded successfully across 2 groups",
  "settlements": [
    {
      "settlement": { /* settlement object */ },
      "groupName": "Trip to Japan",
      "proportion": 0.75
    },
    {
      "settlement": { /* settlement object */ },
      "groupName": "Dinner Group",
      "proportion": 0.25
    }
  ],
  "totalAmount": 2000.00
}
```

### CSS Styling

Added comprehensive styling for the multi-group settlement interface:
- `.multi-group-settlement` - Modal container styling
- `.multi-group-notice` - Information banner about multi-group distribution
- `.group-breakdown` - Breakdown display container
- `.settle-btn` - Settlement button styling for dashboard items
- Responsive design for various screen sizes

### Benefits

1. **User Convenience**: Settle all debts with a person from one place
2. **Data Integrity**: Maintains group-specific settlement records
3. **Transparency**: Clear breakdown of how settlements are distributed
4. **Flexibility**: Works with multiple currencies and complex debt structures
5. **Backward Compatibility**: Doesn't affect existing settlement functionality

### Usage Flow

1. User views Dashboard with aggregated balances
2. Clicks "Settle" button on a balance item
3. MultiGroupSettlementModal opens showing:
   - Total amount to be settled
   - Breakdown of groups affected
   - Proportional distribution preview
4. User confirms settlement details
5. System creates individual settlements for each group
6. Dashboard refreshes with updated balances
7. Success message confirms settlement completion

### Technical Considerations

- **Error Handling**: Comprehensive error handling for edge cases
- **Validation**: Amount and user validation before settlement creation
- **Permissions**: Ensures user is member of all affected groups
- **Rounding**: Proper decimal handling to prevent calculation errors
- **Logging**: Detailed logging for debugging and audit trails

This feature significantly enhances the user experience by allowing settlement of aggregated balances while maintaining the integrity of the group-based settlement system.
