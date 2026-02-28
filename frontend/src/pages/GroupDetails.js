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
  const [globalBalances, setGlobalBalances] = useState([]);
  const [showGlobalComparison, setShowGlobalComparison] = useState(false);
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
  const [showDetailedDebts, setShowDetailedDebts] = useState(false);
  const [groupDebts, setGroupDebts] = useState([]);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'
  const [showCurrentMonthOnly, setShowCurrentMonthOnly] = useState(true); // New state for month filter
  const [showSpendingSummary, setShowSpendingSummary] = useState(false); // Collapsed by default
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchGroupData = useCallback(async () => {
    try {
      setLoading(true);
      // Get current user info
      const userRes = await api.get('/api/users/profile');
      setCurrentUser(userRes.data);

      const [groupRes, expensesRes, settlementsRes, balancesRes, globalBalancesRes] = await Promise.all([
        api.get(`/api/groups/${groupId}`),
        api.get(`/api/expenses?groupId=${groupId}&limit=20&sort=createdAt&order=desc`),
        api.get(`/api/settlements?groupId=${groupId}`),
        api.get(`/api/balances?groupId=${groupId}${useOptimized ? '&optimized=true' : ''}`),
        api.get(`/api/balances${useOptimized ? '?optimized=true' : ''}`) // Global balances for comparison
      ]);

      setGroup(groupRes.data);
      
      // Merge expenses and settlements, sort by date
      const expensesList = (expensesRes.data.expenses || expensesRes.data).map(e => ({
        ...e,
        type: 'expense',
        date: e.createdAt
      }));
      
      const settlementsList = (settlementsRes.data || []).map(s => ({
        ...s,
        type: 'settlement',
        date: s.settledAt || s.createdAt
      }));
      
      const merged = [...expensesList, ...settlementsList].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setExpenses(merged);
      setPagination(expensesRes.data.pagination || null);
      setBalances(balancesRes.data.balances);
      setGlobalBalances(globalBalancesRes.data.balances);
      
      // Validate balance calculation
      setTimeout(() => validateBalanceCalculation(), 100);
      
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

  const loadMoreExpenses = async () => {
    if (!pagination?.hasNextPage || loadingMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = pagination.currentPage + 1;
      const response = await api.get(`/api/expenses?groupId=${groupId}&limit=20&sort=createdAt&order=desc&page=${nextPage}`);
      
      const newExpenses = response.data.expenses || response.data;
      setExpenses(prev => [...prev, ...newExpenses]);
      setPagination(response.data.pagination || null);
    } catch (err) {
      console.error('Failed to load more expenses:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [groupId, useOptimized]);

  // Calculate user's debt/credit for a specific expense
  const calculateUserExpenseBalance = (expense) => {
    if (!currentUser || !expense.splits) return null;
    
    // Find user's split
    const userSplit = expense.splits.find(split => 
      split.user === currentUser.id || split.userId === currentUser.id
    );
    
    if (!userSplit) return null;
    
    const userOwes = userSplit.amount;
    
    // Calculate how much the user paid
    let userPaid = 0;
    
    if (expense.isMultiplePayers && Array.isArray(expense.paidBy)) {
      // Multiple payers - find user's contribution
      const userPayer = expense.paidBy.find(payer => payer.userId === currentUser.id);
      userPaid = userPayer ? userPayer.amount : 0;
    } else if (expense.paidBy === currentUser.id) {
      // Single payer - user paid the full amount
      userPaid = expense.amount;
    }
    
    // Calculate net balance (what user paid minus what they owe)
    const netBalance = userPaid - userOwes;
    
    if (netBalance > 0) {
      // User gets money back
      return {
        type: 'credit',
        amount: netBalance,
        currency: expense.currency || 'TWD',
        message: `You get back ${netBalance.toFixed(2)} ${expense.currency || 'TWD'}`
      };
    } else if (netBalance < 0) {
      // User owes money
      return {
        type: 'debt',
        amount: Math.abs(netBalance),
        currency: expense.currency || 'TWD',
        message: `You owe ${Math.abs(netBalance).toFixed(2)} ${expense.currency || 'TWD'}`
      };
    } else {
      // User is settled (paid exactly what they owe)
      return {
        type: 'settled',
        amount: 0,
        currency: expense.currency || 'TWD',
        message: `You're settled`
      };
    }
  };

  // Validate balance calculation by checking if totals match
  const validateBalanceCalculation = () => {
    console.log('🔍 Validating Balance Calculation...');
    
    if (!currentUser || expenses.length === 0) {
      console.log('❌ Cannot validate: No current user or expenses');
      return;
    }
    
    // Calculate expected balances manually
    const expectedBalances = {};
    
    expenses.forEach(item => {
      // Skip settlements
      if (item.type === 'settlement' || !item.splits) return;
      
      const expense = item;
      const userPaid = expense.paidBy === currentUser.id;
      const userSplit = expense.splits.find(split => 
        split.user === currentUser.id || split.userId === currentUser.id
      );
      
      if (!userSplit) return;
      
      const currency = expense.currency || 'TWD';
      
      if (userPaid) {
        // User paid, others owe them
        expense.splits.forEach(split => {
          const splitUserId = split.user || split.userId;
          if (splitUserId !== currentUser.id) {
            if (!expectedBalances[splitUserId]) expectedBalances[splitUserId] = {};
            if (!expectedBalances[splitUserId][currency]) expectedBalances[splitUserId][currency] = 0;
            expectedBalances[splitUserId][currency] += split.amount; // Others owe user
          }
        });
      } else {
        // Someone else paid, user owes them
        const payerId = expense.paidBy;
        if (!expectedBalances[payerId]) expectedBalances[payerId] = {};
        if (!expectedBalances[payerId][currency]) expectedBalances[payerId][currency] = 0;
        expectedBalances[payerId][currency] -= userSplit.amount; // User owes payer
      }
    });
    
    console.log('📊 Expected Balances (calculated manually):', expectedBalances);
    console.log('📊 API Balances:', balances);
    
    // Compare with API balances
    let isValid = true;
    const apiBalanceMap = {};
    
    balances.forEach(balance => {
      const userId = balance.user.id;
      const currency = balance.currency;
      if (!apiBalanceMap[userId]) apiBalanceMap[userId] = {};
      apiBalanceMap[userId][currency] = balance.type === 'owes_you' ? balance.amount : -balance.amount;
    });
    
    // Check if expected matches API
    for (const [userId, currencies] of Object.entries(expectedBalances)) {
      for (const [currency, expectedAmount] of Object.entries(currencies)) {
        const apiAmount = apiBalanceMap[userId]?.[currency] || 0;
        if (Math.abs(expectedAmount - apiAmount) > 0.01) {
          console.log(`❌ Mismatch for user ${userId} in ${currency}: Expected ${expectedAmount}, API ${apiAmount}`);
          isValid = false;
        }
      }
    }
    
    if (isValid) {
      console.log('✅ Balance calculation is VALID - Manual calculation matches API');
    } else {
      console.log('❌ Balance calculation has DISCREPANCIES');
    }
    
    return isValid;
  };

  // Fetch detailed group debts (all members)
  const fetchGroupDebts = async () => {
    try {
      const response = await api.get(`/api/balances/group/${groupId}/optimized`);
      console.log('Group optimized transfers response:', response.data);
      
      const optimizedData = response.data;
      const detailedDebts = [];
      
      if (optimizedData.optimizedTransfers) {
        optimizedData.optimizedTransfers.forEach(transfer => {
          detailedDebts.push({
            debtor: {
              id: transfer.from,
              name: transfer.fromName || 'Unknown User',
              email: transfer.fromEmail || 'Unknown Email'
            },
            creditor: {
              id: transfer.to,
              name: transfer.toName || 'Unknown User',
              email: transfer.toEmail || 'Unknown Email'
            },
            amount: transfer.amount,
            currency: transfer.currency || 'TWD'
          });
        });
      }
      
      console.log('Processed detailed debts:', detailedDebts);
      setGroupDebts(detailedDebts);
    } catch (error) {
      console.error('Error fetching group debts:', error);
      setGroupDebts([]);
    }
  };

  // Fetch group debts when modal opens
  const handleShowDetailedDebts = () => {
    setShowDetailedDebts(true);
    fetchGroupDebts();
  };


  // Toggle global balance comparison
  const toggleGlobalComparison = () => {
    setShowGlobalComparison(!showGlobalComparison);
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
    console.log('GroupDetails component mounted');
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
      // Use the correct API endpoint: DELETE /api/groups/:id/members/:memberId
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

  // Helper function to check if expense is from current month
  const isCurrentMonth = (expenseDate) => {
    const now = new Date();
    const expense = new Date(expenseDate);
    return expense.getMonth() === now.getMonth() && expense.getFullYear() === now.getFullYear();
  };

  // Helper function to get current month name
  const getCurrentMonthName = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filter expenses based on month setting
  const getFilteredExpenses = () => {
    if (!showCurrentMonthOnly) return expenses;
    return expenses.filter(expense => isCurrentMonth(expense.date));
  };

  // Get sorted expenses (now using filtered expenses)
  const sortedExpenses = sortExpenses(getFilteredExpenses(), sortOrder);

  const handleSortChange = (newSortOrder) => {
    setSortOrder(newSortOrder);
  };

  // Calculate group spending summary
  const calculateGroupSummary = () => {
    if (!currentUser || !expenses.length) return null;

    const currentUserId = currentUser.id;
    const filteredExpenses = getFilteredExpenses();
    const byCurrency = {};
    let expenseCount = 0;

    filteredExpenses.forEach(item => {
      if (item.type === 'settlement') {
        // Process settlements: adjust net balance
        const settlement = item;
        const currency = settlement.currency || 'TWD';
        const amount = parseFloat(settlement.amount) || 0;

        if (!byCurrency[currency]) {
          byCurrency[currency] = { totalGroupSpending: 0, totalUserPaid: 0, totalUserShare: 0, settlements: 0 };
        }

        // If current user paid (fromUser), they reduced their debt
        if (settlement.fromUser === currentUserId) {
          byCurrency[currency].settlements -= amount;
        }
        // If current user received (toUser), they received money owed
        if (settlement.toUser === currentUserId) {
          byCurrency[currency].settlements += amount;
        }
        return;
      }
      
      expenseCount++;
      const expense = item;
      const currency = expense.currency || 'TWD';
      const amount = parseFloat(expense.amount) || 0;

      if (!byCurrency[currency]) {
        byCurrency[currency] = { totalGroupSpending: 0, totalUserPaid: 0, totalUserShare: 0, settlements: 0 };
      }

      byCurrency[currency].totalGroupSpending += amount;

      // Check if current user paid for this expense
      if (expense.paidBy === currentUserId) {
        byCurrency[currency].totalUserPaid += amount;
      }

      // Find user's split amount
      const userSplit = expense.splits?.find(split => 
        (split.user === currentUserId || split.userId === currentUserId)
      );
      if (userSplit) {
        byCurrency[currency].totalUserShare += parseFloat(userSplit.amount) || 0;
      }
    });

    // Count total expenses (excluding settlements)
    const totalExpenseCount = expenses.filter(e => e.type !== 'settlement').length;

    return {
      byCurrency,
      expenseCount,
      totalExpenseCount
    };
  };

  const groupSummary = calculateGroupSummary();

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
        {/* Group Banner */}
        <div className="group-banner">
          <div 
            className="banner-image"
            style={{
              backgroundImage: `url(${group.photoUrl || group.photo || '/group_background.png'})`,
            }}
          >
            <div className="banner-overlay">
              {/* Group Name Overlay */}
              <div className="group-name-overlay">
                <h1 className="group-name-large">{group.name}</h1>
              </div>
              
              {isGroupAdmin() && (
                <button 
                  onClick={() => setShowGroupSettings(true)}
                  className="settings-btn-banner"
                  title="Group settings"
                >
                  <i className="fi fi-rr-settings"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Group Spending Summary */}
        {groupSummary && (
          <div className="group-spending-summary card">
            <div className="card-header" onClick={() => setShowSpendingSummary(!showSpendingSummary)} style={{ cursor: 'pointer' }}>
              <div>
                <h3>
                  <i className={`fi ${showSpendingSummary ? 'fi-rr-angle-small-down' : 'fi-rr-angle-small-right'}`}></i>
                  &nbsp;Group Spending Summary
                </h3>
                {!showSpendingSummary && (
                  <span className="card-subtitle">
                    Click to expand • {groupSummary.totalExpenseCount} expenses
                  </span>
                )}
              </div>
            </div>
            
            {showSpendingSummary && (
              <>
                <div className="summary-header-controls">
                  <span className="card-subtitle">
                    {group.name} • {group.currency || 'TWD'} • 
                    {showCurrentMonthOnly ? (
                      <span className="current-month-indicator">
                        <i className="fi fi-rr-calendar"></i> {getCurrentMonthName()} ({groupSummary.expenseCount} of {groupSummary.totalExpenseCount} expenses)
                      </span>
                    ) : (
                      <span className="all-time-indicator">
                        <i className="fi fi-rr-time-past"></i> All Time ({groupSummary.totalExpenseCount} expenses)
                      </span>
                    )}
                  </span>
                  <div className="summary-controls">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCurrentMonthOnly(!showCurrentMonthOnly);
                      }}
                      className={`button ${showCurrentMonthOnly ? 'secondary' : 'primary'} small`}
                      title={showCurrentMonthOnly ? 'Show all expenses' : 'Show current month only'}
                    >
                      <i className={`fi ${showCurrentMonthOnly ? 'fi-rr-time-past' : 'fi-rr-calendar'}`}></i>
                      {showCurrentMonthOnly ? 'Show All Time' : 'Current Month'}
                    </button>
                  </div>
                </div>
            
            {showCurrentMonthOnly && groupSummary.expenseCount === 0 ? (
              <div className="no-current-month-expenses">
                <div className="empty-state">
                  <i className="fi fi-rr-calendar-exclamation"></i>
                  <h4>No expenses this month</h4>
                  <p>There are no expenses recorded for {getCurrentMonthName()}.</p>
                  <button 
                    onClick={() => setShowCurrentMonthOnly(false)}
                    className="button secondary small"
                  >
                    <i className="fi fi-rr-time-past"></i>
                    View All Time Summary
                  </button>
                </div>
              </div>
            ) : (
              <div className="summary-grid">
                {/* Display by currency - horizontal cards */}
                <div className="summary-item">
                  <div className="summary-label">Total group spending</div>
                  {Object.entries(groupSummary.byCurrency).map(([currency, data]) => (
                    <div key={currency} className="summary-value">
                      {currency} {data.totalGroupSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ))}
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Total you paid for</div>
                  {Object.entries(groupSummary.byCurrency).map(([currency, data]) => (
                    <div key={currency} className="summary-value">
                      {currency} {data.totalUserPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ))}
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Your total share</div>
                  {Object.entries(groupSummary.byCurrency).map(([currency, data]) => (
                    <div key={currency} className="summary-value">
                      {currency} {data.totalUserShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ))}
                </div>
                
                <div className="summary-item">
                  <div className="summary-label">Net balance</div>
                  {Object.entries(groupSummary.byCurrency).map(([currency, data]) => {
                    const netBalance = data.totalUserPaid - data.totalUserShare + data.settlements;
                    return (
                      <div key={currency}>
                        <div className={`summary-value ${netBalance >= 0 ? 'positive' : 'negative'}`}>
                          {netBalance >= 0 ? '+' : ''}{currency} {netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="summary-note">
                          {netBalance >= 0 ? 'You are owed money' : 'You owe money'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Overall Balance Summary */}
                {balances.length > 0 && (
                  <>
                    {(() => {
                      const summary = {};
                      balances.forEach(b => {
                        if (!summary[b.currency]) summary[b.currency] = { owed: 0, owes: 0 };
                        if (b.type === 'owes_you') summary[b.currency].owed += b.amount;
                        else summary[b.currency].owes += b.amount;
                      });
                      
                      // Also include currencies from groupSummary that might not be in balances
                      Object.keys(groupSummary.byCurrency).forEach(currency => {
                        if (!summary[currency]) {
                          summary[currency] = { owed: 0, owes: 0 };
                        }
                      });
                      
                      return Object.entries(summary).map(([currency, amounts]) => {
                        const net = amounts.owed - amounts.owes;
                        // Skip if net is zero
                        if (Math.abs(net) < 0.01) return null;
                        
                        return (
                          <div key={currency} className="summary-item overall-balance-summary">
                            <div className={`overall-balance-inline ${net > 0 ? 'positive' : 'negative'}`}>
                              <div className="summary-label">
                                {net > 0 ? '💰 Overall, you are owed' : '💸 Overall, you owe'}
                              </div>
                              <div className="summary-value">
                                {currency} {Math.abs(net).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      }).filter(Boolean);
                    })()}
                  </>
                )}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {balances.length > 0 ? (
          <div className="balances-compact card">
            <div className="card-header">
              <div>
                <h3><i className="fi fi-rr-credit-card"></i>&nbsp;Group Balances</h3>
                <span className="card-subtitle">{balances.length} pending in this group</span>
                <div className="balance-scope-info">
                  <i className="fi fi-rr-info"></i>
                  <span>These balances show only expenses within this group</span>
                </div>
              </div>
              <div className="balance-controls">
                <button 
                  onClick={handleShowDetailedDebts}
                  className="button secondary small"
                  title="View detailed debt breakdown for this group"
                >
                  <i className="fi fi-rr-list"></i>&nbsp;Details
                </button>
                <button 
                  onClick={toggleGlobalComparison}
                  className={`button ${showGlobalComparison ? 'primary' : 'secondary'} small`}
                  title="Compare group balances with global balances"
                >
                  <i className="fi fi-rr-globe"></i> {showGlobalComparison ? 'Hide Global' : 'Show Global'}
                </button>
              </div>
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

        {/* Global Balance Comparison */}
        {showGlobalComparison && globalBalances.length > 0 && (
          <div className="global-comparison card">
            <div className="card-header">
              <div>
                <h3><i className="fi fi-rr-globe"></i>&nbsp;Global vs Group Balances</h3>
                <span className="card-subtitle">Compare balances across all groups vs this group only</span>
              </div>
            </div>
            <div className="comparison-content">
              <div className="comparison-explanation">
                <div className="comparison-info">
                  <i className="fi fi-rr-info"></i>
                  <div>
                    <strong>Why balances might differ:</strong>
                    <p>Global balances combine all your expenses across different groups, while group balances show only expenses within this specific group. If you share expenses with the same person in multiple groups, the totals will be different.</p>
                  </div>
                </div>
              </div>
              
              <div className="balance-comparison-grid">
                <div className="comparison-column">
                  <h4>This Group Only</h4>
                  <div className="balance-count">{balances.length} balances</div>
                </div>
                <div className="comparison-column">
                  <h4>All Groups Combined</h4>
                  <div className="balance-count">{globalBalances.length} balances</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="expenses-section">
        <div className="expenses-header">
          <div className="expenses-title-section">
            <h2>Expenses</h2>
            <span className="expenses-subtitle">
              {showCurrentMonthOnly ? (
                <span className="current-month-indicator">
                  <i className="fi fi-rr-calendar"></i> {getCurrentMonthName()} ({getFilteredExpenses().length} of {expenses.length} expenses)
                </span>
              ) : (
                <span className="all-time-indicator">
                  <i className="fi fi-rr-time-past"></i> All Time ({expenses.length} expenses)
                </span>
              )}
            </span>
          </div>
          <div className="expenses-header-actions">
            <button 
              onClick={() => setShowCurrentMonthOnly(!showCurrentMonthOnly)}
              className={`button ${showCurrentMonthOnly ? 'secondary' : 'primary'} small`}
              title={showCurrentMonthOnly ? 'Show all expenses' : 'Show current month only'}
            >
              <i className={`fi ${showCurrentMonthOnly ? 'fi-rr-time-past' : 'fi-rr-calendar'}`}></i>
              {showCurrentMonthOnly ? 'Show All Time' : 'Current Month'}
            </button>
            
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
        ) : showCurrentMonthOnly && getFilteredExpenses().length === 0 ? (
          <div className="no-current-month-expenses">
            <div className="empty-state">
              <i className="fi fi-rr-calendar-exclamation"></i>
              <h4>No expenses this month</h4>
              <p>There are no expenses recorded for {getCurrentMonthName()}.</p>
              <button 
                onClick={() => setShowCurrentMonthOnly(false)}
                className="button secondary small"
              >
                <i className="fi fi-rr-time-past"></i>
                View All Expenses
              </button>
            </div>
          </div>
        ) : (
          <div className="expenses-list">
            {sortedExpenses.map(item => {
              if (item.type === 'settlement') {
                // Render settlement
                return (
                  <div 
                    key={item.id} 
                    className="expense-card-compact card settlement-card"
                    style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #3b82f6' }}
                  >
                    <div className="expense-main">
                      {/* Date column on left */}
                      <div className="expense-date-column">
                        <div className="expense-month">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="expense-day">
                          {new Date(item.date).getDate()}
                        </div>
                      </div>
                      
                      {/* Main content */}
                      <div className="expense-content">
                        <div className="expense-header-row">
                          <h4 className="expense-title">
                            💰 {item.fromName || 'Unknown'} paid {item.toName || 'Unknown'}
                          </h4>
                          <div className="expense-user-balance-inline" style={{ color: '#3b82f6' }}>
                            {item.currency || 'TWD'} {item.amount.toFixed(2)}
                          </div>
                        </div>
                        
                        <div className="expense-footer-row">
                          <div className="expense-category-info">
                            <span style={{ 
                              padding: '4px 12px', 
                              backgroundColor: '#dbeafe', 
                              color: '#1e40af',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Settlement
                            </span>
                          </div>
                          {item.notes && (
                            <div className="expense-payer-amount" style={{ color: '#6b7280' }}>
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Render expense
              const expense = item;
              const userBalance = calculateUserExpenseBalance(expense);
              
              return (
                <Link 
                  key={expense.id} 
                  to={`/groups/${groupId}/expenses/${expense.id}`}
                  className="expense-card-compact card"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <div className="expense-main">
                    {/* Date column on left */}
                    <div className="expense-date-column">
                      <div className="expense-month">
                        {new Date(expense.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="expense-day">
                        {new Date(expense.date).getDate()}
                      </div>
                    </div>
                    
                    {/* Main content */}
                    <div className="expense-content">
                      <div className="expense-header-row">
                        <h4 className="expense-title">{expense.description}</h4>
                        {/* User's debt/credit */}
                        {userBalance && userBalance.type === 'debt' && (
                          <div className="expense-user-balance-inline">
                            You owe {userBalance.currency} {userBalance.amount.toFixed(2)}
                          </div>
                        )}
                        {userBalance && userBalance.type === 'credit' && (
                          <div className="expense-user-balance-inline credit">
                            You get back {userBalance.currency} {userBalance.amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="expense-footer-row">
                        <div className="expense-category-info">
                          <CategoryBadge category={expense.category} />
                        </div>
                        <div className="expense-payer-amount">
                          {expense.paidByName || 'Unknown'} Paid {expense.currency || 'TWD'} {expense.amount.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        
        {/* Load More Button */}
        {pagination && pagination.hasNextPage && (
          <div className="load-more-container">
            <button 
              onClick={loadMoreExpenses}
              disabled={loadingMore}
              className="button secondary load-more-btn"
            >
              {loadingMore ? (
                <>
                  <i className="fi fi-rr-spinner"></i>&nbsp;Loading...
                </>
              ) : (
                <>
                  <i className="fi fi-rr-arrow-down"></i>&nbsp;Load More Expenses
                </>
              )}
            </button>
            <div className="pagination-info">
              Showing {expenses.length} of {pagination.totalCount} expenses
            </div>
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
              {/* Edit Group Link */}
              <div className="settings-section">
                <h4><i className="fi fi-rr-edit"></i> Edit Group</h4>
                <p>Change group name, description, and photo</p>
                <Link 
                  to={`/groups/${groupId}/edit`}
                  className="btn btn-primary"
                  onClick={() => setShowGroupSettings(false)}
                >
                  <i className="fi fi-rr-edit"></i>&nbsp;Edit
                </Link>
              </div>

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
                  <i className="fi fi-rr-plus"></i>&nbsp;Add
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
                            <i className="fi fi-rr-trash"></i>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expense Splitting Settings */}
              <div className="settings-section">
                <h4><i className="fi fi-rr-target"></i> Debt Optimization</h4>
                <p>Configure how balances are calculated and displayed</p>
                <div className="splitting-options">
                  <label className="setting-option">
                    <input 
                      type="radio" 
                      name="debtOptimization" 
                      value="optimized"
                      checked={useOptimized}
                      onChange={() => setUseOptimized(true)}
                    />
                    <span>Optimized Transfers</span>
                    <small>Minimize the number of transactions needed to settle all debts</small>
                  </label>
                  <label className="setting-option">
                    <input 
                      type="radio" 
                      name="debtOptimization" 
                      value="direct"
                      checked={!useOptimized}
                      onChange={() => setUseOptimized(false)}
                    />
                    <span>Direct Transfers</span>
                    <small>Show direct transfers between each pair of people</small>
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

      {/* Detailed Group Debts Modal */}
      {showDetailedDebts && (
        <div className="modal-overlay">
          <div className="modal-content detailed-debts-modal">
            <div className="modal-header">
              <h3><i className="fi fi-rr-list"></i>&nbsp;Group Debt Details</h3>
              <button 
                onClick={() => setShowDetailedDebts(false)}
                className="close-btn"
                title="Close"
              >
                <i className="fi fi-rr-cross"></i>
              </button>
            </div>
            
            <div className="modal-body">
              {groupDebts.length > 0 ? (
                <div className="detailed-debts-container">
                  <div className="debt-explanation">
                    <p><i className="fi fi-rr-info"></i>&nbsp;This shows who owes money to whom within this group.</p>
                  </div>
                  
                  <div className="group-debts-list">
                    {groupDebts.map((debt, index) => (
                      <div key={index} className="group-debt-item">
                        <div className="debt-relationship">
                          <div className="debtor-info">
                            <UserPhoto user={debt.debtor} size="small" />
                            <div className="user-details">
                              <span className="user-name">{debt.debtor.name}</span>
                              <span className="user-role">owes</span>
                            </div>
                          </div>
                          
                          <div className="debt-arrow">
                            <i className="fi fi-rr-arrow-right"></i>
                          </div>
                          
                          <div className="creditor-info">
                            <UserPhoto user={debt.creditor} size="small" />
                            <div className="user-details">
                              <span className="user-name">{debt.creditor.name}</span>
                              <span className="user-role">receives</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="debt-amount-large">
                          <span className="amount">
                            {(() => {
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
                              return `${getCurrencySymbol(debt.currency)} ${debt.amount.toFixed(2)}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Summary */}
                  <div className="debt-summary">
                    <div className="summary-header">
                      <h4><i className="fi fi-rr-calculator"></i>&nbsp;Summary</h4>
                    </div>
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Debts:</span>
                        <span className="stat-value">{groupDebts.length}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Amount:</span>
                        <span className="stat-value">
                          {(() => {
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
                            
                            // Group by currency and sum
                            const currencyTotals = {};
                            groupDebts.forEach(debt => {
                              const currency = debt.currency || 'TWD';
                              if (!currencyTotals[currency]) {
                                currencyTotals[currency] = 0;
                              }
                              currencyTotals[currency] += debt.amount;
                            });
                            
                            // Display all currency totals
                            return Object.keys(currencyTotals).map(currency => 
                              `${getCurrencySymbol(currency)} ${currencyTotals[currency].toFixed(2)}`
                            ).join(', ');
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-debts-detail">
                  <i className="fi fi-rr-check-circle"></i>
                  <p>No outstanding debts in this group.</p>
                  <small>All members are settled up!</small>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowDetailedDebts(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
