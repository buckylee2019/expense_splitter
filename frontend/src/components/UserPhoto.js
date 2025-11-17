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

  const getPlaceholderColor = (name) => {
    if (!name) return '#667eea';
    
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple-blue
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-red
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue-cyan
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green-teal
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink-yellow
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Teal-pink
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Coral-pink
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', // Purple-pink
    ];
    
    // Use name to consistently pick a color
    const hash = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeClass = size === 'large' ? 'profile-avatar' : 'user-photo';

  // Use avatarUrl (S3) first, then fallback to legacy avatar field, then default icon
  const avatarSrc = user?.avatarUrl || user?.avatar || '/user_icon.png';

  return (
    <div className={`${sizeClass} ${className}`}>
      <img src={avatarSrc} alt={user?.name || 'User'} />
    </div>
  );
};

export default UserPhoto;
