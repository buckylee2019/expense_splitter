import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Settlements.css';

const Settlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fromUserId: '', // Added for two-way settlement
    toUserId: '',
    amount: '',
    currency: 'TWD',
    groupId: '',
    method: 'cash',
    notes: '',
    isThirdPartySettlement: false // Flag for third-party settlements
  });

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [balances, setBalances] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [editingSettlement, setEditingSettlement] = useState(null);
  const [editFormData, setEditFormData] = useState({
    fromUserId: '',
    toUserId: '',
    amount: '',
    currency: 'TWD',
    groupId: '',
    method: 'cash',
    notes: '',
    isThirdPartySettlement: false
  });
  const [groupMembers, setGroupMembers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching settlements data...');
      
      const [settlementsRes, groupsRes, balancesRes, userRes] = await Promise.all([
        api.get('/api/settlements'),
        api.get('/api/groups'),
        api.get('/api/balances'),
        api.get('/api/users/profile')
      ]);
      
      console.log('Settlements data:', settlementsRes.data);
      console.log('Balances data:', balancesRes.data);
      console.log('Current user:', userRes.data);
      
      setSettlements(settlementsRes.data);
      setGroups(groupsRes.data);
      setBalances(balancesRes.data.balances || []);
      setCurrentUser(userRes.data);
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
      // Get group details with member names
      const groupResponse = await api.get(`/api/groups/${groupId}`);
      setSelectedGroup(groupResponse.data);
      
      // Get balances for this specific group
      const balancesResponse = await api.get(`/api/balances?groupId=${groupId}`);
      const groupBalances = balancesResponse.data.balances || [];
      
      // Reset form data
      setFormData({
        fromUserId: currentUser?.id || '',
        toUserId: '',
        amount: '',
        currency: 'TWD',
        groupId,
        method: 'cash',
        notes: '',
        isThirdPartySettlement: false
      });
      
      // If there are balances, suggest the first one
      if (groupBalances.length > 0) {
        const firstBalance = groupBalances[0];
        
        if (firstBalance.type === 'you_owe') {
          // You owe someone else
          const userName = selectedGroup?.members?.find(m => m.user === firstBalance.user.id)?.userName || 
                          selectedGroup?.members?.find(m => m.user === firstBalance.user.id)?.name || 
                          selectedGroup?.members?.find(m => m.user === firstBalance.user.id)?.email || 
                          firstBalance.user.id;
          
          setFormData(prev => ({
            ...prev,
            toUserId: firstBalance.user.id,
            amount: firstBalance.amount.toFixed(2),
            notes: `Settling balance with ${userName}`
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

  const handleUserChange = (userId, field) => {
    if (field === 'toUserId') {
      // Find the balance with this user
      const userBalance = balances.find(b => b.user.id === userId);
      
      if (userBalance) {
        // Auto-fill the amount based on the balance
        const userName = selectedGroup?.members?.find(m => m.user === userId)?.userName || 
                        selectedGroup?.members?.find(m => m.user === userId)?.name || 
                        selectedGroup?.members?.find(m => m.user === userId)?.email || userId;
        
        setFormData(prev => ({
          ...prev,
          toUserId: userId,
          amount: userBalance.amount.toFixed(2),
          notes: `Settling balance with ${userName}`
        }));
      } else {
        // Just update the user ID if no balance found
        setFormData(prev => ({
          ...prev,
          toUserId: userId
        }));
      }
    } else if (field === 'fromUserId') {
      // Update the from user ID
      setFormData(prev => ({
        ...prev,
        fromUserId: userId
      }));
    }
  };

  const toggleThirdPartySettlement = () => {
    setFormData(prev => {
      const isThirdParty = !prev.isThirdPartySettlement;
      
      // If switching to third-party mode, set fromUserId to empty
      // If switching back to normal mode, set fromUserId to current user
      return {
        ...prev,
        isThirdPartySettlement: isThirdParty,
        fromUserId: isThirdParty ? '' : (currentUser?.id || '')
      };
    });
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (window.confirm('Are you sure you want to delete this settlement? This action cannot be undone.')) {
      try {
        await api.delete(`/api/settlements/${settlementId}`);
        setSuccessMessage('Settlement deleted successfully');
        fetchData(); // Refresh the data
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error deleting settlement:', error);
        setError(error.response?.data?.error || 'Failed to delete settlement');
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const handleEditSettlement = async (settlement) => {
    console.log('Edit settlement:', settlement);
    const group = groups.find(g => g.id === settlement.group);
    console.log('Group found:', group);
    
    // Fetch user details for group members
    const membersWithNames = await Promise.all(
      group.members.map(async (member) => {
        console.log('Processing member:', member);
        try {
          const userResponse = await api.get(`/api/users/${member.user}`);
          console.log('User API response:', userResponse.data);
          const memberWithName = {
            ...member,
            userName: userResponse.data.name || userResponse.data.email
          };
          console.log('Member with name:', memberWithName);
          return memberWithName;
        } catch (error) {
          console.error('Error fetching user:', member.user, error);
          return {
            ...member,
            userName: member.user
          };
        }
      })
    );
    
    console.log('Final membersWithNames:', membersWithNames);
    
    setEditingSettlement(settlement);
    setSelectedGroup(group);
    setGroupMembers(membersWithNames);
    setEditFormData({
      fromUserId: settlement.from,
      toUserId: settlement.to,
      amount: settlement.amount.toString(),
      currency: settlement.currency || 'TWD',
      groupId: settlement.group,
      method: settlement.method || 'cash',
      notes: settlement.notes || '',
      isThirdPartySettlement: settlement.from !== currentUser?.id
    });
  };

  const handleUpdateSettlement = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/settlements/${editingSettlement.id}`, editFormData);
      setSuccessMessage('Settlement updated successfully');
      setEditingSettlement(null);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Update error:', err);
      setError(err.response?.data?.error || 'Failed to update settlement');
    }
  };

  const cancelEdit = () => {
    setEditingSettlement(null);
    setSelectedGroup(null);
    setEditFormData({
      fromUserId: '',
      toUserId: '',
      amount: '',
      currency: 'TWD',
      groupId: '',
      method: 'cash',
      notes: '',
      isThirdPartySettlement: false
    });
  };

  const handleSubmit = async (e) => {
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Prepare data for API call
      const settlementData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };
      
      // If it's a third-party settlement, include fromUserId
      // Otherwise, the backend will use the current user's ID
      if (formData.isThirdPartySettlement) {
        if (!formData.fromUserId) {
          throw new Error('Please select who is paying');
        }
      } else {
        // For regular settlements, remove fromUserId as the backend will use the current user
        delete settlementData.fromUserId;
      }
      
      // Remove the flag as it's not needed by the API
      delete settlementData.isThirdPartySettlement;
      
      console.log('Submitting settlement:', settlementData);
      const response = await api.post('/api/settlements', settlementData);
      console.log('Settlement response:', response.data);
      
      // Show success message
      setSuccessMessage('Settlement recorded successfully!');
      
      // Refresh settlements list and balances
      await fetchData();
      
      // Reset form
      setFormData({
        fromUserId: currentUser?.id || '',
        toUserId: '',
        amount: '',
        currency: 'TWD',
        groupId: '',
        method: 'cash',
        notes: '',
        isThirdPartySettlement: false
      });
      setSelectedGroup(null);
    } catch (err) {
      console.error('Settlement error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create settlement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settlements-page">
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
                      <div className="settlement-actions">
                        <span className="date">
                          {new Date(settlement.settledAt).toLocaleDateString()}
                        </span>
                        {(settlement.recordedBy === currentUser?.id || settlement.from === currentUser?.id || settlement.to === currentUser?.id) && (
                          <button
                            onClick={() => handleEditSettlement(settlement)}
                            className="btn btn-sm btn-secondary edit-settlement-btn"
                            title="Edit settlement"
                          >
                            <i className="fi fi-rr-edit"></i>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSettlement(settlement.id)}
                          className="btn btn-sm btn-danger delete-settlement-btn"
                          title="Delete settlement"
                        >
                          <i className="fi fi-rr-trash"></i>
                        </button>
                      </div>
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
                <div className="form-group settlement-type-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isThirdPartySettlement}
                      onChange={toggleThirdPartySettlement}
                      disabled={loading}
                    />
                    Record settlement for other group members
                  </label>
                </div>

                {formData.isThirdPartySettlement && (
                  <div className="form-group">
                    <label htmlFor="fromUserId">From (Who is paying)</label>
                    <select
                      id="fromUserId"
                      value={formData.fromUserId}
                      onChange={(e) => handleUserChange(e.target.value, 'fromUserId')}
                      required
                      disabled={loading}
                    >
                      <option value="">Select who is paying</option>
                      {selectedGroup.members.map(member => (
                        <option key={member.user} value={member.user}>
                          {member.userName || member.name || member.email || member.user}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="toUserId">Pay To</label>
                  <select
                    id="toUserId"
                    value={formData.toUserId}
                    onChange={(e) => handleUserChange(e.target.value, 'toUserId')}
                    required
                    disabled={loading}
                  >
                    <option value="">Select member</option>
                    {selectedGroup.members.map(member => (
                      <option key={member.user} value={member.user}>
                        {member.userName || member.name || member.email || member.user}
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
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="TWD">TWD - Taiwan Dollar</option>
                      <option value="JPY">JPY - Japanese Yen</option>
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
                    <option value="line_pay">Line Pay</option>
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
              </>
            )}

            <button 
              type="submit" 
              className="button primary"
              disabled={!formData.groupId || !formData.toUserId || !formData.amount || 
                (formData.isThirdPartySettlement && !formData.fromUserId) || loading}
            >
              {loading ? 'Processing...' : 'Record Settlement'}
            </button>
          </form>
        </div>
      </div>

      {/* Edit Settlement Modal */}
      {editingSettlement && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Settlement</h3>
            <form onSubmit={handleUpdateSettlement}>
              <div className="form-group">
                <label htmlFor="edit-group">Group</label>
                <select
                  id="edit-group"
                  value={editFormData.groupId}
                  onChange={(e) => {
                    const selectedGroup = groups.find(g => g.id === e.target.value);
                    setEditFormData(prev => ({ ...prev, groupId: e.target.value }));
                    setSelectedGroup(selectedGroup);
                  }}
                  required
                  disabled
                >
                  <option value="">Select a group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editFormData.isThirdPartySettlement}
                    onChange={(e) => setEditFormData(prev => ({ 
                      ...prev, 
                      isThirdPartySettlement: e.target.checked,
                      fromUserId: e.target.checked ? '' : currentUser?.id || ''
                    }))}
                  />
                  Third-party settlement (someone else paid)
                </label>
              </div>

              {editFormData.isThirdPartySettlement && (
                <div className="form-group">
                  <label htmlFor="edit-from-user">Who paid?</label>
                  <select
                    id="edit-from-user"
                    value={editFormData.fromUserId}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, fromUserId: e.target.value }))}
                    required
                  >
                    <option value="">Select who paid</option>
                    {groupMembers.map(member => (
                      <option key={member.user} value={member.user}>
                        {member.userName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="edit-to-user">Who received the payment?</label>
                <select
                  id="edit-to-user"
                  value={editFormData.toUserId}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, toUserId: e.target.value }))}
                  required
                >
                  <option value="">Select recipient</option>
                  {groupMembers.map(member => (
                    <option key={member.user} value={member.user}>
                      {member.userName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-amount">Amount</label>
                  <input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-currency">Currency</label>
                  <select
                    id="edit-currency"
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, currency: e.target.value }))}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="TWD">TWD - Taiwan Dollar</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-method">Payment Method</label>
                <select
                  id="edit-method"
                  value={editFormData.method}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, method: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="line_pay">Line Pay</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-notes">Notes</label>
                <textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this settlement"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={cancelEdit} className="btn btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!editFormData.groupId || !editFormData.toUserId || !editFormData.amount || 
                    (editFormData.isThirdPartySettlement && !editFormData.fromUserId)}
                >
                  Update Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlements;
