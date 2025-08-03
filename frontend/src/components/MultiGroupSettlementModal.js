import React, { useState, useEffect } from 'react';
import api from '../services/api';

const MultiGroupSettlementModal = ({ userBalance, currentUser, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupBreakdown, setGroupBreakdown] = useState([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);

  // Fetch the group breakdown for this user balance
  useEffect(() => {
    const fetchGroupBreakdown = async () => {
      try {
        setLoadingBreakdown(true);
        const response = await api.get(`/api/balances/breakdown/${userBalance.user.id}`);
        setGroupBreakdown(response.data.groups || []);
        
        // Calculate total amount from all currencies
        const totalAmount = userBalance.currencies.reduce((sum, curr) => sum + curr.amount, 0);
        setFormData(prev => ({
          ...prev,
          amount: totalAmount.toFixed(2),
          notes: `Multi-group settlement with ${userBalance.user.name}`
        }));
      } catch (err) {
        console.error('Error fetching group breakdown:', err);
        setError('Failed to load group breakdown');
      } finally {
        setLoadingBreakdown(false);
      }
    };

    if (userBalance && currentUser) {
      fetchGroupBreakdown();
    }
  }, [userBalance, currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Determine payment direction based on balance types
      const isUserOwing = userBalance.currencies.some(c => c.type === 'you_owe');
      
      // Create multi-group settlement
      const settlementData = {
        // If current user owes money, they pay to the other user
        // If other user owes money, they pay to the current user
        fromUserId: isUserOwing ? currentUser.id : userBalance.user.id,
        toUserId: isUserOwing ? userBalance.user.id : currentUser.id,
        amount: parseFloat(formData.amount),
        method: formData.method,
        notes: formData.notes,
        isMultiGroup: true,
        currencies: userBalance.currencies
      };

      await api.post('/api/settlements/multi-group', settlementData);
      onComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const isUserOwing = userBalance.currencies.some(c => c.type === 'you_owe');
  const fromUserName = isUserOwing ? 'You' : userBalance.user.name;
  const toUserName = isUserOwing ? userBalance.user.name : 'You';

  return (
    <div className="modal-overlay">
      <div className="modal-content settlement-modal multi-group-settlement">
        <div className="modal-header">
          <h3><i className="fi fi-rr-hand-holding-usd"></i> Record Multi-Group Settlement</h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="settlement-summary">
          <div className="settlement-info">
            <span className="from-to">
              <strong>{fromUserName}</strong> pays <strong>{toUserName}</strong>
            </span>
            <div className="multi-currency-amounts">
              {userBalance.currencies.map((curr, index) => (
                <span key={curr.currency} className={`amount-display ${curr.type}`}>
                  {curr.currency} {curr.amount.toFixed(2)}
                  {index < userBalance.currencies.length - 1 && <span className="currency-separator"> + </span>}
                </span>
              ))}
            </div>
          </div>
          
          <div className="multi-group-notice">
            <i className="fi fi-rr-info"></i>
            <span>This settlement will be automatically distributed across multiple groups</span>
          </div>
        </div>

        {loadingBreakdown ? (
          <div className="loading-breakdown">
            <i className="fi fi-rr-spinner"></i> Loading group breakdown...
          </div>
        ) : groupBreakdown.length > 0 && (
          <div className="group-breakdown">
            <h4>Settlement will be distributed across:</h4>
            <div className="breakdown-list">
              {groupBreakdown.map(group => (
                <div key={group.groupId} className="breakdown-item">
                  <span className="group-name">{group.groupName}</span>
                  <div className="group-amounts">
                    {group.currencies.map(curr => (
                      <span key={curr.currency} className="breakdown-amount">
                        {curr.currency} {curr.amount.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="settlement-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Total Amount *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                disabled={loadingBreakdown}
              />
              <small className="form-help">
                This amount will be proportionally distributed across all groups
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="method">Payment Method</label>
              <select
                id="method"
                name="method"
                value={formData.method}
                onChange={handleChange}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_payment">Mobile Payment</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes about this settlement..."
              rows="3"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onCancel}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="button primary" 
              disabled={loading || loadingBreakdown}
            >
              {loading ? (
                <>
                  <i className="fi fi-rr-spinner"></i> Recording...
                </>
              ) : (
                <>
                  <i className="fi fi-rr-check"></i> Record Settlement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MultiGroupSettlementModal;
