import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import UserPhoto from '../components/UserPhoto';
import { parseCategoryString, getCategoryIcon, getCategoryColor } from '../data/expenseCategories';

const ExpenseDetails = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchExpenseDetails = async () => {
      try {
        setLoading(true);
        
        const [userRes, groupRes, expenseRes] = await Promise.all([
          api.get('/api/users/profile'),
          api.get(`/api/groups/${groupId}`),
          api.get(`/api/expenses/${expenseId}`)
        ]);

        setCurrentUser(userRes.data);
        setGroup(groupRes.data);
        setExpense(expenseRes.data);
        setError('');
      } catch (err) {
        setError('Failed to load expense details');
        console.error('Expense details fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenseDetails();
  }, [groupId, expenseId]);

  const handleDeleteExpense = async () => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      await api.delete(`/api/expenses/${expenseId}`);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError('Failed to delete expense: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="loading">Loading expense details...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!expense || !group) {
    return <div className="error-message">Expense not found</div>;
  }

  return (
    <div className="expense-details-page">
      <div className="page-header">
        <div className="breadcrumb">
          <Link to="/dashboard">Dashboard</Link>
          <span> / </span>
          <Link to={`/groups/${groupId}`}>{group.name}</Link>
          <span> / </span>
          <span>{expense.description}</span>
        </div>
        
        <h1 className="expense-name">{expense.description}</h1>
        
        <div className="header-actions">
          <Link to={`/groups/${groupId}`} className="button secondary">
            ← Back to Group
          </Link>
          {currentUser && (
            <>
              <Link 
                to={`/groups/${groupId}/expenses/${expenseId}/edit`}
                className="button primary"
                title="Edit expense"
              >
                <i className="fi fi-rr-edit"></i>
                <span className="hide-mobile">Edit</span>
              </Link>
              {currentUser.id === expense.paidBy && (
                <button 
                  onClick={handleDeleteExpense}
                className="button danger"
                title="Delete expense"
              >
                <i className="fi fi-rr-trash"></i>
                <span className="hide-mobile">Delete</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="expense-details-content">
        <div className="expense-main-info card">
          <div className="expense-amount">
            <span className="currency">{expense.currency}</span>
            <span className="amount">{expense.amount.toFixed(2)}</span>
          </div>
          
          <div className="expense-meta">
            <div className="meta-item">
              <strong>Category:</strong> 
              <span className="category-display">
                {expense.category ? (
                  <>
                    <span className="category-icon">
                      {getCategoryIcon(parseCategoryString(expense.category).category)}
                    </span>
                    <span 
                      className="category-text"
                      style={{ color: getCategoryColor(parseCategoryString(expense.category).category) }}
                    >
                      {expense.category}
                    </span>
                  </>
                ) : (
                  <span className="category-text">未分類</span>
                )}
              </span>
            </div>
            {expense.project && (
              <div className="meta-item">
                <strong>Project:</strong> 
                <span className="project-display">📁 {expense.project}</span>
              </div>
            )}
            {expense.notes && (
              <div className="meta-item">
                <strong>Description:</strong> 
                <span className="description-text">{expense.notes}</span>
              </div>
            )}
            <div className="meta-item">
              <strong>Date:</strong> {new Date(expense.date).toLocaleDateString()}
            </div>
            <div className="meta-item">
              <strong>Split type:</strong> {expense.splitType || 'Equal'}
            </div>
            <div className="meta-item">
              <strong>Created:</strong> {new Date(expense.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Payers Information */}
        <div className="payers-details card">
          <h2>Who Paid</h2>
          <div className="payers-list">
            {expense.isMultiplePayers && Array.isArray(expense.paidBy) ? (
              expense.paidBy.map((payer, index) => (
                <div key={index} className="payer-detail-item">
                  <div className="payer-user">
                    <UserPhoto 
                      user={{
                        name: payer.userName,
                        avatarUrl: payer.userAvatarUrl,
                        avatar: payer.userAvatar
                      }} 
                      size="small" 
                      className="payer-user-photo" 
                    />
                    <div className="payer-user-info">
                      <span className="user-name">{payer.userName || 'Unknown User'}</span>
                      <span className="payer-badge">Payer</span>
                    </div>
                  </div>
                  <div className="payer-amount">
                    <span className="currency">{expense.currency}</span>
                    <span className="amount">{payer.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="payer-detail-item">
                <div className="payer-user">
                  <UserPhoto 
                    user={{
                      name: expense.paidByName,
                      avatarUrl: null,
                      avatar: null
                    }} 
                    size="small" 
                    className="payer-user-photo" 
                  />
                  <div className="payer-user-info">
                    <span className="user-name">{expense.paidByName || 'Unknown User'}</span>
                    <span className="payer-badge">Payer</span>
                  </div>
                </div>
                <div className="payer-amount">
                  <span className="currency">{expense.currency}</span>
                  <span className="amount">{expense.amount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="splits-details card">
          <h2>Split Breakdown</h2>
          <div className="splits-list">
            {expense.splits.map((split, index) => {
              // Calculate how much this person paid
              let amountPaid = 0;
              if (expense.isMultiplePayers && Array.isArray(expense.paidBy)) {
                const payer = expense.paidBy.find(p => p.userId === (split.userId || split.user));
                amountPaid = payer ? payer.amount : 0;
              } else if ((split.userId || split.user) === expense.paidBy) {
                amountPaid = expense.amount;
              }
              
              // Calculate balance (what they paid minus what they owe)
              const balance = amountPaid - split.amount;
              const isPayer = amountPaid > 0;
              
              return (
                <div key={index} className="split-detail-item">
                  <div className="split-user">
                    <UserPhoto 
                      user={{
                        name: split.userName,
                        avatarUrl: split.userAvatarUrl,
                        avatar: split.userAvatar
                      }} 
                      size="small" 
                      className="split-user-photo" 
                    />
                    <div className="split-user-info">
                      <span className="user-name">{split.userName || 'Unknown User'}</span>
                      {isPayer && (
                        <span className="payer-badge">Payer</span>
                      )}
                    </div>
                  </div>
                  <div className="split-amounts">
                    <div className="split-amount">
                      <span className="amount-label">Owes:</span>
                      <span className="currency">{expense.currency}</span>
                      <span className="amount">{split.amount.toFixed(2)}</span>
                    </div>
                    {isPayer && (
                      <div className="paid-amount">
                        <span className="amount-label">Paid:</span>
                        <span className="currency">{expense.currency}</span>
                        <span className="amount">{amountPaid.toFixed(2)}</span>
                      </div>
                    )}
                    <div className={`balance-amount ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero'}`}>
                      <span className="amount-label">
                        {balance > 0 ? 'Gets back:' : balance < 0 ? 'Still owes:' : 'Settled:'}
                      </span>
                      <span className="currency">{expense.currency}</span>
                      <span className="amount">{Math.abs(balance).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="split-summary">
            <div className="summary-item">
              <strong>Total Amount: {expense.currency} {expense.amount.toFixed(2)}</strong>
            </div>
            <div className="summary-item">
              Split among {expense.splits.length} member{expense.splits.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {expense.notes && (
          <div className="expense-notes card">
            <h3>Notes</h3>
            <p>{expense.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseDetails;
// Ensuring we have the edit button fix
