import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const AddExpense = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'USD',
    category: 'General',
    splitType: 'equal'
  });
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'General', 'Food', 'Transportation', 'Accommodation', 
    'Entertainment', 'Shopping', 'Utilities', 'Other'
  ];

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const response = await api.get(`/api/groups/${groupId}`);
        const groupData = response.data;
        setGroup(groupData);
        
        // Initialize equal splits
        const equalAmount = 0;
        const initialSplits = groupData.members.map(member => ({
          userId: member.user,
          amount: equalAmount
        }));
        setSplits(initialSplits);
        setLoading(false);
      } catch (err) {
        setError('Failed to load group data');
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Recalculate splits when amount changes
    if (name === 'amount' && formData.splitType === 'equal') {
      const amount = parseFloat(value) || 0;
      const equalAmount = amount / splits.length;
      setSplits(prev => prev.map(split => ({
        ...split,
        amount: equalAmount
      })));
    }
  };

  const handleSplitChange = (userId, amount) => {
    setSplits(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, amount: parseFloat(amount) || 0 }
        : split
    ));
  };

  const handleSplitTypeChange = (e) => {
    const splitType = e.target.value;
    setFormData(prev => ({ ...prev, splitType }));

    if (splitType === 'equal') {
      const amount = parseFloat(formData.amount) || 0;
      const equalAmount = amount / splits.length;
      setSplits(prev => prev.map(split => ({
        ...split,
        amount: equalAmount
      })));
    }
  };

  const validateSplits = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(totalAmount - totalSplits) < 0.01;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateSplits()) {
      setError('Split amounts must equal the total amount');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/api/expenses', {
        ...formData,
        amount: parseFloat(formData.amount),
        groupId,
        splits
      });

      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create expense');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error && !group) {
    return <div className="error-message">{error}</div>;
  }

  const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
  const totalAmount = parseFloat(formData.amount) || 0;
  const isValid = Math.abs(totalAmount - totalSplits) < 0.01;

  return (
    <div className="add-expense">
      <div className="page-header">
        <h1>Add Expense to {group?.name}</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="expense-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              placeholder="What was this expense for?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="splitType">Split Type</label>
          <select
            id="splitType"
            name="splitType"
            value={formData.splitType}
            onChange={handleSplitTypeChange}
          >
            <option value="equal">Equal Split</option>
            <option value="custom">Custom Split</option>
          </select>
        </div>

        <div className="splits-section">
          <h3>Split Details</h3>
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group.members.find(m => m.user === split.userId);
              return (
                <div key={split.userId} className="split-item">
                  <span className="member-name">
                    {member ? member.userName || member.user : `Member ${index + 1}`}
                  </span>
                  <input
                    type="number"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(split.userId, e.target.value)}
                    disabled={formData.splitType === 'equal'}
                    min="0"
                    step="0.01"
                    className="split-amount"
                  />
                </div>
              );
            })}
          </div>
          
          <div className="split-summary">
            <p>Total: ${totalAmount.toFixed(2)}</p>
            <p>Split Total: ${totalSplits.toFixed(2)}</p>
            {!isValid && (
              <p className="error">Splits don't match total amount!</p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate(`/groups/${groupId}`)}
            className="button secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !isValid}
            className="button primary"
          >
            {submitting ? 'Adding...' : 'Add Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExpense;
