import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

const CategoryPieChart = ({ expenses, title = "Expenses by Category" }) => {
  // Process expenses to get category totals
  const processCategoryData = () => {
    const categoryTotals = {};
    
    expenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += expense.amount;
    });

    return categoryTotals;
  };

  // Define colors for different categories
  const getCategoryColors = () => {
    const colors = [
      '#FF6384', // Pink/Red
      '#36A2EB', // Blue
      '#FFCE56', // Yellow
      '#4BC0C0', // Teal
      '#9966FF', // Purple
      '#FF9F40', // Orange
      '#FF6384', // Pink (repeat)
      '#C9CBCF', // Gray
      '#4BC0C0', // Teal (repeat)
      '#FF6384'  // Pink (repeat)
    ];
    
    const hoverColors = [
      '#FF6384CC', // Pink/Red with transparency
      '#36A2EBCC', // Blue with transparency
      '#FFCE56CC', // Yellow with transparency
      '#4BC0C0CC', // Teal with transparency
      '#9966FFCC', // Purple with transparency
      '#FF9F40CC', // Orange with transparency
      '#FF6384CC', // Pink with transparency
      '#C9CBCFCC', // Gray with transparency
      '#4BC0C0CC', // Teal with transparency
      '#FF6384CC'  // Pink with transparency
    ];

    return { colors, hoverColors };
  };

  // Get category icons/emojis
  const getCategoryIcon = (category) => {
    const icons = {
      '🍽️ 餐飲': '🍽️',
      '🚗 交通': '🚗',
      '🏠 住宿': '🏠',
      '🎬 娛樂': '🎬',
      '🛒 購物': '🛒',
      '💊 醫療': '💊',
      '📚 教育': '📚',
      '⚡ 水電': '⚡',
      '📱 通訊': '📱',
      '👕 服飾': '👕',
      '✈️ 旅遊': '✈️',
      '🎁 禮品': '🎁',
      '🏋️ 健身': '🏋️',
      '🐕 寵物': '🐕',
      '🔧 維修': '🔧',
      '💼 商務': '💼',
      '生活開銷': '🏠',
      '玩樂': '🎮',
      '家用': '🏡',
      '家居裝潢': '🔨',
      'Uncategorized': '📊'
    };
    return icons[category] || '📊';
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

  const categoryTotals = processCategoryData();
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
    plugins: {
      title: {
        display: true,
        text: title,
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
            return `${label}: TWD ${value.toFixed(2)} (${percentage}%)`;
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
      <div className="pie-chart-wrapper">
        <Pie data={data} options={options} />
      </div>
      <div className="category-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Categories</span>
            <span className="stat-value">{categories.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Amount</span>
            <span className="stat-value">TWD {total.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Largest Category</span>
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
