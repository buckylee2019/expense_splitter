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
  // Photo changes are staged and applied by the main Save button
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  // Close the member action menu on any outside click
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

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
    // Reset so picking the same file again still fires onChange
    event.target.value = '';
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
    setPhotoRemoved(false);
    
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

  const hasSavedPhoto = !!(group.photoUrl || group.photo);

  const undoPhotoChange = () => {
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPhotoPreview(group.photoUrl || group.photo || '');
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoRemoved(hasSavedPhoto);
  };

  const readAsDataURL = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.put(`/api/groups/${id}`, {
        name: group.name,
        description: group.description
      });

      if (photoFile) {
        await api.put(`/api/groups/${id}/photo`, { photo: await readAsDataURL(photoFile) });
      } else if (photoRemoved) {
        await api.delete(`/api/groups/${id}/photo`);
      }

      navigate('/groups');
    } catch (error) {
      console.error('Error updating group:', error);
      setError(error.response?.data?.error || 'Failed to update group');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    src={(!photoRemoved && (photoPreview || group.photoUrl || group.photo)) || '/group_background.png'}
                    alt="Group banner preview"
                    className="photo-preview"
                    onError={e => {
                      // Fall back to the default banner if the stored photo URL is dead
                      if (!e.currentTarget.src.endsWith('/group_background.png')) {
                        e.currentTarget.src = '/group_background.png';
                      }
                    }}
                  />
                </div>
                <div className="photo-actions">
                  <input
                    type="file"
                    id="group-photo-upload"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="photo-input"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="group-photo-upload" className="photo-action-btn">
                    <i className="fi fi-rr-camera"></i>
                    {hasSavedPhoto || photoFile ? 'Change photo' : 'Choose photo'}
                  </label>
                  {(photoFile || (hasSavedPhoto && !photoRemoved)) && (
                    <button type="button" onClick={removePhoto} className="photo-action-btn danger">
                      <i className="fi fi-rr-trash"></i>
                      Remove
                    </button>
                  )}
                  {(photoFile || photoRemoved) && (
                    <button type="button" onClick={undoPhotoChange} className="photo-action-btn">
                      <i className="fi fi-rr-undo"></i>
                      Undo
                    </button>
                  )}
                </div>
                {(photoFile || photoRemoved) && (
                  <div className="photo-pending-note">
                    {photoFile ? 'New photo will be saved' : 'Photo will be removed'} when you click Save.
                  </div>
                )}
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
                    <div className="member-menu">
                      <button
                        type="button"
                        className="member-menu-toggle"
                        aria-label={`Actions for ${memberName}`}
                        aria-expanded={openMenuId === memberId}
                        onClick={e => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === memberId ? null : memberId);
                        }}
                      >
                        <i className="fi fi-rr-menu-dots-vertical"></i>
                      </button>
                      {openMenuId === memberId && (
                        <div className="member-menu-dropdown" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleChangeRole(memberId, memberName, member.role === 'admin' ? 'member' : 'admin')}
                          >
                            <i className="fi fi-rr-crown"></i>
                            {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => handleRemoveMember(memberId, memberName)}
                          >
                            <i className="fi fi-rr-trash"></i>
                            Remove from group
                          </button>
                        </div>
                      )}
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
