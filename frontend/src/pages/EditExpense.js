import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CategorySelector from '../components/CategorySelector';

const EditExpense = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TWD',
    category: '',
    project: '', // Keep project field for MOZE compatibility
    date: new Date().toISOString().split('T')[0], // Default to today in YYYY-MM-DD format
    paidBy: '',
    splitType: 'equal',
    notes: ''
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
          currency: expense.currency || 'TWD',
          category: expense.category || '',
          project: expense.project || '',
          date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0], // Convert to YYYY-MM-DD format
          paidBy: expense.paidBy,
          splitType: expense.splitType || 'equal',
          notes: expense.notes || ''
        });
        
        // Create splits for all group members, not just those in the original expense
        const allMemberSplits = groupRes.data.members.map(member => {
          const existingSplit = expense.splits?.find(split => 
            (split.userId || split.user) === member.user
          );
          
          return {
            userId: member.user,
            user: member.user,
            userName: member.userName,
            amount: existingSplit ? existingSplit.amount : 0,
            weight: existingSplit ? (existingSplit.weight || 1) : 1,
            included: existingSplit ? existingSplit.amount > 0 : false
          };
        });
        
        setSplits(allMemberSplits);
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
    if (name === 'amount') {
      if (formData.splitType === 'equal') {
        const amount = parseFloat(value) || 0;
        calculateEqualSplits(amount);
      } else if (formData.splitType === 'weight') {
        setTimeout(() => calculateWeightedSplits(), 0);
      }
    }
  };

  const handleSplitChange = (userId, amount) => {
    setSplits(prev => prev.map(split => 
      (split.userId || split.user) === userId 
        ? { ...split, amount: parseFloat(amount) || 0 }
        : split
    ));
  };

  const handleMemberToggle = (userId) => {
    setSplits(prev => prev.map(split => 
      (split.userId || split.user) === userId 
        ? { ...split, included: !split.included }
        : split
    ));
    
    // Recalculate equal splits after toggling
    if (formData.splitType === 'equal') {
      const amount = parseFloat(formData.amount) || 0;
      setTimeout(() => calculateEqualSplits(amount), 0);
    }
  };

  const handleSplitTypeChange = (e) => {
    const newSplitType = e.target.value;
    setFormData(prev => ({ ...prev, splitType: newSplitType }));
    
    const amount = parseFloat(formData.amount) || 0;
    
    if (newSplitType === 'equal') {
      // Reset all members to included and calculate equal splits
      setSplits(prev => prev.map(split => ({ ...split, included: true })));
      setTimeout(() => calculateEqualSplits(amount), 0);
    } else if (newSplitType === 'weight') {
      // Set default weight of 1 for all members
      setSplits(prev => prev.map(split => ({ 
        ...split, 
        weight: 1,
        amount: amount / splits.length // Equal amount initially
      })));
    } else if (newSplitType === 'custom') {
      // Keep current amounts but allow manual editing
      // No automatic calculation needed
    }
  };

  const calculateEqualSplits = (totalAmount) => {
    setSplits(prev => {
      const includedMembers = prev.filter(split => split.included);
      const equalAmount = includedMembers.length > 0 ? totalAmount / includedMembers.length : 0;
      
      return prev.map(split => ({
        ...split,
        amount: split.included ? equalAmount : 0
      }));
    });
  };

  const handleWeightChange = (userId, weight) => {
    setSplits(prev => prev.map(split => 
      (split.userId || split.user) === userId 
        ? { ...split, weight: parseFloat(weight) || 0 }
        : split
    ));
    
    // Recalculate amounts based on weights
    setTimeout(() => calculateWeightedSplits(), 0);
  };

  const calculateWeightedSplits = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    
    setSplits(prev => {
      const totalWeight = prev.reduce((sum, split) => sum + (split.weight || 0), 0);
      
      if (totalWeight === 0) {
        return prev.map(split => ({ ...split, amount: 0 }));
      }
      
      return prev.map(split => ({
        ...split,
        amount: totalAmount * ((split.weight || 0) / totalWeight)
      }));
    });
  };

  const validateSplits = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    
    // For equal split, ensure at least one member is selected
    if (formData.splitType === 'equal') {
      const includedMembers = splits.filter(split => split.included);
      if (includedMembers.length === 0) {
        setError('Please select at least one member for the equal split');
        return false;
      }
    }
    
    // For weight-based split, ensure total weight is greater than 0
    if (formData.splitType === 'weight') {
      const totalWeight = splits.reduce((sum, split) => sum + (split.weight || 0), 0);
      if (totalWeight === 0) {
        setError('Please set weights for at least one member');
        return false;
      }
    }
    
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
      // Filter out splits with zero amounts (unselected members in equal split)
      const activeSplits = splits.filter(split => split.amount > 0);
      
      await api.put(`/api/expenses/${expenseId}`, {
        ...formData,
        amount: parseFloat(formData.amount),
        splits: activeSplits
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
            <label htmlFor="project">Project</label>
            <select
              id="project"
              name="project"
              value={formData.project}
              onChange={handleChange}
            >
              <option value="">Select Project (Optional)</option>
              <option value="生活開銷">生活開銷</option>
              <option value="玩樂">玩樂</option>
              <option value="家用">家用</option>
              <option value="家居裝潢">家居裝潢</option>
            </select>
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
              step="1"
              min="0"
              required
              placeholder="0.00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              max={new Date().toISOString().split('T')[0]} // Can't select future dates
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Category *</label>
            <CategorySelector
              value={formData.category}
              onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              required={true}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project">Project</label>
            <select
              id="project"
              name="project"
              value={formData.project}
              onChange={handleChange}
            >
              <option value="">Select Project (Optional)</option>
              <option value="生活開銷">生活開銷</option>
              <option value="玩樂">玩樂</option>
              <option value="家用">家用</option>
              <option value="家居裝潢">家居裝潢</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <input
              type="text"
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="form-row">
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

        <div className="form-group">
          <label htmlFor="splitType">Split Type</label>
          <select
            id="splitType"
            name="splitType"
            value={formData.splitType}
            onChange={handleSplitTypeChange}
          >
            <option value="equal">Equal Split</option>
            <option value="weight">Weight-based Split</option>
            <option value="custom">Custom Split</option>
          </select>
        </div>

        <div className="splits-section">
          <h3>Split Details</h3>
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group?.members?.find(m => m.user === (split.userId || split.user));
              const displayName = member?.userName || split.userName || 'Unknown User';
              const isCurrentUser = (split.userId || split.user) === currentUser?.id;
              
              return (
                <div key={split.userId || split.user || index} className={`split-item ${formData.splitType === 'equal' && !split.included ? 'excluded' : ''}`}>
                  {formData.splitType === 'equal' && (
                    <div className="member-checkbox">
                      <input
                        type="checkbox"
                        id={`edit-member-${split.userId || split.user}`}
                        checked={split.included}
                        onChange={() => handleMemberToggle(split.userId || split.user)}
                      />
                      <label htmlFor={`edit-member-${split.userId || split.user}`} className="checkbox-label">
                        Include in split
                      </label>
                    </div>
                  )}
                  
                  <div className="member-info">
                    <span className="member-name">
                      {displayName}{isCurrentUser ? ' (You)' : ''}
                    </span>
                  </div>
                  
                  {formData.splitType === 'weight' && (
                    <div className="weight-input">
                      <label>Weight:</label>
                      <div className="weight-controls">
                        <button
                          type="button"
                          className="weight-btn weight-decrease"
                          onClick={() => handleWeightChange(split.userId || split.user, Math.max(0, (split.weight !== undefined ? split.weight : 1) - 0.5))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={split.weight !== undefined ? split.weight : 1}
                          onChange={(e) => handleWeightChange(split.userId || split.user, e.target.value)}
                          step="0.5"
                          min="0"
                          className="split-weight"
                        />
                        <button
                          type="button"
                          className="weight-btn weight-increase"
                          onClick={() => handleWeightChange(split.userId || split.user, (split.weight !== undefined ? split.weight : 1) + 0.5)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="amount-input">
                    <label>Amount:</label>
                    <input
                      type="number"
                      value={split.amount}
                      onChange={(e) => handleSplitChange(split.userId || split.user, e.target.value)}
                      disabled={formData.splitType === 'equal' || formData.splitType === 'weight'}
                      step="1"
                      min="0"
                      className="split-amount"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="split-total">
            <p>Total: ${splits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)} / ${formData.amount || '0.00'}</p>
            {formData.splitType === 'custom' && (
              <p className={`remaining-amount ${(parseFloat(formData.amount) || 0) - splits.reduce((sum, split) => sum + split.amount, 0) >= 0 ? 'positive' : 'negative'}`}>
                Remaining: ${((parseFloat(formData.amount) || 0) - splits.reduce((sum, split) => sum + split.amount, 0)).toFixed(2)}
              </p>
            )}
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
