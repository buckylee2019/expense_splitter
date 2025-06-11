import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const GroupDetails = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        const [groupRes, expensesRes, balancesRes] = await Promise.all([
          api.get(`/api/groups/${groupId}`),
          api.get(`/api/expenses?groupId=${groupId}`),
          api.get(`/api/balances?groupId=${groupId}`)
        ]);

        setGroup(groupRes.data);
        setExpenses(expensesRes.data);
        setBalances(balancesRes.data.balances);
        setLoading(false);
      } catch (err) {
        setError('Failed to load group data');
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [groupId]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="group-details">
      <div className="page-header">
        <h1>{group.name}</h1>
        <Link 
          to={`/groups/${groupId}/expenses/add`}
          className="button primary"
        >
          Add Expense
        </Link>
      </div>

      <div className="group-info card">
        <h3>Group Information</h3>
        <p>{group.description}</p>
        <div className="members-list">
          <h4>Members</h4>
          <ul>
            {group.members.map(member => (
              <li key={member.user}>
                {member.user}
                {member.role === 'admin' && (
                  <span className="admin-badge">Admin</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="expenses-section">
        <h2>Expenses</h2>
        {expenses.length === 0 ? (
          <p className="no-expenses">
            No expenses yet. Add one to get started!
          </p>
        ) : (
          <div className="expenses-list">
            {expenses.map(expense => (
              <div key={expense.id} className="expense-card card">
                <div className="expense-header">
                  <h3>{expense.description}</h3>
                  <span className="amount">
                    {expense.currency} {expense.amount.toFixed(2)}
                  </span>
                </div>
                <div className="expense-details">
                  <span className="category">{expense.category}</span>
                  <span className="date">
                    {new Date(expense.date).toLocaleDateString()}
                  </span>
                  <span className="paid-by">
                    Paid by: {expense.paidBy}
                  </span>
                </div>
                <div className="splits">
                  {expense.splits.map((split, index) => (
                    <div key={index} className="split-item">
                      <span>{split.userId}</span>
                      <span>{expense.currency} {split.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {balances.length > 0 && (
        <div className="balances-section">
          <h2>Current Balances</h2>
          <div className="balances-list">
            {balances.map((balance, index) => (
              <div key={index} className={`balance-card card ${balance.type}`}>
                <span className="user">
                  {balance.type === 'owes_you' ? 
                    `${balance.userName} owes you` : 
                    `You owe ${balance.userName}`}
                </span>
                <span className="amount">
                  {balance.currency} {balance.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
