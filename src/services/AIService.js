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
需要的 JSON 欄位：
- date: 格式 YYYY年MM月DD日
- location: 地點 (城市/區域，繁中)
- store: 店舖名稱
- category: 種類 (如: 飲食, 交通, 購物, 住宿)
- items: 陣列，包含 { "name": "商品名(繁中)", "price": 數值, "original_name": "原文(選填)" }
- subtotal: 商品小計（未稅/未折扣前）
- tax: 消費稅金額（如果有）
- tax_refund: 退稅金額（如發票顯示「免税額」「免税」(日文) 或 「Tax Free」「Tax Refund」(英文)，請設為負數）
- discount: 折扣金額（如發票顯示「割引」「Discount」，設為負數）
- total_amount: 實付總金額（「合計」「Total」等，最終支付的金額，優先級最高）
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
            { type: 'text', text: '請分析這張單據，輸出 JSON。' },
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

export function buildExpenseFromAI(result, index, currency, rate) {
  const items = Array.isArray(result.items)
    ? result.items.map((item) => ({
        ...item,
        name: (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤'),
      }))
    : [];

  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const subtotal = parseFloat(result.subtotal) || 0;
  const tax = parseFloat(result.tax) || 0;
  const taxRefund = parseFloat(result.tax_refund) || 0;
  const discount = parseFloat(result.discount) || 0;
  const totalAmount = parseFloat(result.total_amount) || 0;
  const finalAmount = totalAmount > 0 ? totalAmount : itemsTotal > 0 ? itemsTotal : 0;

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
  };
}
