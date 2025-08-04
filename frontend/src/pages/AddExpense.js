import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CategoryPopup from '../components/CategoryPopup';
import PopupSelector from '../components/PopupSelector';
import SplitConfigPopup from '../components/SplitConfigPopup';
import PaidByPopup from '../components/PaidByPopup';
import MultiplePaidByPopup from '../components/MultiplePaidByPopup';
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
  
  // Popup states
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [showProjectPopup, setShowProjectPopup] = useState(false);
  const [showCurrencyPopup, setShowCurrencyPopup] = useState(false);
  const [showPaidByPopup, setShowPaidByPopup] = useState(false);
  const [showMultiplePaidByPopup, setShowMultiplePaidByPopup] = useState(false);
  const [showSplitConfigPopup, setShowSplitConfigPopup] = useState(false);
  
  // Multiple payers state
  const [isMultiplePayers, setIsMultiplePayers] = useState(false);
  const [multiplePayers, setMultiplePayers] = useState([]);

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

  // Helper function to get currency symbol
  const getCurrencySymbol = (curr) => {
    switch(curr) {
      case 'TWD': return 'TWD';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      default: return curr;
    }
  };

  // Handle multiple payers
  const handleMultiplePayers = () => {
    setIsMultiplePayers(true);
    setShowMultiplePaidByPopup(true);
  };

  const handleSinglePayerSelect = (userId) => {
    setIsMultiplePayers(false);
    setFormData(prev => ({ ...prev, paidBy: userId }));
  };

  const handleMultiplePayersSave = (payersData) => {
    setMultiplePayers(payersData);
    setIsMultiplePayers(true);
    // Clear single payer selection when using multiple payers
    setFormData(prev => ({ ...prev, paidBy: null }));
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
    
    // Validate payer selection
    if (isMultiplePayers) {
      const activePayers = multiplePayers.filter(p => p.amount > 0);
      if (activePayers.length === 0) {
        setError('Please select at least one payer with an amount');
        return;
      }
    } else if (!formData.paidBy) {
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

      // Handle multiple payers vs single payer
      if (isMultiplePayers) {
        const activePayers = multiplePayers.filter(p => p.amount > 0);
        expenseData.paidBy = activePayers; // Array of payer objects
        expenseData.isMultiplePayers = true;
      } else {
        expenseData.paidBy = formData.paidBy; // Single user ID
        expenseData.isMultiplePayers = false;
      }
      
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
    <div className="add-expense mobile-optimized">
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="expense-form">
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

        <div className="form-row">
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
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Category Selector */}
        <div className="form-group">
          <label>Category *</label>
          <div 
            className="popup-trigger"
            onClick={() => setShowCategoryPopup(true)}
          >
            <span className="trigger-text">
              {formData.category || 'Select Category'}
            </span>
            <i className="fi fi-rr-angle-down"></i>
          </div>
        </div>

        {/* Project Selector */}
        <div className="form-group">
          <label>Project</label>
          <div 
            className="popup-trigger"
            onClick={() => setShowProjectPopup(true)}
          >
            <span className="trigger-text">
              {formData.project || 'Select Project (Optional)'}
            </span>
            <i className="fi fi-rr-angle-down"></i>
          </div>
        </div>

        {/* Notes */}
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

        <div className="form-row">
          {/* Currency Selector */}
          <div className="form-group">
            <label>Currency</label>
            <div 
              className="popup-trigger"
              onClick={() => setShowCurrencyPopup(true)}
            >
              <span className="trigger-text">{formData.currency}</span>
              <i className="fi fi-rr-angle-down"></i>
            </div>
          </div>

          {/* Paid By Selector */}
          <div className="form-group">
            <label>Paid By</label>
            <div 
              className="popup-trigger"
              onClick={() => setShowPaidByPopup(true)}
            >
              <span className="trigger-text">
                {isMultiplePayers ? 
                  (() => {
                    const activePayers = multiplePayers.filter(p => p.included && p.amount > 0);
                    if (activePayers.length === 0) {
                      return 'Select multiple payers';
                    } else if (activePayers.length === 1) {
                      const member = group?.members?.find(m => m.user === activePayers[0].userId);
                      const isCurrentUser = member?.user === currentUser?.id;
                      const displayName = member?.userName || member?.user || 'Unknown';
                      return `${displayName}${isCurrentUser ? ' (You)' : ''}`;
                    } else {
                      const totalPaid = activePayers.reduce((sum, p) => sum + p.amount, 0);
                      return `${activePayers.length} people paid ${getCurrencySymbol(formData.currency)}${totalPaid.toFixed(2)}`;
                    }
                  })()
                  : formData.paidBy ? 
                    (() => {
                      const member = group?.members?.find(m => m.user === formData.paidBy);
                      const isCurrentUser = member?.user === currentUser?.id;
                      const displayName = member?.userName || member?.user || 'Unknown';
                      return `${displayName}${isCurrentUser ? ' (You)' : ''}`;
                    })()
                    : 'Select who paid'
                }
              </span>
              <i className="fi fi-rr-angle-down"></i>
            </div>
          </div>
        </div>

        {/* Split Configuration */}
        <div className="form-group">
          <label>Split Configuration</label>
          <div 
            className="popup-trigger split-config-trigger"
            onClick={() => setShowSplitConfigPopup(true)}
          >
            <div className="split-summary-preview">
              <div className="split-info">
                <div className="split-type-info">
                  <span className="split-type-label">
                    {formData.splitType === 'equal' ? '⚖️ Equal Split' :
                     formData.splitType === 'weight' ? '⚖️ Weight-based Split' :
                     '✏️ Custom Split'}
                  </span>
                </div>
                <div className="split-details-info">
                  <span className="split-count">
                    {formData.splitType === 'equal' 
                      ? `${splits.filter(s => s.included).length} of ${splits.length} members`
                      : `${splits.length} members`
                    }
                  </span>
                  <span className="split-total">
                    {formData.currency} {totalSplits.toFixed(2)} / {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              {!isValid && (
                <div className="split-warning">
                  <i className="fi fi-rr-exclamation-triangle"></i>
                </div>
              )}
            </div>
            <i className="fi fi-rr-angle-right"></i>
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

      {/* Popup Modals */}
      <CategoryPopup
        isOpen={showCategoryPopup}
        onClose={() => setShowCategoryPopup(false)}
        selectedValue={formData.category}
        onSelect={(value) => setFormData(prev => ({ ...prev, category: value }))}
      />

      <PopupSelector
        isOpen={showProjectPopup}
        onClose={() => setShowProjectPopup(false)}
        title="Select Project"
        options={[
          { label: 'None (Optional)', value: '' },
          { label: '生活開銷', value: '生活開銷' },
          { label: '玩樂', value: '玩樂' },
          { label: '家用', value: '家用' },
          { label: '家居裝潢', value: '家居裝潢' }
        ]}
        selectedValue={formData.project}
        onSelect={(value) => setFormData(prev => ({ ...prev, project: value }))}
      />

      <PopupSelector
        isOpen={showCurrencyPopup}
        onClose={() => setShowCurrencyPopup(false)}
        title="Select Currency"
        options={[
          { label: 'TWD - Taiwan Dollar', value: 'TWD' },
          { label: 'USD - US Dollar', value: 'USD' },
          { label: 'EUR - Euro', value: 'EUR' },
          { label: 'GBP - British Pound', value: 'GBP' },
          { label: 'JPY - Japanese Yen', value: 'JPY' }
        ]}
        selectedValue={formData.currency}
        onSelect={(value) => setFormData(prev => ({ ...prev, currency: value }))}
      />

      <PaidByPopup
        isOpen={showPaidByPopup}
        onClose={() => setShowPaidByPopup(false)}
        members={group?.members || []}
        currentUser={currentUser}
        selectedValue={formData.paidBy}
        onSelect={handleSinglePayerSelect}
        onMultiplePayers={handleMultiplePayers}
      />

      <SplitConfigPopup
        isOpen={showSplitConfigPopup}
        onClose={() => setShowSplitConfigPopup(false)}
        splits={splits}
        weights={weights}
        group={group}
        formData={formData}
        onSplitChange={handleSplitChange}
        onMemberToggle={handleMemberToggle}
        onWeightChange={handleWeightChange}
        onSplitTypeChange={(value) => {
          setFormData(prev => ({ ...prev, splitType: value }));
          handleSplitTypeChange({ target: { value } });
        }}
        totalAmount={totalAmount}
        totalSplits={totalSplits}
        isValid={isValid}
      />

      <MultiplePaidByPopup
        isOpen={showMultiplePaidByPopup}
        onClose={() => setShowMultiplePaidByPopup(false)}
        members={group?.members || []}
        currentUser={currentUser}
        totalAmount={parseFloat(formData.amount) || 0}
        currency={formData.currency}
        onSave={handleMultiplePayersSave}
      />
    </div>
  );
};

export default AddExpense;
