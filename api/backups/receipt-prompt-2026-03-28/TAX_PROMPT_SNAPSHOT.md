# 稅項／單據類型 Prompt 快照 · 2026-03-28

來源：`api/receipt-prompt.js`（當日備份見同目錄 `receipt-prompt.js`）。

專案內**沒有**獨立的「稅務 prompt 檔」；稅與免稅語意皆在 `SYSTEM_PROMPT` 的下列區塊，並由 `USER_TEXT` 再次強調 `receipt_type` 與雙欄價。

還原稅項敘述時，請以 **`receipt-prompt.js` 全檔** 為準；本檔僅方便對照編輯。

---

## receipt_type 定義（SYSTEM_PROMPT 內文）

```
• "tax_inclusive"   — 內稅／一口價（行標「内」或無標、行加總 ≈ 合計）。含多稅率（日本 8% 軽＋10%）也選此。
• "tax_exclusive"   — 外稅（行標「外」，小計 = 行加總（未稅），合計 = 小計 + 稅）。
• "instant_tax_free" — 店內即時免稅（小計含稅 > 合計；差額 = 免稅額；日本 UNIQLO、ZARA、藥妝等常見）。
• "net_tax_free"    — 品項已是免稅後淨價（消費稅 = 0，免稅額僅資訊用；日本唐吉訶德、部分藥妝）。
• "vat_refund_later" — 實付含稅，退稅另辦（歐洲常見）。
• "unknown"         — 無法判斷。
```

---

## 金額／稅／免稅／折扣（「金額語意」區塊要點）

- `items[].price`：依單據類型為含稅標價、未稅價、免稅含稅標價、或免稅後淨價。
- `items[].price_actual`：與 `price` 不同時（如非課稅欄）。
- `subtotal`、`tax`、`total_amount`、`tax_refund`（負數）、`receipt_tax_exemption_amount`（正數）、`discount`（負數）。
- 禁止為對齊 `total_amount` 而改寫各行 `price`。

---

## JSON 稅相關欄位（欄位清單節錄）

- `receipt_type`（必填）
- `subtotal`、`tax`、`tax_refund`、`receipt_tax_exemption_amount`、`discount`、`total_amount`

---

## 自我檢查（稅相關）

4. 外稅單：tax 是否 = 合計 − 小計？
5. 即時免稅 + 雙欄：每個 item 是否都填了 `price_actual`？

---

## 範例 A～D（稅情境）

見備份檔 `receipt-prompt.js` 內「具體範例」— 外稅、即時免稅+雙欄、套裝、淨價免稅。

---

## USER_TEXT（含 receipt_type 與稅相關提醒）

```
請分析這張單據並輸出 JSON。receipt_type 必填（tax_inclusive/tax_exclusive/instant_tax_free/net_tax_free/vat_refund_later/unknown 擇一）。subtotal 與 total_amount 以收據印字為準。套裝/セット 合併為一個品項，內部個別品項不要重複列出。雙欄定價（如「非課稅」）必須填 price_actual。每個品項必須含 name_en；並提供 location_en、store_en。輸出前檢查 items 加總 ≈ subtotal。
```
