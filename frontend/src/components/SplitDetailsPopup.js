import React from 'react';

const SplitDetailsPopup = ({ 
  isOpen, 
  onClose, 
  splits, 
  weights, 
  group, 
  formData, 
  onSplitChange, 
  onMemberToggle, 
  onWeightChange,
  totalAmount,
  totalSplits,
  isValid
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getSplitTypeTitle = () => {
    switch (formData.splitType) {
      case 'equal': return 'Equal Split';
      case 'weight': return 'Weight-based Split';
      case 'custom': return 'Custom Split';
      default: return 'Split Details';
    }
  };

  const getSplitTypeDescription = () => {
    switch (formData.splitType) {
      case 'equal': return 'Select members to include in equal split';
      case 'weight': return 'Set weights for each member (higher weight = larger share)';
      case 'custom': return 'Manually set each person\'s amount';
      default: return '';
    }
  };

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector split-details-popup">
        <div className="popup-header">
          <div className="header-left">
            <h3>{getSplitTypeTitle()}</h3>
          </div>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        {getSplitTypeDescription() && (
          <div className="split-description-section">
            <p className="split-description-text">{getSplitTypeDescription()}</p>
          </div>
        )}
        
        <div className="popup-content split-details-content">
          <div className="splits-list">
            {splits.map((split, index) => {
              const member = group.members.find(m => m.user === split.userId);
              const weightObj = weights.find(w => w.userId === split.userId);
              const weight = weightObj?.weight !== undefined ? weightObj.weight : 1;
              
              return (
                <div key={split.userId} className={`split-item ${formData.splitType === 'equal' && !split.included ? 'excluded' : ''}`}>
                  <div className="member-info">
                    <div className="member-details">
                      <span className="member-name">
                        {member ? member.userName || member.user : `Member ${index + 1}`}
                      </span>
                      {formData.splitType === 'weight' && (
                        <span className="weight-percentage">
                          ({((weight / weights.reduce((sum, w) => sum + w.weight, 0)) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    
                    {formData.splitType === 'equal' && (
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
                    )}
                  </div>
                  
                  {formData.splitType === 'weight' && (
                    <div className="weight-controls">
                      <button
                        type="button"
                        className="weight-btn weight-decrease"
                        onClick={() => onWeightChange(split.userId, Math.max(0, weight - 0.5))}
                      >
                        <i className="fi fi-rr-minus"></i>
                      </button>
                      <div className="weight-display">
                        <input
                          type="number"
                          value={weight}
                          onChange={(e) => onWeightChange(split.userId, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.5"
                          className="weight-input"
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
                  )}
                  
                  <div className="amount-section">
                    <div className="amount-label">Amount:</div>
                    <div className="amount-input-container">
                      <input
                        type="number"
                        value={split.amount}
                        onChange={(e) => onSplitChange(split.userId, e.target.value)}
                        disabled={formData.splitType === 'equal' || formData.splitType === 'weight'}
                        min="0"
                        step="1"
                        className="amount-input"
                        placeholder="0.00"
                      />
                      <span className="currency-symbol">{formData.currency}</span>
                    </div>
                  </div>
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
            {formData.splitType === 'custom' && (
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

export default SplitDetailsPopup;
