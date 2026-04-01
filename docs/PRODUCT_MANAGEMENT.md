# 產品與架構管理指南

> **目的**：把「產品決策、版本節奏、架構優先級」寫成可追蹤的文件，避免只存在對話裡、難以交接與複盤。  
> **維護原則**：每次重大功能上線、架構調整或發布前，更新本文件對應章節；與 `HANDOFF.md`、`DESIGN_SPEC.md` 互補，不互相重複貼長文。  
> **迭代詳錄**：分帳／免稅／收據顯示等 **單次迭代的需求、踩坑、backlog、進度快照** → **[PRODUCT_ITERATION_2025-03.md](./PRODUCT_ITERATION_2025-03.md)**（PM 級書面 log）。  
> **人機協作**：使用者提意見時 **先對齊理解與方案再改碼** → 書面流程見 **下方 [與 AI 協作 SOP](#與-ai-協作-sop)**；機讀規則見 `.cursor/rules/feedback-before-implement.mdc`（與迭代檔 §九一致）。  
> **SAVE**：使用者輸入 **`SAVE`** 時，助手應將本次要點寫入當期 **`docs/PRODUCT_ITERATION_YYYY-MM.md` §十**（SAVE 快照表）；規則見同檔 Cursor rule。  
> **單據類型**：情境 A～H 規格 → **[RECEIPT_TYPES.md](./RECEIPT_TYPES.md)**（收據印字優先、與程式對照表）。

---

## 與 AI 協作 SOP

> **流程**：意見 → 對齊 → 再實作。  
> **目的**：把「先消化、再給專業意見、使用者同意後才改碼」寫成可交接的書面流程；**不另開獨立檔**，統一記在本檔。  
> **適用**：透過 Cursor／類似助手進行的功能、UX、重構、行為修改等需求討論。

### 與其他文件的關係

| 項目 | 角色 |
|------|------|
| **本節（`PRODUCT_MANAGEMENT.md`）** | 給人讀的流程說明與共識摘要 |
| `.cursor/rules/feedback-before-implement.mdc` | 助手**必須遵守**的機讀規則（`alwaysApply`） |
| `PRODUCT_ITERATION_YYYY-MM.md` **§九** | 迭代內簡表，與本節對齊 |

若內容衝突，以 **`.cursor/rules/feedback-before-implement.mdc`** 為準，並同步更新本節與 §九。

### 核心流程（強制）

當使用者提出 **意見、問題、想優化的點、或要求修改產品／介面／行為** 時，助手應依序：

1. **消化（不立刻改碼）**  
   不要立刻改程式、設定或 push；先釐清需求邊界與是否與現有行為／資料模型衝突。

2. **對齊（必須輸出給使用者）**  
   以簡短條列說明：**我如何理解你的需求**；**專業看法與建議**（選項、取捨、風險）；必要時**先問關鍵澄清問題**。  
   **重要**：即使用戶寫得很細（按鈕、文案等），仍須先完成對齊；**細節規格 ≠ 已授權實作**。

3. **使用者同意後再實作**  
   僅在使用者**明確同意**（同意、執行、改吧、幫我做等），或**同一則訊息同時**給出需求與執行指令（如「請直接改」）時，才可改碼／push。

### 例外（不必先列改動方案）

- 純資訊：解釋概念、讀檔說明現況。  
- 除錯且已明確「請修」：依專案慣例；若涉產品取捨，仍建議先一句確認。

### 觸發詞「SAVE」

與改碼分離：依 Cursor 規則寫入 `PRODUCT_ITERATION_YYYY-MM.md` **§十**；僅 SAVE、未要求改碼時**不**改程式。詳見該規則全文。

### 維護

協作共識變更時：**先改** `.cursor/rules/feedback-before-implement.mdc`，再同步 **本節** 與 **迭代檔 §九**。

---

## 一、產品管理：最小可行流程

### 1.1 單一真相來源（Single Source of Truth）

| 項目 | 放在哪裡 | 誰更新 |
|------|------------|--------|
| 使用者故事 / 功能範圍 | 本檔「路線圖」+ GitHub Issues（若已用） | 產品負責人 |
| UI/UX 規格細節 | `DESIGN_SPEC.md` | 設計或開發 |
| 技術決策與遷移史 | `HANDOFF.md` | 開發 |
| **本檔** | 優先級、里程碑、技術債、風險 | 產品 + 開發 |

### 1.2 版本命名（建議）

- **對使用者**：`主版本.次版本`（例：`v1.2`）— 與 App 內顯示或行銷一致即可。  
- **對工程**：在 `package.json` 的 `version` 與 Git **tag** 對齊（例：`git tag v1.2.0`）。  
- **變更紀錄**：在 `CHANGELOG.md`（可選，尚未建立）或本檔「發布紀錄」簡表記錄 **使用者可感知的變化**。

### 1.3 迭代節奏（建議）

| 頻率 | 內容 |
|------|------|
| 每週 | 檢視路線圖、調整 P0/P1、清掉已完成的技術債條目 |
| 每次發版前 | 跑一遍 `npm run build`、手機實機測 PWA、檢查匯率/AI 設定 |
| 每月 | 複盤：哪些假設錯了、下月要砍／要加的功能 |

---

## 二、路線圖（Rolling Roadmap）

> 下方狀態：`[ ]` 未開始 · `[~]` 進行中 · `[x]` 完成 · `[!]` 暫緩

### P0 — 影響正確性與信任

| 項目 | 狀態 | 說明 |
|------|------|------|
| 單據 AI：標價細項 + 免稅列 + 實付（含日本免稅 / 多國） | [x] | prompt：`items.price` 標價、`tax_refund` 差額；卡片顯示標價小計／退稅調整 |
| 分人篩選：實付比例攤分 + 圖表／總計一致 | [x] | `personShare.js`；見「迭代紀錄」 |
| 日本免稅：固定費行（GB 佣金等）+ 可退稅池比例 | [x] | 編輯勾「固定」+ 品名推斷；見「迭代紀錄」 |
| 收據免稅額僅顯示（細項已免稅後價之類） | [x] | `receiptTaxExemptionAmount`；不影響實付公式；見「迭代紀錄」 |
| 資料雙軌（`travel_expenses_data` vs 旅程內 `expenses`）文件化或收斂 | [~] | **已文件化** [DATA_FLOW.md](./DATA_FLOW.md)；收斂仍待（TD-01） |
| 跨國：`countryHint` / `price_basis` 預留、列表「免稅」小標 | [ ] | 見「迭代紀錄」第五章 backlog |

### P1 — 體驗與成長

| 項目 | 狀態 | 說明 |
|------|------|------|
| 無障礙/焦點（延續 HANDOFF 審查清單剩餘項） | [ ] | aria、Toast live region 等 |
| 匯出/備份流程與錯誤提示 | [ ] | 見 `ExportService.js` |

### P2 — 商業化與平台

| 項目 | 狀態 | 說明 |
|------|------|------|
| Supabase（Auth + 同步） | [ ] | 替換 `DataService` 實作，介面維持 |
| Capacitor（iOS / Android 殼） | [ ] | 見 `README.md` 未來擴展表 |
| 會員 / 收款 | [ ] | 獨立 Epic，需法規與金流評估 |

---

## 三、架構：輕量優化管理

> 原則：**不大改、先收斂邊界**，讓專案可長期優化、可上架 iOS（PWA 或 Capacitor）。

### 3.1 現況評估（摘要）

| 層級 | 評估 | 建議 |
|------|------|------|
| 建置 | Vite + React 18 | 維持；效能與工具鏈成熟 |
| 路由 | React Router | 維持 |
| 全域狀態 | 單一 `AppContext` | 規模變大時拆「設定 / 旅程 / 支出」或抽 `hooks/useExpenses` |
| 資料 | `DataService` → localStorage | **唯一出口**；上雲或 Capacitor 時只換此層 |
| AI | `AIService.js` | prompt 與後處理邏輯保持在此檔或拆 `receipt/` 子模組 |

### 3.2 優先級（架構）

1. **業務邏輯離開 UI**：匯率、單據規則、分帳計算 → `services/` 或 `utils/`（純函式）。  
2. **Context 瘦身**：只留「狀態 + 委派」，複雜計算移到 `useMemo` 或獨立函式。  
3. **型別（可選）**：新檔 `.ts` 或漸進 JSDoc，降低重構成本。  
4. **測試（可選）**：先為 `utils` 與 `buildExpenseFromAI` 寫單元測試，再擴大。

### 3.3 技術債登記（需追蹤）

| ID | 描述 | 影響 | 建議處理 |
|----|------|------|----------|
| TD-01 | 支出同時存於 `KEYS.EXPENSES` 與旅程物件，需同步 | 邊界錯易誤寫 | **已書面化**：[DATA_FLOW.md](./DATA_FLOW.md)；長期改為單一來源或明確「主從」 |
| TD-02 | `AppContext` 職責多 | 難測、難讀 | 拆 hook 或 slice context |
| TD-03 | 無自動化測試 | 回歸靠手動 | **已補 Vitest**（`npm run test:run`）：`personShare`、`currency`、`ExchangeRateService`、`recalculateExpensesForRates`、`savedCurrencyMerge`；擴充見 backlog |

---

## 四、風險與依賴

| 風險 | 緩解 |
|------|------|
| OpenRouter / 模型 API 變更或限流 | 設定頁可換模型；prompt 版本化（註解或常數） |
| 瀏覽器儲存空間上限 | 提醒匯出備份；未來雲端同步 |
| App Store 審核（未來） | PWA 先驗證產品；Capacitor 再包原生殼 |

---

## 五、文件索引（本專案）

| 檔案 | 用途 |
|------|------|
| **`docs/README.md`** | **文件導覽**：誰該讀哪份、有無重疊、程式資料夾地圖 |
| `README.md` | 安裝、部署、目錄結構（專案門面） |
| `HANDOFF.md` | 歷史決策、遷移背景、目錄對照 |
| `DESIGN_SPEC.md` | 產品級 UI/UX 規格 |
| `designs/README.md` | Pencil mockup 與色票（設計資產） |
| `docs/archive/BACKUP_BRANCH_v1.md` | 備份分支 Git 操作 |
| `BACKUP_README.md`（根） | 捷徑，指向 archive |
| **`docs/PRODUCT_MANAGEMENT.md`** | **本檔：產品路線、架構優先級、技術債** |
| **`docs/PRD_TRAVEL_NOTEBOOK_APP_2026-04.md`** | **正式 PRD**：旅遊手帳產品願景、旅前／旅中／旅後結構、Phase 規劃與商業模式 |
| **`docs/DESIGN_THINKING.md`** | **設計思路敘事**（從起點到現況：分帳與稅、多幣儲存等「為什麼」） |
| **`docs/DATA_FLOW.md`** | **支出與 localStorage 雙軌資料流**（維護、改儲存前必讀） |
| **`docs/PRODUCT_ITERATION_2025-03.md`** | **單次迭代：交付、踩坑、待辦、PM 跟進流程** |

---

## 六、發布紀錄（簡表）

> 每次上線或重要 merge 後補一行。

| 日期 | 版本 / Commit | 摘要 |
|------|----------------|------|
| 2025-03 | `c56cec6` 等 | 分人實攤、固定費行、收據免稅額顯示、prompt／編輯／匯出；詳見 `PRODUCT_ITERATION_2025-03.md` |
| 2025-03 | `d3628d4` 等 | 上傳單據採 AI 幣別 + HKD 匯率；細項說明與免稅額 prompt |
| 2025-03-24 | docs | Cursor rule「意見先對齊再改」；迭代檔進度快照與 §九 |
| 2025-03-24 | docs | **SAVE** 觸發寫入迭代檔 §十；規則擴充 |
| 2025-03-24 | docs | 新增 `RECEIPT_TYPES.md`（單據類型 A～H） |
| 2025-03-24 | feat | 單據類型系統上線：receipt_type 必填、雙價格、外稅消費稅列、套裝合併、依類型驗證；3 輪迭代以 8 張東京真實小票驗收 |
| 2025-03-26 | feat | 介面 i18n（繁中／英）、收據雙語欄位、外稅分人比例稅列、設定僅兩語言；見 `PRODUCT_ITERATION_2025-03.md` §十 SAVE |
| 2025-03-26 | docs | 與 AI 協作 SOP **併入本檔專節**（不另開檔）；見 [與 AI 協作 SOP](#與-ai-協作-sop) |
| 2025-03-26 | `c43c9cb` 等 | **多幣別 Phase 1+2**：匯率方向「1 記帳幣 = X 外幣」、`homeCurrency`／`tripCurrency`、遷移、動態幣別 UI、新建旅程選幣；詳見 [`PRODUCT_ITERATION_2025-03.md` §十一](./PRODUCT_ITERATION_2025-03.md#十一多幣別系統2025-03-26-起--計劃--交付--坑--後續) |
| 2025-03-27 | `f60c664`／`b3da7df`／`1916cbb` 等 | **多幣 Phase 3 延伸**：Frankfurter、`/api/exchange-rates`、Vite proxy、`FRANKFURTER_SUPPORTED` + `rebaseRates`、設定匯率格 `key`、fetch 10s、`currencyMismatch`、Toast 去重；**`HANDOFF.md`** 改為備份/tag 專職；詳見 **§十一**、**§2.7** |
| 2026-03-27 | `33bb2dd`／`2b7c1d0`／`f0f07d8` 等 | **支出卡片／編輯**：`userEditedPricing`、`expensePricing`、稅／折扣／退稅列與精簡顯示、編輯清 `priceActual`、金額前綴；**SAVE** 與坑 **§三 L20–L22** → [`PRODUCT_ITERATION_2025-03.md`](./PRODUCT_ITERATION_2025-03.md) |
| （歷史） | — | 初建立本管理文件 |

---

## 七、複盤問題清單（每季可答）

1. 使用者最常卡在哪三步？（上傳、分帳、匯率？）  
2. 本季 P0 是否都與「信任與正確性」有關？  
3. 技術債是否有一項被真正還清？  
4. 下一季要 **砍** 什麼功能避免膨脹？

---

*最後更新：2026-03-27 支出卡片 SAVE 已入迭代檔 §十／§三 L20–L22；多幣 Phase 3 見 §十一；HANDOFF 與迭代檔分工。*
