import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CreateGroup = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [members, setMembers] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleMemberChange = (index, value) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  const addMemberField = () => {
    setMembers([...members, '']);
  };

  const removeMemberField = (index) => {
    if (members.length > 1) {
      const newMembers = members.filter((_, i) => i !== index);
      setMembers(newMembers);
    }
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
      const validMembers = members.filter(email => email.trim() !== '');
      
      for (const email of validMembers) {
        try {
          await api.post(`/api/groups/${groupId}/members`, { email: email.trim() });
        } catch (memberError) {
          console.warn(`Failed to add member ${email}:`, memberError.response?.data?.error);
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
            You can add members now or invite them later. Enter their email addresses.
          </p>
          
          {members.map((member, index) => (
            <div key={index} className="member-input-group">
              <input
                type="email"
                value={member}
                onChange={(e) => handleMemberChange(index, e.target.value)}
                placeholder="Enter email address"
                className="member-input"
              />
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMemberField(index)}
                  className="remove-member-btn"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={addMemberField}
            className="add-member-btn button secondary"
          >
            Add Another Member
          </button>
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
