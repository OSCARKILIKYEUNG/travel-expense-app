/**
 * 非日本／未知市場的補充範例與禁令（附件 A）。
 */
export const MARKET_GENERIC = `
■ 非日本單據時請注意：
  - **不要**使用日文收據專用標記「内／外」作為唯一判斷依據，除非收據上**確實**為日文稅欄且 detected_market 為 JP。
  - 美國／加拿大等：Sales tax 可能印在底部；仍可能整單以 tax_inclusive 呈現，依實際加總關係選類型。
  - 東南亞：常見 GST／Service charge；服務費行可用 exclude_from_refund_split。

═══════════════════════════════════════════
通用範例 E — 外稅／VAT 分列（歐洲常見版型）
═══════════════════════════════════════════
收據：品項 €10.00 + €25.00，Subtotal €35.00，VAT 20% €7.00，Total €42.00
正確輸出：
  detected_market: "EU"
  receipt_type: "tax_exclusive"
  items: [{price:10},{price:25}]
  subtotal: 35, tax: 7, total_amount: 42, tax_refund: 0

═══════════════════════════════════════════
通用範例 F — 含稅標價（美國／一般零售）
═══════════════════════════════════════════
收據：各行列印金額已含稅，行加總 = Total $48.20，另列 Sales tax 僅作參考或為匯總
正確輸出：
  detected_market: "US"
  receipt_type: "tax_inclusive"
  items: （各行 price 為收據數字）
  subtotal: （若印了則照印） total_amount: 48.2, tax_refund: 0
`.trim();
