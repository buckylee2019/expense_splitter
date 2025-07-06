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

  return (
    <div className={`${sizeClass} ${className}`}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.name || 'User'} />
      ) : (
        <div className={size === 'large' ? 'avatar-placeholder' : 'user-photo-placeholder'}>
          {getInitials(user?.name)}
        </div>
      )}
    </div>
  );
};

export default UserPhoto;
