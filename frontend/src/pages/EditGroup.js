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
    photo: null,
    members: []
  });
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/groups/${id}`);
      setGroup(response.data);
      // Set initial photo preview if group has a photo
      if (response.data.photo) {
        setPhotoPreview(response.data.photo);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      setError('Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  // Image compression function
  const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoUpload = async (event) => {
    console.log('handlePhotoUpload called', event);
    const file = event.target.files[0];
    console.log('Selected file:', file);
    
    if (!file) {
      console.log('No file selected');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('Invalid file type:', file.type);
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB, will be compressed automatically)
    if (file.size > 5 * 1024 * 1024) {
      console.log('File too large:', file.size);
      alert('Image size should be less than 5MB');
      return;
    }

    console.log('File validation passed, processing...');
    
    // Compress image if it's larger than 1MB
    let processedFile = file;
    if (file.size > 1 * 1024 * 1024) {
      console.log('Compressing large image...');
      processedFile = await compressImage(file);
      console.log('Image compressed from', file.size, 'to', processedFile.size);
    }
    
    setPhotoFile(processedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('Preview created, data length:', e.target.result.length);
      // Check base64 size (should be under 300KB for DynamoDB)
      if (e.target.result.length > 300000) {
        alert('Image is too large when converted. Please choose a smaller image.');
        setPhotoFile(null);
        setPhotoPreview(group.photo || '');
        return;
      }
      setPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(processedFile);
  };

  const saveGroupPhoto = async () => {
    if (!photoFile) return;

    setUploadingPhoto(true);
    
    try {
      // Convert photo to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const photoData = {
          photo: e.target.result
        };
        
        console.log('Uploading photo to:', `/api/groups/${id}/photo`);
        console.log('Photo data size:', e.target.result.length);
        
        const response = await api.put(`/api/groups/${id}/photo`, photoData);
        
        console.log('Upload response:', response.data);
        
        // Update group data with new photo
        setGroup(prev => ({
          ...prev,
          photo: response.data.photoUrl || e.target.result
        }));
        
        // Clear the photo file after successful upload
        setPhotoFile(null);
        
        alert('Group photo updated successfully!');
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(photoFile);
      
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('Failed to upload photo: ' + (err.response?.data?.error || err.message));
      setUploadingPhoto(false);
    }
  };

  const removeGroupPhoto = async () => {
    try {
      setUploadingPhoto(true);
      
      const response = await api.put(`/api/groups/${id}/photo`, {
        photo: null
      });
      
      // Update group data to remove photo
      setGroup(prev => ({
        ...prev,
        photo: null
      }));
      
      // Clear preview states
      setPhotoFile(null);
      setPhotoPreview('');
      
      alert('Group photo removed successfully!');
      setUploadingPhoto(false);
    } catch (err) {
      console.error('Error removing photo:', err);
      alert('Failed to remove photo: ' + (err.response?.data?.error || err.message));
      setUploadingPhoto(false);
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

            <div className="form-group">
              <label htmlFor="group-photo">Group Photo</label>
              <div className="photo-upload-section">
                <div className="current-photo-preview">
                  <img 
                    src={photoPreview || group.photo || '/background.png'} 
                    alt="Group banner preview"
                    className="photo-preview"
                  />
                </div>
                <div className="photo-upload-controls">
                  <input
                    type="file"
                    id="group-photo-upload"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="photo-input"
                    style={{ display: 'none' }}
                  />
                  <label 
                    htmlFor="group-photo-upload" 
                    className="btn btn-primary photo-upload-btn"
                  >
                    <i className="fi fi-rr-camera"></i> 
                    Choose Photo
                  </label>
                  {(photoPreview || photoFile) && (
                    <>
                      <button 
                        type="button"
                        onClick={saveGroupPhoto}
                        className="btn btn-success"
                        disabled={uploadingPhoto}
                      >
                        <i className="fi fi-rr-check"></i> 
                        {uploadingPhoto ? 'Saving...' : 'Save Photo'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(group.photo || '');
                        }}
                        className="btn btn-secondary"
                      >
                        <i className="fi fi-rr-cross"></i> Cancel
                      </button>
                    </>
                  )}
                  {group.photo && !photoFile && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm('Remove group photo and use default background?')) {
                          removeGroupPhoto();
                        }
                      }}
                      className="btn btn-danger"
                      disabled={uploadingPhoto}
                    >
                      <i className="fi fi-rr-trash"></i> 
                      {uploadingPhoto ? 'Removing...' : 'Remove Photo'}
                    </button>
                  )}
                </div>
                <small className="form-help">
                  Upload a group photo (max 5MB, automatically compressed). Supported formats: JPG, PNG, GIF
                </small>
              </div>
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
              <div key={member.user || member.id} className="member-item">
                <div className="member-info">
                  <span className="member-name">
                    {member.userName || member.name || member.email || 'Unknown User'}
                  </span>
                  <span className="member-email">
                    {member.email || 'No email'}
                  </span>
                  <span className="member-role">
                    {member.role === 'admin' ? '👑 Admin' : '👤 Member'}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveMember(
                    member.user || member.id, 
                    member.userName || member.name || member.email || 'this member'
                  )}
                  className="btn btn-sm btn-danger"
                  title={`Remove ${member.userName || member.name || member.email || 'member'}`}
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
