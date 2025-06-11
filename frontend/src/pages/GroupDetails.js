import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const GroupDetails = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchGroupData = useCallback(async () => {
    try {
      setLoading(true);
      // Get current user info
      const userRes = await api.get('/api/users/profile');
      setCurrentUser(userRes.data);

      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        api.get(`/api/groups/${groupId}`),
        api.get(`/api/expenses?groupId=${groupId}`),
        api.get(`/api/balances?groupId=${groupId}`)
      ]);

      setGroup(groupRes.data);
      setExpenses(expensesRes.data);
      setBalances(balancesRes.data.balances);
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load group data');
      console.error('Group details fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  // Add event listeners for automatic refresh
  useEffect(() => {
    const handleFocus = () => {
      console.log('Group details focused, refreshing data...');
      fetchGroupData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Group details visible, refreshing data...');
        fetchGroupData();
      }
    };

    const handlePopState = () => {
      console.log('Navigation detected in group details, refreshing...');
      fetchGroupData();
    };

    // Refresh when window gains focus
    window.addEventListener('focus', handleFocus);
    // Refresh when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Refresh on navigation
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [fetchGroupData]);

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      await api.delete(`/api/expenses/${expenseId}`);
      
      // Refresh all data after deletion
      await fetchGroupData();
    } catch (err) {
      setError('Failed to delete expense: ' + (err.response?.data?.error || err.message));
    }
  };

  // Add manual refresh function
  const handleRefresh = () => {
    fetchGroupData();
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/groups/${groupId}`);
      
      // Navigate back to dashboard after successful deletion
      navigate('/', { 
        state: { 
          message: `Group "${group.name}" has been deleted successfully.` 
        }
      });
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError('Failed to delete group: ' + errorMessage);
      
      // If there are expenses, show a more helpful message
      if (err.response?.data?.expenseCount) {
        setError(`Cannot delete group: There are ${err.response.data.expenseCount} expenses in this group. Please delete all expenses first.`);
      }
    }
  };

  // Check if current user is admin of the group
  const isGroupAdmin = () => {
    if (!currentUser || !group) return false;
    const member = group.members.find(m => m.user === currentUser.id);
    return member && member.role === 'admin';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="group-details">
      {lastRefresh && (
        <div className="last-refresh">
          <small>Last updated: {lastRefresh.toLocaleTimeString()}</small>
        </div>
      )}
      
      <div className="page-header">
        <h1>{group.name}</h1>
        <div className="header-actions">
          <button 
            onClick={handleRefresh} 
            className="button secondary"
            disabled={loading}
            title="Refresh group data"
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link 
            to={`/groups/${groupId}/expenses/add`}
            className="button primary"
          >
            Add Expense
          </Link>
          {isGroupAdmin() && (
            <button 
              onClick={handleDeleteGroup}
              className="button danger"
              title="Delete group"
            >
              🗑️ Delete Group
            </button>
          )}
        </div>
      </div>

      <div className="group-info card">
        <h3>Group Information</h3>
        <p>{group.description}</p>
        <div className="members-list">
          <h4>Members</h4>
          <ul>
            {group.members.map(member => (
              <li key={member.user}>
                {member.userName || member.user}
                {member.role === 'admin' && (
                  <span className="admin-badge">Admin</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="expenses-section">
        <h2>Expenses</h2>
        {expenses.length === 0 ? (
          <p className="no-expenses">
            No expenses yet. Add one to get started!
          </p>
        ) : (
          <div className="expenses-list">
            {expenses.map(expense => (
              <div key={expense.id} className="expense-card card">
                <div className="expense-header">
                  <h3>{expense.description}</h3>
                  <div className="expense-actions">
                    <span className="amount">
                      {expense.currency} {expense.amount.toFixed(2)}
                    </span>
                    {currentUser && expense.paidBy === currentUser.id && (
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="delete-button"
                        title="Delete expense"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div className="expense-details">
                  <span className="category">{expense.category}</span>
                  <span className="date">
                    {new Date(expense.date).toLocaleDateString()}
                  </span>
                  <span className="paid-by">
                    Paid by: {expense.paidByName || 'Unknown User'}
                  </span>
                </div>
                <div className="splits">
                  <h4>Split Details:</h4>
                  {expense.splits.map((split, index) => (
                    <div key={index} className="split-item">
                      <span>{split.userName || 'Unknown User'}</span>
                      <span>{expense.currency} {split.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {balances.length > 0 && (
        <div className="balances-section">
          <h2>Current Balances</h2>
          <div className="balances-list">
            {balances.map((balance, index) => (
              <div key={index} className={`balance-card card ${balance.type}`}>
                <span className="user">
                  {balance.type === 'owes_you' ? 
                    `${balance.user.name} owes you` : 
                    `You owe ${balance.user.name}`}
                </span>
                <span className="amount">
                  ${balance.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
