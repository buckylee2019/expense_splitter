import React, { useState } from 'react';
import UserPhoto from './UserPhoto';

const SplitConfigPopup = ({ 
  isOpen, 
  onClose, 
  splits, 
  weights, 
  group, 
  formData, 
  onSplitChange, 
  onMemberToggle, 
  onWeightChange,
  onSplitTypeChange,
  totalAmount,
  totalSplits,
  isValid
}) => {
  const [activeTab, setActiveTab] = useState(formData.splitType);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleTabChange = (splitType) => {
    setActiveTab(splitType);
    onSplitTypeChange(splitType);
  };

  const splitTypes = [
    {
      value: 'equal',
      label: 'Equal',
      icon: '⚖️',
      description: 'Split equally among selected members'
    },
    {
      value: 'weight',
      label: 'Weight',
      icon: '⚖️',
      description: 'Split based on custom weights'
    },
    {
      value: 'custom',
      label: 'Custom',
      icon: '✏️',
      description: 'Manually set each person\'s amount'
    }
  ];

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector split-config-popup">
        <div className="popup-header">
          <div className="header-left">
            <h3>Split Configuration</h3>
          </div>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        {/* Split Type Tabs */}
        <div className="split-tabs">
          {splitTypes.map((type) => (
            <button
              key={type.value}
              className={`split-tab ${activeTab === type.value ? 'active' : ''}`}
              onClick={() => handleTabChange(type.value)}
            >
              <span className="tab-icon">{type.icon}</span>
              <span className="tab-label">{type.label}</span>
            </button>
          ))}
        </div>

        {/* Active Tab Description */}
        <div className="split-description-section">
          <p className="split-description-text">
            {splitTypes.find(type => type.value === activeTab)?.description}
          </p>
        </div>
        
        <div className="popup-content split-details-content">
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group.members.find(m => m.user === split.userId);
              const weightObj = weights.find(w => w.userId === split.userId);
              const weight = weightObj?.weight !== undefined ? weightObj.weight : 1;
              
              return (
                <div key={split.userId} className={`split-item ${activeTab === 'equal' && !split.included ? 'excluded' : ''}`}>
                  {activeTab === 'equal' ? (
                    // Enhanced equal split layout with right-aligned toggle
                    <div className="equal-split-layout">
                      <div className="equal-split-left">
                        <div className="member-profile">
                          <UserPhoto 
                            user={{ 
                              id: split.userId, 
                              name: member?.userName || member?.user || `Member ${index + 1}`,
                              // For now, we don't have avatar data in group.members
                              // The UserPhoto component will show initials placeholder
                            }} 
                            size="medium"
                          />
                        </div>
                        <div className="member-details">
                          <span className="member-name">
                            {member ? member.userName || member.user : `Member ${index + 1}`}
                          </span>
                          <span className="member-amount">
                            {split.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="equal-split-right">
                        <div className="member-toggle">
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={split.included}
                              onChange={() => onMemberToggle(split.userId)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Enhanced layout for weight and custom splits with profile photo
                    <div className="member-row-layout">
                      <div className="member-profile">
                        <UserPhoto 
                          user={{ 
                            id: split.userId, 
                            name: member?.userName || member?.user || `Member ${index + 1}`,
                            // For now, we don't have avatar data in group.members
                            // The UserPhoto component will show initials placeholder
                          }} 
                          size="medium"
                        />
                      </div>
                      <div className="member-content">
                        <div className="member-info-row">
                          <div className="member-details-compact">
                            <span className="member-name">
                              {member ? member.userName || member.user : `Member ${index + 1}`}
                            </span>
                            {activeTab === 'weight' && (
                              <span className="weight-shares-info">
                                {weight} share{weight !== 1 ? 's' : ''} ({((weight / weights.reduce((sum, w) => sum + w.weight, 0)) * 100).toFixed(1)}%)
                              </span>
                            )}
                          </div>
                          <div className="amount-display">
                            {activeTab === 'custom' ? (
                              <div className="amount-input-container">
                                <input
                                  type="number"
                                  value={split.amount}
                                  onChange={(e) => onSplitChange(split.userId, e.target.value)}
                                  min="0"
                                  step="1"
                                  className="amount-input"
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <span className="calculated-amount">
                                {split.amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {activeTab === 'weight' && (
                          <div className="weight-controls-inline">
                            <span className="weight-label">Adjust shares:</span>
                            <div className="weight-controls-compact">
                              <button
                                type="button"
                                className="weight-btn weight-decrease"
                                onClick={() => onWeightChange(split.userId, Math.max(0, weight - 0.5))}
                              >
                                <i className="fi fi-rr-minus"></i>
                              </button>
                              <div className="weight-display-compact">
                                <input
                                  type="number"
                                  value={weight}
                                  onChange={(e) => onWeightChange(split.userId, parseFloat(e.target.value) || 0)}
                                  min="0"
                                  step="0.5"
                                  className="weight-input-compact"
                                />
                              </div>
                              <button
                                type="button"
                                className="weight-btn weight-increase"
                                onClick={() => onWeightChange(split.userId, weight + 0.5)}
                              >
                                <i className="fi fi-rr-plus"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="split-summary">
            <div className="summary-row">
              <span className="summary-label">Total Amount:</span>
              <span className="summary-value">{formData.currency} {totalAmount.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Split Total:</span>
              <span className="summary-value">{formData.currency} {totalSplits.toFixed(2)}</span>
            </div>
            {activeTab === 'weight' && (
              <div className="summary-row">
                <span className="summary-label">Total Shares:</span>
                <span className="summary-value">{weights.reduce((sum, w) => sum + w.weight, 0)} shares</span>
              </div>
            )}
            {activeTab === 'custom' && (
              <div className="summary-row">
                <span className="summary-label">Remaining:</span>
                <span className={`summary-value ${totalAmount - totalSplits >= 0 ? 'positive' : 'negative'}`}>
                  {formData.currency} {(totalAmount - totalSplits).toFixed(2)}
                </span>
              </div>
            )}
            {!isValid && (
              <div className="validation-error">
                <i className="fi fi-rr-exclamation-triangle"></i>
                <span>Splits don't match total amount!</span>
              </div>
            )}
          </div>
        </div>

        <div className="popup-actions">
          <button
            type="button"
            onClick={onClose}
            className="button primary full-width"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitConfigPopup;
