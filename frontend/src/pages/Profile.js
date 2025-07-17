import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import UserPhoto from '../components/UserPhoto';

const Profile = () => {
  const navigate = useNavigate();
  const { logout, updateUser } = useAuth();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    avatar: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
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
        avatar: userData.avatarUrl || userData.avatar || '' // Use avatarUrl first, then fallback to legacy avatar
      });
      // Set photo preview from S3 URL or legacy avatar
      setPhotoPreview(userData.avatarUrl || userData.avatar || '');
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 2MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo size must be less than 2MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Clear messages
      if (error) setError('');
      if (success) setSuccess('');
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setFormData(prev => ({
      ...prev,
      avatar: ''
    }));
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
      let updatedFormData = { ...formData };
      
      // If there's a new photo, convert it to base64
      if (photoFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          updatedFormData.avatar = e.target.result;
          
          const response = await api.put('/api/users/profile', updatedFormData);
          setUser(response.data.user);
          updateUser(response.data.user); // Update AuthContext with fresh user data
          // Update form data with the new avatarUrl from response
          setFormData(prev => ({
            ...prev,
            avatar: response.data.user.avatarUrl || response.data.user.avatar || ''
          }));
          // Update photo preview with the new S3 URL
          setPhotoPreview(response.data.user.avatarUrl || response.data.user.avatar || '');
          setPhotoFile(null); // Clear the file input
          setSuccess('Profile updated successfully!');
          
          // Clear the photo file after successful upload
          setPhotoFile(null);
          
          // Clear success message after 3 seconds
          setTimeout(() => setSuccess(''), 3000);
          setSubmitting(false);
        };
        reader.readAsDataURL(photoFile);
      } else {
        const response = await api.put('/api/users/profile', updatedFormData);
        setUser(response.data.user);
        updateUser(response.data.user); // Update AuthContext with fresh user data
        setSuccess('Profile updated successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
        setSubmitting(false);
      }
      
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
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
      <div className="profile-container">
        <div className="profile-card card">
          <div className="profile-header">
            <UserPhoto 
              user={{ 
                name: formData.name, 
                avatarUrl: photoPreview || formData.avatar, // Use avatarUrl field for UserPhoto component
                avatar: !photoPreview && !formData.avatar ? '' : undefined // Legacy fallback
              }} 
              size="large" 
            />
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
              <label htmlFor="photo">Profile Photo</label>
              <div className="photo-upload-section">
                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="photo-input"
                />
                <label htmlFor="photo" className="photo-upload-btn">
                  <i className="fi fi-rr-camera"></i>
                  Choose Photo
                </label>
                {(photoPreview || formData.avatar) && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="btn btn-sm btn-danger"
                    style={{ marginLeft: '10px' }}
                  >
                    <i className="fi fi-rr-trash"></i>
                    Remove
                  </button>
                )}
              </div>
              <small className="form-help">
                Upload a profile photo (max 2MB). Supported formats: JPG, PNG, GIF
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
