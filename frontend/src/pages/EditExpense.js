import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const EditExpense = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'USD',
    category: 'General',
    paidBy: '',
    splitType: 'equal',
    project: '' // New field for MOZE compatibility
  });
  
  const [splits, setSplits] = useState([]);
  const [group, setGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [userRes, groupRes, expenseRes] = await Promise.all([
          api.get('/api/users/profile'),
          api.get(`/api/groups/${groupId}`),
          api.get(`/api/expenses/${expenseId}`)
        ]);

        setCurrentUser(userRes.data);
        setGroup(groupRes.data);
        
        const expense = expenseRes.data;
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          currency: expense.currency || 'USD',
          category: expense.category || 'General',
          paidBy: expense.paidBy,
          splitType: expense.splitType || 'equal',
          project: expense.project || '' // Include project field
        });
        
        setSplits(expense.splits || []);
        setError('');
      } catch (err) {
        setError('Failed to load expense details');
        console.error('Edit expense fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, expenseId]);

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
      (split.userId || split.user) === userId 
        ? { ...split, amount: parseFloat(amount) || 0 }
        : split
    ));
  };

  const validateSplits = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(totalAmount - totalSplits) < 0.01;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.paidBy) {
      setError('Please select who paid for this expense');
      return;
    }
    
    if (!validateSplits()) {
      setError('Split amounts must equal the total amount');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.put(`/api/expenses/${expenseId}`, {
        ...formData,
        amount: parseFloat(formData.amount),
        splits
      });

      navigate(`/groups/${groupId}/expenses/${expenseId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update expense');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error && !group) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="edit-expense">
      <div className="page-header">
        <h1>Edit Expense</h1>
        <button 
          onClick={() => navigate(`/groups/${groupId}/expenses/${expenseId}`)}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>

      {error && <div className="error">{error}</div>}

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
            <label htmlFor="project">Project (Optional)</label>
            <input
              type="text"
              id="project"
              name="project"
              value={formData.project}
              onChange={handleChange}
              placeholder="Project name or category"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="amount">Amount</label>
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
              <option value="General">General</option>
              <option value="Food">Food</option>
              <option value="Transportation">Transportation</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Utilities">Utilities</option>
              <option value="Shopping">Shopping</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="paidBy">Paid By</label>
            <select
              id="paidBy"
              name="paidBy"
              value={formData.paidBy}
              onChange={handleChange}
              required
            >
              <option value="">Select who paid</option>
              {group?.members?.map(member => {
                const isCurrentUser = member.user === currentUser?.id;
                const displayName = member.userName || member.user;
                return (
                  <option key={member.user} value={member.user}>
                    {displayName}{isCurrentUser ? ' (You)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="splits-section">
          <h3>Split Details</h3>
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group?.members?.find(m => m.user === (split.userId || split.user));
              const displayName = member?.userName || split.userName || 'Unknown User';
              const isCurrentUser = (split.userId || split.user) === currentUser?.id;
              
              return (
                <div key={split.userId || split.user || index} className="split-item">
                  <span className="split-user">
                    {displayName}{isCurrentUser ? ' (You)' : ''}
                  </span>
                  <input
                    type="number"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(split.userId || split.user, e.target.value)}
                    step="0.01"
                    min="0"
                    className="split-amount"
                  />
                </div>
              );
            })}
          </div>
          
          <div className="split-total">
            Total: ${splits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)} / ${formData.amount || '0.00'}
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate(`/groups/${groupId}/expenses/${expenseId}`)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? 'Updating...' : 'Update Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditExpense;
