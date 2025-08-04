import React from 'react';

const PopupSelector = ({ 
  isOpen, 
  onClose, 
  title, 
  options, 
  selectedValue, 
  onSelect, 
  displayKey = 'label',
  valueKey = 'value',
  showSearch = false,
  searchPlaceholder = 'Search...'
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  if (!isOpen) return null;

  const filteredOptions = showSearch 
    ? options.filter(option => 
        (option[displayKey] || option).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleSelect = (option) => {
    const value = typeof option === 'object' ? option[valueKey] : option;
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
      <div className="popup-selector">
        <div className="popup-header">
          <h3>{title}</h3>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        {showSearch && (
          <div className="popup-search">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        )}
        
        <div className="popup-options">
          {filteredOptions.map((option, index) => {
            const displayText = typeof option === 'object' ? option[displayKey] : option;
            const optionValue = typeof option === 'object' ? option[valueKey] : option;
            const isSelected = optionValue === selectedValue;
            
            return (
              <div
                key={index}
                className={`popup-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(option)}
              >
                <span className="option-text">{displayText}</span>
                {isSelected && <i className="fi fi-rr-check"></i>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PopupSelector;
