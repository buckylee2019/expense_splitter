import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import CategoryPieChart from '../components/CategoryPieChart';
import '../styles/Reports.css';

const Reports = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [displayMode, setDisplayMode] = useState('list'); // 'list' or 'matrix'
  const [exportType, setExportType] = useState('personal'); // 'personal', 'all-members', 'group-balances'

  // Generate year options (current year and previous 5 years)
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 6; i++) {
    yearOptions.push(currentYear - i);
  }

  const monthOptions = [
    { value: 1, label: '1月 January' },
    { value: 2, label: '2月 February' },
    { value: 3, label: '3月 March' },
    { value: 4, label: '4月 April' },
    { value: 5, label: '5月 May' },
    { value: 6, label: '6月 June' },
    { value: 7, label: '7月 July' },
    { value: 8, label: '8月 August' },
    { value: 9, label: '9月 September' },
    { value: 10, label: '10月 October' },
    { value: 11, label: '11月 November' },
    { value: 12, label: '12月 December' }
  ];

  useEffect(() => {
    fetchCurrentUser();
    fetchReport();
  }, [selectedYear, selectedMonth]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/api/users/profile');
      setCurrentUser(response.data);
      
      // If admin, fetch groups
      if (response.data.email === 'little880536@gmail.com') {
        const groupsResponse = await api.get('/api/groups');
        setGroups(groupsResponse.data);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get(`/api/reports/monthly/${selectedYear}/${selectedMonth}`);
      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUnifiedExport = async () => {
    if (exportType === 'personal') {
      await handleExportCSV();
    } else if (exportType === 'all-members') {
      await handleExportAllMembers();
    } else if (exportType === 'group-balances') {
      await exportGroupBalancesCSV();
    }
  };

  const handleExportAllMembers = async () => {
    if (!selectedGroupId) {
      setError('Please select a group first');
      return;
    }
    
    if (displayMode === 'matrix') {
      exportAdminMatrixCSV();
      return;
    }
    
    try {
      setExporting(true);
      
      const response = await api.get(`/api/reports/export-all/${selectedYear}/${selectedMonth}?groupId=${selectedGroupId}`, {
        responseType: 'blob'
      });
      
      // Get group name for filename
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      const groupName = selectedGroup ? selectedGroup.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') : 'group';
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${groupName}_expenses_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export all members data');
    } finally {
      setExporting(false);
    }
  };

  const exportAdminMatrixCSV = async () => {
    try {
      setExporting(true);
      
      // Get group expenses data
      const response = await api.get(`/api/reports/group-matrix/${selectedYear}/${selectedMonth}?groupId=${selectedGroupId}`);
      const groupExpenses = response.data;
      
      // Build matrix data
      const allUsers = new Map();
      const expenseMatrix = {};

      groupExpenses.forEach(expense => {
        expense.splits?.forEach(split => {
          const userId = split.user || split.userId;
          if (userId && split.userName) {
            allUsers.set(userId, split.userName);
          }
        });
        expenseMatrix[expense.description] = {};
      });

      const users = Array.from(allUsers.entries()).map(([id, name]) => ({ id, name }));

      groupExpenses.forEach(expense => {
        expense.splits?.forEach(split => {
          const userId = split.user || split.userId;
          if (userId) {
            expenseMatrix[expense.description][userId] = split.amount || 0;
          }
        });
      });

      // Create CSV content
      const csvRows = [];
      
      // Header row
      const headerRow = ['', ...users.map(user => user.name)];
      csvRows.push(headerRow.join(','));
      
      // Data rows
      Object.entries(expenseMatrix).forEach(([expenseName, userAmounts]) => {
        const row = [expenseName, ...users.map(user => userAmounts[user.id] || 0)];
        csvRows.push(row.join(','));
      });
      
      // Calculate total paid by each user and add as negative row
      const totalPaidByUser = {};
      groupExpenses.forEach(expense => {
        const paidBy = expense.paidBy;
        if (paidBy) {
          if (!totalPaidByUser[paidBy]) {
            totalPaidByUser[paidBy] = 0;
          }
          totalPaidByUser[paidBy] += expense.amount || 0;
        }
      });
      
      // Add "total paid by you" row with negative values
      const totalPaidRow = ['total paid by you', ...users.map(user => -(totalPaidByUser[user.id] || 0))];
      csvRows.push(totalPaidRow.join(','));

      const csvContent = csvRows.join('\n');
      
      // Get group name for filename
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      const groupName = selectedGroup ? selectedGroup.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') : 'group';
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${groupName}_matrix_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export matrix data');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      
      const response = await api.get(`/api/reports/export/${selectedYear}/${selectedMonth}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `expenses_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportGroupBalancesCSV = async () => {
    if (!selectedGroupId) {
      setError('Please select a group first');
      return;
    }

    try {
      setExporting(true);
      
      // Get group-wide optimized transfers
      const response = await api.get(`/api/balances/group/${selectedGroupId}/optimized`);
      const balancesData = response.data;
      
      if (!balancesData.optimizedTransfers || balancesData.optimizedTransfers.length === 0) {
        setError('No balance data found for this group');
        return;
      }

      // Get group info
      const groupResponse = await api.get(`/api/groups/${selectedGroupId}`);
      const groupName = groupResponse.data.name;

      // Create CSV content
      let csvContent = `Group Balance Report - ${groupName}\n`;
      csvContent += `Generated on: ${new Date().toLocaleDateString()}\n`;
      csvContent += `Optimized Transfers (${balancesData.transferCount} transactions)\n\n`;
      csvContent += `From,To,Amount,Currency\n`;

      // Process optimized transfers
      balancesData.optimizedTransfers.forEach(transfer => {
        csvContent += `${transfer.fromName},${transfer.toName},${transfer.amount},${transfer.currency}\n`;
      });

      // Add summary
      csvContent += `\nSummary\n`;
      csvContent += `Total Optimized Transfers,${balancesData.transferCount}\n`;
      csvContent += `Total Transfer Amount,${balancesData.totalTransferAmount}\n`;
      csvContent += `Savings vs Individual Settlements,${balancesData.savingsPercentage}%\n`;

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${groupName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}_balances_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export group balances');
    } finally {
      setExporting(false);
    }
  };

  const exportMatrixCSV = () => {
    if (!reportData || !reportData.expenses.length) return;

    // Build matrix data
    const allUsers = new Map();
    const expenseMatrix = {};

    reportData.expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const userId = split.user || split.userId;
        if (userId && split.userName) {
          allUsers.set(userId, split.userName);
        }
      });
      expenseMatrix[expense.description] = {};
    });

    const users = Array.from(allUsers.entries()).map(([id, name]) => ({ id, name }));

    reportData.expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const userId = split.user || split.userId;
        if (userId) {
          expenseMatrix[expense.description][userId] = split.amount || 0;
        }
      });
    });

    // Create CSV content
    const csvRows = [];
    
    // Header row
    const headerRow = ['', ...users.map(user => user.name)];
    csvRows.push(headerRow.join(','));
    
    // Data rows
    Object.entries(expenseMatrix).forEach(([expenseName, userAmounts]) => {
      const row = [expenseName, ...users.map(user => userAmounts[user.id] || 0)];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `matrix_expenses_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount, currency = 'TWD') => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMatrixView = () => {
    if (!reportData || !reportData.expenses.length) return null;

    // Get all unique users from all expenses
    const allUsers = new Map();
    const expenseMatrix = {};

    reportData.expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const userId = split.user || split.userId;
        if (userId && split.userName) {
          allUsers.set(userId, split.userName);
        }
      });
      
      // Initialize expense row
      expenseMatrix[expense.description] = {};
    });

    // Convert map to array
    const users = Array.from(allUsers.entries()).map(([id, name]) => ({ id, name }));

    // Fill the matrix
    reportData.expenses.forEach(expense => {
      expense.splits?.forEach(split => {
        const userId = split.user || split.userId;
        if (userId) {
          expenseMatrix[expense.description][userId] = split.amount || 0;
        }
      });
    });

    return (
      <div className="matrix-view">
        <div className="matrix-table-container">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="expense-header"></th>
                {users.map(user => (
                  <th key={user.id} className="user-header">
                    {user.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(expenseMatrix).map(([expenseName, userAmounts]) => (
                <tr key={expenseName}>
                  <td className="expense-name">{expenseName}</td>
                  {users.map(user => (
                    <td key={user.id} className="amount-cell">
                      {userAmounts[user.id] || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="reports">
      <div className="page-header">
        <h1> Monthly Expense Report</h1>
        <p>View and export your monthly expense data</p>
      </div>

      {/* Date Selection */}
      <div className="report-controls card">
        <div className="date-selectors">
          <div className="form-group">
            <label htmlFor="year">Year 年份</label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="month">Month 月份</label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {monthOptions.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="report-actions">
          <div className="form-group">
            <label htmlFor="export-type">Export Type</label>
            <select
              id="export-type"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="export-type-selector"
            >
              <option value="personal">Personal Expenses CSV</option>
              {currentUser && currentUser.email === 'little880536@gmail.com' && (
                <>
                  <option value="all-members">All Members Expenses CSV</option>
                  <option value="group-balances">Group Balances CSV</option>
                </>
              )}
            </select>
          </div>
          
          {(exportType === 'all-members' || exportType === 'group-balances') && currentUser && currentUser.email === 'little880536@gmail.com' && (
            <div className="form-group">
              <label htmlFor="group-select">Select Group</label>
              <select
                id="group-select"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="group-selector"
              >
                <option value="">Choose a group...</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {exportType === 'all-members' && currentUser && currentUser.email === 'little880536@gmail.com' && (
            <div className="form-group">
              <label htmlFor="display-mode">Display Mode</label>
              <select
                id="display-mode"
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value)}
                className="display-mode-selector"
              >
                <option value="list">List View</option>
                <option value="matrix">Matrix View (Users × Expenses)</option>
              </select>
            </div>
          )}
          
          <button
            onClick={handleUnifiedExport}
            disabled={exporting || (exportType !== 'personal' && !selectedGroupId)}
            className="button primary"
          >
            {exporting ? '📤 Exporting...' : '📥 Export'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Report Summary */}
      {reportData && (
        <>
          <div className="report-summary card">
            <h2>📈 Summary for {selectedYear}/{selectedMonth}</h2>
            
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Expenses</span>
                <span className="stat-value">{reportData.summary.totalExpenses}</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Total Amount</span>
                <span className="stat-value">{formatCurrency(reportData.summary.totalAmount)}</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Amount Paid</span>
                <span className="stat-value paid">{formatCurrency(reportData.summary.totalPaid)}</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Net Balance</span>
                <span className={`stat-value ${reportData.summary.totalOwed >= 0 ? 'owed' : 'owing'}`}>
                  {reportData.summary.totalOwed >= 0 ? '+' : ''}{formatCurrency(reportData.summary.totalOwed)}
                </span>
                <small className="stat-note">
                  {reportData.summary.totalOwed >= 0 ? 'You are owed money' : 'You owe money'}
                </small>
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="chart-section">
              <h2>Category Distribution</h2>
              <CategoryPieChart 
                expenses={reportData.expenses} 
                title={`Expenses by Category - ${selectedYear}/${selectedMonth}`}
              />
            </div>

            {/* Category Breakdown */}
            {Object.keys(reportData.summary.byCategory).length > 0 && (
              <div className="category-breakdown">
                <h3><i className="fi fi-rr-calculator"></i> By Category</h3>
                <div className="category-list">
                  {Object.entries(reportData.summary.byCategory)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="category-item">
                        <span className="category-name">{category}</span>
                        <span className="category-amount">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Currency Breakdown */}
            {Object.keys(reportData.summary.byCurrency).length > 1 && (
              <div className="currency-breakdown">
                <h3>💱 By Currency</h3>
                <div className="currency-list">
                  {Object.entries(reportData.summary.byCurrency)
                    .sort(([,a], [,b]) => b - a)
                    .map(([currency, amount]) => (
                      <div key={currency} className="currency-item">
                        <span className="currency-name">{currency}</span>
                        <span className="currency-amount">{formatCurrency(amount, currency)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Expense List */}
          <div className="expense-list-section card">
            <h2>📋 Expense Details ({reportData.expenses.length} items)</h2>
            
            {reportData.expenses.length === 0 ? (
              <div className="no-expenses">
                <p>No expenses found for {selectedYear}/{selectedMonth}</p>
                <Link to="/groups" className="button primary">
                  Add Some Expenses
                </Link>
              </div>
            ) : displayMode === 'matrix' ? (
              renderMatrixView()
            ) : (
              <div className="expenses-table">
                <div className="table-header">
                  <div className="col-date">Date</div>
                  <div className="col-description">Description</div>
                  <div className="col-category">Category</div>
                  <div className="col-amount">Amount</div>
                  <div className="col-group">Group</div>
                  <div className="col-status">Status</div>
                </div>
                
                <div className="table-body">
                  {reportData.expenses
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(expense => (
                      <div key={expense.id} className="table-row">
                        <div className="col-date">
                          <div className="date">{formatDate(expense.date)}</div>
                          <div className="time">{formatTime(expense.date)}</div>
                        </div>
                        
                        <div className="col-description">
                          <div className="description">{expense.description}</div>
                        </div>
                        
                        <div className="col-category">
                          <span className="category-tag">{expense.category}</span>
                        </div>
                        
                        <div className="col-amount">
                          <div className="amount">
                            {formatCurrency(
                              expense.isPaidByUser ? expense.amount : expense.userAmount,
                              expense.currency
                            )}
                          </div>
                        </div>
                        
                        <div className="col-group">
                          <span className="group-name">{expense.groupName || 'Personal'}</span>
                        </div>
                        
                        <div className="col-status">
                          <span className={`status-badge ${expense.isPaidByUser ? 'paid' : 'owed'}`}>
                            {expense.isPaidByUser ? 'Paid by You' : 'You Owe'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
