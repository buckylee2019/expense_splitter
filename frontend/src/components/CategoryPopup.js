import React, { useState } from 'react';
import { expenseCategories, getCategoryIcon } from '../data/expenseCategories';

const CategoryPopup = ({ isOpen, onClose, selectedValue, onSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const categories = Object.keys(expenseCategories);
  const filteredCategories = categories.filter(category =>
    category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  const handleSubcategorySelect = (subcategory) => {
    const fullCategory = `${selectedCategory} - ${subcategory}`;
    onSelect(fullCategory);
    onClose();
    setSelectedCategory('');
    setSearchTerm('');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      setSelectedCategory('');
      setSearchTerm('');
    }
  };

  const handleBack = () => {
    setSelectedCategory('');
  };

  const subcategories = selectedCategory ? expenseCategories[selectedCategory] : [];
  const filteredSubcategories = subcategories.filter(sub =>
    sub.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector category-popup">
        <div className="popup-header">
          <div className="header-left">
            {selectedCategory && (
              <button className="back-btn" onClick={handleBack}>
                <i className="fi fi-rr-angle-left"></i>
              </button>
            )}
            <h3>
              {selectedCategory ? `${getCategoryIcon(selectedCategory)} ${selectedCategory}` : 'Select Category'}
            </h3>
          </div>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        <div className="popup-search">
          <input
            type="text"
            placeholder={selectedCategory ? 'Search subcategories...' : 'Search categories...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="popup-options">
          {!selectedCategory ? (
            // Show categories
            filteredCategories.map((category) => (
              <div
                key={category}
                className="popup-option category-option"
                onClick={() => handleCategorySelect(category)}
              >
                <span className="category-icon">{getCategoryIcon(category)}</span>
                <span className="option-text">{category}</span>
                <i className="fi fi-rr-angle-right"></i>
              </div>
            ))
          ) : (
            // Show subcategories
            filteredSubcategories.map((subcategory) => {
              const fullCategory = `${selectedCategory} - ${subcategory}`;
              const isSelected = fullCategory === selectedValue;
              
              return (
                <div
                  key={subcategory}
                  className={`popup-option subcategory-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSubcategorySelect(subcategory)}
                >
                  <span className="option-text">{subcategory}</span>
                  {isSelected && <i className="fi fi-rr-check"></i>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryPopup;
