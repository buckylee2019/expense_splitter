const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Group = require('../models/Group');
const auth = require('../middleware/auth');

// Get monthly expense report
router.get('/monthly/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id;
    
    // Create date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    console.log(`Fetching monthly report for user ${userId}, ${year}/${month}`);
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get all expenses for the user in the specified month
    const allExpenses = await Expense.findByUserId(userId);
    
    // Filter expenses by date
    const monthlyExpenses = allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
    
    console.log(`Found ${monthlyExpenses.length} expenses for the month`);
    
    // Get user details for each expense
    const expensesWithDetails = await Promise.all(
      monthlyExpenses.map(async (expense) => {
        try {
          // Get group details if expense has a group
          let groupName = '';
          if (expense.group) {
            const group = await Group.findById(expense.group);
            groupName = group ? group.name : '';
          }
          
          // Get payer details
          let payerName = '';
          if (expense.paidBy) {
            const payer = await User.findById(expense.paidBy);
            payerName = payer ? (payer.name || payer.email) : '';
          }
          
          // Find user's split amount
          const userSplit = expense.splits.find(split => 
            (split.user === userId || split.userId === userId)
          );
          const userAmount = userSplit ? userSplit.amount : 0;
          
          return {
            ...expense,
            groupName,
            payerName,
            userAmount,
            isPaidByUser: expense.paidBy === userId
          };
        } catch (error) {
          console.error('Error processing expense:', error);
          return {
            ...expense,
            groupName: '',
            payerName: '',
            userAmount: 0,
            isPaidByUser: false
          };
        }
      })
    );
    
    // Calculate summary statistics
    const summary = {
      totalExpenses: expensesWithDetails.length,
      totalAmount: expensesWithDetails.reduce((sum, exp) => sum + (exp.isPaidByUser ? exp.amount : exp.userAmount), 0),
      totalPaid: expensesWithDetails.filter(exp => exp.isPaidByUser).reduce((sum, exp) => sum + exp.amount, 0),
      totalOwed: expensesWithDetails.filter(exp => !exp.isPaidByUser).reduce((sum, exp) => sum + exp.userAmount, 0),
      byCategory: {},
      byCurrency: {}
    };
    
    // Group by category and currency
    expensesWithDetails.forEach(expense => {
      const category = expense.category || '其他';
      const currency = expense.currency || 'TWD';
      const amount = expense.isPaidByUser ? expense.amount : expense.userAmount;
      
      if (!summary.byCategory[category]) {
        summary.byCategory[category] = 0;
      }
      summary.byCategory[category] += amount;
      
      if (!summary.byCurrency[currency]) {
        summary.byCurrency[currency] = 0;
      }
      summary.byCurrency[currency] += amount;
    });
    
    res.json({
      year: parseInt(year),
      month: parseInt(month),
      expenses: expensesWithDetails,
      summary
    });
    
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// Export monthly expenses as CSV
router.get('/export/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id;
    
    // Get current user details
    const currentUser = await User.findById(userId);
    const userName = currentUser ? (currentUser.name || currentUser.email) : 'User';
    
    // Create date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    // Get all expenses for the user in the specified month
    const allExpenses = await Expense.findByUserId(userId);
    const monthlyExpenses = allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
    
    // Convert to MOZE CSV format
    const csvRows = [];
    
    // Add header row (matching MOZE.csv format)
    csvRows.push('帳戶,幣種,記錄類型,主類別,子類別,金額,手續費,折扣,名稱,商家,日期,時間,專案,描述,標籤,對象');
    
    // Process each expense
    for (const expense of monthlyExpenses) {
      try {
        // Get group details
        let groupName = '';
        if (expense.group) {
          const group = await Group.findById(expense.group);
          groupName = group ? group.name : '';
        }
        
        // Parse category (format: "主類別 - 子類別")
        const categoryParts = expense.category ? expense.category.split(' - ') : ['其他', '其他'];
        const mainCategory = categoryParts[0] || '其他';
        const subCategory = categoryParts[1] || '其他';
        
        // Find user's split amount
        const userSplit = expense.splits.find(split => 
          (split.user === userId || split.userId === userId)
        );
        const userAmount = userSplit ? userSplit.amount : 0;
        const isPaidByUser = expense.paidBy === userId;
        
        // Format date and time
        const expenseDate = new Date(expense.date);
        const dateStr = `${expenseDate.getFullYear()}/${expenseDate.getMonth() + 1}/${expenseDate.getDate()}`;
        const timeStr = `${expenseDate.getHours().toString().padStart(2, '0')}:${expenseDate.getMinutes().toString().padStart(2, '0')}`;
        
        // Create CSV row (matching MOZE format)
        const amount = isPaidByUser ? -expense.amount : -userAmount; // Negative for expenses
        const csvRow = [
          '錢包', // 帳戶 (Account)
          expense.currency || 'TWD', // 幣種 (Currency)
          '支出', // 記錄類型 (Record Type)
          mainCategory, // 主類別 (Main Category)
          subCategory, // 子類別 (Sub Category)
          amount, // 金額 (Amount) - negative for expenses
          0, // 手續費 (Fee)
          0, // 折扣 (Discount)
          expense.description || '', // 名稱 (Name)
          groupName, // 商家 (Merchant/Group)
          dateStr, // 日期 (Date)
          timeStr, // 時間 (Time)
          '', // 專案 (Project)
          expense.description || '', // 描述 (Description)
          '', // 標籤 (Tags)
          '' // 對象 (Target)
        ].join(',');
        
        csvRows.push(csvRow);
      } catch (error) {
        console.error('Error processing expense for CSV:', error);
      }
    }
    
    const csvContent = csvRows.join('\n');
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${year}_${month.toString().padStart(2, '0')}.csv"`);
    
    // Add BOM for proper UTF-8 encoding in Excel
    res.write('\ufeff');
    res.end(csvContent);
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

module.exports = router;
