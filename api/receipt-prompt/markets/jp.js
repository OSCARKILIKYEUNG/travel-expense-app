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
  - **品名／店名語系（必守）**：name 與 store 填**繁體中文翻譯**；original_name 與 store_original 填收據印出的日文／英文原文。禁止把日文原文直接當 name／store。禁止改成「食品」「飲料」「商品」「日用品」等泛稱，也不要依 8%／10% 把多行併成一個稅率類別。
  - 譯名須對應該行印字（可辨識品牌／品類），不可臆造。看不清時可見原文放 original_name，禁止改成「商品A」「商品B」等代稱。
  - 店名例：LAWSON → 羅森（store_original 保留 LAWSON…）；UNIQLO → 優衣庫；ドン・キホーテ／DON QUIJOTE → 唐吉訶德。

■ 免税取引（淨價免稅，如唐吉訶德 ★免税品）：
  - 收據標明「免税取引」或「★免税品」→ receipt_type 必須為 "net_tax_free"。
  - 列印「免税」「免税額」「免税対象」的那一列是 receipt_tax_exemption_amount（正數、僅資訊），**絕不是** tax／消費税。
  - tax 必須為 0，tax_refund 必須為 0。即使該數字約為合計的 10%（例如合計 6093 旁的 609），也不要填進 tax。
  - 另有「消費税 ¥0」時，0 才是 tax；免税額與消費税是兩欄。

■ 內稅多稅率（便利商店等，行價已含 8%／10%）：
  - receipt_type 為 "tax_inclusive"。total_amount **錨定「合計」**（LAWSON 範例合計 ¥2,359）。
  - 含稅時 subtotal 也錨定合計，並等於各含稅商品行加總。不要把「対象額」或未稅行加總當成 subtotal。
  - 底部「内消費税」「(8%)」「(10%)」「対象額」是已含在合計裡的內稅摘要：**不要**當成品項，**不要**把 8% 稅額與 10% 稅額加總後填進 tax 再另加。行加總短於合計時，那是摘要列未被當成商品，不要當成細項與實付不一致。
  - 錯誤例（禁止）：商品行 148+220+398+130+180=1076 當成 subtotal、8%¥20+10%¥72=92 當成 tax。1076+92 不是合計。正確是 subtotal 2359、total_amount 2359；tax 為 0，或只記一筆已含在合計內的內稅摘要。

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
    {name:"西裝外套", original_name:"BLAZER", name_en:"Blazer", price:6590, price_actual:5991},
    {name:"外套", original_name:"JACKET", name_en:"Jacket", price:7690, price_actual:6991},
    {name:"GB 佣金", original_name:"GB Commis", name_en:"GB commission", price:286, price_actual:286, exclude_from_refund_split:true}
  ]
  subtotal: 20576, total_amount: 18732, tax_refund: -1844
  ⚠ subtotal 必須保留印字 20576，不要改成實付 18732。BLAZER／JACKET 必須填 price_actual。
  GB 佣金設 exclude_from_refund_split，加總核對時排除該行（不要用它解釋小計或實付的差額）。

═══════════════════════════════════════════
日本範例 C — 套裝／セット
═══════════════════════════════════════════
收據：12件 Wショーツ各@590，但セット金額 ¥5,940。另有其他品項。小計 ¥28,130。
正確輸出：
  detected_market: "JP"
  has_bundle: true
  items: [{name:"女士內褲 套裝×12", original_name:"Wショーツ セット×12", name_en:"Women shorts set x12", price:5940}, ...其他品項照常]
  ⚠ セット內的 12 件 @590 不要各自列出！items 加總應 ≈ 28,130。
  即時免稅（UNIQLO）：小計 ¥28,130、免税 ¥2,557、合計 ¥25,573。
  tax_refund 只填 -2557。同一筆不要再填 discount（discount 必須為 0）。subtotal 必須是 28130，不要改成實付 25573。

═══════════════════════════════════════════
日本範例 D — 淨價免稅（品項已是免稅後價）
═══════════════════════════════════════════
收據：免税取引、品項金額已是免稅後價、消費税等 ¥0、免税 ¥1,034
正確輸出：
  detected_market: "JP"
  receipt_type: "net_tax_free"
  tax: 0, tax_refund: 0
  receipt_tax_exemption_amount: 1034

═══════════════════════════════════════════
日本範例 E — 淨價免稅（唐吉訶德／免税取引，免税額 ≠ 消費税）
═══════════════════════════════════════════
收據：免税取引／★免税品。品項已是免稅後價（例 ¥1,280、¥2,980、¥1,833；name 繁中、original_name 日文原文，勿寫「商品A」）。
消費税等 ¥0、免税 ¥609、合計 ¥6,093。609 是免税額，不是消費税。
正確輸出：
  detected_market: "JP"
  receipt_type: "net_tax_free"
  tax: 0, tax_refund: 0
  total_amount: 6093
  receipt_tax_exemption_amount: 609
  ⚠ 禁止 tax: 609。禁止把合計做成 6093+609。

═══════════════════════════════════════════
日本範例 F — 內稅多稅率（LAWSON，軽 8% + 10%）
═══════════════════════════════════════════
收據：商品行 name=繁中、original_name=日文印字（禁止改成「商品A」）。store 例「羅森」，store_original「LAWSON…」。合計 ¥2,359。
底部另有 (8%)／(10%) 対象額與内消費税（例如稅額 ¥20 與 ¥72）。那些是已含在合計裡的摘要，不是新的品項。
正確輸出：
  detected_market: "JP"
  receipt_type: "tax_inclusive"
  items: [{name:"〈繁中品名〉", original_name:"〈日文印字〉", name_en:"〈英文〉", price:〈該行印字〉}, ...]
  subtotal: 2359, tax: 0, total_amount: 2359, tax_refund: 0
  ⚠ 禁止 subtotal 1076、tax 92。禁止 total_amount = subtotal + tax。禁止用「商品A」或稅率類別取代品名。
`.trim();
