import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import UserPhoto from '../components/UserPhoto';
import SettlementModal from '../components/SettlementModal';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const location = useLocation();
  const { user: authUser, updateUser } = useAuth();
  const [user, setUser] = useState(authUser);
  const [balances, setBalances] = useState({ balances: [], summary: {} });
  const [groupBalances, setGroupBalances] = useState([]);
  const [useOptimized, setUseOptimized] = useState(true);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
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
      setUser(userRes.data);
      updateUser(userRes.data);

      // Fetch group-specific balances by finding groups where user is a member
      console.log('🏢 Dashboard: Fetching user groups and balances...');
      try {
        // Get all groups where user is a member
        const userGroupsResponse = await api.get('/api/groups');
        const userGroups = userGroupsResponse.data || [];
        console.log('🏢 Found', userGroups.length, 'groups where user is a member');
        
        if (userGroups.length > 0) {
          const groupBalancePromises = userGroups.map(async (group) => {
            try {
              console.log(`🔍 Fetching balances for group ${group.id} (${group.name})...`);
              const balanceResponse = await api.get(`/api/balances?groupId=${group.id}${useOptimized ? '&optimized=true' : ''}`);
              
              console.log(`📊 Group ${group.name}:`, balanceResponse.data.balances?.length || 0, 'balances');
              
              if (balanceResponse.data.balances && balanceResponse.data.balances.length > 0) {
                return {
                  groupId: group.id,
                  groupName: group.name,
                  balances: balanceResponse.data.balances,
                  summary: balanceResponse.data.summary
                };
              }
              return null;
            } catch (error) {
              console.error(`❌ Error fetching balances for group ${group.id}:`, error);
              return null;
            }
          });

          const groupBalanceResults = await Promise.all(groupBalancePromises);
          const filteredResults = groupBalanceResults.filter(Boolean);
          console.log('🏢 Final group balances:', filteredResults.length, 'groups with balances');
          setGroupBalances(filteredResults);
          
          // Set a dummy balances object to show the section
          setBalances({ 
            balances: filteredResults.flatMap(g => g.balances), 
            summary: {} 
          });
        } else {
          console.log('🏢 No groups found for user');
          setGroupBalances([]);
          setBalances({ balances: [], summary: {} });
        }
      } catch (error) {
        console.error('❌ Error fetching user groups:', error);
        setGroupBalances([]);
        setBalances({ balances: [], summary: {} });
      }

      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      console.error('❌ Dashboard: Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const toggleOptimization = () => {
    setUseOptimized(!useOptimized);
  };

  const handleGroupSettleClick = (groupBalance) => {
    // Use the first balance in the group for settlement
    if (groupBalance.balances.length > 0) {
      setSelectedBalance({
        ...groupBalance.balances[0],
        groupId: groupBalance.groupId
      });
      setShowSettlementModal(true);
    }
  };

  const handleSettlementComplete = () => {
    setShowSettlementModal(false);
    setSelectedBalance(null);
    setSuccessMessage('Settlement recorded successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchData(); // Refresh data
  };

  useEffect(() => {
    fetchData();
  }, [useOptimized]);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      setTimeout(() => setSuccessMessage(''), 5000);
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">
          <i className="fi fi-rr-spinner"></i>
        </div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-message">
          <i className="fi fi-rr-exclamation"></i>
          <p>{error}</p>
          <button onClick={fetchData} className="button primary">
            <i className="fi fi-rr-refresh"></i> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-section">
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
                <span className="card-subtitle">{balances.balances.length} pending across all groups</span>
                <div className="balance-scope-info">
                  <i className="fi fi-rr-info"></i>
                  <span>These balances are organized by group</span>
                </div>
              </div>
              <div className="balance-controls">
                <button 
                  onClick={toggleOptimization}
                  className={`button ${useOptimized ? 'primary' : 'secondary'} small`}
                  title={useOptimized ? 'Using optimized transfers (aggregates debts across groups for fewer transactions)' : 'Using direct transfers (shows individual debt per expense)'}
                >
                  {useOptimized ? <><i className="fi fi-rr-target"></i> Optimized</> : <><i className="fi fi-rr-chart-pie"></i> Direct</>}
                </button>
              </div>
            </div>
            
            <div className="balances-container">
              <div className="group-balances">
                {groupBalances.length === 0 ? (
                  <div className="no-group-balances">
                    <p>No outstanding balances in any groups</p>
                  </div>
                ) : (
                  groupBalances.map(groupBalance => (
                    <div key={groupBalance.groupId} className="group-balance-section">
                      <div className="group-balance-header">
                        <h3>{groupBalance.groupName}</h3>
                        <div className="group-header-actions">
                          <span className="group-balance-count">{groupBalance.balances.length} balances</span>
                          <button 
                            className="button primary small"
                            onClick={() => handleGroupSettleClick(groupBalance)}
                            title="Settle all balances in this group"
                          >
                            <i className="fi fi-rr-hand-holding-usd"></i>
                            Settle Group
                          </button>
                        </div>
                      </div>
                      <div className="group-balance-items">
                        {groupBalance.balances.map(balance => (
                          <div key={`${balance.user.id}-${balance.currency}`} className="balance-item-modern">
                            <div className="balance-user-info">
                              <UserPhoto user={balance.user} size="small" />
                              <div className="balance-user-details">
                                <span className="user-name">{balance.user.name}</span>
                                <span className={`balance-amount ${balance.type}`}>
                                  {balance.type === 'owes_you' ? 'owes you ' : 'you owe '}
                                  {balance.currency || 'TWD'} {balance.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
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

      {/* Settlement Modal */}
      {showSettlementModal && selectedBalance && (
        <SettlementModal
          balance={selectedBalance}
          groupId={selectedBalance.groupId}
          currentUser={user}
          onComplete={handleSettlementComplete}
          onCancel={() => setShowSettlementModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
