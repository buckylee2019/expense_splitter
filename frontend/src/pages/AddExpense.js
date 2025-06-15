import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const AddExpense = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TWD',
    mainCategory: '飲食',
    subCategory: '午餐',
    splitType: 'equal',
    paidBy: ''
  });
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categoryData = {
    '飲食': ['早餐', '午餐', '晚餐', '宵夜', '飲料', '點心', '酒類', '水果', '食材', '咖啡豆', '旅遊'],
    '交通': ['捷運', '公車', '計程車', '火車', '機票', '汽車', '摩托車', '加油費', '停車費', '過路費'],
    '購物': ['衣物', '鞋子', '包包', '配件', '美妝保養', '生活用品', '電子產品', '文具用品', '禮物', '紀念品', '保健食品', '精品', '裝飾品'],
    '娛樂': ['電影', 'KTV', '遊戲', '運動', '健身', '音樂', '展覽', '遊樂園', '消遣', '影音', '博弈'],
    '生活': ['住宿', '旅行', '美容美髮', '按摩', '泡湯', '派對'],
    '家居': ['房租', '電費', '水費', '瓦斯費', '網路費', '電話費', '管理費', '日常用品', '家具', '家電', '修繕費', '保養', '洗車'],
    '醫療': ['門診', '藥品', '牙齒保健', '健康檢查', '打針', '醫療用品'],
    '學習': ['書籍', '課程', '證書'],
    '個人': ['保險', '投資', '稅金', '紅包', '捐款', '社交', '通話費', '手續費', '罰單', '訂金', '借款'],
    '其他': ['孝親費', '其他']
  };

  const mainCategories = Object.keys(categoryData);

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
          amount: equalAmount
        }));
        setSplits(initialSplits);
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
    
    // Handle main category change - reset subcategory to first option
    if (name === 'mainCategory') {
      setFormData(prev => ({
        ...prev,
        mainCategory: value,
        subCategory: categoryData[value][0] // Set to first subcategory
      }));
      return;
    }
    
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
      const expenseData = {
        ...formData,
        category: `${formData.mainCategory} - ${formData.subCategory}`, // Combine categories
        amount: parseFloat(formData.amount),
        groupId,
        splits
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
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mainCategory">主類別 (Main Category)</label>
            <select
              id="mainCategory"
              name="mainCategory"
              value={formData.mainCategory}
              onChange={handleChange}
              required
            >
              {mainCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="subCategory">子類別 (Subcategory)</label>
            <select
              id="subCategory"
              name="subCategory"
              value={formData.subCategory}
              onChange={handleChange}
              required
            >
              {categoryData[formData.mainCategory]?.map(subCategory => (
                <option key={subCategory} value={subCategory}>
                  {subCategory}
                </option>
              ))}
            </select>
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
