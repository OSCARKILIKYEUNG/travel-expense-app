import { buffer } from 'node:stream/consumers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT, USER_TEXT } from './receipt-prompt.js';

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
  if (!key) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: '伺服器未設定 GEMINI_API_KEY。請在 Vercel 專案 Environment Variables 新增（Production / Preview）。',
      }),
    );
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

  const textParts = [{ text: USER_TEXT }, { inlineData: { mimeType, data } }];

  try {
    const genAI = new GoogleGenerativeAI(key);
    let text;

    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        systemInstruction: SYSTEM_PROMPT,
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
        systemInstruction: SYSTEM_PROMPT,
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

    res.statusCode = 200;
    return res.end(JSON.stringify(parsed));
  } catch (err) {
    console.error('[parse-receipt]', err);
    const msg = err?.message || String(err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: msg }));
  }
}
