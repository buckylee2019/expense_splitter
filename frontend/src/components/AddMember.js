import React, { useState } from 'react';
import api from '../services/api';

const AddMember = ({ groupId, onMemberAdded, onCancel }) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post(`/api/groups/${groupId}/members`, {
        email: email.trim()
      });

      onMemberAdded(response.data.group);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-member-form">
      <h3>Add New Member</h3>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="memberEmail">Email Address</label>
          <input
            type="email"
            id="memberEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter member's email address"
            required
          />
          <small className="form-help">
            The person must already have an account to be added to the group.
          </small>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddMember;
