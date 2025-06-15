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
    category: '飲食 - 午餐',
    splitType: 'equal',
    paidBy: ''
  });
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    // 飲食 (Food & Dining)
    '飲食 - 早餐', '飲食 - 午餐', '飲食 - 晚餐', '飲食 - 宵夜',
    '飲食 - 飲料', '飲食 - 點心', '飲食 - 酒類', '飲食 - 水果',
    '飲食 - 食材', '飲食 - 咖啡豆', '飲食 - 旅遊',
    
    // 交通 (Transportation)
    '交通 - 捷運', '交通 - 公車', '交通 - 計程車', '交通 - 火車',
    '交通 - 機票', '交通 - 汽車', '交通 - 摩托車', '交通 - 加油費',
    '交通 - 停車費', '交通 - 過路費',
    
    // 購物 (Shopping)
    '購物 - 衣物', '購物 - 鞋子', '購物 - 包包', '購物 - 配件',
    '購物 - 美妝保養', '購物 - 生活用品', '購物 - 電子產品',
    '購物 - 文具用品', '購物 - 禮物', '購物 - 紀念品',
    '購物 - 保健食品', '購物 - 精品', '購物 - 裝飾品',
    
    // 娛樂 (Entertainment)
    '娛樂 - 電影', '娛樂 - KTV', '娛樂 - 遊戲', '娛樂 - 運動',
    '娛樂 - 健身', '娛樂 - 音樂', '娛樂 - 展覽', '娛樂 - 遊樂園',
    '娛樂 - 消遣', '娛樂 - 影音', '娛樂 - 博弈',
    
    // 生活 (Lifestyle)
    '生活 - 住宿', '生活 - 旅行', '生活 - 美容美髮', '生活 - 按摩',
    '生活 - 泡湯', '生活 - 派對',
    
    // 家居 (Home & Utilities)
    '家居 - 房租', '家居 - 電費', '家居 - 水費', '家居 - 瓦斯費',
    '家居 - 網路費', '家居 - 電話費', '家居 - 管理費',
    '家居 - 日常用品', '家居 - 家具', '家居 - 家電',
    '家居 - 修繕費', '家居 - 保養', '家居 - 洗車',
    
    // 醫療 (Medical)
    '醫療 - 門診', '醫療 - 藥品', '醫療 - 牙齒保健', '醫療 - 健康檢查',
    '醫療 - 打針', '醫療 - 醫療用品',
    
    // 學習 (Education)
    '學習 - 書籍', '學習 - 課程', '學習 - 證書',
    
    // 個人 (Personal)
    '個人 - 保險', '個人 - 投資', '個人 - 稅金', '個人 - 紅包',
    '個人 - 捐款', '個人 - 社交', '個人 - 通話費', '個人 - 手續費',
    '個人 - 罰單', '個人 - 訂金', '個人 - 借款',
    
    // 其他 (Others)
    '其他 - 孝親費', '其他 - 其他'
  ];

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
