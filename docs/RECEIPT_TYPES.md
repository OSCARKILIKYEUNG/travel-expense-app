# 單據類型與處理要點

> **目的**：把常見小票情境 **一次寫清**，方便對照程式、prompt 與 UI，避免只存在對話裡。  
> **產品共識**：同一張小票通常 **不** 混「部分可退、部分不可退」；**退稅／免稅金額以收據印字為準**（有印就用）。

---

## 一、情境總表

| 代碼 | 情境（簡稱） | 收據長什麼樣 | `receipt_type` | 主要痛點／注意 |
|------|----------------|--------------|----------------|----------------|
| **A** | 一般內稅／一口價 | 行含稅，行加總 ≈ 合計。可含多稅率（8% 軽＋10%） | `tax_inclusive` | 最單純；AI 勿亂改行價。 |
| **B** | 外稅 | 行標「外」，小計＝行加總（未稅），合計＝小計＋稅 | `tax_exclusive` | 行加總 < 實付，差額＝稅。 |
| **C** | 店內即時免稅 | 小計（含稅）> 合計（實付），有免稅額扣除 | `instant_tax_free` | 實付以**合計**為準；免稅額**優先採收據**。 |
| **D** | 免稅＋固定費/佣金 | 每行有雙欄（含稅＋非課稅），佣金行 `exclude_from_refund_split` | `instant_tax_free` + 佣金行 | 用 `price_actual`（非課稅）計分帳。 |
| **E** | 淨價免稅 | 品項已是免稅後價，消費稅＝0，免稅額僅資訊 | `net_tax_free` | **不能**再扣免稅額！ |
| **F** | 套裝/組合價（セット） | 多行單價＋セット金額一筆 | 任何類型 + `has_bundle: true` | AI 應合併セット為一個品項；否則行加總 ≠ 小計。 |
| **G** | 離境退稅 | 實付＝含稅合計；退稅另辦 | `vat_refund_later` | `tax_refund` 常為 0。 |
| **H** | 折扣/優惠券 | 割引、Coupon 負數 | 任何類型 + `discount` | 與免稅分開。 |

---

## 二、真實小票驗證（2025-12 東京）

| 店 | 類型 | 收據特徵 | 驗證結果 |
|----|------|----------|----------|
| なんでや（居酒屋） | A `tax_inclusive` | 行標「内」，加總＝合計 ¥5,450 | ✅ |
| ドラえもん未来デパート | B `tax_exclusive` | 行標「外」，小計 ¥2,680 + 稅 ¥268 = 合計 ¥2,948 | ✅ |
| UNIQLO | C+F `instant_tax_free` + bundle | セット×12 ¥5,940；小計 ¥28,130 − 免稅 ¥2,557 = ¥25,573 | ✅ |
| ZARA | D `instant_tax_free` + 佣金 | 雙欄（含稅/非課稅）+ GB Commis ¥286 | ✅ |
| マツモトキヨシ | E `net_tax_free` | 消費稅 ¥0，免稅 ¥1,034（資訊）；合計 ¥10,340 | ✅ |
| ドン・キホーテ | E `net_tax_free` | ★免稅品淨價，免稅額 609（資訊）；合計 ¥6,093 | ✅ |
| LAWSON | A `tax_inclusive`（多稅率）| 軽 8% + 10%，合計 ¥2,359 | ✅ |
| instant | A `tax_inclusive` | 單品 ¥12,100 | ✅ |

---

## 三、架構升級（三條腿）

### 升級 1：錨定數字優先

AI 必填五個錨定值，行項目次之：

| 欄位 | 說明 |
|------|------|
| `subtotal` | 小計（收據印字，含稅或未稅看類型） |
| `tax` | 消費稅金額 |
| `receipt_tax_exemption_amount` | 收據免稅額（正數，資訊性） |
| `total_amount` | 實付合計 |
| `receipt_type` | 類型代碼（必填） |

### 升級 2：雙價格（`price` + `price_actual`）

| 欄位 | 用途 |
|------|------|
| `items[].price` | 顯示用：收據上的標價/主金額 |
| `items[].priceActual` | 分帳用：實際計入合計的金額（省略時 = `price`） |

- ZARA 等雙欄收據：`price` = 含稅、`priceActual` = 非課稅
- 套裝合併後的單一品項：`price` = セット金額（= `priceActual`）
- 一般收據：不需填 `priceActual`

### 升級 3：依類型驗證

| 類型 | 驗證規則 | 不通過 → |
|------|----------|----------|
| `tax_inclusive` | `sum(price) ≈ total` | `needsReview` |
| `tax_exclusive` | `subtotal + tax ≈ total` | `needsReview` |
| `instant_tax_free` | `subtotal − exempt ≈ total` | `needsReview` |
| `net_tax_free` | `sum(price) ≈ total` 且 `tax ≈ 0` | `needsReview` |
| 有 `has_bundle` | `subtotal` 與 `sum(price)` 可有落差 | 只在無 `priceActual` 時警示 |

驗不過只做**標記**（UI 提示），不硬改數字。

---

## 四、與程式的對應

| 概念 | 主要實作位置 |
|------|-------------|
| `receipt_type`、`has_bundle`、錨定數字、`price_actual` | `api/receipt-prompt.js`（prompt）、`AIService.buildExpenseFromAI`（解析） |
| `priceActual`、`getItemActualPrice`、分帳比例 | `src/utils/personShare.js` |
| 收據類型 badge、`needsReview` 警示、雙價格顯示 | `src/components/expense/ExpenseCard.jsx` |
| 使用者手動改 `receiptType` | `src/components/expense/EditExpenseDialog.jsx` |
| 類型常數、下拉選項 | `src/utils/constants.js`（`RECEIPT_TYPES`、`RECEIPT_TYPE_OPTIONS`） |

---

## 五、擴展指南（其他國家）

新增國家/店型時：

1. **在本表 §一 加一列**（或加註國家標記）。
2. **判斷它最接近哪個 `receipt_type`**：
   - 韓國免稅店 → 多為 `net_tax_free` 或 `instant_tax_free`
   - 歐洲 → `vat_refund_later`（離境退稅）
   - 東南亞（泰國、越南）→ 多為 `tax_inclusive`
   - 如果現有類型不夠 → 在 `constants.js` 和 prompt 加新值，**不改舊值語意**
3. **加 fixture 小票**到 §二 驗證表。
4. **在迭代檔記一句**。

> 原則：每次加一國只動 prompt（教 AI 新信號）＋ constants（新類型值）＋ 本表（文件記錄）；`personShare.js` 的 `getItemActualPrice` / `getEligiblePoolRatio` 邏輯不需改，除非出現全新的定價結構。

---

## 六、已知 AI 坑點（Gemini）

| 坑 | 影響 | 現有緩解 | 待辦 |
|----|------|----------|------|
| **漏品項**：ZARA 4 件只認 3 件（BLAZER 消失） | 退稅分攤比例偏，使用者困惑 | `instant_tax_free` needsReview（items vs subtotal 差 >5%）→ 黃條提醒 | B-08 提高圖片解析度 |
| **品名誤辨**：UNIQLO Wボーイズソックス ¥990 → 女士內褲 ¥790 | items sum 偏差 200，品名不對 | subtotal 交叉驗證 + 套裝門檻放寬 1% | 無好的程式修正；觀察 |
| **套裝重複列品**：セット 合併行 + 個別行都列出 | items sum > subtotal | prompt 自我檢查 + buildExpenseFromAI 品項去重 | B-09 更智慧的去重 |
| **不回 `receipt_type`** 或回舊值 | badge 不顯示 | `normalizeReceiptType` 超寬容錯（中文、別名） | 持續觀察 |
| **不回 `tax`（外稅場景）** | 消費稅列不出現 | fallback 計算 `tax = total − subtotal` | 已修 |
| **不回 `price_actual`（雙欄場景）** | 雙價格不顯示，分帳用含稅價 | prompt 加了 ZARA 範例 | 觀察；最壞情況回 subtotal-based refund 仍算對 |

---

## 七、修訂紀錄

| 日期 | 說明 |
|------|------|
| 2025-03-24 | 初版：A～H 八類。 |
| 2025-03-24 | v2：加入三項升級（錨定數字、雙價格、依類型驗證）、真實小票驗證表、擴展指南。 |
| 2025-03-24 | v3：加入 §六 已知 AI 坑點表（漏品項、品名誤辨、套裝重複、欄位遺漏及各自緩解）。 |

*新增店型／國家時：在本表加列，並在迭代檔記一句。*
