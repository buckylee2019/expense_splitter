import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/Reports.css';

const Reports = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

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
    fetchReport();
  }, [selectedYear, selectedMonth]);

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
          <button
            onClick={fetchReport}
            disabled={loading}
            className="button secondary"
          >
            {loading ? '🔄 Loading...' : '🔍 View Report'}
          </button>
          
          {reportData && reportData.expenses.length > 0 && (
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="button primary"
            >
              {exporting ? '📤 Exporting...' : '📥 Export CSV'}
            </button>
          )}
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
                <span className="stat-label">Amount Owed</span>
                <span className="stat-value owed">{formatCurrency(reportData.summary.totalOwed)}</span>
              </div>
            </div>

            {/* Category Breakdown */}
            {Object.keys(reportData.summary.byCategory).length > 0 && (
              <div className="category-breakdown">
                <h3>💰 By Category</h3>
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
