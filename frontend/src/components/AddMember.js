import React, { useState } from 'react';
import api from '../services/api';
import MemberPicker from './MemberPicker';

const AddMember = ({ groupId, existingMemberIds = [], onMemberAdded, onCancel, autoFocus = false }) => {
  const [error, setError] = useState('');

  const handleAdd = async (user) => {
    setError('');

    try {
      const response = await api.post(`/api/groups/${groupId}/members`, {
        userId: user.id
      });
      onMemberAdded(response.data.group);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
      return false;
    }
  };

  return (
    <div className="add-member-form">
      <h3>Add New Member</h3>

      {error && <div className="error">{error}</div>}

      <MemberPicker
        excludeIds={existingMemberIds}
        onSelect={handleAdd}
        autoFocus={autoFocus}
      />

      {onCancel && (
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default AddMember;
