// Comprehensive expense categories for Chinese users
export const expenseCategories = {
  '飲食': [
    '午餐', '咖啡豆', '宵夜', '旅遊', '早餐', '晚餐', 
    '水果', '酒類', '食材', '飲料', '點心'
  ],
  '購物': [
    '保健食品', '包包', '市場', '應用軟體', '文具用品', '生活用品', 
    '禮物', '精品', '紀念品', '美妝保養', '衣物', '裝飾品', 
    '訂閱', '配件', '關稅', '電子產品', '鞋子'
  ],
  '交通': [
    '停車費', '公車', '加油費', '捷運', '摩托車', '機票', 
    '汽車', '火車', '計程車', '過路費'
  ],
  '家居': [
    '保養', '修繕費', '家具', '家電', '工程款', '房租', 
    '日常用品', '水費', '洗車', '燃料費', '瓦斯費', '管理費', 
    '網路費', '訂閱', '電話費', '電費'
  ],
  '生活': [
    '住宿', '按摩', '旅行', '泡湯', '派對', '美容美髮'
  ],
  '個人': [
    '保險', '借款', '其他', '手續費', '投資', '捐款', 
    '社交', '稅金', '紅包', '罰單', '訂金', '通話費', '孝親費'
  ],
  '娛樂': [
    'KTV', '健身', '博弈', '展覽', '影音', '消遣', 
    '遊戲', '遊樂園', '運動', '電影', '音樂'
  ],
  '學習': [
    '書籍', '課程', '證書'
  ],
  '家庭': [
    '生活費', '應付款項', '借入', '應收款項', '代付', '借出', '報帳'
  ],
  '收入': [
    '利息', '富陽私宅', '彩券', '獎金', '紅包', '薪水', '還款'
  ],
  '轉帳': [
    '兌換', '存款', '轉帳'
  ],
  '醫療': [
    '健康檢查', '打針', '牙齒保健', '藥品', '醫療用品', '門診'
  ]
};

// Get all categories as a flat array for easy iteration
export const getAllCategories = () => Object.keys(expenseCategories);

// Get all subcategories for a specific category
export const getSubcategories = (category) => expenseCategories[category] || [];

// Get all subcategories as a flat array with category prefix
export const getAllSubcategoriesWithPrefix = () => {
  const result = [];
  Object.entries(expenseCategories).forEach(([category, subcategories]) => {
    subcategories.forEach(subcategory => {
      result.push(`${category} - ${subcategory}`);
    });
  });
  return result;
};

// Parse a category string back to category and subcategory
export const parseCategoryString = (categoryString) => {
  if (!categoryString) return { category: '', subcategory: '' };
  
  const parts = categoryString.split(' - ');
  if (parts.length === 2) {
    return { category: parts[0], subcategory: parts[1] };
  }
  
  // If it's just a category without subcategory
  if (expenseCategories[categoryString]) {
    return { category: categoryString, subcategory: '' };
  }
  
  return { category: categoryString, subcategory: '' };
};

// Get category color for UI styling
export const getCategoryColor = (category) => {
  const colors = {
    '交通': '#3B82F6', // Blue
    '個人': '#8B5CF6', // Purple
    '娛樂': '#F59E0B', // Amber
    '學習': '#10B981', // Emerald
    '家居': '#6B7280', // Gray
    '家庭': '#EF4444', // Red
    '收入': '#22C55E', // Green
    '生活': '#EC4899', // Pink
    '購物': '#F97316', // Orange
    '轉帳': '#06B6D4', // Cyan
    '醫療': '#DC2626', // Red-600
    '飲食': '#84CC16'  // Lime
  };
  
  return colors[category] || '#6B7280';
};

// Get category icon for UI
export const getCategoryIcon = (category) => {
  const icons = {
    '交通': '🚗',
    '個人': '👤',
    '娛樂': '🎮',
    '學習': '📚',
    '家居': '🏠',
    '家庭': '👨‍👩‍👧‍👦',
    '收入': '💰',
    '生活': '✨',
    '購物': '🛍️',
    '轉帳': '💳',
    '醫療': '🏥',
    '飲食': '🍽️'
  };
  
  return icons[category] || '📝';
};
