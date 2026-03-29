/**
 * 日本市場專章（附件 B）— 僅在 detected_market 為 JP 時與通用規則並用。
 * 中期可改為獨檔動態載入。
 */
export const MARKET_JP = `
■ 日文服裝用語翻譯（detected_market 為 JP 時優先參考）：
   - ボクサー/Boxer → 四角內褲
   - ボクサーブリーフ → 四角內褲
   - セミボクサー → 半長內褲
   - ブリーフ → 三角內褲
   - Tシャツ → T恤
   - ワイヤレスブラ/Wireless Bra → 無鋼圈胸罩

■ 日本小票常見標記：
  - 行末「内」→ 該行金額含消費稅；「外」→ 未稅（小計多為未稅加總）。
  - 多稅率（8% 軽減 + 10%）仍常以 tax_inclusive 呈現時，以**行加總與合計關係**為準。

■ 套裝：收據上「セット金額」與通用 has_bundle 規則相同（合併一行、不重複列內件）。

═══════════════════════════════════════════
日本範例 A — 外稅（行標「外」）
═══════════════════════════════════════════
收據：品項 ¥850外、¥1800外、¥30外 → 小計 ¥2,680、外税10% ¥268、合計 ¥2,948
正確輸出：
  detected_market: "JP"
  receipt_type: "tax_exclusive"
  items: [{price:850},{price:1800},{price:30}]
  subtotal: 2680, tax: 268, total_amount: 2948, tax_refund: 0

═══════════════════════════════════════════
日本範例 B — 即時免稅 + 雙欄（如 ZARA「非課稅」欄）
═══════════════════════════════════════════
收據：BLAZER ¥6590→非課税¥5991、JACKET ¥7690→非課税¥6991、GB Commis ¥286→非課税¥286
小計 ¥20,576、合計 ¥18,732
正確輸出：
  detected_market: "JP"
  receipt_type: "instant_tax_free"
  items: [
    {name:"西裝外套", price:6590, price_actual:5991},
    {name:"外套", price:7690, price_actual:6991},
    {name:"GB 佣金", price:286, price_actual:286, exclude_from_refund_split:true}
  ]
  subtotal: 20576, total_amount: 18732, tax_refund: -1844

═══════════════════════════════════════════
日本範例 C — 套裝／セット
═══════════════════════════════════════════
收據：12件 Wショーツ各@590，但セット金額 ¥5,940。另有其他品項。小計 ¥28,130。
正確輸出：
  detected_market: "JP"
  has_bundle: true
  items: [{name:"女士內褲 セット×12", price:5940}, ...其他品項照常]
  ⚠ セット內的 12 件 @590 不要各自列出！items 加總應 ≈ 28,130。

═══════════════════════════════════════════
日本範例 D — 淨價免稅（品項已是免稅後價）
═══════════════════════════════════════════
收據：免税取引、品項金額已是免稅後價、消費税等 ¥0、免税 ¥1,034
正確輸出：
  detected_market: "JP"
  receipt_type: "net_tax_free"
  tax: 0, tax_refund: 0
  receipt_tax_exemption_amount: 1034
`.trim();
