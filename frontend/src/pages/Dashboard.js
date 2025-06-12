import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';

const Dashboard = () => {
  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [balances, setBalances] = useState({ balances: [], summary: {} });
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

      // Fetch all data in parallel
      console.log('📊 Dashboard: Fetching groups, balances, and settlements...');
      const [groupsResponse, balancesResponse, settlementsResponse] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/balances'),
        api.get('/api/settlements').catch(err => {
          console.error('❌ Dashboard: Error fetching settlements:', err);
          return { data: [] }; // Return empty array on error to prevent breaking
        })
      ]);

      console.log('🏠 Dashboard: Groups loaded:', groupsResponse.data.length);
      console.log('💰 Dashboard: Balances loaded:', balancesResponse.data.balances?.length || 0);
      console.log('💵 Dashboard: Settlements loaded:', settlementsResponse.data?.length || 0);
      console.log('Settlement data:', settlementsResponse.data);
      
      setGroups(groupsResponse.data);
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

  // Add a manual refresh function
  const handleRefresh = () => {
    fetchData();
  };

  if (loading) {
    return <div className="loading">Loading your dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const totalOwed = balances.summary.totalOwed || 0;
  const totalOwing = balances.summary.totalOwing || 0;
  const netBalance = totalOwed - totalOwing;

  // Get recent settlements (last 5)
  // const recentSettlements = settlements.slice(0, 5);
  console.log('Dashboard render - settlements data:', settlements);

  return (
    <div className="dashboard">
      {successMessage && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}
      
      {lastRefresh && (
        <div className="last-refresh">
          <small>Last updated: {lastRefresh.toLocaleTimeString()}</small>
        </div>
      )}
      
      <div className="dashboard-header">
        <div>
          <h1>💰 Welcome to ExpenseSplitter</h1>
          <p className="mb-0">Manage your shared expenses with ease</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleRefresh} 
            className="button secondary"
            disabled={loading}
            title="Refresh dashboard data"
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link to="/groups/create" className="button primary large">
            ➕ Create New Group
          </Link>
        </div>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>💚 Money Owed to You</h3>
          <div className="balance-details">
            <p className="owed">${totalOwed.toFixed(2)}</p>
            <small>Amount others owe you</small>
          </div>
        </div>
        
        <div className="summary-card">
          <h3>💸 Money You Owe</h3>
          <div className="balance-details">
            <p className="owing">${totalOwing.toFixed(2)}</p>
            <small>Amount you owe others</small>
          </div>
        </div>
        
        <div className="summary-card">
          <h3>⚖️ Net Balance</h3>
          <div className="balance-details">
            <p className={netBalance >= 0 ? 'owed' : 'owing'}>
              {netBalance >= 0 ? '+' : ''}${netBalance.toFixed(2)}
            </p>
            <small>
              {netBalance >= 0 ? 'You are owed overall' : 'You owe overall'}
            </small>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="groups-section">
          <div className="card-header">
            <h2>🏠 Your Groups</h2>
            <span className="card-subtitle">{groups.length} groups</span>
          </div>
          
          {groups.length === 0 ? (
            <div className="no-groups">
              <h3>🎯 Ready to start splitting expenses?</h3>
              <p>Create your first group to begin tracking shared expenses with friends, family, or roommates.</p>
              <Link to="/groups/create" className="button primary large mt-lg">
                🚀 Create Your First Group
              </Link>
            </div>
          ) : (
            <div className="groups-grid">
              {groups.map(group => (
                <Link 
                  to={`/groups/${group.id}`} 
                  key={group.id} 
                  className="group-card"
                >
                  <h3>🏠 {group.name}</h3>
                  <p>{group.description || 'No description provided'}</p>
                  <div className="group-meta">
                    <span>👥 {group.members.length} members</span>
                    {group.isActive && <span className="active-badge">✅ Active</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="settlements-section">
          <div className="card">
            <div className="card-header">
              <h2>💵 Recent Settlements</h2>
              <Link to="/settlements" className="view-all-link">View All</Link>
            </div>
            
            {settlements && settlements.length > 0 ? (
              <div className="settlements-list">
                {settlements.slice(0, 5).map((settlement, index) => (
                  <div key={settlement.id || index} className="settlement-item-compact">
                    <div className="settlement-info">
                      <div className="settlement-amount">
                        {settlement.currency} {parseFloat(settlement.amount).toFixed(2)}
                      </div>
                      <div className="settlement-users">
                        <span className="from-user">From: {settlement.from}</span>
                        <span className="to-user">To: {settlement.to}</span>
                      </div>
                    </div>
                    <div className="settlement-meta">
                      <span className="settlement-date">
                        {new Date(settlement.settledAt).toLocaleDateString()}
                      </span>
                      <span className="settlement-method">{settlement.method}</span>
                    </div>
                  </div>
                ))}
                <div className="view-all-settlements">
                  <Link to="/settlements" className="button secondary">
                    View All Settlements
                  </Link>
                </div>
              </div>
            ) : (
              <div className="no-settlements">
                <p>No settlements recorded yet.</p>
                <Link to="/settlements" className="button secondary">
                  Record a Settlement
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {balances.balances.length > 0 && (
        <div className="balances-section">
          <div className="card">
            <div className="card-header">
              <h2>💳 Outstanding Balances</h2>
              <span className="card-subtitle">{balances.balances.length} pending</span>
            </div>
            <div className="balances-list">
              {balances.balances.map((balance, index) => (
                <div key={index} className={`balance-item card ${balance.type}`}>
                  <div className="balance-info">
                    <span className="user">
                      {balance.type === 'owes_you' ? 
                        `💚 ${balance.user.name} owes you` : 
                        `💸 You owe ${balance.user.name}`}
                    </span>
                    <small className="balance-note">
                      {balance.type === 'owes_you' ? 
                        'They should pay you' : 
                        'You should pay them'}
                    </small>
                  </div>
                  <div className="balance-amount">
                    <span className="amount">
                      ${balance.amount.toFixed(2)}
                    </span>
                    <Link to="/settlements" className="settle-button">
                      Settle
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <div className="card">
          <div className="card-header">
            <h3>⚡ Quick Actions</h3>
          </div>
          <div className="actions-grid">
            <Link to="/groups/create" className="action-card">
              <div className="action-icon">🏠</div>
              <h4>Create Group</h4>
              <p>Start a new expense group</p>
            </Link>
            <Link to="/settlements" className="action-card">
              <div className="action-icon">💰</div>
              <h4>Record Settlement</h4>
              <p>Mark a debt as paid</p>
            </Link>
            <div className="action-card disabled">
              <div className="action-icon">📊</div>
              <h4>Reports</h4>
              <p>Coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
