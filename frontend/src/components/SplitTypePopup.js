import React from 'react';

const SplitTypePopup = ({ isOpen, onClose, selectedValue, onSelect }) => {
  if (!isOpen) return null;

  const splitTypes = [
    {
      value: 'equal',
      label: 'Equal Split',
      description: 'Split equally among selected members',
      icon: '⚖️'
    },
    {
      value: 'weight',
      label: 'Weight-based Split',
      description: 'Split based on custom weights',
      icon: '⚖️'
    },
    {
      value: 'custom',
      label: 'Custom Split',
      description: 'Manually set each person\'s amount',
      icon: '✏️'
    }
  ];

  const handleSelect = (value) => {
    onSelect(value);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector split-type-popup">
        <div className="popup-header">
          <h3>Split Type</h3>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        <div className="popup-options">
          {splitTypes.map((type) => {
            const isSelected = type.value === selectedValue;
            
            return (
              <div
                key={type.value}
                className={`popup-option split-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(type.value)}
              >
                <div className="split-option-content">
                  <div className="split-option-header">
                    <span className="split-icon">{type.icon}</span>
                    <span className="option-text">{type.label}</span>
                    {isSelected && <i className="fi fi-rr-check"></i>}
                  </div>
                  <p className="split-description">{type.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SplitTypePopup;
