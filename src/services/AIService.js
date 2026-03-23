const SYSTEM_PROMPT = `
你是一個專業的會計助手 API。請分析傳入的單據圖片。
嚴格規則：
1. 只回傳純 JSON 字串。
2. 不要使用 markdown code block (不要用 \`\`\`json)。
3. 將所有商品名稱與地點翻譯成「繁體中文」。
4. 日文服裝用語翻譯規則（重要）：
   - ボクサー/Boxer → 四角內褲
   - ボクサーブリーフ → 四角內褲
   - セミボクサー → 半長內褲
   - ブリーフ → 三角內褲
   - Tシャツ → T恤
   - ワイヤレスブラ/Wireless Bra → 無鋼圈胸罩

【金額一致性 — 最重要】
- total_amount 必須等於顧客「實際支付」的合計（收銀台「合計」「Total」「AMOUNT DUE」等）。
- items[].price 的語意必須與 total_amount 一致：所有細項加總必須等於 total_amount（允許該幣別最小單位內的四捨五入誤差）。
- 日本免稅 / TAX FREE / 免税 / 即時退稅單據：常同時印「含消費稅標價」與「非課税／免稅後」兩套數字。請優先讀取與「合計」同一層級的金額作為 items[].price（例如各品項旁「非課税」行、或免稅後單價）；不要混用「含稅標價」當細項卻用「免稅後合計」當 total。
- 若單據僅有含稅細項與免稅合計、沒有逐行免稅價：仍須讓 items 加總邏輯上合理，並把「含稅小計」填在 subtotal（見下），total_amount 維持實付。
- 歐洲等「先付含稅、機場退稅」：total_amount 以店內實付為準；若退稅在別處辦理，不要將機場退稅金額從 total_amount 扣除，除非單據上已明確顯示。

receipt_type（選填，字串）：
- "instant_tax_free"：店內即時免稅/退稅（常見日本免稅櫃）
- "standard"：一般單據，細項加總即應付
- "vat_refund_later"：實付為含稅總額，退稅另辦
- "unknown"：無法判斷時

需要的 JSON 欄位：
- date: 格式 YYYY年MM月DD日
- location: 地點 (城市/區域，繁中)
- store: 店舖名稱
- category: 種類 (如: 飲食, 交通, 購物, 住宿)
- items: 陣列，包含 { "name": "商品名(繁中)", "price": 數值, "original_name": "原文(選填)" }
- subtotal: 若單據有「小計」且代表含稅/標價加總（與實付不同時請務必填，例如日本免稅前小計）
- tax: 消費稅金額（如果有單獨列出）
- tax_refund: 因免稅/退稅而少付的金額，請用負數（例如實付比含稅小計少 1844 則填 -1844）；若無則 0
- discount: 一般折扣（割引、Discount），負數
- total_amount: 實付總金額（「合計」「Total」等 — 與 items 加總必須一致）
- receipt_type: 見上（選填）
- currency: 貨幣代碼 (如 JPY, USD, CNY, EUR 等)
- payment_method: 支付方式（如：現金、信用卡、電子支付等）
`;

function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const MAX = 1024;
        if (w > h) {
          if (w > MAX) { h *= MAX / w; w = MAX; }
        } else {
          if (h > MAX) { w *= MAX / h; h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
}

export async function parseReceipt(file, apiKey, modelName) {
  const base64 = await resizeImage(file);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Travel Expense App',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '請分析這張單據，輸出 JSON。務必遵守 system 內「金額一致性」：細項 price 加總須與 total_amount（實付）一致；日本免稅單據請優先採用與合計同層級之免稅單價。',
            },
            { type: 'image_url', image_url: { url: base64 } },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`API 請求失敗: ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 回傳內容為空');

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('無法從回傳內容中提取 JSON');

  return JSON.parse(match[0]);
}

/** 零錢幣別：整數；其餘預設兩位小數 */
function roundMoney(amount, currency) {
  const c = (currency || 'HKD').toUpperCase();
  if (['JPY', 'KRW', 'VND', 'CLP'].includes(c)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100) / 100;
}

function moneyEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

/**
 * 當細項加總 ≠ 實付時，依比例調整各品項，使加總 = targetTotal（最後一筆吸收捨入差）。
 * @returns {{ items: Array, adjusted: boolean }}
 */
export function alignItemPricesToTotal(items, targetTotal, currency) {
  if (!items?.length || targetTotal <= 0) {
    return { items: items || [], adjusted: false };
  }
  const eps = moneyEpsilon(currency);
  const sum = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  if (Math.abs(sum - targetTotal) <= eps) {
    return { items, adjusted: false };
  }
  if (sum <= 0) {
    return { items, adjusted: false };
  }
  const factor = targetTotal / sum;
  const scaled = items.map((item) => ({
    ...item,
    price: roundMoney((parseFloat(item.price) || 0) * factor, currency),
  }));
  let newSum = scaled.reduce((s, i) => s + i.price, 0);
  let diff = roundMoney(targetTotal - newSum, currency);
  if (Math.abs(diff) > eps && scaled.length > 0) {
    const last = scaled.length - 1;
    scaled[last] = {
      ...scaled[last],
      price: roundMoney(scaled[last].price + diff, currency),
    };
  }
  return { items: scaled, adjusted: true };
}

export function buildExpenseFromAI(result, index, currency, rate) {
  let items = Array.isArray(result.items)
    ? result.items.map((item) => ({
        ...item,
        name: (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤'),
      }))
    : [];

  const grossSum = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const totalAmount = parseFloat(result.total_amount) || 0;
  const subFromAI = parseFloat(result.subtotal) || 0;
  let tax = parseFloat(result.tax) || 0;
  let taxRefund = parseFloat(result.tax_refund) || 0;
  const discount = parseFloat(result.discount) || 0;

  const eps = moneyEpsilon(currency);
  const targetPaid = totalAmount > 0 ? totalAmount : grossSum;

  let aiAlignedItemPrices = false;
  if (targetPaid > 0 && items.length > 0) {
    const { items: aligned, adjusted } = alignItemPricesToTotal(items, targetPaid, currency);
    items = aligned;
    aiAlignedItemPrices = adjusted;
  }

  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const finalAmount = totalAmount > 0 ? totalAmount : itemsTotal > 0 ? itemsTotal : 0;

  let subtotal = subFromAI > 0 ? subFromAI : 0;
  if (!subtotal) {
    subtotal = aiAlignedItemPrices ? grossSum : itemsTotal;
  }

  if (finalAmount > 0 && subtotal > finalAmount + eps && Math.abs(taxRefund) < eps) {
    taxRefund = finalAmount - subtotal;
  }

  const receiptType = result.receipt_type || '';

  return {
    id: Date.now() + index,
    date: result.date || new Date().toLocaleDateString('zh-TW'),
    location: result.location || '未知地點',
    store: result.store || '未知店舖',
    category: result.category || '未分類',
    items,
    subtotal: subtotal || itemsTotal,
    tax,
    taxRefund,
    discount,
    originalAmount: finalAmount,
    currency,
    hkdAmount: finalAmount * rate,
    paymentMethod: result.payment_method || '',
    receiptType,
    aiAlignedItemPrices,
  };
}
