import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CategoryBadge from '../components/CategoryBadge';
import AddMember from '../components/AddMember';

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
  const [showAddMember, setShowAddMember] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'

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
  const handleMemberAdded = (updatedGroup) => {
    setGroup(updatedGroup);
    setShowAddMember(false);
    // Refresh all data to ensure consistency
    fetchGroupData();
  };

  // Sort expenses by date
  const sortExpenses = (expensesList, order) => {
    return [...expensesList].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      if (order === 'newest') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });
  };

  // Get sorted expenses
  const sortedExpenses = sortExpenses(expenses, sortOrder);

  const handleSortChange = (newSortOrder) => {
    setSortOrder(newSortOrder);
  };

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

      <div className="group-info-compact">
        <div className="group-summary card">
          <div className="group-basic-info">
            <p className="group-description">{group.description}</p>
            <div className="group-stats">
              <span className="stat">
                <strong>{group.members.length}</strong> members
              </span>
              <span className="stat">
                <strong>{expenses.length}</strong> expenses
              </span>
            </div>
          </div>
          
          <div className="members-compact">
            <div className="members-header">
              <strong>Members: </strong>
              {isGroupAdmin() && (
                <button 
                  onClick={() => setShowAddMember(true)}
                  className="btn btn-small btn-primary"
                  title="Add new member"
                >
                  + Add Member
                </button>
              )}
            </div>
            <div className="members-list">
              {group.members.map((member, index) => (
                <span key={member.user} className="member-tag">
                  {member.userName || member.user}
                  {member.role === 'admin' && <span className="admin-indicator">★</span>}
                  {index < group.members.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        </div>

        {balances.length > 0 ? (
          <div className="balances-compact card">
            <h4>Quick Balances</h4>
            <div className="balances-summary">
              {balances.slice(0, 3).map((balance, index) => (
                <div key={index} className={`balance-item ${balance.type}`}>
                  <span className="balance-text">
                    {balance.type === 'owes_you' ? 
                      `${balance.user.name} owes you` : 
                      `You owe ${balance.user.name}`}
                  </span>
                  <span className="balance-amount">{balance.currency || 'TWD'} {balance.amount.toFixed(2)}</span>
                </div>
              ))}
              {balances.length > 3 && (
                <div className="more-balances">
                  +{balances.length - 3} more...
                </div>
              )}
            </div>
          </div>
        ) : expenses.length > 0 && (
          <div className="all-settled-message card">
            <div className="settled-icon">✅</div>
            <h4>All Settled!</h4>
            <p>Great news! All expenses in this group are settled. No outstanding balances.</p>
          </div>
        )}
      </div>

      <div className="expenses-section">
        <div className="expenses-header">
          <h2>Expenses</h2>
          {expenses.length > 0 && (
            <div className="sort-controls">
              <label htmlFor="sort-select">Sort by date:</label>
              <select 
                id="sort-select"
                value={sortOrder} 
                onChange={(e) => handleSortChange(e.target.value)}
                className="sort-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          )}
        </div>
        
        {expenses.length === 0 ? (
          <p className="no-expenses">
            No expenses yet. Add one to get started!
          </p>
        ) : (
          <div className="expenses-list">
            {sortedExpenses.map(expense => (
              <div key={expense.id} className="expense-card-compact card">
                <div className="expense-main">
                  <div className="expense-info">
                    <h4 className="expense-title">{expense.description}</h4>
                    {expense.project && (
                      <div className="expense-project">📁 {expense.project}</div>
                    )}
                    <div className="expense-meta">
                      <span className="expense-date">
                        {new Date(expense.date).toLocaleDateString()}
                      </span>
                      <span className="expense-payer">
                        by {expense.paidByName || 'Unknown'}
                      </span>
                      <CategoryBadge category={expense.category} />
                    </div>
                  </div>
                  
                  <div className="expense-amount">
                    <span className="currency">{expense.currency}</span>
                    <span className="amount">{expense.amount.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="expense-actions">
                  <Link 
                    to={`/groups/${groupId}/expenses/${expense.id}`}
                    className="view-details-btn"
                  >
                    View Details
                  </Link>
                  {currentUser && expense.paidBy === currentUser.id && (
                    <button 
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="delete-button-small"
                      title="Delete expense"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddMember 
              groupId={groupId}
              onMemberAdded={handleMemberAdded}
              onCancel={() => setShowAddMember(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
