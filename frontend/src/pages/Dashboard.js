import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import UserPhoto from '../components/UserPhoto';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [balances, setBalances] = useState({ balances: [], summary: {} });
  const [useOptimized, setUseOptimized] = useState(true); // Default to optimized
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Dashboard: Starting data fetch...');
      
      // Get current user info
      const userRes = await api.get('/api/users/profile');
      console.log('👤 Dashboard: Current user loaded:', userRes.data);

      // Fetch balances and settlements
      console.log('📊 Dashboard: Fetching balances and settlements...');
      const [balancesResponse, settlementsResponse] = await Promise.all([
        api.get(`/api/balances${useOptimized ? '?optimized=true' : ''}`),
        api.get('/api/settlements').catch(err => {
          console.error('❌ Dashboard: Error fetching settlements:', err);
          return { data: [] }; // Return empty array on error to prevent breaking
        })
      ]);

      console.log('💰 Dashboard: Balances loaded:', balancesResponse.data.balances?.length || 0);
      console.log('💵 Dashboard: Settlements loaded:', settlementsResponse.data?.length || 0);
      
      setBalances(balancesResponse.data);
      setSettlements(Array.isArray(settlementsResponse.data) ? settlementsResponse.data : []);
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      console.error('❌ Dashboard: Error loading dashboard data:', err);
      setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for success message from navigation state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    fetchData();
  }, [location.state?.message]);

  // Refresh data when navigating back to dashboard
  useEffect(() => {
    const handlePopState = () => {
      console.log('Navigation detected, refreshing dashboard...');
      fetchData();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Add event listener to refresh data when user returns to the tab/window
  useEffect(() => {
    const handleFocus = () => {
      console.log('Dashboard focused, refreshing data...');
      fetchData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Dashboard visible, refreshing data...');
        fetchData();
      }
    };

    // Refresh when window gains focus
    window.addEventListener('focus', handleFocus);
    // Refresh when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Toggle between optimized and original balance calculation
  const toggleOptimization = () => {
    setUseOptimized(!useOptimized);
    // Refresh data with new optimization setting
    setTimeout(() => fetchData(), 100);
  };

  if (loading) {
    return <div className="loading">Loading your dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // Get recent settlements (last 5)
  // const recentSettlements = settlements.slice(0, 5);
  console.log('Dashboard render - settlements data:', settlements);

  return (
    <div className="dashboard">
      {/* Welcome Header */}
      <div className="dashboard-welcome">
        <div className="welcome-content">
          <UserPhoto user={user} size="small" className="welcome-user-photo" />
          <div className="welcome-text">
            <h1>Welcome back, {user?.name?.split(' ')[0] || 'User'}!</h1>
            <p>Here's your expense overview</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="success-message">
          <i className="fi fi-rr-check"></i> {successMessage}
        </div>
      )}
      
      {lastRefresh && (
        <div className="last-refresh">
          <small>Last updated: {lastRefresh.toLocaleTimeString()}</small>
        </div>
      )}

      {balances.balances.length > 0 ? (
        <div className="balances-section">
          <div className="card">
            <div className="card-header">
              <div>
                <h2><i className="fi fi-rr-credit-card"></i> Outstanding Balances</h2>
                <span className="card-subtitle">{balances.balances.length} pending</span>
              </div>
              <div className="balance-controls">
                <button 
                  onClick={toggleOptimization}
                  className={`button ${useOptimized ? 'primary' : 'secondary'} small`}
                  title={useOptimized ? 'Using optimized transfers (fewer transactions)' : 'Using direct transfers'}
                >
                  {useOptimized ? <><i className="fi fi-rr-target"></i> Optimized</> : <><i className="fi fi-rr-chart-pie"></i> Direct</>}
                </button>
              </div>
            </div>
            
            <div className="balances-container">
              {/* Balance Summary */}
              <div className="balance-summary-header">
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

                  // Group balances by currency and calculate net for each
                  const currencyBalances = {};
                  
                  balances.balances.forEach(balance => {
                    const currency = balance.currency || 'TWD';
                    if (!currencyBalances[currency]) {
                      currencyBalances[currency] = { owed: 0, owing: 0 };
                    }
                    
                    if (balance.type === 'owes_you') {
                      currencyBalances[currency].owed += balance.amount;
                    } else {
                      currencyBalances[currency].owing += balance.amount;
                    }
                  });
                  
                  // Calculate net balances per currency
                  const netBalances = {};
                  let hasPositive = false;
                  let hasNegative = false;
                  
                  Object.keys(currencyBalances).forEach(currency => {
                    const net = currencyBalances[currency].owed - currencyBalances[currency].owing;
                    if (Math.abs(net) > 0.01) { // Only include significant amounts
                      netBalances[currency] = net;
                      if (net > 0) hasPositive = true;
                      if (net < 0) hasNegative = true;
                    }
                  });
                  
                  const currencies = Object.keys(netBalances);
                  
                  if (currencies.length === 0) {
                    return (
                      <>
                        <h3>You're all settled up</h3>
                        <div className="total-owed-amount neutral">
                          No outstanding balances
                        </div>
                      </>
                    );
                  }
                  
                  // Determine overall message
                  let headerText = '';
                  if (hasPositive && !hasNegative) {
                    headerText = 'Overall, you are owed';
                  } else if (hasNegative && !hasPositive) {
                    headerText = 'Overall, you owe';
                  } else {
                    headerText = 'Your balance summary';
                  }
                  
                  return (
                    <>
                      <h3>{headerText}</h3>
                      <div className="multi-currency-amounts">
                        {currencies.map((currency, index) => {
                          const amount = netBalances[currency];
                          const isPositive = amount > 0;
                          const displayAmount = Math.abs(amount);
                          
                          return (
                            <span key={currency} className="currency-amount">
                              <span className={`amount-value ${isPositive ? 'positive' : 'negative'}`}>
                                {getCurrencySymbol(currency)} {displayAmount.toFixed(2)}
                              </span>
                              {index < currencies.length - 1 && (
                                <span className="currency-separator"> + </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Individual Balance Items */}
              <div className="balance-items-list">
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
                  
                  balances.balances.forEach(balance => {
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

                  return Object.values(userBalances).map((userBalance, index) => {
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
                      <div key={userBalance.user.id} className="balance-item-modern">
                        <div className="balance-user-info">
                          <UserPhoto user={userBalance.user} size="small" />
                          <div className="balance-user-details">
                            <span className="user-name">{userBalance.user.name}</span>
                            <span className="balance-description">
                              {userCurrencies.some(c => c.type === 'owes_you') && userCurrencies.some(c => c.type === 'you_owe')
                                ? 'mixed balances'
                                : userCurrencies[0].type === 'owes_you' ? 'owes you' : 'you owe'
                              }
                            </span>
                          </div>
                        </div>
                        <div className="balance-amount-modern">
                          <div className="multi-currency-user-amounts">
                            {userCurrencies.map((currencyBalance, currIndex) => (
                              <span 
                                key={currencyBalance.currency} 
                                className={`amount-value ${currencyBalance.type}`}
                              >
                                {getCurrencySymbol(currencyBalance.currency)} {currencyBalance.amount.toFixed(2)}
                                {currIndex < userCurrencies.length - 1 && (
                                  <span className="currency-separator-small"> + </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }).filter(Boolean);
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-balances">
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fi fi-rr-credit-card"></i>
              </div>
              <h3>No Outstanding Balances</h3>
              <p>You're all settled up! When you have shared expenses, they'll appear here.</p>
              <div className="empty-actions">
                <Link to="/groups" className="button primary">
                  <i className="fi fi-rr-home"></i> View Groups
                </Link>
                <Link to="/groups/create" className="button secondary">
                  <i className="fi fi-rr-plus"></i> Create Group
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
