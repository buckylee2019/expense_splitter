import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SettlementModal = ({ balance, groupId, currentUser, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    fromUserId: '',
    toUserId: '',
    amount: '',
    currency: 'TWD',
    groupId: groupId,
    method: 'cash',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill form data based on balance
  useEffect(() => {
    if (balance && currentUser) {
      const isUserOwing = balance.type === 'you_owe';
      
      setFormData({
        fromUserId: isUserOwing ? currentUser.id : balance.user.id,
        toUserId: isUserOwing ? balance.user.id : currentUser.id,
        amount: balance.amount.toString(),
        currency: balance.currency || 'TWD',
        groupId: groupId,
        method: 'cash',
        notes: `Settlement for ${balance.type === 'you_owe' ? 'amount owed to' : 'amount owed by'} ${balance.user.name}`
      });
    }
  }, [balance, currentUser, groupId]);

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
      await api.post('/api/settlements', formData);
      onComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const fromUserName = balance?.type === 'you_owe' ? 'You' : (balance?.user?.name || 'Select User');
  const toUserName = balance?.type === 'you_owe' ? (balance?.user?.name || 'Select User') : 'You';

  return (
    <div className="modal-overlay">
      <div className="modal-content settlement-modal">
        <div className="modal-header">
          <h3><i className="fi fi-rr-hand-holding-usd"></i> Record Settlement</h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="settlement-summary">
          <div className="settlement-info">
            <span className="from-to">
              <strong>{fromUserName}</strong> pays <strong>{toUserName}</strong>
            </span>
            <span className="amount-display">
              {formData.currency} {parseFloat(formData.amount || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="settlement-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Amount *</label>
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
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="TWD">TWD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
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
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="line_pay">📱 Line Pay</option>
              <option value="other">Other</option>
            </select>
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

          <div className="form-actions">
            <button 
              type="button" 
              onClick={onCancel}
              className="button secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="button primary"
              disabled={loading}
            >
              {loading ? 'Recording...' : 'Record Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettlementModal;
