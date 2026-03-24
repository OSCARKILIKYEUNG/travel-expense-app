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
| Backlog B-01～B-07 | 未做 | 見 §五 |

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
| B-01 | [ ] 分人篩選 + **收據免稅額** 的說明是否要在 partial 區塊加一句（僅參考） | 可選；避免資訊只在全單模式出現。 |
| B-02 | [ ] `price_basis` / `countryHint` 預留欄位（資料層） | 跨國長期，不必急著做規則引擎。 |
| B-03 | [ ] Prompt 抽免稅額 **命中率** 抽樣複盤 | 依實際單據調整關鍵字與 `receipt_type`。 |

### P1 — 體驗

| ID | 項目 | 備註 |
|----|------|------|
| B-04 | [ ] 卡片小標「免稅」當 `receiptTaxExemptionAmount > 0` | 列表一眼辨識。 |
| B-05 | [ ] 細項加總 ≠ 實付時的引導文案（已部分存在） | 統一語氣。 |

### P2 — 工程

| ID | 項目 | 備註 |
|----|------|------|
| B-06 | [ ] `personShare` 單元測試（Vitest） | 固定費 + 收據免稅顯示邏輯。 |
| B-07 | [ ] README 專案結構補 `utils/personShare.js` | 與現況同步。 |

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
| `.cursor/rules/feedback-before-implement.mdc` | 意見先對齊再改之協作規則 |

---

## 八、修訂紀錄

| 日期 | 動作 |
|------|------|
| 2025-03-23 | 建立本檔；收錄本輪需求、交付、踩坑、backlog、PM 流程。 |
| 2025-03-24 | 新增 §進度快照、§九協作規則、L7；連結 Cursor rule。 |
| 2025-03-24 | 新增 §十 SAVE 快照表與觸發詞約定；擴充 Cursor rule。 |
| 2025-03-24 | 新增 `docs/RECEIPT_TYPES.md`（單據 A～H）；索引與 README 連結。 |

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

---

*維護：下一輪大改分帳／免稅邏輯時，更新「已交付」或開新月份迭代檔，並在 `PRODUCT_MANAGEMENT.md` 發布紀錄對應一行。*
