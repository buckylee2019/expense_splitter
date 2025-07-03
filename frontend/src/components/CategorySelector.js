import React, { useState, useEffect } from 'react';
import { 
  expenseCategories, 
  getAllCategories, 
  getSubcategories, 
  parseCategoryString,
  getCategoryColor,
  getCategoryIcon 
} from '../data/expenseCategories';

const CategorySelector = ({ value, onChange, required = false }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const { category, subcategory } = parseCategoryString(value);
      setSelectedCategory(category);
      setSelectedSubcategory(subcategory);
    }
  }, [value]);

  // Handle category selection
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
    
    // If no subcategories, close and set value
    const subcategories = getSubcategories(category);
    if (subcategories.length === 0) {
      setIsOpen(false);
      onChange(category);
    }
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setIsOpen(false);
    onChange(`${selectedCategory} - ${subcategory}`);
  };

  // Get display text
  const getDisplayText = () => {
    if (!selectedCategory) return '選擇分類...';
    if (!selectedSubcategory) return selectedCategory;
    return `${selectedCategory} - ${selectedSubcategory}`;
  };

  // Clear selection
  const clearSelection = (e) => {
    e.stopPropagation();
    setSelectedCategory('');
    setSelectedSubcategory('');
    onChange('');
  };

  return (
    <div className="category-selector">
      <div 
        className={`category-selector-trigger ${isOpen ? 'open' : ''} ${!value && required ? 'required' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="category-display">
          {selectedCategory && (
            <span className="category-icon">
              {getCategoryIcon(selectedCategory)}
            </span>
          )}
          <span className="category-text">{getDisplayText()}</span>
        </div>
        <div className="category-actions">
          {value && (
            <button
              type="button"
              className="clear-button"
              onClick={clearSelection}
              title="清除選擇"
            >
              ✕
            </button>
          )}
          <span className={`dropdown-arrow ${isOpen ? 'up' : 'down'}`}>
            ▼
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="category-dropdown">
          {!selectedCategory ? (
            // Show categories
            <div className="category-list">
              <div className="dropdown-header">選擇分類</div>
              {getAllCategories().map(category => (
                <div
                  key={category}
                  className="category-item"
                  onClick={() => handleCategorySelect(category)}
                  style={{ borderLeft: `4px solid ${getCategoryColor(category)}` }}
                >
                  <span className="category-icon">{getCategoryIcon(category)}</span>
                  <span className="category-name">{category}</span>
                  <span className="subcategory-count">
                    {getSubcategories(category).length} 項目
                  </span>
                </div>
              ))}
            </div>
          ) : (
            // Show subcategories
            <div className="subcategory-list">
              <div className="dropdown-header">
                <button
                  type="button"
                  className="back-button"
                  onClick={() => setSelectedCategory('')}
                >
                  ← 返回分類
                </button>
                <span>{selectedCategory}</span>
              </div>
              
              {/* Option to select just the category */}
              <div
                className="subcategory-item category-only"
                onClick={() => {
                  setIsOpen(false);
                  onChange(selectedCategory);
                }}
              >
                <span className="category-icon">{getCategoryIcon(selectedCategory)}</span>
                <span className="subcategory-name">{selectedCategory} (一般)</span>
              </div>

              {/* Subcategory options */}
              {getSubcategories(selectedCategory).map(subcategory => (
                <div
                  key={subcategory}
                  className="subcategory-item"
                  onClick={() => handleSubcategorySelect(subcategory)}
                >
                  <span className="subcategory-name">{subcategory}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;
