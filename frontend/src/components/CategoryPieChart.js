import React, { useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { expenseCategories } from '../data/expenseCategories';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

const CategoryPieChart = ({ expenses, title = "Expenses by Category" }) => {
  const [currentView, setCurrentView] = useState('main'); // 'main' or specific main category
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  // Amounts in different currencies can't share one pie (no FX conversion),
  // so chart one currency at a time, defaulting to the most-used one.
  const currencyCounts = {};
  (expenses || []).forEach(expense => {
    const currency = expense.currency || 'TWD';
    currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
  });
  const currencies = Object.keys(currencyCounts).sort((a, b) => currencyCounts[b] - currencyCounts[a]);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];
  const currencyExpenses = (expenses || []).filter(expense => (expense.currency || 'TWD') === currency);

  // Parse category string to get main category and subcategory
  const parseCategory = (categoryString) => {
    if (!categoryString) return { main: 'Uncategorized', sub: null };
    
    // Handle different category formats
    if (categoryString.includes(' ')) {
      // Format: "🍽️ 餐飲" or "main-sub" or "main sub"
      const parts = categoryString.split(/[\s-]/);
      if (parts.length >= 2) {
        const main = parts[0].replace(/[🍽️🚗🏠🎬🛒💊📚⚡📱👕✈️🎁🏋️🐕🔧💼]/g, '').trim();
        const sub = parts.slice(1).join(' ').trim();
        return { main: main || 'Uncategorized', sub: sub || null };
      }
    }
    
    // Check if it's a known main category
    if (expenseCategories[categoryString]) {
      return { main: categoryString, sub: null };
    }
    
    // Try to find main category by checking if categoryString contains a known main category
    for (const mainCat of Object.keys(expenseCategories)) {
      if (categoryString.includes(mainCat)) {
        const sub = categoryString.replace(mainCat, '').replace(/[-\s]/g, '').trim();
        return { main: mainCat, sub: sub || null };
      }
    }
    
    return { main: categoryString, sub: null };
  };

  // Process expenses for main categories
  const processMainCategoryData = () => {
    const categoryTotals = {};
    
    currencyExpenses.forEach(expense => {
      const { main } = parseCategory(expense.category);
      if (!categoryTotals[main]) {
        categoryTotals[main] = 0;
      }
      categoryTotals[main] += expense.amount;
    });

    return categoryTotals;
  };

  // Process expenses for subcategories of a specific main category
  const processSubCategoryData = (mainCategory) => {
    const subCategoryTotals = {};
    
    currencyExpenses.forEach(expense => {
      const { main, sub } = parseCategory(expense.category);
      if (main === mainCategory) {
        const subCategory = sub || '其他';
        if (!subCategoryTotals[subCategory]) {
          subCategoryTotals[subCategory] = 0;
        }
        subCategoryTotals[subCategory] += expense.amount;
      }
    });

    return subCategoryTotals;
  };

  // Define colors for different categories
  const getCategoryColors = () => {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
      '#8E44AD', '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
      '#1ABC9C', '#9B59B6', '#34495E', '#16A085', '#27AE60'
    ];
    
    const hoverColors = colors.map(color => color + 'CC');
    return { colors, hoverColors };
  };

  // Get category icons/emojis
  const getCategoryIcon = (category) => {
    const mainCategoryIcons = {
      '交通': '🚗',
      '個人': '👤',
      '娛樂': '🎬',
      '學習': '📚',
      '家居': '🏠',
      '家庭': '👨‍👩‍👧‍👦',
      '收入': '💰',
      '生活': '🌟',
      '購物': '🛒',
      '轉帳': '💳',
      '醫療': '💊',
      '飲食': '🍽️',
      'Uncategorized': '📊'
    };

    const subCategoryIcons = {
      // 交通 subcategories
      '停車費': '🅿️', '公車': '🚌', '加油費': '⛽', '捷運': '🚇', '摩托車': '🏍️',
      '機票': '✈️', '汽車': '🚗', '火車': '🚄', '計程車': '🚕', '過路費': '🛣️',
      
      // 飲食 subcategories
      '午餐': '🍱', '咖啡豆': '☕', '宵夜': '🌙', '早餐': '🥐', '晚餐': '🍽️',
      '水果': '🍎', '酒類': '🍷', '食材': '🥬', '飲料': '🥤', '點心': '🍰',
      
      // 娛樂 subcategories
      'KTV': '🎤', '健身': '🏋️', '博弈': '🎰', '展覽': '🖼️', '影音': '📺',
      '消遣': '🎮', '遊戲': '🎯', '遊樂園': '🎡', '運動': '⚽', '電影': '🎬', '音樂': '🎵',
      
      // 購物 subcategories
      '保健食品': '💊', '包包': '👜', '市場': '🏪', '應用軟體': '📱', '文具用品': '✏️',
      '生活用品': '🧴', '禮物': '🎁', '精品': '💎', '紀念品': '🎪', '美妝保養': '💄',
      '衣物': '👕', '裝飾品': '🎨', '配件': '⌚', '電子產品': '📱', '鞋子': '👟',
      
      // Default for others
      '其他': '📋'
    };

    return mainCategoryIcons[category] || subCategoryIcons[category] || '📊';
  };

  // Handle chart click for drill-down
  const handleChartClick = (event, elements) => {
    if (elements.length > 0 && currentView === 'main') {
      const clickedIndex = elements[0].index;
      const categories = Object.keys(getCurrentData());
      const clickedCategory = categories[clickedIndex];
      
      // Check if this main category has subcategories
      if (expenseCategories[clickedCategory] && expenseCategories[clickedCategory].length > 0) {
        setCurrentView(clickedCategory);
        setBreadcrumb(['All Categories', clickedCategory]);
      }
    }
  };

  // Get current data based on view
  const getCurrentData = () => {
    if (currentView === 'main') {
      return processMainCategoryData();
    } else {
      return processSubCategoryData(currentView);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (level) => {
    if (level === 0) {
      setCurrentView('main');
      setBreadcrumb([]);
    }
  };

  if (!expenses || expenses.length === 0) {
    return (
      <div className="pie-chart-container">
        <div className="no-data-message">
          <div className="no-data-icon">📊</div>
          <h3>No Expense Data</h3>
          <p>Add some expenses to see the category breakdown.</p>
        </div>
      </div>
    );
  }

  const categoryTotals = getCurrentData();
  const categories = Object.keys(categoryTotals);
  const amounts = Object.values(categoryTotals);
  const { colors, hoverColors } = getCategoryColors();

  // Calculate total for percentages
  const total = amounts.reduce((sum, amount) => sum + amount, 0);

  const data = {
    labels: categories.map(cat => `${getCategoryIcon(cat)} ${cat}`),
    datasets: [
      {
        data: amounts,
        backgroundColor: colors.slice(0, categories.length),
        hoverBackgroundColor: hoverColors.slice(0, categories.length),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderWidth: 3,
        hoverBorderColor: '#ffffff'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    plugins: {
      title: {
        display: true,
        text: currentView === 'main' ? title : `${currentView} - Subcategories`,
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12
          },
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const amount = amounts[i];
                const percentage = ((amount / total) * 100).toFixed(1);
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor,
                  lineWidth: data.datasets[0].borderWidth,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${currency} ${value.toFixed(2)} (${percentage}%)`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#ffffff',
        borderWidth: 1
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000
    }
  };

  return (
    <div className="pie-chart-container">
      {currencies.length > 1 && (
        <div className="chart-currency-tabs">
          {currencies.map(c => (
            <button
              key={c}
              type="button"
              className={`chart-currency-tab ${c === currency ? 'active' : ''}`}
              onClick={() => {
                // Drop back to the main view; the drilled-in category may not exist in this currency
                setSelectedCurrency(c);
                setCurrentView('main');
                setBreadcrumb([]);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      {breadcrumb.length > 0 && (
        <div className="chart-breadcrumb">
          {breadcrumb.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className="breadcrumb-separator"> › </span>}
              <button 
                className={`breadcrumb-item ${index === breadcrumb.length - 1 ? 'active' : ''}`}
                onClick={() => handleBreadcrumbClick(index)}
                disabled={index === breadcrumb.length - 1}
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="pie-chart-wrapper">
        <Pie data={data} options={options} />
      </div>

      {/* Instructions for drill-down */}
      {currentView === 'main' && (
        <div className="chart-instructions">
          💡 Click on a category slice to see its subcategories
        </div>
      )}

      <div className="category-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">
              {currentView === 'main' ? 'Main Categories' : 'Subcategories'}
            </span>
            <span className="stat-value">{categories.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Amount</span>
            <span className="stat-value">{currency} {total.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">
              Largest {currentView === 'main' ? 'Category' : 'Subcategory'}
            </span>
            <span className="stat-value">
              {categories.length > 0 ? 
                `${getCategoryIcon(categories[amounts.indexOf(Math.max(...amounts))])} ${categories[amounts.indexOf(Math.max(...amounts))]}` 
                : 'N/A'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryPieChart;
