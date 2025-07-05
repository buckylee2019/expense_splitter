import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    avatar: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/profile');
      const userData = response.data;
      
      setUser(userData);
      setFormData({
        name: userData.name || '',
        phone: userData.phone || '',
        avatar: userData.avatar || ''
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put('/api/users/profile', formData);
      
      setUser(response.data.user);
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Profile</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="button secondary"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="profile-container">
        <div className="profile-card card">
          <div className="profile-header">
            <div className="profile-avatar">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">
                  {getInitials(formData.name)}
                </div>
              )}
            </div>
            <div className="profile-info">
              <h2>{user?.name || 'User'}</h2>
              <p className="profile-email">{user?.email}</p>
              <p className="profile-joined">
                Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="avatar">Avatar URL</label>
              <input
                type="url"
                id="avatar"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
                placeholder="Enter avatar image URL (optional)"
              />
              <small className="form-help">
                You can use a URL to an image hosted online (e.g., from Gravatar, social media, etc.)
              </small>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="disabled-input"
              />
              <small className="form-help">
                Email address cannot be changed. Contact support if you need to update it.
              </small>
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
                disabled={submitting}
                className="button primary"
              >
                {submitting ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>

        <div className="profile-stats card">
          <h3>Account Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">{user?.groups?.length || 0}</div>
              <div className="stat-label">Groups</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{user?.friends?.length || 0}</div>
              <div className="stat-label">Friends</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {user?.updatedAt ? Math.floor((new Date() - new Date(user.updatedAt)) / (1000 * 60 * 60 * 24)) : 0}
              </div>
              <div className="stat-label">Days since last update</div>
            </div>
          </div>
        </div>

        <div className="profile-actions card">
          <h3>Account Actions</h3>
          <div className="action-buttons">
            <button
              type="button"
              onClick={handleLogout}
              className="logout-button"
            >
              <i className="fi fi-rr-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
          <p className="logout-description">
            Sign out of your account and return to the login page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
