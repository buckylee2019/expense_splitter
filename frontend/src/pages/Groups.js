import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (window.confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      try {
        await api.delete(`/api/groups/${groupId}`);
        setGroups(groups.filter(group => group.id !== groupId));
      } catch (error) {
        console.error('Error deleting group:', error);
        setError('Failed to delete group');
      }
    }
  };

  const handleEditGroup = (groupId) => {
    navigate(`/groups/${groupId}/edit`);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Groups</h1>
        <Link to="/groups/create" className="btn btn-primary">
          + Create New Group
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">
          <h3>No groups yet</h3>
          <p>Create your first group to start splitting expenses with friends!</p>
          <Link to="/groups/create" className="btn btn-primary">
            Create Your First Group
          </Link>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(group => (
            <div key={group.id} className="group-card">
              <div className="group-header">
                <h3 className="group-name">{group.name}</h3>
                <div className="group-actions">
                  <button 
                    onClick={() => handleEditGroup(group.id)}
                    className="btn btn-sm btn-secondary"
                    title="Edit Group"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="btn btn-sm btn-danger"
                    title="Delete Group"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
              
              <div className="group-info">
                <p className="group-description">{group.description || 'No description'}</p>
                <div className="group-stats">
                  <span className="stat">
                    👥 {group.members?.length || 0} members
                  </span>
                  <span className="stat">
                    💰 {group.expenseCount || 0} expenses
                  </span>
                </div>
              </div>

              <div className="group-footer">
                <Link 
                  to={`/groups/${group.id}`} 
                  className="btn btn-primary btn-sm"
                >
                  View Details
                </Link>
                <Link 
                  to={`/groups/${group.id}/expenses/create`} 
                  className="btn btn-secondary btn-sm"
                >
                  Add Expense
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Groups;
