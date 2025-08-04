import React from 'react';
import UserPhoto from './UserPhoto';

const PaidByPopup = ({ 
  isOpen, 
  onClose, 
  members, 
  currentUser,
  selectedValue, 
  onSelect,
  onMultiplePayers
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleMemberSelect = (userId) => {
    onSelect(userId);
    onClose();
  };

  const handleMultiplePayers = () => {
    onMultiplePayers();
    onClose();
  };

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector paid-by-popup">
        <div className="popup-header">
          <div className="header-left">
            <h3>Choose payer</h3>
          </div>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        <div className="popup-content">
          <div className="paid-by-list">
            {members?.map((member) => {
              const isCurrentUser = member.user === currentUser?.id;
              const displayName = member.userName || member.user;
              const isSelected = selectedValue === member.user;
              
              return (
                <div 
                  key={member.user} 
                  className={`paid-by-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMemberSelect(member.user)}
                >
                  <div className="paid-by-left">
                    <div className="member-profile">
                      <UserPhoto 
                        user={{ 
                          id: member.user, 
                          name: displayName,
                          avatarUrl: member?.avatarUrl,
                          avatar: member?.avatar
                        }} 
                        size="medium"
                      />
                    </div>
                    <div className="member-details">
                      <span className="member-name">
                        {displayName}{isCurrentUser ? ' (You)' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="paid-by-right">
                    {isSelected && (
                      <div className="selection-indicator">
                        <i className="fi fi-rr-check"></i>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Multiple people option */}
            <div 
              className="paid-by-item multiple-people-option"
              onClick={handleMultiplePayers}
            >
              <div className="paid-by-left">
                <div className="multiple-people-icon">
                  <i className="fi fi-rr-users"></i>
                </div>
                <div className="member-details">
                  <span className="member-name">Multiple people</span>
                </div>
              </div>
              <div className="paid-by-right">
                <div className="arrow-indicator">
                  <i className="fi fi-rr-angle-right"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaidByPopup;
