# 對話備份與交接說明 (Handoff)

本文是與 AI 助手對話的書面備份，供在另一台電腦繼續工作時參考。

---

## 一、對話脈絡與目標

- **起點**：現有「旅遊記帳助手」為單一 HTML 檔（約 2,890 行），想優化 UI 並對標市場水準。
- **後續需求**：  
  - 讓 web app 真正 **responsive**  
  - 未來要 **上架 mobile app**（iOS/Android）  
  - 未來要 **會員與收款**  
  - 希望架構一次做對，避免之後大改浪費時間

---

## 二、我們做了什麼（依時間順序）

### 1. 釐清 App 功用與規格

- **技術**：React 18 (CDN) + Tailwind + Babel 瀏覽器編譯、OpenRouter/Gemini 2.5 Flash、localStorage。
- **功能**：AI 收據解析、手動記帳、多旅程、多人分帳、多幣種、圖表、匯出/列印、重複偵測、設定（API Key、匯率、人物、旅程）。

### 2. 選定可用的 Skills

- **web-design-guidelines**：審查 UI（無障礙、焦點、表單、動畫等）。
- **vercel-react-best-practices**：React 效能與最佳實踐。
- **Pencil MCP**：未來可畫 UI mockup。
- **auto-skill**：已啟用，用於知識與經驗記錄。

### 3. 執行 Web Interface Guidelines 審查（步驟一）

- 對單一 HTML 做完整審查，產出約 **42 項** 問題。
- **Critical**：viewport 禁用縮放 (`user-scalable=no`)、在 render 內重複呼叫 `detectDuplicates` 造成 O(n²)。
- **High**：多處 icon 按鈕缺 `aria-label`、缺語義 HTML、Toast 缺 `aria-live`、缺 skip link。
- **Medium**：焦點狀態、表單 label/autocomplete、動畫缺 `prefers-reduced-motion`、modal 缺 `overscroll-behavior`。
- **Low**：排版（…）、數字用 `Intl`、深色模式、URL 不反映狀態等。

### 4. 架構方案與遷移決策

- **選擇**：Vite + React + Tailwind，未來用 **Capacitor** 包成原生 app（不重寫 UI），後端預留 **Supabase**（Auth + DB + 未來收款）。
- **關鍵決策**：  
  - 元件拆分、React Router、**DataService 抽象層**（現在 localStorage，之後只改這一層換 API）、響應式、PWA、環境變數。

### 5. 實際遷移（你回覆 ok 後執行）

- 初始化 Vite + React + Tailwind + PWA 外掛。
- 建立 `utils`（constants, currency, date, duplicates）、**DataService**、AIService、ExportService。
- 建立 AppContext、共用 UI（Icons, Dialog, Toast）、Layout（Header, BottomNav, Sidebar, AppLayout）。
- 建立 Expense / Trip / Chart 元件與四頁：Dashboard, AddExpense, Charts, Settings。
- 實作響應式：手機底部導航、桌面側欄、自適應寬度。
- 加上 `.gitignore`、`README.md`，並產出 **不含 node_modules 的 ZIP**（約 96 KB）放在桌面。

### 6. 部署準備（你已登入 GitHub 與 Vercel）

- 公司電腦無法安裝 Git / GitHub CLI，所以改為：  
  - 提供「在另一台電腦繼續」的完整步驟（見 README.md 與下方第四節）。  
  - 你帶走 ZIP + README，在可安裝軟體的電腦上：`npm install` → Git init → GitHub repo → Vercel 連 GitHub 一鍵部署。

### 7. 對話備份

- 你問：對話段落是否也有備份？  
- 說明：當時只備份了專案與 README，**對話沒有匯出成檔案**。  
- 你回覆需要對話備份 → 故撰寫本 **HANDOFF.md** 作為對話的書面備份。

---

## 三、重要決策與原因（方便日後維護）

| 決策 | 原因 |
|------|------|
| 用 Vite 而非 Next.js | 現有邏輯已是 SPA，Vite 遷移成本低、build 快，之後加 Capacitor 即可。 |
| 用 Capacitor 而非 React Native | 同一套 React UI 直接打包成 app，不需重寫。 |
| DataService 抽象層 | 未來換 Supabase 只改 `src/services/DataService.js`，頁面與元件不變。 |
| 現在就上 React Router | 深度連結、返回鍵、未來 app 導航都依賴真實路由。 |
| 響應式 + PWA | 手機可「加到主螢幕」，為之後上架 app 鋪路。 |
| 審查發現的 viewport | 已在新版 index.html 拿掉 `user-scalable=no`，符合無障礙。 |
| 審查發現的 detectDuplicates | 新版在 ExpenseList 用 useMemo 只算一次 duplicateIds，避免 O(n²)。 |

---

## 四、在另一台電腦繼續的步驟（簡表）

1. **安裝**：Node.js LTS、Git、可選 GitHub CLI。
2. **解壓**：`travel-expense-app.zip` → 進入目錄。
3. **依賴**：`npm install` → `npm run dev`（確認本機正常）。
4. **Git + GitHub**：  
   `git init` → `git add .` → `git commit -m "Initial commit"` →  
   `gh auth login` → `gh repo create travel-expense-app --public --source=. --push`
5. **Vercel**：vercel.com → 用 GitHub 登入 → New Project → 選 repo → Deploy（Framework 會自動辨識 Vite）。
6. 之後每次 `git push` 會自動重新部署。

更細的指令與替代方式（例如不用 gh、或手動建 GitHub repo）在 **README.md**。

---

## 五、專案目錄結構（方便對照）

```
travel-expense-app/
├── public/
│   └── icons/
├── src/
│   ├── components/
│   │   ├── chart/     DailyChart, PersonChart
│   │   ├── expense/   ExpenseCard, ExpenseList, EditDialog, DeleteDialog, UploadArea, PersonFilter
│   │   ├── layout/    Header, BottomNav, Sidebar, AppLayout
│   │   ├── trip/      TripManager
│   │   └── ui/        Icons, Dialog, Toast
│   ├── pages/         Dashboard, AddExpense, Charts, Settings
│   ├── services/      DataService, AIService, ExportService
│   ├── store/         AppContext
│   └── utils/         constants, currency, date, duplicates
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── docs/
│   ├── README.md              文件導覽（建議先讀）
│   ├── PRODUCT_MANAGEMENT.md  產品路線與技術債
│   └── archive/
│       └── BACKUP_BRANCH_v1.md
├── designs/                   Pencil mockup（見 designs/README.md）
├── README.md
├── BACKUP_README.md           備份說明捷徑 → docs/archive/
└── HANDOFF.md   （本檔案）
```

---

## 六、產品與架構管理（必讀）

- 已新增 **`docs/PRODUCT_MANAGEMENT.md`**：路線圖（P0/P1/P2）、版本建議、架構優先級、技術債登記、發布紀錄表。  
- 已新增 **`docs/README.md`**：以產品經理視角整理「哪份文件負責什麼、有無重疊」，避免 README / HANDOFF / 設計稿混淆。  
- 已新增 **`docs/PRODUCT_ITERATION_2025-03.md`**：單次迭代之 **交付、踩坑、待辦、PM 跟進流程**（與滾動路線圖分離，避免對話散失）。  
- 目標是做好 **產品管理** 與 **可追蹤優化**，與本 HANDOFF（歷史脈絡）分工：HANDOFF 偏「為什麼這樣做」；PRODUCT_MANAGEMENT 偏「接下來做什麼、怎麼管」；ITERATION 檔偏「這一輪做了什麼、下次接什麼」。

---

## 七、之後若要做的事（備忘）

- 把 ZIP 重新壓一次（可包含本 HANDOFF.md，若當初壓縮時尚未加入）。
- 在可安裝的電腦上完成 GitHub + Vercel 部署後，可刪除公司電腦上的 ZIP 或專案副本（依公司規定）。
- 未來若要加會員／收款：改 DataService + 加 Supabase；若要上架 app：加 Capacitor 並建 iOS/Android 專案。

---

*此檔案為對話的書面備份，與 README.md 一併帶走即可在別台電腦還原脈絡並繼續工作。*
