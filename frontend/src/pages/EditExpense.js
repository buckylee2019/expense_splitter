import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CategoryPopup from '../components/CategoryPopup';
import PopupSelector from '../components/PopupSelector';
import SplitConfigPopup from '../components/SplitConfigPopup';
import PaidByPopup from '../components/PaidByPopup';
import MultiplePaidByPopup from '../components/MultiplePaidByPopup';
import { parseCategoryString } from '../data/expenseCategories';

const EditExpense = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TWD',
    category: '',
    project: '',
    date: new Date().toISOString().split('T')[0],
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
        setLoading(true);
        
        const [userRes, groupRes, expenseRes] = await Promise.all([
          api.get('/api/users/profile'),
          api.get(`/api/groups/${groupId}`),
          api.get(`/api/expenses/${expenseId}`)
        ]);

        setCurrentUser(userRes.data);
        setGroup(groupRes.data);
        
        const expense = expenseRes.data;
        
        // Handle multiple payers vs single payer
        const isMultiple = expense.isMultiplePayers && Array.isArray(expense.paidBy);
        setIsMultiplePayers(isMultiple);
        
        if (isMultiple) {
          // Initialize multiple payers
          const payers = groupRes.data.members.map(member => {
            const existingPayer = expense.paidBy.find(p => p.userId === member.user);
            return {
              userId: member.user,
              userName: member.userName,
              amount: existingPayer ? existingPayer.amount : 0,
              included: existingPayer ? existingPayer.amount > 0 : false
            };
          });
          setMultiplePayers(payers);
        }
        
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          currency: expense.currency || 'TWD',
          category: expense.category || '',
          project: expense.project || '',
          date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
          paidBy: isMultiple ? '' : expense.paidBy,
          splitType: expense.splitType || 'equal',
          notes: expense.notes || ''
        });
        
        // Create splits for all group members
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
        
        // Initialize weights for all group members
        const initialWeights = groupRes.data.members.map(member => {
          const existingSplit = expense.splits?.find(split => 
            (split.userId || split.user) === member.user
          );
          return {
            userId: member.user,
            weight: existingSplit ? (existingSplit.weight || 1) : 1
          };
        });
        
        setSplits(allMemberSplits);
        setWeights(initialWeights);
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

  // Helper function to get currency symbol
  const getCurrencySymbol = (curr) => {
    switch(curr) {
      case 'TWD': return '¥';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      default: return curr;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Recalculate splits when amount changes
    if (name === 'amount') {
      const amount = parseFloat(value) || 0;
      if (formData.splitType === 'equal') {
        setTimeout(() => calculateEqualSplits(amount), 0);
      } else if (formData.splitType === 'weight') {
        setTimeout(() => calculateWeightedSplits(amount), 0);
      }
    }
  };

  const handleSplitTypeChange = (splitType) => {
    setFormData(prev => ({ ...prev, splitType }));
    const amount = parseFloat(formData.amount) || 0;
    
    if (splitType === 'equal') {
      calculateEqualSplits(amount);
    } else if (splitType === 'weight') {
      calculateWeightedSplits(amount);
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

  const calculateWeightedSplits = (totalAmount) => {
    const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
    
    if (totalWeight === 0) return;
    
    setSplits(prevSplits => 
      prevSplits.map(split => {
        const weight = weights.find(w => w.userId === split.userId)?.weight || 0;
        return {
          ...split,
          amount: (weight / totalWeight) * totalAmount
        };
      })
    );
  };

  const validateSplits = () => {
    const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    const totalAmount = parseFloat(formData.amount) || 0;
    return Math.abs(totalAmount - totalSplits) < 0.01;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate payer selection
    if (isMultiplePayers) {
      const activePayers = multiplePayers.filter(p => p.amount > 0);
      if (activePayers.length === 0) {
        setError('Please select at least one payer');
        return;
      }
    } else if (!formData.paidBy) {
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
      // Filter out splits with zero amounts
      const activeSplits = splits.filter(split => split.amount > 0);
      
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        splits: activeSplits
      };

      // Handle multiple payers vs single payer
      if (isMultiplePayers) {
        const activePayers = multiplePayers.filter(p => p.amount > 0);
        expenseData.paidBy = activePayers;
        expenseData.isMultiplePayers = true;
      } else {
        expenseData.paidBy = formData.paidBy;
        expenseData.isMultiplePayers = false;
      }
      
      await api.put(`/api/expenses/${expenseId}`, expenseData);

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
    return <div className="error-message">{error}</div>;
  }

  const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
  const totalAmount = parseFloat(formData.amount) || 0;
  const isValid = Math.abs(totalAmount - totalSplits) < 0.01;

  return (
    <div className="edit-expense mobile-optimized">
      <div className="page-header">
        <h1>Edit Expense</h1>
        <button 
          type="button" 
          onClick={() => navigate(`/groups/${groupId}/expenses/${expenseId}`)}
          className="button secondary"
        >
          Cancel
        </button>
      </div>

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

        {/* Currency Selector */}
        <div className="form-group">
          <label>Currency</label>
          <div 
            className="popup-trigger"
            onClick={() => setShowCurrencyPopup(true)}
          >
            <span className="trigger-text">
              {getCurrencySymbol(formData.currency)} {formData.currency}
            </span>
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
                </div>
              </div>
              <div className="split-validation">
                <span className={`validation-status ${isValid ? 'valid' : 'invalid'}`}>
                  {isValid ? '✓' : '⚠️'}
                </span>
              </div>
            </div>
            <i className="fi fi-rr-angle-down"></i>
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label htmlFor="notes">Notes (Optional)</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Add any additional notes..."
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate(`/groups/${groupId}/expenses/${expenseId}`)}
            className="button secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting || !isValid}
            className="button primary"
          >
            {submitting ? 'Updating...' : 'Update Expense'}
          </button>
        </div>
      </form>

      {/* Popups */}
      {showCategoryPopup && (
        <CategoryPopup
          selectedCategory={formData.category}
          onSelect={(category) => {
            setFormData(prev => ({ ...prev, category }));
            setShowCategoryPopup(false);
          }}
          onClose={() => setShowCategoryPopup(false)}
        />
      )}

      {showProjectPopup && (
        <PopupSelector
          title="Select Project"
          options={[
            { value: '', label: 'No Project' },
            { value: '生活開銷', label: '生活開銷' },
            { value: '玩樂', label: '玩樂' },
            { value: '家用', label: '家用' },
            { value: '家居裝潢', label: '家居裝潢' }
          ]}
          selectedValue={formData.project}
          onSelect={(project) => {
            setFormData(prev => ({ ...prev, project }));
            setShowProjectPopup(false);
          }}
          onClose={() => setShowProjectPopup(false)}
        />
      )}

      {showCurrencyPopup && (
        <PopupSelector
          title="Select Currency"
          options={[
            { value: 'TWD', label: '¥ TWD (Taiwan Dollar)' },
            { value: 'USD', label: '$ USD (US Dollar)' },
            { value: 'EUR', label: '€ EUR (Euro)' },
            { value: 'JPY', label: '¥ JPY (Japanese Yen)' }
          ]}
          selectedValue={formData.currency}
          onSelect={(currency) => {
            setFormData(prev => ({ ...prev, currency }));
            setShowCurrencyPopup(false);
          }}
          onClose={() => setShowCurrencyPopup(false)}
        />
      )}

      {showPaidByPopup && (
        <PaidByPopup
          group={group}
          currentUser={currentUser}
          selectedPayer={formData.paidBy}
          isMultiplePayers={isMultiplePayers}
          multiplePayers={multiplePayers}
          onSelectSingle={(payer) => {
            setFormData(prev => ({ ...prev, paidBy: payer }));
            setIsMultiplePayers(false);
            setShowPaidByPopup(false);
          }}
          onToggleMultiple={() => {
            setIsMultiplePayers(!isMultiplePayers);
            if (!isMultiplePayers) {
              setShowMultiplePaidByPopup(true);
              setShowPaidByPopup(false);
            }
          }}
          onClose={() => setShowPaidByPopup(false)}
        />
      )}

      {showMultiplePaidByPopup && (
        <MultiplePaidByPopup
          group={group}
          currentUser={currentUser}
          totalAmount={parseFloat(formData.amount) || 0}
          currency={formData.currency}
          multiplePayers={multiplePayers}
          onUpdatePayers={(updatedPayers) => {
            setMultiplePayers(updatedPayers);
          }}
          onDone={() => {
            setShowMultiplePaidByPopup(false);
          }}
          onClose={() => {
            setShowMultiplePaidByPopup(false);
            setIsMultiplePayers(false);
          }}
        />
      )}

      {showSplitConfigPopup && (
        <SplitConfigPopup
          group={group}
          currentUser={currentUser}
          totalAmount={parseFloat(formData.amount) || 0}
          currency={formData.currency}
          splitType={formData.splitType}
          splits={splits}
          weights={weights}
          onUpdateSplitType={(type) => {
            handleSplitTypeChange(type);
          }}
          onUpdateSplits={(updatedSplits) => {
            setSplits(updatedSplits);
          }}
          onUpdateWeights={(updatedWeights) => {
            setWeights(updatedWeights);
          }}
          onClose={() => setShowSplitConfigPopup(false)}
        />
      )}
    </div>
  );
};

export default EditExpense;
