# 產品迭代紀錄 · 2025-03（分帳／免稅／顯示邏輯）

> **定位**：本檔為 **2025-03 這一輪** 需求、交付、踩坑與後續跟進的 **單一書面來源**（Session 級）。  
> **不與** `HANDOFF.md`（歷史遷移）或 `PRODUCT_MANAGEMENT.md`（滾動路線圖）重複貼公式長文；後兩者以 **連結 + 狀態更新** 為主。

---

## 一、本輪摘要（給 PM / 接棒用）

| 項目 | 說明 |
|------|------|
| **主題** | 多人分帳時「實付」與「原價行」不一致（免稅／退稅／固定費）；分人篩選時金額與退稅顯示正確；跨國單據長期策略。 |
| **狀態** | 功能已 **上線並 push**；**協作規則**已寫入 Cursor rule（見 §九）；後續以本檔 backlog 追蹤。 |
| **核心程式** | `src/utils/personShare.js`、`ExpenseCard.jsx`、圖表／Dashboard、`AIService.js`、`api/receipt-prompt.js`、編輯表單。 |

### 進度快照（Progress · 2025-03-24 更新）

| 區塊 | 狀態 | 備註 |
|------|------|------|
| 分帳／免稅／固定費／收據免稅額顯示 | 已上線 | 多個 commit 已 push |
| 上傳單據幣別採 AI `currency`、HKD 匯率 | 已上線 | `resolveReceiptCurrency` + `UploadArea` |
| 編輯細項說明文案 | 已上線 | 免稅後單價 vs 固定費分離 |
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
| `src/components/expense/ExpenseCard.jsx` | 退稅列／收據免稅列／分人明細 |
| `src/services/AIService.js` | `buildExpenseFromAI` |
| `api/receipt-prompt.js` | Gemini JSON 規格 |
| `README.md` | 免稅／固定費／收據免稅額說明 |
| `docs/PRODUCT_MANAGEMENT.md` | 滾動路線圖與技術債 |
| `docs/RECEIPT_TYPES.md` | **單據類型 A～H**、收據印字優先之共識 |
| `src/i18n.js`、`src/locales/zh-TW.json`、`src/locales/en.json` | 介面 i18n（繁中／英） |
| `src/utils/locale.js`、`src/utils/displayNames.js` | 語言正規化、收據欄位雙語顯示 |
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
| 2025-03-26 | SAVE：i18n（繁中／英）、收據雙語、語言僅兩選與 `normalizeUiLanguage`；詳見 §十。 |

---

## 九、協作規則（意見 → 對齊 → 再實作）

**目的**：減少未對齊就改程式、方便產品決策與交接。

| 步驟 | 內容 |
|------|------|
| 1 | 使用者提出意見或修改需求時，助手**不**立刻改 code。 |
| 2 | 助手先說明：**我如何理解問題**、**預計怎麼改**（含檔案／風險）。 |
| 3 | 使用者確認、或明確說「同意／改吧／執行／幫我做」後，再實作。 |

**實作位置**：`.cursor/rules/feedback-before-implement.mdc`（`alwaysApply: true`）。

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

---

*維護：下一輪大改分帳／免稅邏輯時，更新「已交付」或開新月份迭代檔，並在 `PRODUCT_MANAGEMENT.md` 發布紀錄對應一行。*
