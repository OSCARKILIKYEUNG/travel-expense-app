/**
 * 與圖片一併送出的使用者文字（可之後依語系拆分）。
 */
export const USER_TEXT = `請分析這張單據並輸出 JSON。
步驟：① 先填 detected_market（允許值見 system 清單）與 market_evidence；② 再選 receipt_type（tax_inclusive / tax_exclusive / instant_tax_free / net_tax_free / vat_refund_later / unknown）；③ 再填品項與金額。
非日本單據勿預設為 JP；非 JP 時勿套用附件 B 的日本「内／外」前提。
subtotal 與 total_amount 以收據印字為準。組合價／セット合併為一個品項（成分行 @單價 無自身印價者不列為品項，可能在套裝行之前）。雙欄定價須填 price_actual。每個品項必須含 name（繁中）、name_en、original_name（收據原文）；並提供 store（繁中）、store_original、location_en、store_en。禁止把日文原文當 name／store；禁止改成「商品A」。即時免稅差額只填 tax_refund，不要同時填 discount；subtotal 用小計，不要改成實付。対象額／内税是摘要，不是品項。輸出前檢查 items 加總 ≈ subtotal。`;
