import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import ImageCropper from '../components/ImageCropper';
import AddMember from '../components/AddMember';
import UserPhoto from '../components/UserPhoto';

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
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  // AuthContext's user is only set at login, so it's empty after a reload
  useEffect(() => {
    api.get('/api/users/profile')
      .then(res => setCurrentUser(res.data))
      .catch(err => console.error('Error fetching profile:', err));
  }, []);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/groups/${id}`);
      setGroup(response.data);
      // Set initial photo preview if group has a photo URL or legacy photo
      if (response.data.photoUrl) {
        setPhotoPreview(response.data.photoUrl);
      } else if (response.data.photo) {
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

    // Validate file size (max 10MB for S3)
    if (file.size > 10 * 1024 * 1024) {
      console.log('File too large:', file.size);
      alert('Image size should be less than 10MB');
      return;
    }

    console.log('File validation passed, showing cropper...');
    
    // Show cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob) => {
    console.log('Crop complete, blob size:', croppedBlob.size);
    
    // Compress if needed
    let processedFile = croppedBlob;
    if (croppedBlob.size > 1 * 1024 * 1024) {
      console.log('Compressing cropped image...');
      processedFile = await compressImage(croppedBlob);
      console.log('Image compressed from', croppedBlob.size, 'to', processedFile.size);
    }
    
    setPhotoFile(processedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(processedFile);
    
    setShowCropper(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
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
        
        // Update group data with new photo URL
        setGroup(prev => ({
          ...prev,
          photoUrl: response.data.photoUrl,
          photo: null // Clear legacy photo field
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
      
      const response = await api.delete(`/api/groups/${id}/photo`);
      
      // Update group data to remove photo
      setGroup(prev => ({
        ...prev,
        photoUrl: null,
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

  const handleRemoveMember = async (memberId, memberName) => {
    if (window.confirm(`Remove ${memberName} from this group?`)) {
      try {
        await api.delete(`/api/groups/${id}/members/${memberId}`);
        fetchGroup(); // Refresh group data
      } catch (error) {
        console.error('Error removing member:', error);
        // The page-level error banner is out of view down here, so alert instead
        alert(error.response?.status === 403
          ? 'Only group admins can remove members.'
          : 'Failed to remove member: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleChangeRole = async (memberId, memberName, role) => {
    const prompt = role === 'admin'
      ? `Make ${memberName} an admin? Admins can remove members and edit the group.`
      : `Remove admin rights from ${memberName}?`;
    if (!window.confirm(prompt)) return;
    try {
      const res = await api.put(`/api/groups/${id}/members/${memberId}/role`, { role });
      // Only take the member list, so unsaved name/description edits survive
      setGroup(prev => ({ ...prev, members: res.data.group.members }));
    } catch (error) {
      console.error('Error changing member role:', error);
      alert('Failed to change role: ' + (error.response?.data?.error || error.message));
    }
  };

  const isCurrentUserAdmin = !!currentUser && (group.members || []).some(
    m => m.user === currentUser.id && m.role === 'admin'
  );

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
                    src={photoPreview || group.photoUrl || group.photo || '/background.png'} 
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
                          setPhotoPreview(group.photoUrl || group.photo || '');
                        }}
                        className="btn btn-secondary"
                      >
                        <i className="fi fi-rr-cross"></i>&nbsp;Cancel
                      </button>
                    </>
                  )}
                  {(group.photoUrl || group.photo) && !photoFile && (
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
                      {uploadingPhoto ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
                <small className="form-help">
                  Upload a group photo (max 10MB). Supported formats: JPG, PNG, GIF, WebP. Photos are stored securely and served via CDN.
                </small>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>

        <div className="group-members-section">
          <h2>Group Members ({group.members?.length || 0})</h2>
          
          <AddMember
            groupId={id}
            existingMemberIds={(group.members || []).map(m => m.user)}
            // Only take the member list, so unsaved name/description edits survive
            onMemberAdded={updatedGroup => setGroup(prev => ({ ...prev, members: updatedGroup.members }))}
          />

          <ul className="add-member-options group-member-options">
            {group.members?.map(member => {
              const memberId = member.user || member.id;
              const memberName = member.userName || member.name || member.email || 'Unknown User';
              return (
                <li key={memberId} className="add-member-option">
                  <UserPhoto user={{ ...member, name: memberName }} />
                  <div className="add-member-option-info">
                    <span className="add-member-option-name">
                      {memberName}
                      {member.role === 'admin' && <span className="group-member-admin">👑 Admin</span>}
                    </span>
                    <span className="add-member-option-meta">{member.email || 'No email'}</span>
                  </div>
                  {isCurrentUserAdmin && (
                    <div className="member-actions">
                      <button
                        onClick={() => handleChangeRole(memberId, memberName, member.role === 'admin' ? 'member' : 'admin')}
                        className="btn btn-secondary btn-small"
                      >
                        {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(memberId, memberName)}
                        className="btn btn-danger btn-small"
                        title={`Remove ${memberName}`}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      {showCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={16 / 9}
        />
      )}
    </div>
  );
};

export default EditGroup;
