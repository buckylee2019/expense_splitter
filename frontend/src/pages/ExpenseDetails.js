import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

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
          <span>Expense Details</span>
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
                ✏️ Edit Expense
              </Link>
              {currentUser.id === expense.paidBy && (
                <button 
                  onClick={handleDeleteExpense}
                className="button danger"
                title="Delete expense"
              >
                🗑️ Delete Expense
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="expense-details-content">
        <div className="expense-main-info card">
          <h1>{expense.description}</h1>
          <div className="expense-amount">
            <span className="currency">{expense.currency}</span>
            <span className="amount">{expense.amount.toFixed(2)}</span>
          </div>
          
          <div className="expense-meta">
            <div className="meta-item">
              <strong>Category:</strong> {expense.category || 'General'}
            </div>
            <div className="meta-item">
              <strong>Date:</strong> {new Date(expense.date).toLocaleDateString()}
            </div>
            <div className="meta-item">
              <strong>Paid by:</strong> {expense.paidByName || 'Unknown User'}
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
          <div className="splits-list">
            {expense.splits.map((split, index) => (
              <div key={index} className="split-detail-item">
                <div className="split-user">
                  <span className="user-name">{split.userName || 'Unknown User'}</span>
                  {(split.user === expense.paidBy || split.userId === expense.paidBy) && (
                    <span className="payer-badge">Payer</span>
                  )}
                </div>
                <div className="split-amount">
                  <span className="currency">{expense.currency}</span>
                  <span className="amount">{split.amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
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
