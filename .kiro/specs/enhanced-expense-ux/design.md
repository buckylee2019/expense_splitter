# 設計文件：強化費用使用者體驗

## 概述

本設計文件概述 SplitX 費用管理系統的使用者體驗改善。這些強化功能著重於為建立、編輯和檢視費用創造更直覺、更具視覺吸引力且更有效率的介面。設計運用現代化使用者介面模式、漸進式揭露、即時回饋以及行動優先的響應式設計原則。

### 設計目標

1. **降低認知負荷** - 透過漸進式揭露和智慧預設值簡化複雜操作
2. **提供即時回饋** - 使用即時驗證和視覺指示器引導使用者
3. **行動裝置最佳化** - 確保觸控友善介面具有適當的大小和手勢
4. **維持一致性** - 使用現有主題系統中已建立的設計模式
5. **強化無障礙** - 支援鍵盤導航和螢幕閱讀器

### 設計原則

- **漸進式揭露**：最初僅顯示必要資訊，按需揭露細節
- **視覺階層**：使用大小、顏色和間距引導注意力
- **即時回饋**：提供即時驗證和狀態更新
- **容錯互動**：允許輕鬆修正錯誤而不遺失資料
- **行動優先**：先為觸控互動設計，再為桌面裝置強化

## 架構

### 元件結構

```
強化費用系統
├── 表單元件
│   ├── ExpenseFormContainer（智慧元件）
│   ├── AmountInput（具即時驗證）
│   ├── DateTimePicker（具快速選擇選項）
│   ├── CategorySelector（強化搜尋與最近使用）
│   ├── PayerSelector（統一的單一/多位介面）
│   └── SplitConfigurator（視覺化分帳管理）
├── 顯示元件
│   ├── ExpenseCard（強化清單檢視）
│   ├── ExpenseDetails（改善詳情檢視）
│   ├── BalanceIndicator（視覺化債務/債權顯示）
│   └── SplitBreakdown（視覺化分帳明細）
├── 共用元件
│   ├── ProgressBar（用於分帳分配）
│   ├── ValidationMessage（內嵌錯誤顯示）
│   ├── LoadingState（骨架載入器）
│   └── SuccessToast（操作回饋）
└── 工具元件
    ├── FormValidator（即時驗證邏輯）
    ├── SplitCalculator（分帳計算）
    └── PreferenceManager（使用者偏好儲存）
```

### State Management

```javascript
// Enhanced Form State Structure
{
  formData: {
    description: string,
    amount: number,
    currency: string,
    category: string,
    date: Date,
    notes: string,
    paidBy: string | PayerObject[],
    splitType: 'equal' | 'weight' | 'custom'
  },
  splits: Split[],
  weights: Weight[],
  validation: {
    errors: Map<field, error>,
    warnings: Map<field, warning>,
    isValid: boolean
  },
  ui: {
    activePopup: string | null,
    isSubmitting: boolean,
    showAdvanced: boolean,
    recentCategories: string[]
  },
  preferences: {
    defaultCurrency: string,
    lastUsedCategory: string,
    frequentPayers: string[],
    splitTemplates: SplitTemplate[]
  }
}
```

## 元件與介面

### 1. 強化費用表單

#### 佈局設計

```
┌─────────────────────────────────────────┐
│  Add Expense                      [×]   │
├─────────────────────────────────────────┤
│                                         │
│  Description *                          │
│  ┌───────────────────────────────────┐ │
│  │ Lunch at restaurant               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Amount *          Date *               │
│  ┌──────────┐    ┌──────────────────┐  │
│  │ 1,250.00 │    │ Today, 2:30 PM ▼│  │
│  └──────────┘    └──────────────────┘  │
│                                         │
│  Category *                             │
│  ┌───────────────────────────────────┐ │
│  │ 🍽️ 飲食 - 午餐              ▼   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Paid By *                              │
│  ┌───────────────────────────────────┐ │
│  │ 👤 You                        ▼   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Split Configuration                    │
│  ┌───────────────────────────────────┐ │
│  │ ⚖️ Equal Split                    │ │
│  │ 3 of 4 members                    │ │
│  │ TWD 1,250.00 / 1,250.00      ✓   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌ Advanced Options ▼                  │
│                                         │
│  [Cancel]              [Add Expense]   │
└─────────────────────────────────────────┘
```

#### 主要功能

1. **智慧欄位排序**：最常使用的欄位在頂部
2. **內嵌驗證**：欄位下方的即時錯誤訊息
3. **視覺化分帳摘要**：帶有驗證狀態的精簡預覽
4. **漸進式揭露**：進階選項預設收合
5. **固定操作**：表單按鈕在捲動期間保持可見

#### Validation States

```css
/* Visual feedback for validation states */
.form-field.valid {
  border-color: var(--success-color);
  background: var(--success-light);
}

.form-field.invalid {
  border-color: var(--danger-color);
  background: var(--danger-light);
  animation: shake 0.3s ease;
}

.form-field.warning {
  border-color: var(--warning-color);
  background: var(--warning-light);
}
```

### 2. Enhanced Split Configuration Interface

#### Visual Design

```
┌─────────────────────────────────────────┐
│  ← Split Configuration                  │
├─────────────────────────────────────────┤
│  [Equal] [Weight] [Custom]              │
├─────────────────────────────────────────┤
│  Split equally among selected members   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Progress: TWD 1,250 / 1,250    ✓   ││
│  │ ████████████████████████████████   ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 👤 Alice                    [✓]     ││
│  │    TWD 416.67                       ││
│  ├─────────────────────────────────────┤│
│  │ 👤 Bob                      [✓]     ││
│  │    TWD 416.67                       ││
│  ├─────────────────────────────────────┤│
│  │ 👤 Charlie                  [✓]     ││
│  │    TWD 416.66                       ││
│  ├─────────────────────────────────────┤│
│  │ 👤 David                    [ ]     ││
│  │    TWD 0.00                         ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Deselect All]                         │
│                                         │
│                          [Done]         │
└─────────────────────────────────────────┘
```

#### Split Type Tabs

Each split type has distinct visual treatment:

1. **Equal Split**
   - Toggle switches for member inclusion
   - Automatic recalculation on toggle
   - Visual indication of included/excluded members
   - "Deselect All" quick action

2. **Weight-Based Split**
   - Increment/decrement buttons for weights
   - Visual ratio indicators (pie chart or bars)
   - Percentage display alongside absolute amounts
   - Real-time recalculation

3. **Custom Split**
   - Direct amount input fields
   - Running total with remaining amount
   - Color-coded progress bar (green when complete, yellow when under, red when over)
   - Auto-distribute remaining amount button

#### Progress Indicator

```javascript
// Progress bar component
<ProgressBar
  current={totalSplits}
  target={totalAmount}
  status={isValid ? 'complete' : isOver ? 'over' : 'under'}
  showPercentage={true}
  animated={true}
/>
```

### 3. Enhanced Category Selector

#### Design Layout

```
┌─────────────────────────────────────────┐
│  ← Select Category              [×]     │
├─────────────────────────────────────────┤
│  🔍 Search categories...                │
├─────────────────────────────────────────┤
│  RECENT                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ 🍽️       │ │ 🚗       │ │ 🛍️       ││
│  │ 飲食     │ │ 交通     │ │ 購物     ││
│  └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────┤
│  ALL CATEGORIES                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ 🍽️       │ │ 🚗       │ │ 🏠       ││
│  │ 飲食     │ │ 交通     │ │ 家居     ││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ 🛍️       │ │ ✨       │ │ 👤       ││
│  │ 購物     │ │ 生活     │ │ 個人     ││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ 🎮       │ │ 📚       │ │ 👨‍👩‍👧‍👦   ││
│  │ 娛樂     │ │ 學習     │ │ 家庭     ││
│  └──────────┘ └──────────┘ └──────────┘│
└─────────────────────────────────────────┘
```

#### Subcategory View

```
┌─────────────────────────────────────────┐
│  ← 🍽️ 飲食                      [×]     │
├─────────────────────────────────────────┤
│  🔍 Search subcategories...             │
├─────────────────────────────────────────┤
│  ☑️ 午餐                                │
│  ☐ 咖啡豆                               │
│  ☐ 宵夜                                 │
│  ☐ 旅遊                                 │
│  ☐ 早餐                                 │
│  ☐ 晚餐                                 │
│  ☐ 水果                                 │
│  ☐ 酒類                                 │
│  ☐ 食材                                 │
│  ☐ 飲料                                 │
│  ☐ 點心                                 │
└─────────────────────────────────────────┘
```

#### Features

1. **Grid Layout**: Visual category cards with icons and colors
2. **Recent Section**: Last 3-5 used categories for quick access
3. **Search Functionality**: Real-time filtering with highlighted matches
4. **Hierarchical Navigation**: Smooth transition between category and subcategory views
5. **Visual Feedback**: Selected state with checkmark icon

### 4. Enhanced Multiple Payer Interface

#### Design Layout

```
┌─────────────────────────────────────────┐
│  ← Enter Paid Amounts          [Done]   │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐│
│  │ TWD 850.00 of 1,250.00              ││
│  │ TWD 400.00 remaining                ││
│  │ ████████████████░░░░░░░░░░░░░░░░   ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  👤 Alice                               │
│     TWD [500.00_____________]           │
│                                         │
│  👤 Bob                                 │
│     TWD [350.00_____________]           │
│                                         │
│  👤 Charlie                             │
│     TWD [0.00_______________]           │
│                                         │
│  👤 David                               │
│     TWD [0.00_______________]           │
└─────────────────────────────────────────┘
```

#### Features

1. **Fixed Header**: Running total and remaining amount always visible
2. **Visual Progress**: Progress bar showing allocation status
3. **Large Input Fields**: Touch-friendly amount inputs
4. **Currency Symbol**: Pre-filled currency symbol for context
5. **Status Indicators**:
   - Green: Amounts match exactly
   - Yellow: Underpaid (shows remaining)
   - Red: Overpaid (shows excess)

### 5. Enhanced Expense Details View

#### Design Layout

```
┌─────────────────────────────────────────┐
│  ← Lunch at restaurant          [Edit]  │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐│
│  │         TWD 1,250.00                ││
│  │                                     ││
│  │  🍽️ 飲食 - 午餐                    ││
│  │  📅 Today, 2:30 PM                  ││
│  │  ⚖️ Equal Split                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  WHO PAID                               │
│  ┌─────────────────────────────────────┐│
│  │ 👤 Alice                            ││
│  │    Paid TWD 1,250.00                ││
│  └─────────────────────────────────────┘│
│                                         │
│  SPLIT BREAKDOWN                        │
│  ┌─────────────────────────────────────┐│
│  │ 👤 Alice                    [Payer] ││
│  │    Owes: TWD 416.67                 ││
│  │    Paid: TWD 1,250.00               ││
│  │    Gets back: TWD 833.33     ✓      ││
│  ├─────────────────────────────────────┤│
│  │ 👤 Bob                              ││
│  │    Owes: TWD 416.67                 ││
│  │    Still owes: TWD 416.67    ⚠️     ││
│  ├─────────────────────────────────────┤│
│  │ 👤 Charlie                          ││
│  │    Owes: TWD 416.66                 ││
│  │    Still owes: TWD 416.66    ⚠️     ││
│  └─────────────────────────────────────┘│
│                                         │
│  YOUR BALANCE                           │
│  ┌─────────────────────────────────────┐│
│  │  You get back TWD 833.33      ✓    ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

#### Features

1. **Visual Hierarchy**: Large amount display at top
2. **Color-Coded Balances**:
   - Green (✓): Gets money back
   - Red (⚠️): Owes money
   - Gray: Settled
3. **User Highlight**: Current user's row has distinct background
4. **Clear Labels**: Explicit "Owes", "Paid", "Gets back", "Still owes"
5. **Payer Badge**: Visual indicator for who paid

## Data Models

### Enhanced Expense Model

```typescript
interface EnhancedExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  category: string; // Format: "Category - Subcategory"
  project?: string;
  date: Date;
  notes?: string;
  
  // Payer information
  paidBy: string | PayerInfo[];
  isMultiplePayers: boolean;
  
  // Split information
  splitType: 'equal' | 'weight' | 'custom';
  splits: Split[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // UI enhancements
  userBalance?: UserBalance; // Calculated for current user
  validationStatus?: ValidationStatus;
}

interface PayerInfo {
  userId: string;
  userName: string;
  amount: number;
  userAvatarUrl?: string;
}

interface Split {
  userId: string;
  userName: string;
  amount: number;
  weight?: number; // For weight-based splits
  included: boolean; // For equal splits
  userAvatarUrl?: string;
}

interface UserBalance {
  type: 'credit' | 'debt' | 'settled';
  amount: number;
  currency: string;
  message: string;
}

interface ValidationStatus {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### User Preferences Model

```typescript
interface UserPreferences {
  userId: string;
  
  // Expense preferences
  defaultCurrency: string;
  recentCategories: string[]; // Last 5 categories
  frequentPayers: string[]; // Most used payers
  
  // Split preferences
  defaultSplitType: 'equal' | 'weight' | 'custom';
  splitTemplates: SplitTemplate[];
  
  // UI preferences
  showAdvancedOptions: boolean;
  dateFormat: string;
  
  // Updated timestamp
  updatedAt: Date;
}

interface SplitTemplate {
  name: string;
  splitType: 'equal' | 'weight' | 'custom';
  configuration: any; // Split-specific config
}
```

## Error Handling

### Validation Error Types

```typescript
enum ValidationErrorType {
  REQUIRED_FIELD = 'required_field',
  INVALID_AMOUNT = 'invalid_amount',
  SPLIT_MISMATCH = 'split_mismatch',
  NO_PAYER_SELECTED = 'no_payer_selected',
  NO_CATEGORY_SELECTED = 'no_category_selected',
  FUTURE_DATE = 'future_date',
  INVALID_SPLIT_CONFIG = 'invalid_split_config'
}

interface ValidationError {
  field: string;
  type: ValidationErrorType;
  message: string;
  severity: 'error' | 'warning';
}
```

### Error Display Strategy

1. **Inline Errors**: Display below the relevant field
2. **Summary Errors**: Show at top of form for multiple errors
3. **Toast Notifications**: For submission errors
4. **Field Highlighting**: Red border and background for invalid fields

### Error Messages

```javascript
const ERROR_MESSAGES = {
  required_field: 'This field is required',
  invalid_amount: 'Please enter a valid amount greater than 0',
  split_mismatch: 'Split amounts must equal the total amount',
  no_payer_selected: 'Please select who paid for this expense',
  no_category_selected: 'Please select a category',
  future_date: 'Date cannot be in the future',
  invalid_split_config: 'Please configure splits for all members'
};
```

## 測試策略

### 單元測試

1. **表單驗證邏輯**
   - 測試所有驗證規則
   - 測試邊界情況（零金額、負數等）
   - 測試分帳計算準確性

2. **分帳計算器**
   - 不同成員數量的平均分帳
   - 不同權重組合的權重分帳
   - 自訂分帳驗證
   - 四捨五入準確性

3. **偏好管理**
   - 儲存和擷取偏好
   - 預設值處理
   - 偏好遷移

### 整合測試

1. **表單提交流程**
   - 以有效資料建立費用
   - 處理驗證錯誤
   - 處理 API 錯誤
   - 成功導航

2. **分帳設定**
   - 在分帳類型之間切換
   - 平均分帳中的成員切換
   - 權重分帳中的權重調整
   - 自訂金額輸入

3. **分類選擇**
   - 搜尋功能
   - 最近分類顯示
   - 階層式導航

### 使用者驗收測試

1. **行動裝置可用性**
   - 觸控目標大小
   - 鍵盤行為
   - 捲動效能
   - 手勢支援

2. **桌面裝置可用性**
   - 鍵盤導航
   - Tab 順序
   - 懸停狀態
   - 焦點指示器

3. **無障礙**
   - 螢幕閱讀器相容性
   - 純鍵盤導航
   - 色彩對比
   - 焦點管理

### 效能測試

1. **渲染效能**
   - 初始載入時間
   - 表單互動響應性
   - 分帳計算速度
   - 清單捲動效能

2. **記憶體使用**
   - 元件清理
   - 事件監聽器管理
   - 狀態管理效率

## Visual Design System

### Color Palette

```css
/* Status Colors */
--success-color: #2ed573;
--success-light: #d1fae5;
--danger-color: #ff4757;
--danger-light: #fee2e2;
--warning-color: #f59e0b;
--warning-light: #fef3c7;
--info-color: #3b82f6;
--info-light: #dbeafe;

/* Semantic Colors */
--credit-color: var(--success-color);
--debt-color: var(--danger-color);
--settled-color: var(--text-muted);
--pending-color: var(--warning-color);
```

### Typography Scale

```css
/* Heading Sizes */
--h1-size: 2.25rem;  /* 36px */
--h2-size: 1.875rem; /* 30px */
--h3-size: 1.5rem;   /* 24px */
--h4-size: 1.25rem;  /* 20px */

/* Body Sizes */
--body-large: 1.125rem;  /* 18px */
--body-normal: 1rem;     /* 16px */
--body-small: 0.875rem;  /* 14px */
--body-tiny: 0.75rem;    /* 12px */

/* Font Weights */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### Spacing System

```css
/* Spacing Scale (8px base) */
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
--space-3xl: 4rem;     /* 64px */
```

### Animation Timings

```css
/* Transition Durations */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* Easing Functions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Component Patterns

#### Button States

```css
.button {
  transition: all var(--duration-normal) var(--ease-out);
}

.button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.button:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
```

#### Input States

```css
.input {
  transition: all var(--duration-fast) var(--ease-out);
}

.input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
  outline: none;
}

.input.error {
  border-color: var(--danger-color);
  background-color: var(--danger-light);
}

.input.success {
  border-color: var(--success-color);
  background-color: var(--success-light);
}
```

## Mobile-Specific Considerations

### Touch Targets

- Minimum size: 44x44px (iOS) / 48x48px (Android)
- Spacing between targets: 8px minimum
- Larger targets for primary actions

### Gestures

- Pull-to-refresh for expense lists
- Swipe-to-delete for expense items
- Swipe-to-navigate between form sections
- Long-press for additional options

### Keyboard Handling

- Numeric keyboard for amount fields
- Email keyboard for email fields
- Proper input types to trigger correct keyboards
- Viewport adjustment when keyboard appears

### Performance Optimizations

- Lazy loading for long lists
- Virtual scrolling for large datasets
- Debounced search inputs
- Optimistic UI updates
- Skeleton loaders during data fetch

## Accessibility Features

### Keyboard Navigation

- Logical tab order through form fields
- Escape key to close popups
- Enter key to submit forms
- Arrow keys for list navigation
- Space/Enter to toggle checkboxes

### Screen Reader Support

```html
<!-- Example: Split configuration -->
<div role="region" aria-label="Split configuration">
  <div role="tablist" aria-label="Split type selection">
    <button role="tab" aria-selected="true" aria-controls="equal-split-panel">
      Equal Split
    </button>
  </div>
  <div role="tabpanel" id="equal-split-panel" aria-labelledby="equal-tab">
    <!-- Split content -->
  </div>
</div>
```

### ARIA Labels

- Descriptive labels for all interactive elements
- Status announcements for validation errors
- Progress indicators for multi-step processes
- Live regions for dynamic content updates

### Color Contrast

- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Minimum 3:1 for UI components
- Don't rely solely on color for information

## Implementation Phases

### Phase 1: Core Form Enhancements (Week 1-2)
- Enhanced form layout with improved field ordering
- Real-time validation with inline error messages
- Smart defaults and preference management
- Loading states and success feedback

### Phase 2: Split Configuration (Week 2-3)
- Visual split configuration interface
- Progress bar for split allocation
- Enhanced equal/weight/custom split modes
- Split calculation optimization

### Phase 3: Category & Payer Selection (Week 3-4)
- Enhanced category selector with grid layout
- Recent categories section
- Improved multiple payer interface
- Search functionality

### Phase 4: Details View & Mobile (Week 4-5)
- Enhanced expense details visualization
- Balance indicators and color coding
- Mobile-specific optimizations
- Touch gesture support

### Phase 5: Polish & Testing (Week 5-6)
- Accessibility improvements
- Performance optimization
- Cross-browser testing
- User acceptance testing

## 成功指標

### 量化指標
- 費用建立時間：目標 < 30 秒
- 表單完成率：目標 > 95%
- 錯誤率：目標 < 5%
- 行動裝置使用率：目標 > 60%

### 質化指標
- 使用者滿意度分數：目標 > 4.5/5
- 易用性評分：目標 > 4.5/5
- 功能可發現性：目標 > 80%
- 行動裝置體驗評分：目標 > 4.5/5

## 未來強化

1. **AI 驅動的分類建議**：使用機器學習根據描述建議分類
2. **收據掃描**：OCR 從照片中擷取費用詳情
3. **定期費用**：定期費用的範本系統
4. **批次操作**：多選和批次編輯費用
5. **離線支援**：具離線費用建立的 PWA
6. **語音輸入**：費用描述的語音轉文字
7. **智慧通知**：未結清費用的提醒
8. **分析儀表板**：消費模式的視覺化洞察
