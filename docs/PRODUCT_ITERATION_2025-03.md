# 產品迭代紀錄 · 2025-03（分帳／免稅／顯示邏輯）

> **定位**：本檔為 **2025-03 這一輪** 需求、交付、踩坑與後續跟進的 **單一書面來源**（Session 級）。  
> **不與** `HANDOFF.md`（歷史遷移、換機、備份/tag）或 `PRODUCT_MANAGEMENT.md`（滾動路線圖）重複貼公式長文；後兩者以 **連結 + 狀態更新** 為主。  
> **HANDOFF** 不複製本檔的交付表；**本檔** 不複製 HANDOFF 的遷移史與備份步驟。  
> **現版匯率／稅項／分帳公式** 以 **§十二** 為準（與程式 `currency.js`、`personShare.js` 對齊）。

---

## 一、本輪摘要（給 PM / 接棒用）

| 項目 | 說明 |
|------|------|
| **主題** | 多人分帳時「實付」與「原價行」不一致（免稅／退稅／固定費）；分人篩選時金額與退稅顯示正確；跨國單據長期策略；延伸 **多幣別／記帳幣／旅程幣／即時匯率**。 |
| **狀態** | 功能已 **上線並 push**；**協作規則**已寫入 Cursor rule（見 §九）；後續以本檔 backlog 追蹤。 |
| **核心程式** | `personShare.js`、`ExpenseCard.jsx`、圖表／Dashboard、`AIService.js`、`receipt-prompt.js`、編輯表單；多幣時加 **`AppContext`**、`currency.js`、**`ExchangeRateService.js`**、`api/exchange-rates.js`。 |

### 進度快照（Progress · 2025-03-27 更新）

| 區塊 | 狀態 | 備註 |
|------|------|------|
| 分帳／免稅／固定費／收據免稅額顯示 | 已上線 | 多個 commit 已 push |
| 上傳單據幣別 | 已上線 | AI `currency` + **`settings` 匯率表**；**記帳幣**語意見 §十一（非固定 HKD） |
| 介面 i18n（繁中／英） | 已上線 | `locales/*`、收據雙語欄位 |
| 多幣別 Phase 1+2 + 延伸 | 已上線 | `homeCurrency`／`tripCurrency`、遷移、動態顯示；延伸見 §十一 **Phase 3 已交付** |
| 編輯細項說明文案 | 已上線 | 免稅後單價 vs 固定費分離；**placeholder 無範例數字**（見 §2.6） |
| 設定：人物改名 | 已上線 | `renamePerson` + 持久化 |
| Cursor：**意見→先對齊再改** | 已建立 rule | `.cursor/rules/feedback-before-implement.mdc` |
| **SAVE** → 寫入 §十 快照 | 已約定 | 見 Cursor rule 與 §十 |
| 單據類型系統（receipt_type + 雙價格 + 驗證） | 已上線 | 3 輪迭代；8 張東京小票驗收 |
| Backlog B-01～B-15 | 部分完成 | 見 §五（B-05 已完成、B-03 進行中）|

---

## 二、已交付清單（Delivered）

### 2.1 分人實攤（實付比例）

- **邏輯**：篩選某人且整卡 assignee ≠ 該人時，實攤 = `實付 × (該人原價小計 ÷ 全單原價加總)`（HKD／原幣一致）。
- **同步**：`Dashboard`、`Charts`、`DailyChart`、`PersonChart` 與卡片一致。
- **檔案**：`personShare.js` + 上述頁面。

### 2.2 固定費行（例：日本 ZARA · GB 佣金 286）

- **問題**：全單用同一 `P/G` 會錯把「手續費」也乘上退稅比例。
- **解法**：可退稅池 `G_elig = 全單標價 − 固定費標價`，`P_elig = 實付 − 固定費`，`r = P_elig / G_elig`；固定行實攤 = 標價。
- **UI**：編輯細項勾「**固定**」；品名關鍵字（佣金、Commis 等）可自動推斷。
- **檔案**：`personShare.js`、`EditExpenseDialog.jsx`、`AIService` 建檔時帶欄位。

### 2.3 分人檢視：退稅明細

- 原價小計 → 比例退稅 → 實攤；依 **有效退稅**（含 `taxRefund` 或 標價−實付 推算）。

### 2.4 收據免稅額（僅顯示）

- **問題**：唐吉訶德類單據，細項已是免稅後價，加總＝實付 → 畫面像「沒退稅」。
- **解法**：欄位 `receiptTaxExemptionAmount`（`receipt_tax_exemption_amount`），**不參與**實付與分帳公式；卡片另列「免稅額（收據）」+ 說明文案。
- **檔案**：`ExpenseCard`、`EditExpense`、`receipt-prompt.js`、`buildExpenseFromAI`、`ExportService`（匯出可加一行）。

### 2.5 部署與環境

- **Vercel**：`GEMINI_API_KEY` 僅伺服器；本機單據需 `vercel dev` 或已部署網址。
- **推送**：專案內 `npm run deploy` = `git add` + `commit` + `push`（見 `scripts/deploy.js`）。

### 2.6 小 UX 與表單（曾漏錄，補登）

- **編輯支出／免稅相關輸入**：`taxRefund`、`discount`、`receiptExemption` 等 placeholder **移除範例數字**（如「-2557」），避免誤導為必填格式；見 `EditExpenseDialog`、`locales`。
- **設定 → 人物管理**：**編輯人物名稱**（按鈕 + Dialog），`renamePerson` 同步所有旅程與支出指派人；曾踩坑：須走 **`setExpenses`** 寫入 localStorage（見 §11.3 **M6**）。

### 2.7 多幣別 Phase 3 延伸（2025-03～，與 §十一對齊）

> 接在 Phase 1+2 之後；**完整檔案與坑**見 **§十一**。

- **Frankfurter 即時匯率**：`ExchangeRateService.fetchFrankfurterRates`；**同源代理** `api/exchange-rates.js`；**Vite dev** `vite.config.js` proxy `→ api.frankfurter.app`，避免 CORS。
- **不支援作為 ECB 基準的幣別**（如 **TWD、VND**）：`FRANKFURTER_SUPPORTED`；改為 **`rebaseRates` 數學換算** + info toast；不切換失敗。
- **切換記帳幣**：先 `rebaseRates` 再嘗試拉牌；API 失敗仍套用換算結果並提示。
- **設定頁匯率格**：`defaultValue` 不隨 state 更新 → 以 **`key=`** 強制重掛（見 §11.3 M3）。
- **`fetch` 無 timeout** → 下拉長時間 disabled → **AbortController 10 s**（§三 L18）。
- **AI 幣別 vs 旅程幣**：`AIService.buildExpenseFromAI` 標 **`currencyMismatch`**，`ExpenseCard` 警示（與 `needsReview` 分開處理）。
- **旅程幣**：新建／編輯／**設定內 TripManager** 可改 `tripCurrency`（`updateTrip`）。
- **「更新匯率」雙重 Toast**：有支出時 **只**依 `AppContext` `exchangeRates` effect 提示 `ratesUpdated`；無支出時 Settings 才 `fetchRatesOk`（§三 L19）。

---

## 三、踩坑與教訓（Lessons Learned）

| # | 現象 | 原因 | 後續／預防 |
|---|------|------|------------|
| L1 | 線上像舊版 | 未 `push` 或 PWA 快取 | 以 Vercel Deployments 對 commit；重大改版提示清快取。 |
| L2 | 分人金額仍像「原價加總」 | 僅一行或 G=S，或整卡 assignee＝篩選人 → 非 partial | 區分「整卡給某人」與「共同+行上標人」；文件說明何時會出現比例。 |
| L3 | `taxRefund` 空則不顯示分人退稅 | 只信欄位，未推算 | 已用 `getEffectiveRefundPositive`（含 標價−實付）。 |
| L4 | 助手「能否 deploy」說法不一 | 預設不自動跑 git，需使用者明確要求 | 流程：使用者說「push / deploy」→ 執行 `npm run deploy`。 |
| L5 | 日本免稅兩種單據 | ① 標價≠實付；② 細項已免稅後價 | ① 差額 + 固定費行；② **收據免稅額僅顯示** 欄位。 |
| L6 | AI 與公式假設衝突 | Prompt 一度強調「標價」與實付分離 | Prompt 已加 `receipt_tax_exemption_amount`；維持與 `README` 同步。 |
| L7 | 使用者提意見後未先對齊就改碼 | 助手預設直接實作 | **已立規則**：先說明理解與方案，經同意或明確「執行」再動手（見 §九）。 |
| L8 | **Gemini 漏品項**：ZARA 4 件只辨到 3 件（BLAZER 整件消失） | 圖片壓縮到 1024px 後小字模糊；或 Gemini 對雙欄格式解析不穩定 | prompt 已加具體範例；可考慮提高 `resizeImage` MAX 到 1536/2048；加 `instant_tax_free` 的 items vs subtotal >5% 驗證 → needsReview。 |
| L9 | **Gemini 品名誤辨**：UNIQLO 把 Wボーイズソックス ¥990 認成 女士內褲 ¥790 | 長收據上同類品名反覆出現，AI 混淆 | 目前無好的程式碼修正；subtotal 交叉驗證可抓差額但不能糾正品名。持續觀察。 |
| L10 | **Gemini 套裝重複列品**：セット 合併行 + 個別行都列出，items sum > subtotal | prompt 指令不夠強或 AI 忽略 | prompt 加了「セット內品項不要重複列出」+ 自我檢查清單；`buildExpenseFromAI` 加品項去重（excess = sum − subtotal → 找 price 匹配行刪除）。 |
| L11 | **AI 不回 `receipt_type`**（或回舊值 `"standard"`） | prompt 改了但 Gemini 不一定遵守 | `normalizeReceiptType` 加超寬容錯（中文、帶橫線、各種別名）；`USER_TEXT` 列出所有合法值。 |
| L12 | **外稅 `tax` 未回傳** → 消費稅列不出現 | AI 認為 tax 是 optional 就省略了 | `buildExpenseFromAI` 加 fallback：`tax_exclusive` 且 `tax ≤ 0` 時自動算 `total − subtotal`。 |
| L13 | **Vercel 部署時序**：push 後立即測試看到舊版 | Vercel build 需 1-2 分鐘 | 測試前確認 Vercel Dashboard 顯示 **Ready**；或用 `vercel --prod` CLI 等部署完才回報。 |
| L14 | **PWA Service Worker 快取** → 新 JS bundle 已部署但瀏覽器仍用舊版 | SW 的 precache 策略 | 重大改版後提醒使用者 `Ctrl+Shift+R` 或清網站資料；可考慮 `skipWaiting` / `clientsClaim` 策略。 |
| L15 | **needsReview 門檻過敏**：套裝 5 JPY 門檻對 AI 微小品名/金額誤差太敏感 | 門檻固定值不適合所有金額量級 | 已改為 `max(subtotal × 1%, 300)` 相對門檻。 |
| L16 | **Rollup 運算子優先順序**：`i.priceActual ?? i.price \|\| 0` build 失敗 | `??` 與 `\|\|` 混用需加括號（ES 規範要求） | 改為 `i.priceActual ?? (i.price \|\| 0)`；日後混用 nullish coalescing 時注意。 |
| L17 | **PowerShell heredoc 不支援**：git commit 用 `$(cat <<'EOF' ...)` 在 PowerShell 失敗 | Windows PowerShell 不支援 bash heredoc | 在 Windows 環境一律用單行 `-m "..."` 提交。 |
| L18 | **Frankfurter `fetch` 無 timeout** | 瀏覽器預設不逾時；代理慢或掛起時下拉 **長時間「更新中」** | `fetchFrankfurterRates` 使用 **AbortController + 10 s**；逾時進 catch，仍保留 rebase 換算。 |
| L19 | **「更新匯率」成功時 Toast 重複** | `settings` 更新匯率 + `AppContext` 依 `exchangeRates` 重算支出 **各 notify 一次** | 有支出時只讓 **AppContext** 顯示 `ratesUpdated`；**無支出**時 Settings 才 `fetchRatesOk`。 |
| L20 | **編輯消費稅／退稅後卡片像沒變** | ① 消費稅列曾僅在 `receiptType === 'tax_exclusive'` 時顯示，內含稅等仍存 `tax` 也不出列；② 精簡模式（`userEditedPricing`）曾 **隱藏**「退稅（標價與實付差額）」列，一改稅務就進精簡 → 退稅永遠看不到 | 已修：`tax > eps` 即顯示消費稅列；退稅列 **不再**因精簡隱藏。 |
| L21 | **編輯品項金額後仍顯示掃描期「稅後／實價」** | 精簡顯示仍優先 `priceActual`；只改 `price` 未清掃描留下的 `priceActual` | 已修：精簡模式顯示以 **`price` 為準**；`EditExpenseDialog` 改價時 **`priceActual = undefined`**。 |
| L22 | **OAuth `client_secret*.json` 在專案根目錄** | 下載憑證後易誤留 repo | **勿** `git add`；應 **`.gitignore`** 或移出專案；Supabase／Vercel 用環境變數。 |

---

## 四、決策與公式（速查，詳見 README）

- **實付比例（無固定費）**：`實攤 = P × (S ÷ G)`。
- **含固定費 F**：`r = (P − F) ÷ (G − F)` 套在非固定行；固定行實攤 = 該行標價。
- **顯示用免稅額**：與 `P、G` 脫鉤，避免誤導「無免稅」。

---

## 五、待辦與優化 backlog（本輪暫停後跟進）

> 狀態：`[ ]` 未做 · `[~]` 進行中 · `[x]` 完成

### P0 — 正確性／信任

| ID | 項目 | 備註 |
|----|------|------|
| B-01 | [ ] 分人篩選 + **收據免稅額** 的說明是否要在 partial 區塊加一句（僅參考） | 可選。 |
| B-02 | [ ] `price_basis` / `countryHint` 預留欄位（資料層） | 跨國長期。 |
| B-03 | [~] Prompt 抽免稅額 **命中率** 複盤 | 已加 4 範例 + 自我檢查；ZARA/UNIQLO 仍有漏品項和品名誤辨（L8/L9），持續觀察。 |
| B-08 | [ ] **提高圖片解析度**：`resizeImage` MAX 1024 → 1536 或 2048 | L8 漏品項可能因壓縮後小字模糊；需測 API 成本與延遲。 |
| B-09 | [ ] **品項去重更智慧**：名稱＋價格組合匹配 | 目前只做精確 price match excess，兩行組合或不精確匹配會失效。 |
| B-10 | [ ] **subtotal 強制錨定**：items sum 偏差大時直接用 subtotal 覆蓋比例 | 避免退稅被行加總拉偏。 |

### P1 — 體驗

| ID | 項目 | 備註 |
|----|------|------|
| B-04 | [ ] 卡片小標「免稅」當 `receiptTaxExemptionAmount > 0` | 列表一眼辨識。 |
| B-05 | [x] 細項加總 ≠ 實付時的引導文案 | 已有 `needsReview` 黃條。 |
| B-11 | [ ] **needsReview 加「檢查」按鈕** → 直接開 EditExpenseDialog | 使用者看到警示後能快速修正。 |
| B-12 | [ ] **外稅卡片底部含稅小計行**：消費稅列下加「含稅合計 = ¥N」 | 讓數學自洽一目了然，目前使用者要自己算。 |

### P2 — 工程

| ID | 項目 | 備註 |
|----|------|------|
| B-06 | [ ] `personShare` 單元測試（Vitest） | 新增 `getItemActualPrice` / `sumAllItemActualPrices` 更需測試。 |
| B-07 | [ ] README 專案結構補 `utils/personShare.js` | 與現況同步。 |
| B-13 | [ ] **PWA 快取策略優化**：`skipWaiting` + `clientsClaim` 或版本提示 | L14：部署後使用者可能一直看舊版。 |
| B-14 | [ ] **Vercel 部署等待**：`vercel --prod` CLI 等完成再回報 URL | L13：push 後立即測常看到舊版。 |
| B-15 | [ ] **receipt-prompt fixture 測試**：8 張小票 JSON snapshot 測試 `buildExpenseFromAI` | 任何 prompt/AIService 改動後可快速回歸。 |

---

## 六、產品經理跟進流程（建議固定做）

1. **每個迭代** 開或更新 **一個** `PRODUCT_ITERATION_YYYY-MM.md`（或併入本檔新章節），避免對話散失。  
2. **發版前**：更新 `PRODUCT_MANAGEMENT.md` →「發布紀錄」+ 路線圖勾選。  
3. **踩坑** 只寫 **一處**（本檔或 PRODUCT_MANAGEMENT 技術債表），不重複貼兩份長文。  
4. **跨國策略**：記錄在 `PRODUCT_MANAGEMENT` 或本檔「決策」，**不**在 README 堆長篇。  
5. **部署**：約定觸發詞（「請 push / deploy」）與責任（誰執行 `npm run deploy`）。  
6. **與 AI 協作**：使用者提**意見／優化／問題**時，助手應**先**說明理解與改法，**不**立即改碼；見 **§九** 與 `.cursor/rules/feedback-before-implement.mdc`。

---

## 七、相關檔案索引

| 路徑 | 用途 |
|------|------|
| `src/utils/personShare.js` | 分帳、固定費、有效退稅、實攤 |
| `src/components/expense/ExpenseCard.jsx` | 退稅列／收據免稅列／分人明細；精簡顯示、`userEditedPricing` |
| `src/components/expense/ExpenseList.jsx` | 編輯儲存合併 `userEditedPricing`、`hasPricingRelatedChanges` |
| `src/utils/expensePricing.js` | `hasPricingRelatedChanges`（價格／稅／折扣／品項金額是否變更） |
| `src/services/AIService.js` | `buildExpenseFromAI` |
| `api/receipt-prompt/`（`assemble.js` + `markets/*`）／`api/receipt-prompt.js` re-export | Gemini JSON 規格（市場偵測 + 附件 A/B） |
| `README.md` | 免稅／固定費／收據免稅額說明 |
| `docs/PRODUCT_MANAGEMENT.md` | 滾動路線圖與技術債 |
| `docs/RECEIPT_TYPES.md` | **單據類型 A～H**、收據印字優先之共識 |
| `src/i18n.js`、`src/locales/zh-TW.json`、`src/locales/en.json` | 介面 i18n（繁中／英） |
| `src/utils/locale.js`、`src/utils/displayNames.js` | 語言正規化、收據欄位雙語顯示 |
| `src/services/ExchangeRateService.js` | Frankfurter 拉牌、`mergeExchangeRates`、`rebaseRates`、`FRANKFURTER_SUPPORTED` |
| `api/exchange-rates.js` | Vercel serverless 代理 Frankfurter（同源、`GET ?from=`） |
| `vite.config.js` | dev 時 `/api/exchange-rates` proxy 至 `api.frankfurter.app` |
| `src/store/AppContext.jsx` | 記帳幣、`exchangeRates`、支出依匯率重算、Toast 觸發 |
| `.cursor/rules/feedback-before-implement.mdc` | 意見先對齊再改之協作規則 |

---

## 八、修訂紀錄

| 日期 | 動作 |
|------|------|
| 2025-03-23 | 建立本檔；收錄本輪需求、交付、踩坑、backlog、PM 流程。 |
| 2025-03-24 | 新增 §進度快照、§九協作規則、L7；連結 Cursor rule。 |
| 2025-03-24 | 新增 §十 SAVE 快照表與觸發詞約定；擴充 Cursor rule。 |
| 2025-03-24 | 新增 `docs/RECEIPT_TYPES.md`（單據 A～H）；索引與 README 連結。 |
| 2025-03-24 | §三 踩坑擴充 L8～L17（AI 漏品項、品名誤辨、套裝重複、部署時序、PWA 快取、運算子優先順序等）；§五 Backlog 擴充到 B-15。 |
| 2025-03-26 | 與 AI 協作書面 SOP **併入** `PRODUCT_MANAGEMENT.md` 專節（不另開檔）；§九 加連結；`docs/README.md`、根 `README.md` 已索引。 |
| 2025-03-26 | SAVE：i18n（繁中／英）、收據雙語、語言僅兩選與 `normalizeUiLanguage`；詳見 §十。 |
| 2025-03-26 | **SAVE 多幣別**：新增 **§十一**（計劃／交付／坑／後續）；§十 增列；`PRODUCT_MANAGEMENT` 發布紀錄補一行。 |
| 2025-03-27 | **整理與補漏**：§一 進度快照／主題更新；新增 **§2.6、§2.7**；§三 **L18、L19**；§十一 **Phase 3 狀態與交付**（含 Frankfurter、proxy、rebase、key、timeout、雙 Toast、currencyMismatch）；§十 SAVE 新列；§七 索引補匯率相關檔；與 `HANDOFF.md` 分工、避免重複長表。 |
| 2025-03-27 | **維護優化階段 0**：新增 **`docs/DATA_FLOW.md`**（`travel_expenses_data` ↔ `trip.expenses`、Context 權威、`switchTrip`／`removePersonAndReassignAll` 要點）；`docs/README.md`、`PRODUCT_MANAGEMENT.md`（TD-01、路線圖、索引）連結更新。 |
| 2025-03-27 | **維護優化階段 1～3**：**Vitest** + `src/**/*.test.js`（`personShare`、`currency`、`ExchangeRateService`、匯率重算、幣別清單合併）；**`recalculateExpensesForRates`、`buildMergedSavedCurrencySettings`** 抽離純函式，`AppContext` 精簡；**`src/types/expense.js`** JSDoc（`hkdAmount` 語意）；`updateExpense` 改用 `toHome`；`vite.config` `test` 區塊、`package.json` `test`／`test:run`。 |
| 2026-03-27 | **SAVE**：§三 新增 **L20–L22**（編輯後稅／退稅／品項顯示、OAuth 檔勿入庫）；§十 新增 **2026-03-27** 列；與 `DATA_FLOW.md` 修訂紀錄對齊。 |
| 2026-03-27 | **`DESIGN_THINKING.md`**：新增 **§五**（掃描對照 vs 編輯後定案、`userEditedPricing`、折扣可見、稅務列與 ± 前綴）；原 §五～§八 順延為 §六～§九；時間軸與延伸閱讀已更新。 |
| 2026-03-30 | **Webhook 除錯全紀錄**：§13.1 補「Webhook 308 修復 + 簽章穩健化」交付項；§13.2 新增 **L36–L42**（308 redirect、Next.js-only config、Web API 格式、簽章 secret 不匹配、body parser 吃 raw body、Workbench 舊 delivery、PowerShell curl 別名）。`SUPABASE_AUTH_AND_SYNC` 新增 **§5.1b** 除錯全攻略（含快速排查流程圖）。 |

---

## 九、協作規則（意見 → 對齊 → 再實作）

**目的**：減少未對齊就改程式、方便產品決策與交接。

| 步驟 | 內容 |
|------|------|
| 1 | 使用者提出意見或修改需求時，助手**不**立刻改 code。 |
| 2 | 助手先說明：**我如何理解問題**、**預計怎麼改**（含檔案／風險）。 |
| 3 | 使用者確認、或明確說「同意／改吧／執行／幫我做」後，再實作。 |

**實作位置**：`.cursor/rules/feedback-before-implement.mdc`（`alwaysApply: true`）。**書面 SOP（給人讀）**：[`PRODUCT_MANAGEMENT.md` 專節「與 AI 協作 SOP」](./PRODUCT_MANAGEMENT.md#與-ai-協作-sop)。

**例外**：純解釋概念、讀檔說明現況，可直接回答。

---

## 十、SAVE 快照（對話存檔 · PM 用）

> 當使用者在對話中輸入 **`SAVE`**（作為主要指令）時，助手應在本表 **新增一列**，並遵守 `.cursor/rules/feedback-before-implement.mdc` 之「SAVE」段落。  
> 跨月可新建 `docs/PRODUCT_ITERATION_YYYY-MM.md` 並複製本節表頭。

| 日期 | 摘要 | 待辦／跟進 |
|------|------|------------|
| 2025-03-24 | 約定觸發詞 **SAVE**＝寫入本表 + 更新規則；與「意見先對齊再改」並存於同一 Cursor rule。 | 之後每次工作段結束可打 SAVE 存檔；跨月新建迭代檔。 |
| 2025-03-24 | 使用者確認將「單據情境 A～H」寫入 repo；新增 `docs/RECEIPT_TYPES.md`，並入文件索引。 | 逐類對解法時以該檔為準迭代。 |
| 2025-03-24 | **三項架構升級**落地：① prompt 輸出 `receipt_type`（必填）+ `has_bundle` + `price_actual`；② `personShare.js` 新增 `getItemActualPrice` / `sumAllItemActualPrices`，分帳用 actual price；③ `buildExpenseFromAI` 依類型驗證 + `needsReview` 標記；④ UI 加類型 badge、需檢查警示、雙價格顯示、編輯可改類型。| 以 8 張東京真實小票驗證覆蓋 A–F；下一步：韓國/歐洲小票加入驗證表；持續優化 prompt 對セット的合併準確度。 |
| 2025-03-24 | **第二輪修正**（3 commits）：① prompt 加 4 個具體範例 + 自我檢查清單，強制 AI 回 `receipt_type`；② `buildExpenseFromAI` 品項去重（items sum > subtotal 時自動刪多餘行）；③ ExpenseCard 外稅加「消費稅 +N」列 + 標題改「原價（未稅）」；④ `normalizeReceiptType` 容錯加寬（中文、各種變體）。| 實測 8 張東京小票：badge✅、ZARA 雙價格✅、UNIQLO セット合併✅、退稅 2,557✅。 |
| 2025-03-24 | **第三輪修正**：① 外稅 `tax` fallback（AI 沒回 tax 時自動算 total−subtotal）；② `instant_tax_free` 加 needsReview 驗證（items vs subtotal 差 >5%）；③ 套裝 needsReview 門檻從 5 JPY 放寬到 max(小計×1%, 300)。| 待驗：清 PWA 快取後重新上傳 DORAEMON（消費稅列）、ZARA（needsReview 觸發）；UNIQLO 黃條應消失。AI 品項遺漏（ZARA BLAZER）/ 品名誤辨（UNIQLO 短襪→內褲）為 Gemini 準確度問題，持續觀察。 |
| 2025-03-26 | **SAVE — i18n 與語言設定**：① `react-i18next` + `zh-TW.json`／`en.json`，全站文案（含 `Header`、導航、圖表、設定、Toast 等）；② 收據 **雙語欄位**（`name`／`name_en`、`store`／`store_en`、`location`／`location_en`）由 `receipt-prompt` + `buildExpenseFromAI` 寫入，`displayNames` 依語系顯示；③ **外稅 + 分人**時加「消費稅（按比例）」列；④ 刪除確認用本地化店名；⑤ **設定僅繁中／英**（移除「跟隨系統」），`normalizeUiLanguage` + `DataService` 統一、舊 `system`→繁中，`PRESET_TRIPS_DATA` 補 `uiLanguage`，匯入備份可帶語言。 | 舊資料無 `name_en` 時英文介面先顯示繁中；可選 backlog：編輯表單加英文品名欄。 |
| 2025-03-26 | **書面 SOP**：併入 `PRODUCT_MANAGEMENT.md`（與 §九、Cursor rule 對照）；明定「細節規格≠已授權實作」。 | 規則變更時同步：Cursor rule、`PRODUCT_MANAGEMENT.md` 該節、§九。 |
| 2025-03-26 | **歸檔**：獨立 `SOP_AI_COLLABORATION.md` 已刪除，全文併入產品管理檔專節，減少重複檔案。 | — |
| 2025-03-26 | **多幣別 Phase 1+2**（`c43c9cb` 已 push）：匯率語意反轉、home/trip 幣、遷移、UI 動態記帳幣、旅程幣選擇、匯出／圖表標籤；詳見 **§十一**。 | 延伸見 **§十一 Phase 3**；`PRODUCT_MANAGEMENT` 發布表另補 Frankfurter 等列。 |
| 2025-03-27 | **多幣 Phase 3 延伸**（已 push `main`，例：`f60c664`／`b3da7df`／`1916cbb`）：Frankfurter + **`/api/exchange-rates`** + Vite proxy、`FRANKFURTER_SUPPORTED` + **`rebaseRates`**、設定頁 **`key`**、**fetch 10s**、AI **`currencyMismatch`**、設定內改旅程幣、雙 Toast 處理；**`HANDOFF.md`** 改為備份/tag 專職、不重複本表。 | UX 微調、改名 `hkdAmount`、**OTHER** 自訂幣精準牌價等見 §11.4。 |
| 2026-03-27 | **SAVE — 支出卡片／編輯（稅務、精簡顯示、UI 前綴）**（已 push `main`，例：`33bb2dd`、`2b7c1d0`、`f0f07d8`）：① **`userEditedPricing`** + **`src/utils/expensePricing.js`** 之 `hasPricingRelatedChanges`（`ExpenseList` 儲存時合併）；② **`ExpenseCard`**：整單折扣列、精簡／掃描兩套品項對照、**消費稅**改為有 **`tax`** 即顯示、**退稅列**不因精簡隱藏；③ **`EditExpenseDialog`**：補 **消費稅 `tax`**、改品項價時清 **`priceActual`**；④ 退稅／折扣金額前加 **`-`**（與消費稅 **`+`** 對齊），分人「比例退稅」同前綴；⑤ 坑與 log → **§三 L20–L22**；⑥ **`docs/DATA_FLOW.md`** 已述 `userEditedPricing`；⑦ **Auth／雲端**坑與 Console／Network／SQL →仍見 **`docs/SUPABASE_AUTH_AND_SYNC_2026-03.md`**。 | 根目錄 **`client_secret*.json`** 勿入庫（見 **L22**）；可選：`.gitignore` 加條款。 |

---

## 十一、多幣別系統（2025-03-26 起）— 計劃 · 交付 · 坑 · 後續

> 與使用者對齊「先單一旅程幣、原幣 + 記帳幣為真實來源」後分階段實作；**本節為技術與產品交付單一來源**。備份與換機步驟見 **`HANDOFF.md`**。

### 11.1 計劃對照（Phase 1～3 狀態）

| 階段 | 內容 | 狀態 |
|------|------|------|
| **Phase 1 · 基礎** | 匯率 **「1 記帳幣（home）= X 外幣」**；**記帳幣金額 = 原幣 ÷ X**（`hkdAmount` 欄位仍表記帳幣金額，未改名）。**`homeCurrency`**、`trip.tripCurrency`、舊資料遷移。 | **已交付** |
| **Phase 2 · UI** | 記帳幣代碼、設定匯率說明、新建旅程選旅程幣、**設定內 TripManager 編輯旅程幣**、複製報告／圖表／卡片一致。 | **已交付** |
| **Phase 3 · 即時匯率與防呆** | 免費 API（**Frankfurter**）、同源代理；切換記帳幣 **rebase** + 失敗仍換算；**TWD/VND** 等不支援 `from` 時改數學換算 + 提示；**fetch timeout**；設定匯率格 **key** 刷新顯示；掃描 **AI 幣別 ≠ 旅程幣** → `currencyMismatch` 卡片提示；**更新匯率** 與 **AppContext** Toast 去重（§三 L19）。 | **已交付**（細節 §2.7、下表） |
| **Phase 3 · 未做／可選** | 儀表板「1 記帳幣 = X 外幣」**更完整 UX**、欄位 **`hkdAmount` 改名**、OTHER 自訂幣若無 ECB 的精準即時匯率等 | **Backlog** |

### 11.2 已交付（實作與推送 · 彙總）

**Phase 1+2（基礎）**

- **常數**：`DEFAULT_EXCHANGE_RATES`「1 基準 = X 外幣」；`PRESET_TRIPS_DATA` 含 `tripCurrency`、`homeCurrency`。
- **DataService**：`loadSettings` 遷移；`loadTripsData` 補 `tripCurrency`；`createTrip(name, date, tripCurrency)`，新旅程 **僅複製 people**。
- **currency.js**：`toHome`；`resolveReceiptCurrency(parsed, settings, tripCurrency)`。
- **AppContext**：`exchangeRates` 變更時重算支出；`updateExpense` **÷ rate**；`homeCurrency`、`homeCurrencyCode`、`tripCurrency`。
- **AIService / AddExpense / UploadArea / personShare**：**÷ rate** 與分攤一致。
- **UI**：`Settings` 匯率區、`TripManager`（旅程幣）；`Dashboard`、`ExpenseCard`、`Charts`、`DailyChart`、`PersonChart`、`ExportService` 動態記帳幣。
- **Git**：`main` 已 push（例：`c43c9cb`）。

**Phase 3 延伸（2025-03～）**

- **`api/exchange-rates.js`** + **`ExchangeRateService.js`**：`fetchFrankfurterRates`、`mergeExchangeRates`、`rebaseRates`、**`FRANKFURTER_SUPPORTED`**（ECB 未涵蓋 **TWD、VND** 等作為 `from` 時改 rebase + 提示）。
- **`vite.config.js`**：`/api/exchange-rates` **dev proxy**。
- **`Settings.jsx`**：切換記帳幣先 **rebase**；支援 Frankfurter 時拉牌；匯率輸入 **`key`** 避免 `defaultValue` 卡舊畫面；**fetch 10 s** 逾時；**「更新匯率」** 按鈕在不支援幣別／OTHER 時停用或提示；Toast 邏輯見 **§三 L19**。
- **AIService / ExpenseCard**：**`currencyMismatch`**（AI 幣別 vs 旅程幣）。
- **Header.jsx**：`trips.map` 參數勿名 **`t`**（避免遮蔽 i18n）**— 白屏已修**。
- **Git**：`main` 例：`f60c664`（proxy 等）、`b3da7df`（TWD/VND／rebase）、`1916cbb`（key / timeout）。

### 11.3 坑點與注意（接棒必讀）

| # | 說明 |
|---|------|
| **M1** | 欄位名 **`hkdAmount`** 語意已是「記帳幣金額」，**勿**望文生義當成僅 HKD；未來若改名需遷移 localStorage。 |
| **M2** | **舊匯率遷移** 為 `1/r`；自訂幣 `customCurrencyRate` 一併反轉；若使用者曾手動改錯，遷移後仍繼承該錯誤（需人工對帳）。 |
| **M3** | 設定頁匯率為 **uncontrolled**（`defaultValue` + `onBlur`）。程式更新 `exchangeRates` 時，**已用 `key` 強制重掛** 使顯示與 state 一致；若移除 `key` 會回到「畫面不更新」問題。 |
| **M4** | `getPartialMatchPersonShareHKD` 等函式名仍含 HKD，**與記帳幣語意不一致**；重構時一併改名。 |
| **M5** | **Header** `map` 回呼參數 **`t` 遮蔽 `useTranslation` 的 `t`** → 白屏；**已修**。 |
| **M6** | `renamePerson` 必須走 **`setExpenses`** 持久化，勿用僅更新 state 的 setter。 |
| **M7** | 部署後若見舊版：**Vercel build**、**PWA Service Worker**（§三 L13/L14）。 |
| **M8** | **OTHER**：不向網路拉牌價；**雙 Toast**（`fetchRates` + `ratesUpdated`）已依 **L19** 處理。 |

### 11.4 後續跟進（Backlog）

- 欄位 **`hkdAmount` 改名**、儀表板匯率 **UX 微調**、**旅程幣變更對既有支出**是否需一鍵重標（產品決策）。
- 與 `PRODUCT_MANAGEMENT.md`「多幣／匯率」路線併檢；大改前依 **§九** 先對齊再動手。

---

## 十二、現版邏輯速查（匯率 · 稅／退稅 · 分帳）

> 本節描述 **目前程式實作**（非各國稅法）；程式來源：`src/utils/currency.js`、`src/utils/personShare.js`、`src/store/AppContext.jsx`、`src/components/expense/ExpenseCard.jsx`、`src/pages/AddExpense.jsx`。欄位 **`hkdAmount`** 實際為 **記帳幣金額**（見 §11.3 M1）。

### 12.1 匯率與記帳幣金額

| 項目 | 說明 |
|------|------|
| **匯率表** | `settings.exchangeRates[currency]`：**數字 X 表示「1 記帳幣（home）= X 單位該外幣 c」**；記帳幣本身對應列為 **1**。 |
| **單筆支出換算** | `originalAmount` = 該筆 **原幣實付（或使用者確認之總額）**；**記帳幣金額**（存於欄位 `hkdAmount`）= **`originalAmount ÷ exchangeRates[currency]`**（`currency.js` 的 `toHome`）。 |
| **匯率變更後** | `AppContext` 依目前 `exchangeRates` **重算所有支出**的 `hkdAmount` 與 `rate`（`originalAmount`、`currency` 不變）。 |
| **旅程幣 `tripCurrency`** | 新建／手動記帳 **預設原幣**、AI 未辨識幣別時之 **fallback**（`resolveReceiptCurrency`）；**不**等於自動換算公式——換算永遠用 **記帳幣 + 匯率表**。 |

### 12.2 稅項、退稅、實付（資料欄位與顯示）

| 項目 | 說明 |
|------|------|
| **手動新增支出**（`AddExpense`） | **2026-03-29 起**與 **編輯**一致：**`originalAmount` 僅來自「實付」欄**；`subtotal`／`tax`／`taxRefund`／`discount` **獨立儲存**，不覆寫實付。此前舊版曾用「小計+退稅+折扣 > 0 則覆寫實付」——已廢止（見 **§十三**）。 |
| **消費稅額 `tax`** | 常與 **`receiptType === 'tax_exclusive'`**（外稅）並用：卡片顯示「原價（未稅）+ 消費稅」列；**不**單獨重算 `originalAmount`（實付仍以帳上 `originalAmount` 為準）。 |
| **有效退稅額（推算）** | `getEffectiveRefundPositive(expense)`：優先 **`|taxRefund|`**；若幾乎為 0，則用 **max(0, 標價加總或 subtotal − 實付)**，讓舊資料仍能顯示退稅感。 |
| **收據免稅額 `receiptTaxExemptionAmount`** | **僅展示**（例：細項已是免稅後單價）；**不參與**分帳公式。 |
| **分人篩選 + 外稅** | 該人分攤到的 **消費稅顯示** ≈ **`tax × (該人標價小計 ÷ 全單標價小計)`**（`ExpenseCard` `partialTaxShare`，以 **display `price`** 比例）。 |

### 12.3 分帳：整單可退稅比例 r 與「固定費」行

記號（皆 **原幣**，與 `personShare.js` 一致）：

- **P** = `originalAmount`（實付）
- **G** = 全單品項 **actual price** 加總（`sumAllItemActualPrices`；有 `priceActual` 時優先，供 ZARA 非課稅欄等）
- **F** = **固定費行** actual 加總（佣金／手續費等，`excludeFromRefundSplit` 或品名推斷 `inferFixedFeeFromName`）— **不**隨退稅比例縮水
- **gElig** = G − F（可退稅池標價）
- **pElig** = P − F（可退稅池實付）
- **r** = pElig ÷ gElig（當池合理時）；否則 **fallback** 為 **P÷G**（`legacyUniform`）

**篩選某人且該人僅佔部分品項（partial match）時：**

1. **該人實攤原幣** `getPartialMatchPersonShareOriginal`：固定費行 → 該行 **照 actual 全額**；其餘行 → **該行 actual × r**（或整單比例 P×S/G 若走 legacy）。
2. **該人實攤記帳幣** `getPartialMatchPersonShareHKD`：**`hkdAmount × (該人實攤原幣 ÷ P)`**（若 P>0）；與 **記帳幣** 欄位語意一致（函式名仍含 HKD 為歷史名稱，見 §11.3 M4）。
3. **該人分到的退稅額（顯示用）** `getPartialRefundShareOriginal`：在可退稅池內依該人可退稅標價與 **r** 分配；固定費行不參與退稅池分配。

**未做分人篩選**：卡片顯示整單 `originalAmount` / `hkdAmount` 與全單退稅／外稅列。

### 12.4 與 README／免稅長文的分工

- 使用者可讀 **`README.md`** 的免稅／固定費概念說明。  
- **可執行的公式與變數名** 以 **本節 + 原始碼** 為準；若兩處不一致，以程式為準。

---

## 十三、2026-03-28～30 紀錄（自訂類別 · 表單 UX · 計費／Stripe · 營運決策）

> **範圍**：與 §一～十二 **不重複**的補登；實作以 Git `main` 與下列路徑為準。

### 13.1 已交付（優點／產物）

| 項目 | 說明 |
|------|------|
| **自訂支出類別** | 六類鎖定 + Settings 增刪自訂；掃描 prompt 動態合併類別；`normalizeExpenseCategoryFromAi`。 |
| **單據類型 UI 可關** | `constants.js` **`SHOW_RECEIPT_TYPE_UI`**；關閉時隱藏編輯下拉與卡片 tag，**`receiptType` 仍存、計價邏輯不變**。 |
| **新增／編輯金額區共用** | `ExpenseFormPricingSection.jsx`；細項 **Grid 表頭對齊**；**新增列**含分配給 + 固定（與已存列一致）。 |
| **文案精簡** | `taxHint`／`itemsHelp`／收據免稅／卡片 needsReview、自訂類別 hint 等縮短；細項欄 **品名／標價** 表頭。 |
| **用量與計費基建** | `scripts/measure-receipt-prompt.mjs`（粗量文字 prompt）；`002_usage_logs.sql`；`003_stripe_billing.sql`（`stripe_*` 欄）；`api/stripe-webhook.js` + `stripe` 依賴。 |
| **Checkout 建立 + 設定頁** | **`api/create-checkout-session.js`**（JWT 驗證、`metadata.supabase_user_id`）；**設定 → 訂閱（Stripe）→ 前往結帳**；回傳 `?checkout=success`／`cancelled` 提示。 |
| **`.gitignore`** | `client_secret*.json`（Google OAuth 下載檔勿入庫）。 |
| **設計思路（PM 敘事）** | **[DESIGN_THINKING.md](./DESIGN_THINKING.md) §八** — 與本節同一時點的「為什麼這樣設計」（類別骨架、單據 UI 收斂、Add=Edit 心智、誠實表單、短文案、掃描綁定變動成本、金鑰／儀表板信任邊界）。 |
| **Webhook 308 修復 + 簽章穩健化** | 移除 `trailingSlash: false`、移除 Next.js-only `export const config`；函式統一 `export default handler`；`getRawBody()` 多策略讀取 raw body（Buffer→string→stream→stringify fallback）；加 debug log（`rawBody.length`、`sig` 前綴）。**詳見** [SUPABASE_AUTH §5.1b](./SUPABASE_AUTH_AND_SYNC_2026-03.md)。 |

### 13.2 踩坑（Lessons · 接棒預防）

| # | 現象 | 原因／解法 |
|---|------|------------|
| L28 | 細項表頭與輸入欄 **對不齊**、新增列沒「分配給」 | **Flex + wrap** 欄寬與表頭不一致 → 改 **固定欄寬 CSS Grid**（`ITEM_ROW_GRID`）；新增列補 **draftAssign**／**draftFixed**。 |
| L29 | 手動新增「實付」與小計／稅 **心智不一致** | 舊 `AddExpense` 用「小計+退稅+折扣」覆寫實付；編輯無此邏輯 → **已統一為僅實付欄決定 `originalAmount`**（§12.2 已改寫）。 |
| L30 | **Stripe Dashboard 找不到 API keys** | 新 UI **Workbench → Webhooks** 與舊 **Developers → API keys** 分離 → 點 **Developers**（左下）再進 **API keys**；Webhook 用 **Add destination** 設 URL。 |
| L31 | 只有 **Product ID** 沒 **Price ID** | 訂閱要綁 **`price_...`**；進 **Product catalog → 產品內 → Pricing**，或 **Add price** 建 **Recurring $5/month**。 |
| L32 | 環境變數名混淆 | Stripe 後台不叫 `STRIPE_SECRET_KEY`——是 **自己**把 **Publishable / Secret** 複製後在 Vercel **命名**成該變數。 |
| L33 | **`.env` 含真 anon key**、OAuth JSON 在根目錄 | 易誤提交或外洩 → **`.env` 必在 .gitignore**；`client_secret*.json` 已 ignore；外洩則 **rotate** Supabase／Google 憑證。 |
| L34 | Webhook 設好仍 **400/502** | 須有 **`api/stripe-webhook.js`**；Vercel 加 **`STRIPE_WEBHOOK_SECRET`**、**`SUPABASE_SERVICE_ROLE_KEY`**；部署後 **Redeploy**；Checkout **`metadata.supabase_user_id`** 必帶。 |
| L35 | **我無法代操使用者瀏覽器** | 安全與登入邊界 → 儀表板操作請 **截圖 + 逐步指引**。 |
| L36 | **Webhook 308 redirect**：`vercel.json` 的 `trailingSlash: false` 對 POST 也生效 | Vercel 在 redirect 階段（先於 rewrite）回 308 → Stripe 不追 POST redirect → 失敗。解法：**移除 `trailingSlash: false`**，保留 rewrite 安全網。 |
| L37 | **`export const config = { api: { bodyParser: false } }`** 無效 | 此語法為 **Next.js** 專屬；Vite 專案在 Vercel 上忽略，甚至可能導致函式註冊異常產生 308。解法：直接移除。 |
| L38 | **`export async function POST(request)`** 在 Vite 專案可能不被識別 | Vercel 對非 Next.js 的 Web API 格式支援不穩定；改回 **`export default async function handler(req, res)`** 最可靠。 |
| L39 | **Webhook 簽章失敗**：`STRIPE_WEBHOOK_SECRET` 不匹配 | Workbench destination 的 `whsec_...` **≠** Developers endpoint 的 `whsec_...`；換 endpoint 後必須更新 Vercel env var 並 Redeploy。 |
| L40 | **Vercel body parser 吃掉 raw body** | Vercel Node.js Helpers 自動解析 `req.body`（lazy getter）；若 stream 已被消費，`buffer(req)` 讀到空 → HMAC 對不上。解法：`getRawBody()` 多策略 fallback，或設 `NODEJS_HELPERS=0`。 |
| L41 | **Stripe Workbench 舊 delivery 不自動更新** | 部署修好後，Event deliveries 仍顯示舊 status（如 308）；需點 **Resend** 或發新 test event 驗證。 |
| L42 | **PowerShell `curl` ≠ cURL** | Windows 下 `curl` 是 `Invoke-WebRequest` 別名；須用 **`curl.exe`** 才是原生 cURL。 |

### 13.3 產品／商業決策（已定或討論中）

| 決策 | 內容 |
|------|------|
| **免費額度（規劃）** | 每帳戶 **終生 5 個檔案**掃描（非「5 次 session」細節另訂）；手動記帳不限。 |
| **付費** | 掃描不限（或另訂上限）；**月費首選討論價 USD $5**；變動成本粗估以 **Gemini 2.5 Flash + 張數** 推算（見對話與 `measure-receipt-prompt.mjs`）。 |
| **Stripe 上線順序** | **Sandbox／Test** 先跑通；Live 再填商家／個人資料；**不必先有 BR** 才能測試；公司抬頭收款與 **Individual** 路徑因地區而異（非法律建議）。 |
| **Webhook 事件（建議）** | `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`。 |
| **訂閱與資料** | Webhook 用 **service role** 更新 **`user_app_data`** 的 `stripe_customer_id`、`stripe_subscription_id`、`subscription_status`（**003** migration）。 |

### 13.4 相關檔案索引

- 表單共用：`src/components/expense/ExpenseFormPricingSection.jsx`、`EditExpenseDialog.jsx`、`AddExpense.jsx`  
- 開關：`src/utils/constants.js` → `SHOW_RECEIPT_TYPE_UI`  
- Stripe：`api/stripe-webhook.js`、`vercel.json`、`package.json` → `stripe`  
- SQL：`supabase/migrations/002_usage_logs.sql`、`003_stripe_billing.sql`  
- 範例環境變數：`.env.example`（Stripe + Service Role 註解）

---

*維護：下一輪大改分帳／免稅／匯率邏輯時，**同步更新 §十二** 與「已交付」或新迭代檔，並在 `PRODUCT_MANAGEMENT.md` 發布紀錄對應一行。*
