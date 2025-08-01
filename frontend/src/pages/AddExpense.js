import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CategorySelector from '../components/CategorySelector';
import { parseCategoryString } from '../data/expenseCategories';

const AddExpense = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TWD',
    category: '', // New comprehensive category system
    project: '', // Keep project field for MOZE compatibility
    date: new Date().toISOString().split('T')[0], // Default to today in YYYY-MM-DD format
    splitType: 'equal',
    paidBy: '',
    notes: ''
  });
  const [splits, setSplits] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user and group data
        const [userResponse, groupResponse] = await Promise.all([
          api.get('/api/users/profile'),
          api.get(`/api/groups/${groupId}`)
        ]);
        
        const userData = userResponse.data;
        const groupData = groupResponse.data;
        
        setCurrentUser(userData);
        setGroup(groupData);
        
        // Set default payer to current user
        setFormData(prev => ({
          ...prev,
          paidBy: userData.id
        }));
        
        // Initialize equal splits
        const equalAmount = 0;
        const initialSplits = groupData.members.map(member => ({
          userId: member.user,
          amount: equalAmount,
          included: true // Default to including all members in equal split
        }));
        
        // Initialize weights for all group members (default weight = 1)
        const initialWeights = groupData.members.map(member => ({
          userId: member.user,
          weight: 1
        }));
        
        setSplits(initialSplits);
        setWeights(initialWeights);
        setLoading(false);
      } catch (err) {
        setError('Failed to load group data');
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  const handlePayerChange = (e) => {
    const selectedPayer = e.target.value;
    setFormData(prev => ({
      ...prev,
      paidBy: selectedPayer
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle payer change separately for better control
    if (name === 'paidBy') {
      handlePayerChange(e);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Recalculate splits when amount changes
    if (name === 'amount') {
      const amount = parseFloat(value) || 0;
      
      if (formData.splitType === 'equal') {
        calculateEqualSplits(amount);
      } else if (formData.splitType === 'weight') {
        calculateWeightedSplits(amount);
      }
    }
  };

  const handleSplitChange = (userId, amount) => {
    setSplits(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, amount: parseFloat(amount) || 0 }
        : split
    ));
  };

  const handleMemberToggle = (userId) => {
    setSplits(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, included: !split.included }
        : split
    ));
    
    // Recalculate equal splits after toggling
    if (formData.splitType === 'equal') {
      const amount = parseFloat(formData.amount) || 0;
      setTimeout(() => calculateEqualSplits(amount), 0); // Use setTimeout to ensure state is updated
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

  const handleSplitTypeChange = (e) => {
    const splitType = e.target.value;
    setFormData(prev => ({ ...prev, splitType }));

    const amount = parseFloat(formData.amount) || 0;

    if (splitType === 'equal') {
      calculateEqualSplits(amount);
    } else if (splitType === 'weight') {
      calculateWeightedSplits(amount);
    } else if (splitType === 'custom') {
      // Set all amounts to zero for custom split
      setSplits(prev => prev.map(split => ({
        ...split,
        amount: 0
      })));
    }
  };

  const calculateWeightedSplits = (totalAmount) => {
    const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
    
    if (totalWeight === 0) return;
    
    setSplits(prev => prev.map(split => {
      const weight = weights.find(w => w.userId === split.userId)?.weight || 1;
      const weightedAmount = (totalAmount * weight) / totalWeight;
      return {
        ...split,
        amount: Math.round(weightedAmount * 100) / 100 // Round to 2 decimal places
      };
    }));
  };

  const handleWeightChange = (userId, newWeight) => {
    const weight = Math.max(0, parseFloat(newWeight) || 0);
    
    setWeights(prev => prev.map(w => 
      w.userId === userId ? { ...w, weight } : w
    ));

    // Recalculate splits if in weight mode
    if (formData.splitType === 'weight') {
      const amount = parseFloat(formData.amount) || 0;
      // Update weights first, then calculate
      const updatedWeights = weights.map(w => 
        w.userId === userId ? { ...w, weight } : w
      );
      const totalWeight = updatedWeights.reduce((sum, w) => sum + w.weight, 0);
      
      if (totalWeight > 0) {
        setSplits(prev => prev.map(split => {
          const userWeight = updatedWeights.find(w => w.userId === split.userId)?.weight || 0;
          const weightedAmount = (amount * userWeight) / totalWeight;
          return {
            ...split,
            amount: Math.round(weightedAmount * 100) / 100
          };
        }));
      }
    }
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
    
    return Math.abs(totalAmount - totalSplits) < 0.01;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.paidBy) {
      setError('Please select who paid for this expense');
      return;
    }
    
    if (!formData.category) {
      setError('Please select a category for this expense');
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
      
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        groupId,
        splits: activeSplits
      };
      
      await api.post('/api/expenses', expenseData);

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
              step="1"
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
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="TWD">TWD - Taiwan Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="paidBy">Paid By</label>
            <select
              id="paidBy"
              name="paidBy"
              value={formData.paidBy || ''}
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
          {formData.splitType === 'weight' && (
            <div className="weight-info">
              <p>Set weights for each member (higher weight = larger share)</p>
            </div>
          )}
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group.members.find(m => m.user === split.userId);
              const weightObj = weights.find(w => w.userId === split.userId);
              const weight = weightObj?.weight !== undefined ? weightObj.weight : 1;
              
              return (
                <div key={split.userId} className={`split-item ${formData.splitType === 'equal' && !split.included ? 'excluded' : ''}`}>
                  {formData.splitType === 'equal' && (
                    <div className="member-checkbox">
                      <input
                        type="checkbox"
                        id={`member-${split.userId}`}
                        checked={split.included}
                        onChange={() => handleMemberToggle(split.userId)}
                      />
                      <label htmlFor={`member-${split.userId}`} className="checkbox-label">
                        Include in split
                      </label>
                    </div>
                  )}
                  
                  <div className="member-info">
                    <span className="member-name">
                      {member ? member.userName || member.user : `Member ${index + 1}`}
                    </span>
                  </div>
                  
                  {formData.splitType === 'weight' && (
                    <div className="weight-input">
                      <label>Weight:</label>
                      <div className="weight-controls">
                        <button
                          type="button"
                          className="weight-btn weight-decrease"
                          onClick={() => handleWeightChange(split.userId, Math.max(0, weight - 0.5))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={weight}
                          onChange={(e) => handleWeightChange(split.userId, e.target.value)}
                          min="0"
                          step="0.5"
                          className="weight-value"
                        />
                        <button
                          type="button"
                          className="weight-btn weight-increase"
                          onClick={() => handleWeightChange(split.userId, weight + 0.5)}
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
                      onChange={(e) => handleSplitChange(split.userId, e.target.value)}
                      disabled={formData.splitType === 'equal' || formData.splitType === 'weight'}
                      min="0"
                      step="1"
                      className="split-amount"
                    />
                  </div>
                  
                  {formData.splitType === 'weight' && (
                    <div className="weight-percentage">
                      ({((weight / weights.reduce((sum, w) => sum + w.weight, 0)) * 100).toFixed(1)}%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="split-summary">
            <p>Total: ${totalAmount.toFixed(2)}</p>
            <p>Split Total: ${totalSplits.toFixed(2)}</p>
            {formData.splitType === 'custom' && (
              <p className={`remaining-amount ${totalAmount - totalSplits >= 0 ? 'positive' : 'negative'}`}>
                Remaining: ${(totalAmount - totalSplits).toFixed(2)}
              </p>
            )}
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
