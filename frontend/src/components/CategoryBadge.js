import React from 'react';
import { parseCategoryString, getCategoryIcon } from '../data/expenseCategories';

const CategoryBadge = ({ category, size = 'small' }) => {
  if (!category) {
    return (
      <span className="expense-category-badge">
        <span className="category-icon">📝</span>
        <span>未分類</span>
      </span>
    );
  }

  const { category: mainCategory, subcategory } = parseCategoryString(category);
  const icon = getCategoryIcon(mainCategory);

  return (
    <span 
      className={`expense-category-badge ${size === 'large' ? 'large' : ''}`}
      data-category={mainCategory}
      title={category}
    >
      <span className="category-icon">{icon}</span>
      <span className="category-name">
        {subcategory ? `${mainCategory}-${subcategory}` : mainCategory}
      </span>
    </span>
  );
};

export default CategoryBadge;
