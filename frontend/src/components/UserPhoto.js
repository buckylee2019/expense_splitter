import React from 'react';

const UserPhoto = ({ user, size = 'small', className = '' }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeClass = size === 'large' ? 'profile-avatar' : 'user-photo';

  // Use avatarUrl (S3) first, then fallback to legacy avatar field
  const avatarSrc = user?.avatarUrl || user?.avatar;

  return (
    <div className={`${sizeClass} ${className}`}>
      {avatarSrc ? (
        <img src={avatarSrc} alt={user.name || 'User'} />
      ) : (
        <div className={size === 'large' ? 'avatar-placeholder' : 'user-photo-placeholder'}>
          {getInitials(user?.name)}
        </div>
      )}
    </div>
  );
};

export default UserPhoto;
