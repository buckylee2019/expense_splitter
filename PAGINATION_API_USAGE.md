# Expense API 分頁和過濾使用指南

## 問題描述
原本的 expense API 每次都返回群組中的所有 expense，當數據量增長時會導致性能問題。

## 解決方案
新增了分頁、過濾和搜索功能的 API 端點。

## API 使用方法

### 基本分頁
```javascript
// 獲取第1頁，每頁20筆記錄
GET /api/expenses?groupId=123&page=1&limit=20

// 響應格式
{
  "expenses": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 95,
    "hasNextPage": true,
    "hasPrevPage": false,
    "limit": 20
  }
}
```

### 日期範圍過濾
```javascript
// 獲取2024年1月的記錄
GET /api/expenses?groupId=123&startDate=2024-01-01&endDate=2024-01-31&page=1&limit=20
```

### 搜索和過濾
```javascript
// 搜索包含"lunch"的記錄，食物類別，金額100-500
GET /api/expenses?groupId=123&search=lunch&category=food&minAmount=100&maxAmount=500&page=1&limit=10
```

### 排序
```javascript
// 按金額降序排列
GET /api/expenses?groupId=123&sort=amount&order=desc&page=1&limit=20

// 按日期升序排列（默認是降序）
GET /api/expenses?groupId=123&sort=date&order=asc&page=1&limit=20
```

## 前端實現示例

### React Hook 示例
```javascript
import { useState, useEffect } from 'react';

const useExpenses = (groupId) => {
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    sort: 'date',
    order: 'desc'
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        groupId,
        ...filters
      });
      
      const response = await fetch(`/api/expenses?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setExpenses(data.expenses);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchExpenses();
    }
  }, [groupId, filters]);

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const nextPage = () => {
    if (pagination?.hasNextPage) {
      setFilters(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const prevPage = () => {
    if (pagination?.hasPrevPage) {
      setFilters(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  return {
    expenses,
    pagination,
    loading,
    filters,
    updateFilters,
    nextPage,
    prevPage,
    refetch: fetchExpenses
  };
};
```

### 組件使用示例
```javascript
const ExpenseList = ({ groupId }) => {
  const {
    expenses,
    pagination,
    loading,
    filters,
    updateFilters,
    nextPage,
    prevPage
  } = useExpenses(groupId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const handleSearch = () => {
    updateFilters({
      search: searchTerm,
      category: selectedCategory
    });
  };

  return (
    <div>
      {/* 搜索和過濾 */}
      <div className="filters">
        <input
          type="text"
          placeholder="搜索描述..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">所有類別</option>
          <option value="food">食物</option>
          <option value="transport">交通</option>
          {/* 更多類別... */}
        </select>
        <button onClick={handleSearch}>搜索</button>
      </div>

      {/* 記錄列表 */}
      {loading ? (
        <div>載入中...</div>
      ) : (
        <div>
          {expenses.map(expense => (
            <div key={expense.id} className="expense-item">
              <h3>{expense.description}</h3>
              <p>金額: ${expense.amount}</p>
              <p>日期: {new Date(expense.date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* 分頁控制 */}
      {pagination && (
        <div className="pagination">
          <button 
            onClick={prevPage} 
            disabled={!pagination.hasPrevPage}
          >
            上一頁
          </button>
          <span>
            第 {pagination.currentPage} 頁，共 {pagination.totalPages} 頁
            （總計 {pagination.totalCount} 筆記錄）
          </span>
          <button 
            onClick={nextPage} 
            disabled={!pagination.hasNextPage}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
};
```

## 性能優化建議

1. **默認限制**: 設置合理的默認每頁記錄數（建議20-50筆）
2. **最大限制**: 限制單次請求最大記錄數（建議不超過100筆）
3. **索引優化**: 確保 DynamoDB 有適當的 GSI 支持常用查詢
4. **緩存策略**: 考慮在前端實現適當的緩存機制
5. **無限滾動**: 對於移動端，可以考慮實現無限滾動而非傳統分頁

## 向後兼容性

舊的 API 調用（不帶分頁參數）仍然有效，但會默認返回前20筆記錄並包含分頁信息。建議逐步遷移到新的分頁 API。
