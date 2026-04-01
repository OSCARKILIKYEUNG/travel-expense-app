import { buffer } from 'node:stream/consumers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_PROMPT, USER_TEXT } from './receipt-prompt.js';
import { mergeExpenseCategoriesForPrompt } from './expense-categories-merge.js';
import { buildBillingSnapshot } from '../shared/billing.js';

const MODEL_ID = 'gemini-2.5-flash';

/** Vercel 有時未注入 req.body，僅在 body 為 null/undefined 時讀 raw stream（避免重複讀流） */
async function readJsonBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (b === undefined || b === null) {
    try {
      const buf = await buffer(req);
      const s = buf.toString('utf8');
      return s ? JSON.parse(s) : {};
    } catch {
      return null;
    }
  }
  return {};
}

function stripDataUrl(base64) {
  if (!base64 || typeof base64 !== 'string') return '';
  const m = base64.match(/^data:([^;]+);base64,(.+)$/);
  return m ? m[2] : base64;
}

function guessMime(base64) {
  if (!base64 || typeof base64 !== 'string') return 'image/jpeg';
  if (base64.startsWith('data:image/png')) return 'image/png';
  if (base64.startsWith('data:image/webp')) return 'image/webp';
  return 'image/jpeg';
}

function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || typeof auth !== 'string') return '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function createServerSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Vercel Serverless：使用 GEMINI_API_KEY（勿提交到 Git）
 * 本地：`vercel dev` 並在 .env.local 設定 GEMINI_API_KEY
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  const key = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: '伺服器未設定 GEMINI_API_KEY。請在 Vercel 專案 Environment Variables 新增（Production / Preview）。',
      }),
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: '伺服器未完成 Supabase 伺服器設定。請確認 SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、VITE_SUPABASE_ANON_KEY。',
      }),
    );
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: '請先登入後再使用 AI 掃描。', code: 'missing_auth' }));
  }

  const authClient = createServerSupabaseClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createServerSupabaseClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: '登入已過期，請重新登入後再試。', code: 'invalid_auth' }));
  }

  const [{ data: billingRow, error: billingError }, { count: usageCount, error: usageError }] = await Promise.all([
    adminClient
      .from('user_app_data')
      .select('subscription_status')
      .eq('user_id', user.id)
      .maybeSingle(),
    adminClient
      .from('usage_logs')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .eq('event_type', 'receipt_scan'),
  ]);

  if (billingError || usageError) {
    console.error('[parse-receipt] billing lookup', billingError || usageError);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: '無法確認你的方案與掃描額度，請稍後再試。' }));
  }

  const billing = buildBillingSnapshot({
    subscriptionStatus: billingRow?.subscription_status,
    usedReceiptScans: usageCount || 0,
  });

  if (!billing.hasUnlimitedScans && billing.remainingFreeScans <= 0) {
    res.statusCode = 402;
    return res.end(JSON.stringify({
      error: '你的免費 AI 掃描額度已用完，升級 Pro 後可繼續掃描。',
      code: 'quota_exceeded',
      billing,
    }));
  }

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: '無法讀取請求內容（JSON）' }));
  }

  const imageBase64 = body?.imageBase64;
  if (!imageBase64) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: '缺少 imageBase64' }));
  }

  const data = stripDataUrl(imageBase64);
  const mimeType = guessMime(imageBase64);

  if (!data) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: '圖片資料為空' }));
  }

  const expenseCategoryList = mergeExpenseCategoriesForPrompt(body?.expenseCategories);
  const categoryAppendix = `

══════════════════════════════════════════
支出類別清單（category 欄位 · 動態）
══════════════════════════════════════════
**必填**：category 僅能為以下**一字不差**的其中一個：
${expenseCategoryList.map((n) => `「${n}」`).join('、')}
無法合理歸類時必須選「其他」（上列已含「其他」時選「其他」）。`;

  const systemInstruction = `${SYSTEM_PROMPT}${categoryAppendix}`;
  const userText = `${USER_TEXT}
category 僅能從下列擇一（須完全一致）：${expenseCategoryList.join('、')}。無法判斷填「其他」。`;

  const textParts = [{ text: userText }, { inlineData: { mimeType, data } }];

  try {
    const genAI = new GoogleGenerativeAI(key);
    let text;

    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        systemInstruction,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(textParts);
      text = result.response?.text();
    } catch (firstErr) {
      const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        systemInstruction,
        generationConfig: { temperature: 0.1 },
      });
      const result = await model.generateContent(textParts);
      text = result.response?.text();
    }
    if (!text) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Gemini 回傳內容為空' }));
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: '無法解析 JSON' }));
      }
      parsed = JSON.parse(match[0]);
    }

    const { error: usageInsertError } = await adminClient.from('usage_logs').insert({
      user_id: user.id,
      event_type: 'receipt_scan',
      metadata: {
        source: 'parse-receipt',
        image_mime: mimeType,
        subscription_status: billing.subscriptionStatus,
        has_custom_categories: Array.isArray(body?.expenseCategories) && body.expenseCategories.length > 0,
      },
    });

    if (usageInsertError) {
      console.error('[parse-receipt] usage insert', usageInsertError);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: '已解析完成，但無法記錄掃描額度，請稍後再試。' }));
    }

    const nextBilling = buildBillingSnapshot({
      subscriptionStatus: billing.subscriptionStatus,
      usedReceiptScans: (billing.usedReceiptScans || 0) + 1,
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ...parsed,
      _billing: nextBilling,
    }));
  } catch (err) {
    console.error('[parse-receipt]', err);
    const msg = err?.message || String(err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: msg }));
  }
}
