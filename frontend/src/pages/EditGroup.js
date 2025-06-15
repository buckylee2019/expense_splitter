import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const EditGroup = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [group, setGroup] = useState({
    name: '',
    description: '',
    members: []
  });
  const [newMemberEmail, setNewMemberEmail] = useState('');

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/groups/${id}`);
      setGroup(response.data);
    } catch (error) {
      console.error('Error fetching group:', error);
      setError('Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.put(`/api/groups/${id}`, {
        name: group.name,
        description: group.description
      });
      navigate('/groups');
    } catch (error) {
      console.error('Error updating group:', error);
      setError(error.response?.data?.error || 'Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    try {
      await api.post(`/api/groups/${id}/members`, {
        email: newMemberEmail.trim()
      });
      setNewMemberEmail('');
      fetchGroup(); // Refresh group data
    } catch (error) {
      console.error('Error adding member:', error);
      setError(error.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (window.confirm(`Remove ${memberName} from this group?`)) {
      try {
        await api.delete(`/api/groups/${id}/members/${memberId}`);
        fetchGroup(); // Refresh group data
      } catch (error) {
        console.error('Error removing member:', error);
        setError(error.response?.data?.error || 'Failed to remove member');
      }
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading group details...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Edit Group</h1>
        <button 
          onClick={() => navigate('/groups')} 
          className="btn btn-secondary"
        >
          ← Back to Groups
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="edit-group-container">
        <div className="group-details-section">
          <h2>Group Details</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="name">Group Name *</label>
              <input
                type="text"
                id="name"
                value={group.name}
                onChange={(e) => setGroup({...group, name: e.target.value})}
                required
                placeholder="Enter group name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={group.description}
                onChange={(e) => setGroup({...group, description: e.target.value})}
                placeholder="Enter group description (optional)"
                rows="3"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="group-members-section">
          <h2>Group Members ({group.members?.length || 0})</h2>
          
          <form onSubmit={handleAddMember} className="add-member-form">
            <div className="form-group">
              <label htmlFor="newMemberEmail">Add New Member</label>
              <div className="input-group">
                <input
                  type="email"
                  id="newMemberEmail"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Enter email address"
                />
                <button type="submit" className="btn btn-primary">
                  Add Member
                </button>
              </div>
            </div>
          </form>

          <div className="members-list">
            {group.members?.map(member => (
              <div key={member.id} className="member-item">
                <div className="member-info">
                  <span className="member-name">{member.name || member.email}</span>
                  <span className="member-email">{member.email}</span>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                  className="btn btn-sm btn-danger"
                  title="Remove member"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditGroup;
