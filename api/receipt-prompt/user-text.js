/**
 * 與圖片一併送出的使用者文字（可之後依語系拆分）。
 */
export const USER_TEXT = `請分析這張單據並輸出 JSON。
步驟：① 先填 detected_market（允許值見 system 清單）與 market_evidence；② 再選 receipt_type（tax_inclusive / tax_exclusive / instant_tax_free / net_tax_free / vat_refund_later / unknown）；③ 再填品項與金額。
非日本單據勿預設為 JP；非 JP 時勿套用附件 B 的日本「内／外」前提。
subtotal 與 total_amount 以收據印字為準。組合價／セット合併為一個品項。雙欄定價須填 price_actual。每個品項必須含 name_en；並提供 location_en、store_en。輸出前檢查 items 加總 ≈ subtotal。`;
