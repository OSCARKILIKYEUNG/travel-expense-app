# 旅遊記帳助手 Pro

AI 驅動的旅遊記帳與分帳助手 — 支援多旅程、多人分帳、多幣種轉換、AI 收據辨識。

## 技術架構

- **Vite + React 18** — 建構工具 + UI 框架
- **Tailwind CSS** — 樣式
- **React Router v7** — 路由
- **PWA** — 可安裝到手機主螢幕
- **localStorage** — 資料儲存（未來可換 Supabase）
- **單據 AI** — **Google Gemini 2.5 Flash**（經 **Vercel Serverless** `api/parse-receipt`，`GEMINI_API_KEY` 僅在伺服器，**不可放前端**）

### 日本免稅／手續費與分帳比例

整單實付低於標價小計時，預設依「可退稅標價池」比例攤分：**若某行為固定費用（實付＝標價、不參與退稅）**，請在編輯細項勾「**固定**」，或品名含 *佣金、Commis、GB 手續費* 等會自動視為固定行。  
計算公式：`可退稅池比例 r = (實付 − 固定費標價和) ÷ (標價小計 − 固定費標價和)`，服飾等行實攤＝該行標價×r，固定行實攤＝該行標價。

### 單據辨識：環境變數（必做）

金鑰**只**放在 **Vercel 環境變數**，勿寫進程式碼或提交 Git。變數名稱必須是 **`GEMINI_API_KEY`**（與 `api/parse-receipt.js` 一致）。

**取得 API Key（擇一）：**

| 方式 | 說明 |
|------|------|
| [Google AI Studio](https://aistudio.google.com/apikey) | 最簡單，一鍵建立 Gemini 用金鑰 |
| [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | 同一 GCP 專案內：**API 程式庫** 啟用 **「Generative Language API」**（`generativelanguage.googleapis.com`），**不要**只開 Vision API；再到憑證建立 **API 金鑰**，必要時在「API 限制」中允許 Generative Language API |

**在 Vercel 設定：**

1. 專案 → **Settings → Environment Variables**
2. **Name:** `GEMINI_API_KEY`  
3. **Value:** 貼上金鑰（字串，勿加引號）  
4. 勾選 **Production**（與需要時 **Preview**）  
5. **Save** 後到 **Deployments → 最新一筆 → Redeploy**（或 Push 本 repo 觸發部署），變數才會套用到新 build。

本機要測單據上傳：複製 `.env.example` 為 `.env.local`，填入 `GEMINI_API_KEY`，然後：

```bash
npm install
npx vercel dev
```

（`npm run dev` 只會跑 Vite，**沒有** `/api`，上傳單據會失敗；需用 `vercel dev` 或已部署的網址測試。）

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

### 方法 C：拖放 `dist/`（不建議）

只拖 `dist/` **不會**帶上 `api/` 後端，**單據 AI 將無法使用**。請用 GitHub 連線部署整份 repo。

---

## 文件與產品管理

- **[docs/README.md](./docs/README.md)** — **文件導覽（建議先讀）**：釐清各份 MD 分工、是否重疊、程式目錄地圖
- **[docs/PRODUCT_MANAGEMENT.md](./docs/PRODUCT_MANAGEMENT.md)** — 產品路線圖、版本節奏、架構輕量優化優先級、技術債登記（**建議與程式一併維護**）
- [HANDOFF.md](./HANDOFF.md) — 專案歷史與技術決策
- [DESIGN_SPEC.md](./DESIGN_SPEC.md) — 設計規格
- [docs/archive/BACKUP_BRANCH_v1.md](./docs/archive/BACKUP_BRANCH_v1.md) — Git 備份分支 `backup/v1-original` 操作說明（根目錄 [BACKUP_README.md](./BACKUP_README.md) 為捷徑）

---

## 專案結構

```
api/                 # Vercel Serverless（Gemini，讀 GEMINI_API_KEY）
├── parse-receipt.js
├── receipt-prompt.js
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
