import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MemberPicker from '../components/MemberPicker';
import UserPhoto from '../components/UserPhoto';

const CreateGroup = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const selectMember = (user) => {
    setMembers(prev => (prev.some(m => m.id === user.id) ? prev : [...prev, user]));
  };

  const removeMember = (userId) => {
    setMembers(prev => prev.filter(m => m.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create the group first
      const groupResponse = await api.post('/api/groups', formData);
      const groupId = groupResponse.data.group.id;

      // Add members to the group
      for (const member of members) {
        try {
          await api.post(`/api/groups/${groupId}/members`, { userId: member.id });
        } catch (memberError) {
          console.warn(`Failed to add member ${member.name}:`, memberError.response?.data?.error);
        }
      }

      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
      setLoading(false);
    }
  };

  return (
    <div className="create-group">
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="group-form card">
        <div className="form-group">
          <label htmlFor="name">Group Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter group name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="What's this group for?"
            rows="3"
          />
        </div>

        <div className="members-section">
          <h3>Add Members (Optional)</h3>
          <p className="help-text">
            You can add members now or invite them later.
          </p>

          {members.length > 0 && (
            <ul className="selected-members">
              {members.map(member => (
                <li key={member.id} className="selected-member">
                  <UserPhoto user={member} />
                  <span>{member.name}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    className="selected-member-remove"
                    aria-label={`Remove ${member.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <MemberPicker
            excludeIds={members.map(m => m.id)}
            onSelect={selectMember}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="button secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="button primary"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGroup;
