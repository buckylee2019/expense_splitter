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
          <Link to="/groups">Groups</Link>
          <span> / </span>
          <Link to={`/groups/${groupId}`}>{group.name}</Link>
        </div>
        
        <h1 className="expense-name">{expense.description}</h1>
      </div>
      
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


        <div className="splits-details card">
          <h2>Split Breakdown</h2>
          <div className="splits-tree">
            {(() => {
              const payerGroups = {};
              
              // Identify payers and get their info from group members
              if (expense.isMultiplePayers && Array.isArray(expense.paidBy)) {
                expense.paidBy.forEach(payer => {
                  const member = group?.members?.find(m => m.id === payer.userId);
                  if (member) {
                    payerGroups[payer.userId] = {
                      name: member.name,
                      paid: payer.amount,
                      avatarUrl: member.avatarUrl,
                      avatar: member.avatar,
                      owes: []
                    };
                  }
                });
              } else {
                const member = group?.members?.find(m => m.id === expense.paidBy);
                if (member) {
                  payerGroups[expense.paidBy] = {
                    name: member.name,
                    paid: expense.amount,
                    avatarUrl: member.avatarUrl,
                    avatar: member.avatar,
                    owes: []
                  };
                }
              }
              
              // Add splits to owes list
              expense.splits.forEach(split => {
                Object.keys(payerGroups).forEach(payerId => {
                  payerGroups[payerId].owes.push({
                    name: split.userName,
                    amount: split.amount,
                    avatarUrl: split.userAvatarUrl,
                    avatar: split.userAvatar,
                    isCurrentUser: split.userName === currentUser?.name
                  });
                });
              });
              
              return Object.values(payerGroups).map((payer, idx) => (
                <div key={idx} className="tree-group">
                  <div className="tree-root">
                    <UserPhoto 
                      user={{
                        name: payer.name,
                        avatarUrl: payer.avatarUrl,
                        avatar: payer.avatar
                      }} 
                      size="medium" 
                    />
                    <span className="tree-root-text">{payer.name} paid {expense.currency || 'TWD'} {payer.paid.toFixed(2)}</span>
                  </div>
                  {payer.owes.length > 0 ? (
                    payer.owes.map((ower, oIdx) => (
                      <div key={oIdx} className={`tree-branch ${oIdx === payer.owes.length - 1 ? 'last' : ''}`}>
                        <span className="tree-line"></span>
                        <UserPhoto 
                          user={{
                            name: ower.name,
                            avatarUrl: ower.avatarUrl,
                            avatar: ower.avatar
                          }} 
                          size="small" 
                        />
                        <span className={ower.isCurrentUser ? 'tree-text highlight' : 'tree-text'}>
                          {ower.isCurrentUser ? 'You owe' : `${ower.name} owes`} {expense.currency || 'TWD'} {ower.amount.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="tree-branch last">
                      <span className="tree-line"></span>
                      <span className="tree-text">No splits</span>
                    </div>
                  )}
                </div>
              ));
            })()}
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
