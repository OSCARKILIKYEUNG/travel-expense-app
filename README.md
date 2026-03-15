# 旅遊記帳助手 Pro

AI 驅動的旅遊記帳與分帳助手 — 支援多旅程、多人分帳、多幣種轉換、AI 收據辨識。

## 技術架構

- **Vite + React 18** — 建構工具 + UI 框架
- **Tailwind CSS** — 樣式
- **React Router v7** — 路由
- **PWA** — 可安裝到手機主螢幕
- **localStorage** — 資料儲存（未來可換 Supabase）

## 在新電腦上設定

### 1. 安裝 Node.js

前往 https://nodejs.org 下載 LTS 版本並安裝。

### 2. 安裝依賴

```bash
cd travel-expense-app
npm install
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

瀏覽器會自動開啟 http://localhost:3000

### 4. 建構生產版本

```bash
npm run build
```

輸出在 `dist/` 資料夾。

---

## 部署到 Vercel（免費）

### 方法 A：透過 GitHub（推薦）

```bash
# 1. 初始化 Git
git init
git add .
git commit -m "Initial commit: Travel Expense App"

# 2. 在 GitHub 建立 repo（需安裝 gh CLI）
gh auth login
gh repo create travel-expense-app --public --source=. --push

# 3. 前往 https://vercel.com
#    - 用 GitHub 帳號登入
#    - 點 "New Project"
#    - 選擇 travel-expense-app repo
#    - Framework Preset 選 "Vite"
#    - 點 "Deploy"
#    - 完成！拿到 https://travel-expense-app.vercel.app 網址
```

### 方法 B：直接用 Vercel CLI

```bash
# 1. 安裝 Vercel CLI
npm i -g vercel

# 2. 部署
vercel

# 按提示操作即可，會自動偵測 Vite 專案
```

### 方法 C：拖放部署

1. 執行 `npm run build`
2. 前往 https://vercel.com/new
3. 直接把 `dist/` 資料夾拖進去
4. 完成！

---

## 專案結構

```
src/
├── components/
│   ├── chart/        # DailyChart, PersonChart
│   ├── expense/      # ExpenseCard, ExpenseList, EditDialog, DeleteDialog, UploadArea, PersonFilter
│   ├── layout/       # Header, BottomNav, Sidebar, AppLayout
│   ├── trip/         # TripManager
│   └── ui/           # Icons, Dialog, Toast
├── pages/            # Dashboard, AddExpense, Charts, Settings
├── services/         # DataService (資料層抽象), AIService, ExportService
├── store/            # AppContext (全局狀態)
└── utils/            # constants, currency, date, duplicates
```

## DataService 抽象層

所有資料操作都通過 `src/services/DataService.js`。未來要接後端（如 Supabase），只需修改這一個檔案。

## 未來擴展

| 功能 | 做法 |
|------|------|
| 會員系統 | 加入 Supabase Auth，修改 DataService |
| 雲端同步 | DataService 改用 Supabase PostgreSQL |
| 手機 App | 安裝 Capacitor：`npx cap add ios && npx cap add android` |
| 收款功能 | 新增 PaymentService + Subscription 頁面 |
