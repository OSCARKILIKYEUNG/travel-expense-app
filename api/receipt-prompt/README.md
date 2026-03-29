# Receipt prompt 模組（Gemini `systemInstruction`）

## 目的

- **基底**：任何國家小票；**先** `detected_market` + `market_evidence`，**再**稅型與金額。
- **附件 A**（`markets/generic.js`）：非日本補充與範例 E、F。
- **附件 B**（`markets/jp.js`）：日本專章與範例 A～D；模型僅在 `detected_market === JP` 時應採用其日文前提。

## 檔案

| 檔案 | 角色 |
|------|------|
| `registry.js` | `DETECTED_MARKET_CODES` 單一真相（後端）；修改時與 `src/constants/receiptMarkets.js` 同步。 |
| `markets/base.js` | `buildMarketBasePrompt()` 全域規則與 JSON 欄位。 |
| `markets/generic.js` | `MARKET_GENERIC` 附件 A。 |
| `markets/jp.js` | `MARKET_JP` 附件 B。 |
| `assemble.js` | `buildSystemPrompt()` 拼接；**中期**兩段式 API 可改為依 market 只載入對應片段。 |
| `user-text.js` | 與圖片一併送出的 `USER_TEXT`。 |
| `index.js` | 匯出 `SYSTEM_PROMPT`、`USER_TEXT`。 |

根目錄 `api/receipt-prompt.js` 僅 re-export，供 `parse-receipt.js` 既有 import 不變。

## 前端正規化

`buildExpenseFromAI` 會寫入 `aiDetectedMarket`、`aiMarketEvidence`（若模型有回）。

## 備份

歷史快照仍見 `api/backups/receipt-prompt-2026-03-28/`（單檔舊版）；新架構以本目錄為準。
