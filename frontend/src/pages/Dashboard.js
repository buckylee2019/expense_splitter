import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import UserPhoto from '../components/UserPhoto';

const Dashboard = () => {
  const location = useLocation();
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
                  // Calculate net balance
                  const totalOwed = balances.summary.totalOwed || 0;
                  const totalOwing = balances.summary.totalOwing || 0;
                  const netBalance = totalOwed - totalOwing;
                  
                  if (netBalance > 0) {
                    return (
                      <>
                        <h3>Overall, you are owed</h3>
                        <div className="total-owed-amount positive">
                          TWD {netBalance.toFixed(2)}
                        </div>
                      </>
                    );
                  } else if (netBalance < 0) {
                    return (
                      <>
                        <h3>Overall, you owe</h3>
                        <div className="total-owed-amount negative">
                          TWD {Math.abs(netBalance).toFixed(2)}
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <h3>You're all settled up</h3>
                        <div className="total-owed-amount neutral">
                          TWD 0.00
                        </div>
                      </>
                    );
                  }
                })()}
              </div>

              {/* Individual Balance Items */}
              <div className="balance-items-list">
                {balances.balances.map((balance, index) => (
                  <div key={index} className={`balance-item-modern ${balance.type}`}>
                    <div className="balance-user-info">
                      <UserPhoto user={balance.user} size="small" />
                      <div className="balance-user-details">
                        <span className="user-name">{balance.user.name}</span>
                        <span className="balance-description">
                          {balance.type === 'owes_you' ? 'owes you' : 'you owe'}
                        </span>
                      </div>
                    </div>
                    <div className="balance-amount-modern">
                      <span className={`amount-value ${balance.type}`}>
                        {balance.currency || 'TWD'} {balance.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
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
