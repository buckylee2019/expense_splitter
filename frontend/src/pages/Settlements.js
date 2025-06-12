import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Settlements.css';

const Settlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    toUserId: '',
    amount: '',
    currency: 'USD',
    groupId: '',
    method: 'cash',
    notes: '',
    expenseIds: []
  });

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [unsettledExpenses, setUnsettledExpenses] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching settlements data...');
      
      const [settlementsRes, groupsRes, balancesRes] = await Promise.all([
        api.get('/api/settlements'),
        api.get('/api/groups'),
        api.get('/api/balances')
      ]);
      
      console.log('Settlements data:', settlementsRes.data);
      console.log('Balances data:', balancesRes.data);
      
      setSettlements(settlementsRes.data);
      setGroups(groupsRes.data);
      setBalances(balancesRes.data.balances || []);
      setError('');
    } catch (err) {
      console.error('Error fetching settlements:', err);
      setError('Failed to load settlements data: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = async (groupId) => {
    try {
      // Get unsettled expenses for the group
      const response = await api.get(`/api/expenses?groupId=${groupId}&settled=false`);
      setUnsettledExpenses(response.data);
      
      // Get group details with member names
      const groupResponse = await api.get(`/api/groups/${groupId}`);
      setSelectedGroup(groupResponse.data);
      
      // Get balances for this specific group
      const balancesResponse = await api.get(`/api/balances?groupId=${groupId}`);
      const groupBalances = balancesResponse.data.balances || [];
      
      // Reset form data
      setFormData({
        toUserId: '',
        amount: '',
        currency: 'USD',
        groupId,
        method: 'cash',
        notes: '',
        expenseIds: []
      });
      
      // If there are balances, suggest the first one
      if (groupBalances.length > 0) {
        const firstBalance = groupBalances[0];
        
        if (firstBalance.type === 'you_owe') {
          // You owe someone else
          setFormData(prev => ({
            ...prev,
            toUserId: firstBalance.user.id,
            amount: firstBalance.amount.toFixed(2),
            notes: `Settling balance with ${firstBalance.user.name}`
          }));
        } else {
          // Someone owes you - don't auto-fill as they should be the one paying
        }
      }
    } catch (err) {
      console.error('Error loading group data:', err);
      setError('Failed to load group data');
    }
  };

  const handleUserChange = (userId) => {
    // Find the balance with this user
    const userBalance = balances.find(b => b.user.id === userId);
    
    if (userBalance) {
      // Auto-fill the amount based on the balance
      setFormData(prev => ({
        ...prev,
        toUserId: userId,
        amount: userBalance.amount.toFixed(2),
        notes: `Settling balance with ${userBalance.user.name}`
      }));
    } else {
      // Just update the user ID if no balance found
      setFormData(prev => ({
        ...prev,
        toUserId: userId
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Convert amount to number before sending to API
      const formDataWithNumberAmount = {
        ...formData,
        amount: parseFloat(formData.amount)
      };
      
      console.log('Submitting settlement:', formDataWithNumberAmount);
      const response = await api.post('/api/settlements', formDataWithNumberAmount);
      console.log('Settlement response:', response.data);
      
      // Show success message
      setSuccessMessage('Settlement recorded successfully!');
      
      // Refresh settlements list and balances
      await fetchData();
      
      // Reset form
      setFormData({
        toUserId: '',
        amount: '',
        currency: 'USD',
        groupId: '',
        method: 'cash',
        notes: '',
        expenseIds: []
      });
      setSelectedGroup(null);
      setUnsettledExpenses([]);
    } catch (err) {
      console.error('Settlement error:', err);
      setError(err.response?.data?.error || 'Failed to create settlement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settlements-page">
      <div className="page-header">
        <h1>Settlements</h1>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="settlements-grid">
        <div className="settlements-list card">
          <h2>Recent Settlements</h2>
          {loading && <div className="loading">Loading settlements...</div>}
          {!loading && settlements.length === 0 ? (
            <p className="no-settlements">No settlements yet</p>
          ) : (
            <div className="settlements-items">
              {settlements.map(settlement => {
                console.log('Settlement data:', settlement);
                return (
                  <div key={settlement.id || Math.random()} className="settlement-item">
                    <div className="settlement-header">
                      <span className="amount">
                        {settlement.currency} {typeof settlement.amount === 'number' ? settlement.amount.toFixed(2) : parseFloat(settlement.amount || 0).toFixed(2)}
                      </span>
                      <span className="date">
                        {new Date(settlement.settledAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="settlement-details">
                      <p>
                        <strong>From:</strong> {settlement.fromName || settlement.from}
                        <br />
                        <strong>To:</strong> {settlement.toName || settlement.to}
                      </p>
                      {settlement.notes && (
                        <p className="notes">{settlement.notes}</p>
                      )}
                      <span className="method">{settlement.method}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="create-settlement card">
          <h2>Record New Settlement</h2>
          <form onSubmit={handleSubmit} className="settlement-form">
            <div className="form-group">
              <label htmlFor="groupId">Group</label>
              <select
                id="groupId"
                value={formData.groupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select a group</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedGroup && (
              <>
                <div className="form-group">
                  <label htmlFor="toUserId">Pay To</label>
                  <select
                    id="toUserId"
                    value={formData.toUserId}
                    onChange={(e) => handleUserChange(e.target.value)}
                    required
                    disabled={loading}
                  >
                    <option value="">Select member</option>
                    {selectedGroup.members.map(member => (
                      <option key={member.user} value={member.user}>
                        {member.userName || member.user}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="amount">Amount</label>
                    <input
                      type="number"
                      id="amount"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        amount: e.target.value 
                      }))}
                      required
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="currency">Currency</label>
                    <select
                      id="currency"
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        currency: e.target.value 
                      }))}
                      disabled={loading}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="method">Payment Method</label>
                  <select
                    id="method"
                    value={formData.method}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      method: e.target.value 
                    }))}
                    disabled={loading}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="venmo">Venmo</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      notes: e.target.value 
                    }))}
                    placeholder="Add any notes about this settlement"
                    disabled={loading}
                  />
                </div>

                {unsettledExpenses.length > 0 && (
                  <div className="form-group">
                    <label>Related Expenses</label>
                    <div className="expenses-list">
                      {unsettledExpenses.map(expense => (
                        <label key={expense.id} className="expense-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.expenseIds.includes(expense.id)}
                            onChange={(e) => {
                              const newExpenseIds = e.target.checked
                                ? [...formData.expenseIds, expense.id]
                                : formData.expenseIds.filter(id => id !== expense.id);
                              setFormData(prev => ({ 
                                ...prev, 
                                expenseIds: newExpenseIds 
                              }));
                            }}
                            disabled={loading}
                          />
                          {expense.description} - {expense.currency} {expense.amount}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <button 
              type="submit" 
              className="button primary"
              disabled={!formData.groupId || !formData.toUserId || !formData.amount || loading}
            >
              {loading ? 'Processing...' : 'Record Settlement'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settlements;
