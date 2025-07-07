import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import CategoryBadge from '../components/CategoryBadge';
import AddMember from '../components/AddMember';
import SettlementModal from '../components/SettlementModal';
import UserPhoto from '../components/UserPhoto';

const GroupDetails = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [optimizationInfo, setOptimizationInfo] = useState(null);
  const [useOptimized, setUseOptimized] = useState(true); // Default to optimized for groups
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
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
        api.get(`/api/balances?groupId=${groupId}${useOptimized ? '&optimized=true' : ''}`)
      ]);

      setGroup(groupRes.data);
      setExpenses(expensesRes.data);
      setBalances(balancesRes.data.balances);
      
      // Store optimization info if available
      if (balancesRes.data.optimizedTransfers) {
        setOptimizationInfo({
          transferCount: balancesRes.data.transferCount,
          originalTransferCount: balancesRes.data.originalTransferCount,
          optimizedTransfers: balancesRes.data.optimizedTransfers
        });
      } else {
        setOptimizationInfo(null);
      }
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load group data');
      console.error('Group details fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId, useOptimized]);

  // Toggle between optimized and original balance calculation
  const toggleOptimization = () => {
    setUseOptimized(!useOptimized);
  };

  // Handle settle button click
  const handleSettleClick = (balance) => {
    setSelectedBalance(balance);
    setShowSettlementModal(true);
  };

  // Handle settlement completion
  const handleSettlementComplete = () => {
    setShowSettlementModal(false);
    setSelectedBalance(null);
    // Refresh group data to update balances
    fetchGroupData();
  };

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
  // Check if current user is admin of the group
  const handleMemberAdded = (updatedGroup) => {
    setGroup(updatedGroup);
    setShowAddMember(false);
    // Refresh all data to ensure consistency
    fetchGroupData();
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) {
      return;
    }

    try {
      await api.delete(`/api/groups/${groupId}/members/${memberUserId}`);
      // Refresh group data
      fetchGroupData();
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove member: ' + (err.response?.data?.error || err.message));
    }
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
                  onClick={() => setShowGroupSettings(true)}
                  className="btn btn-small btn-secondary"
                  title="Group settings"
                >
                  <i className="fi fi-rr-settings"></i> Settings
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
            <div className="balances-header">
              <h4>Quick Balances</h4>
              <button 
                onClick={toggleOptimization}
                className={`button ${useOptimized ? 'primary' : 'secondary'} small`}
                title={useOptimized ? 'Using optimized transfers (fewer transactions)' : 'Using direct transfers'}
              >
                {useOptimized ? '🎯 Optimized' : '📊 Direct'}
              </button>
            </div>
            
            <div className="balances-summary">
              {(() => {
                // Helper function to get currency symbol
                const getCurrencySymbol = (currency) => {
                  const symbols = {
                    'TWD': 'NT$',
                    'USD': '$',
                    'JPY': '¥',
                    'EUR': '€',
                    'GBP': '£',
                    'CNY': '¥',
                    'HKD': 'HK$',
                    'SGD': 'S$'
                  };
                  return symbols[currency] || currency;
                };

                // Group balances by user
                const userBalances = {};
                
                balances.forEach(balance => {
                  const userId = balance.user.id;
                  if (!userBalances[userId]) {
                    userBalances[userId] = {
                      user: balance.user,
                      currencies: {}
                    };
                  }
                  
                  const currency = balance.currency || 'TWD';
                  if (!userBalances[userId].currencies[currency]) {
                    userBalances[userId].currencies[currency] = { owed: 0, owing: 0 };
                  }
                  
                  if (balance.type === 'owes_you') {
                    userBalances[userId].currencies[currency].owed += balance.amount;
                  } else {
                    userBalances[userId].currencies[currency].owing += balance.amount;
                  }
                });

                return Object.values(userBalances).slice(0, 3).map((userBalance, index) => {
                  // Calculate net balances for this user across all currencies
                  const userCurrencies = [];
                  
                  Object.keys(userBalance.currencies).forEach(currency => {
                    const net = userBalance.currencies[currency].owed - userBalance.currencies[currency].owing;
                    if (Math.abs(net) > 0.01) { // Only show significant amounts
                      userCurrencies.push({
                        currency,
                        amount: Math.abs(net),
                        type: net > 0 ? 'owes_you' : 'you_owe'
                      });
                    }
                  });

                  if (userCurrencies.length === 0) return null;

                  return (
                    <div key={userBalance.user.id} className="balance-item">
                      <div className="balance-info-with-photo">
                        <UserPhoto user={userBalance.user} size="small" />
                        <div className="balance-text-content">
                          <span className="balance-text">
                            {userCurrencies.some(c => c.type === 'owes_you') && userCurrencies.some(c => c.type === 'you_owe')
                              ? `Mixed balances with ${userBalance.user.name}`
                              : userCurrencies[0].type === 'owes_you' 
                                ? `${userBalance.user.name} owes you`
                                : `You owe ${userBalance.user.name}`
                            }
                          </span>
                          <div className="balance-amounts-compact">
                            {userCurrencies.map((currencyBalance, currIndex) => (
                              <span 
                                key={currencyBalance.currency} 
                                className={`balance-amount ${currencyBalance.type}`}
                              >
                                {getCurrencySymbol(currencyBalance.currency)} {currencyBalance.amount.toFixed(2)}
                                {currIndex < userCurrencies.length - 1 && ' + '}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button 
                        className="settle-btn"
                        onClick={() => handleSettleClick({
                          user: userBalance.user,
                          type: userCurrencies[0].type,
                          amount: userCurrencies[0].amount,
                          currency: userCurrencies[0].currency
                        })}
                        title="Settle this balance"
                      >
                        Settle
                      </button>
                    </div>
                  );
                }).filter(Boolean);
              })()}
              {balances.length > 3 && (
                <div className="more-balances">
                  +{Object.keys(balances.reduce((acc, balance) => {
                    acc[balance.user.id] = true;
                    return acc;
                  }, {})).length - 3} more...
                  <Link to="/settlements" className="view-all-link">View All</Link>
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
          <div className="expenses-header-actions">
            <Link 
              to={`/groups/${groupId}/expenses/add`}
              className="button primary"
            >
              <i className="fi fi-rr-plus"></i>
              <span className="hide-mobile">Add Expense</span>
            </Link>
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
                      <i className="fi fi-rr-trash"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group Settings Modal */}
      {showGroupSettings && (
        <div className="modal-overlay">
          <div className="modal-content group-settings-modal">
            <div className="modal-header">
              <h3><i className="fi fi-rr-settings"></i> Group Settings</h3>
              <button 
                onClick={() => setShowGroupSettings(false)}
                className="close-btn"
                title="Close"
              >
                <i className="fi fi-rr-cross"></i>
              </button>
            </div>
            
            <div className="modal-body">
              {/* Add Member Section */}
              <div className="settings-section">
                <h4><i className="fi fi-rr-user-add"></i> Add Member</h4>
                <p>Invite new members to join this group</p>
                <button 
                  onClick={() => {
                    setShowGroupSettings(false);
                    setShowAddMember(true);
                  }}
                  className="btn btn-primary"
                >
                  <i className="fi fi-rr-plus"></i> Add New Member
                </button>
              </div>

              {/* Remove Member Section */}
              <div className="settings-section">
                <h4><i className="fi fi-rr-user-remove"></i> Remove Members</h4>
                <p>Remove members from this group</p>
                <div className="members-management-list">
                  {group.members.map(member => {
                    const isCurrentUser = member.user === currentUser?.id;
                    const isAdmin = member.role === 'admin';
                    const canRemove = isGroupAdmin() && !isCurrentUser && group.members.length > 1;
                    
                    return (
                      <div key={member.user} className="member-management-item">
                        <div className="member-info">
                          <span className="member-name">
                            {member.userName || member.user}
                            {isCurrentUser && <span className="you-indicator"> (You)</span>}
                            {isAdmin && <span className="admin-indicator">★ Admin</span>}
                          </span>
                        </div>
                        {canRemove && (
                          <button 
                            onClick={() => handleRemoveMember(member.user)}
                            className="btn btn-small btn-danger"
                            title="Remove member"
                          >
                            <i className="fi fi-rr-trash"></i> Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expense Splitting Settings */}
              <div className="settings-section">
                <h4><i className="fi fi-rr-calculator"></i> Expense Splitting</h4>
                <p>Configure how expenses are split by default</p>
                <div className="splitting-options">
                  <label className="setting-option">
                    <input 
                      type="radio" 
                      name="defaultSplitType" 
                      value="equal"
                      defaultChecked
                    />
                    <span>Equal Split (Default)</span>
                    <small>Split expenses equally among all members</small>
                  </label>
                  <label className="setting-option">
                    <input 
                      type="radio" 
                      name="defaultSplitType" 
                      value="weight"
                    />
                    <span>Weight-based Split</span>
                    <small>Split based on custom weights for each member</small>
                  </label>
                  <label className="setting-option">
                    <input 
                      type="radio" 
                      name="defaultSplitType" 
                      value="custom"
                    />
                    <span>Custom Split</span>
                    <small>Manually set amounts for each member</small>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => setShowGroupSettings(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showSettlementModal && selectedBalance && (
        <SettlementModal
          balance={selectedBalance}
          groupId={groupId}
          currentUser={currentUser}
          onComplete={handleSettlementComplete}
          onCancel={() => setShowSettlementModal(false)}
        />
      )}
    </div>
  );
};

export default GroupDetails;
