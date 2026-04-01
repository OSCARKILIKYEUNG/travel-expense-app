# Supabase 登入與雲端同步 · 2026-03（Session 級交接）

> **定位**：本輪 **Auth、每使用者 localStorage 範圍、`user_app_data` 雲端真相、同步延遲與除錯** 的單一書面來源。  
> **與其他檔分工**：不取代 `PRODUCT_ITERATION_2025-03.md`（分帳／多幣公式）；**補充** `DATA_FLOW.md` 在「雲端上線後」的儲存層。  
> **程式唯一真相**：以 `src/store/AppContext.jsx`、`src/services/syncSupabase.js`、`src/services/DataService.js`、`src/lib/supabaseClient.js` 為準。

---

## 一、進度快照（Progress · 2026-03-27）

| 區塊 | 狀態 | 備註 |
|------|------|------|
| Supabase Auth（Email／密碼、驗證信） | 已上線 | `/login`；`emailRedirectTo` = `origin/`；`confirmEmail` 須在後台開 |
| Google OAuth 登入 | 已上線 | `signInWithOAuth({ provider: 'google' })`；後台開 Google Provider + Google Cloud 重新導向 URI 見 `.env.example` |
| 登入後路由保護 | 已上線 | `RequireAuth` + `AuthenticatedShell`；未登入 → `/login` |
| 本機 `user:{uuid}:` 範圍鍵 | 已上線 | 每帳號一組，避免與登入前舊資料混用 |
| 合併「登入前舊資料」入口 | **已移除** | 使用者明確不要合併；舊無前綴鍵仍可能留在瀏覽器但不讀取 |
| **雲端唯一真相** `public.user_app_data` | 已上線 | `trips_data` / `app_settings` / `people_list` + RLS；**須先執行 SQL migration** |
| 本機快取 + debounce 寫回 | 已上線 | `bootstrapUserAppData` → 再掛 `AppProviderInner`；**500ms** debounce 後 `upsert` |
| 同步失敗使用者可見 | 已上線 | Toast `errors.persistFailed`；先前僅 `console.error('[sync]', err)` |
| 凍結「會員前」版本 | 已有 tag | `pre-supabase-auth`；說明見 `docs/archive/TAG_PRE_SUPABASE_AUTH.md` |
| **忘記密碼（Email 重設流程）** | 已上線 | `/login`「忘記密碼？」→ `resetPasswordForEmail`；`/reset-password` + `PASSWORD_RECOVERY` → `updateUser({ password })` 後導向 `/`；**Redirect URLs 須含 `/reset-password`**（見 §五、§八） |

---

## 二、架構（給接棒用）

### 2.1 資料層分工

| 層級 | 角色 |
|------|------|
| **PostgreSQL `user_app_data`** | **唯一真相**（多裝置以雲端為準）；登入後首次載入自拉取，無列則種預設並 upsert |
| **localStorage `user:{userId}:travel_*`** | **快取**；與既有 `DataService` 讀寫相容，減少大改 |
| **React state（AppContext）** | 操作時權威；`expenses` ↔ `trip.expenses` 雙軌仍依 `DATA_FLOW.md` |

### 2.2 關鍵檔案

| 路徑 | 用途 |
|------|------|
| `supabase/migrations/001_user_app_data.sql` | 建表 + RLS；**必須在 Supabase SQL Editor 執行** |
| `src/services/syncSupabase.js` | `bootstrapUserAppData`、`persistUserAppData` |
| `src/store/AppContext.jsx` | 外層：`bootstrap` 完成前顯示載入／錯誤；內層：debounce 觸發 `persist` |
| `src/context/AuthContext.jsx` | Session、`signUp`/`signIn`/`signOut`、`resendSignUpEmail`、`resetPasswordForEmail`、`updatePassword`（recovery） |
| `src/components/auth/AuthenticatedShell.jsx` | `AppProvider key={user.id} userId={user.id}` |
| `src/pages/ResetPassword.jsx` | 重設密碼落地頁（`PASSWORD_RECOVERY`、新密碼表單） |
| `src/lib/supabaseClient.js` | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |

### 2.3 單據影像 vs 記帳欄位

| 項目 | 存放位置 |
|------|----------|
| 上傳的 **相片** | **不**存 Supabase；送 `POST /api/parse-receipt`（Gemini）一次性辨識 |
| 辨識後的 **支出 JSON** | 與手動記帳相同，在 **`user_app_data.trips_data`** 內各 `trip.expenses[]` |

---

## 三、踩坑與教訓（Lessons · L20 起建議接續 PRODUCT_ITERATION 編號）

| # | 現象 | 原因／解法 |
|---|------|------------|
| L20 | Supabase **看不到 email** | 帳號在 **Authentication → Users**，不在 `user_app_data` |
| L21 | Table Editor **沒有記帳列** | 資料在 **`user_app_data`** 一列，`trips_data` 為 JSON；不是獨立 `expenses` 表 |
| L22 | 登入後仍看到舊本機資料 | 未用 `user:` 範圍鍵；已改為每 `user.id` 分開（舊無前綴鍵不讀） |
| L23 | 有操作但雲端很久才更新 | **500ms debounce** + Table Editor **需重新整理**才看到最新 JSON |
| L24 | 同步失敗但畫面正常 | 舊版只打 `console`；現版會 **Toast** `persistFailed` |
| L25 | 本機有資料、雲端沒有 | 未執行 **migration**、或 `VITE_*` 指到**另一個** Supabase 專案（本機 vs Vercel） |
| L26 | 白屏（歷史） | `AppContext` 曾缺 `getAccountingCode` import；**接棒時注意 import** |
| L27 | 點了重設密碼信卻顯示「連結無效」 | **Redirect URLs** 未含 **`/reset-password` 完整 URL**（本機 port 須與 Vite 一致，預設 **3000**）；或信在過期時間後才點 |

> **與雲端／Auth 無關的支出 UI 坑**（編輯後消費稅／退稅／品項金額顯示、`priceActual`、OAuth 檔勿入庫）→ **`docs/PRODUCT_ITERATION_2025-03.md` §三 L20–L22**、§十 **SAVE（2026-03-27）**。

---

## 四、Log 與除錯（工程）

### 4.1 瀏覽器 Console

| 前綴／關鍵字 | 含義 |
|--------------|------|
| `[sync]` | `persistUserAppData` 拋錯時 `console.error`（與 Toast 並存） |

### 4.2 網路（F12 → Network）

- 篩選 **`user_app_data`** 或 **`rest/v1`**  
- 預期 **200**（select／upsert）；**401/403** → RLS 或 session；**404** → 表不存在或 URL 錯專案

### 4.3 SQL 快速查（Supabase SQL Editor）

```sql
-- 表是否存在、是否有列
select count(*) from public.user_app_data;

-- 最近更新時間、旅程數
select user_id, updated_at,
       jsonb_array_length(coalesce(trips_data->'trips','[]'::jsonb)) as trip_count
from public.user_app_data;
```

### 4.4 i18n 鍵（同步錯誤文案）

- `errors.syncFailed`：bootstrap 失敗（載入畫面前）
- `errors.persistFailed`：debounce 後 upsert 失敗
- `errors.syncRetry`：重新載入按鈕

---

## 五、環境與部署檢查清單

- [ ] Supabase **SQL Editor** 已執行 `supabase/migrations/001_user_app_data.sql`
- [ ] **Authentication → URL Configuration**：Site URL、Redirect URLs 含本機與正式網域，且含 **`/reset-password` 完整 URL**（例：`http://localhost:3000/reset-password`、正式網域同路徑；與 `AuthContext` 內 `redirectTo` 一致；本專案 Vite **port 3000**）
- [ ] **Email** 開啟 Confirm email（若要走驗證信）
- [ ] **Google 登入**：Supabase **Authentication → Providers → Google** 開啟並貼 **Client ID／Secret**（來自 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 用戶端 → **網頁應用程式**）；**已授權的重新導向 URI** 必含 `https://<project-ref>.supabase.co/auth/v1/callback`（`<project-ref>` 見 Supabase Project Settings → API 的 URL）
- [ ] **Vercel** `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 與本機 `.env` **同一專案**
- [ ] 單據 API：`GEMINI_API_KEY` 僅伺服器（`api/parse-receipt`）
- [ ] **SQL（增量）**：`supabase/migrations/002_usage_logs.sql`（**AI 掃描免費額度必跑**；記錄 `receipt_scan` 用量）；`003_stripe_billing.sql`（`user_app_data` 之 `stripe_customer_id` / `stripe_subscription_id` / `subscription_status`，**接 Stripe Webhook 必跑**）
- [ ] **Stripe（Vercel 伺服器專用，勿加 `VITE_`）**：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`（Webhook destination 的 `whsec_...`）、`STRIPE_PRICE_ID`（`price_...` 月費）；可選 `STRIPE_PUBLISHABLE_KEY`（前端 Stripe.js 時再考慮 `VITE_` 暴露策略）
- [ ] **Stripe Webhook URL**：`https://<正式網域>/api/stripe-webhook`；變數新增後 **Redeploy**
- [ ] **結帳 API**：`STRIPE_PRICE_ID`（`price_...`）已設，且 **`/api/create-checkout-session`** 與設定頁可建立 Checkout（見 §5.2）
- [ ] **Supabase Service Role**：`SUPABASE_SERVICE_ROLE_KEY` **僅 Vercel**，供 `api/stripe-webhook.js` 更新訂閱欄位；**絕不**進前端 bundle。若未設 `SUPABASE_URL`，Webhook 會 fallback 讀 `VITE_SUPABASE_URL`
- [ ] **Checkout 實作時**：Session `metadata` 必含 **`supabase_user_id`**（與 `auth.users.id` 一致），否則 `checkout.session.completed` 無法對應列（**詳見 §5.2**）

### 5.1 後台哪裡複製這兩支「伺服器專用」金鑰

| 變數（貼到 Vercel） | 在哪裡看 |
|---------------------|----------|
| **`SUPABASE_SERVICE_ROLE_KEY`** | [Supabase Dashboard](https://supabase.com/dashboard) → 選專案 → 左側 **Project Settings**（齒輪）→ **API** → 區塊 **Project API keys** → **`service_role`**（**secret**，按 Reveal 後複製）。**不要**放進前端或 commit。 |
| **`STRIPE_WEBHOOK_SECRET`** | [Stripe Dashboard](https://dashboard.stripe.com)：**路徑 A（建議）** 左下 **Developers** → **Webhooks** → 新增或點選 endpoint（URL：`https://<網域>/api/stripe-webhook`）→ **Signing secret**（`whsec_...`）。**路徑 B** 畫面**右下角** **Workbench** 圖示（終端機 `>_`）→ 在 Workbench 內開 **Webhooks** → 同上。產品目錄／定價頁**沒有** Webhooks；若看不到 secret，代表尚未建立 endpoint 或點錯筆。 |

**Stripe 補充**：一般 **API Secret Key**（`sk_test_...` / `sk_live_...`）在左下角 **Developers** → **API keys**，與 Webhook 的 **`whsec_...`** 是不同東西——Webhook 專用密鑰只在 Webhook 設定裡。

### 5.1b Webhook 除錯全攻略（2026-03-30 實戰總結）

#### 坑 ①：HTTP 308 Permanent Redirect — 函式收不到請求

| 嘗試 | 結果 | 說明 |
|------|------|------|
| `vercel.json` 加 `"trailingSlash": false` | **造成 308** | Vercel 會對帶尾斜線的 URL 回 308 redirect，**先於** rewrites 處理；Stripe 對 POST 不追 redirect → 失敗。 |
| 加 rewrite `"/api/stripe-webhook/" → "/api/stripe-webhook"` | **被 308 繞過** | 有 `trailingSlash: false` 時，redirect 優先於 rewrite → 仍 308。 |
| `export async function POST(request)` (Web API 格式) | **可能不被辨識** | Vite 專案（非 Next.js）在 Vercel 上用此格式，函式可能未被正確註冊 → 路由 fallback → 308。 |
| `export const config = { api: { bodyParser: false } }` | **Next.js 專屬** | Vite 專案忽略此設定，可能導致函式註冊異常 → 308。 |

**最終解法（已驗證）**：
1. **移除** `vercel.json` 中的 `"trailingSlash": false`
2. **保留** rewrite：`{ "source": "/api/stripe-webhook/", "destination": "/api/stripe-webhook" }`（作為安全網）
3. 函式用 **`export default async function handler(req, res)`**（與其他 API 一致）
4. **移除** `export const config`（非 Next.js 不需要）

**驗證**：`curl -X POST https://<domain>/api/stripe-webhook` 與 `.../stripe-webhook/` 皆應回 **400**（`Missing stripe-signature`），**不是 308**。Windows PowerShell 需用 **`curl.exe`**（`curl` 是 `Invoke-WebRequest` 的別名）。

#### 坑 ②：簽章驗證失敗（400 · No signatures found matching）

| 原因 | 說明 |
|------|------|
| **`STRIPE_WEBHOOK_SECRET` 不匹配** | **最常見**。Workbench destination 的 `whsec_...` ≠ Developers → Webhooks endpoint 的 `whsec_...`；換 endpoint 後 **必須更新** Vercel env var 並 **Redeploy**。 |
| **Vercel body parser 吃掉 raw body** | Vercel Node.js Helpers 會自動解析 `req.body`（lazy getter），若在 `buffer(req)` 之前觸發 getter，stream 被消費 → HMAC 對不上。 |
| **`JSON.stringify` 重序列化** | 若 fallback 到 `JSON.stringify(req.body)`，格式（空格、key 順序）與 Stripe 原始 payload 不同 → 簽章不同。 |

**最終解法**：`getRawBody(req)` 多策略（Buffer → string → stream → stringify fallback），且在函式最前方讀取，**不先碰** `req.body`。已加 `console.log` 印出 `rawBody.length` 與 `sig` 前綴方便排查。若仍失敗，可在 Vercel 設 **`NODEJS_HELPERS=0`** 環境變數（停用所有 API 函式的 body 自動解析；本專案其他 API 已處理 fallback 讀取）。

#### 坑 ③：Stripe Workbench 顯示舊 delivery 結果

Workbench **Event deliveries** 頁面保留每次 delivery attempt 的回應。若事件在 308 時期被嘗試、之後部署修好，**舊事件的歷史 status 不會自動更新**。需點 **Resend** 或發新 test event 才能看到最新回應。

#### 快速排查流程

```
1. curl.exe -X POST https://<domain>/api/stripe-webhook → 期望 400 "Missing stripe-signature"
   ├─ 308 → 查 vercel.json trailingSlash / URL 是否帶尾斜線
   ├─ 404 → 函式未部署（build 失敗或檔名錯）
   └─ 400 → 函式有收到 ✔

2. Stripe 發 test event → 期望 200 "received: true"
   ├─ 400 signature → 對比 STRIPE_WEBHOOK_SECRET（Stripe Reveal vs Vercel env）
   ├─ 400 read body → Vercel Logs 看 rawBody.length（0 = 被吃掉 → 設 NODEJS_HELPERS=0）
   └─ 503 → 缺 env var（STRIPE_SECRET_KEY / SUPABASE_*）
```

### 5.1a Stripe Dashboard 其他路徑速查（2026-03）

| 要找什麼 | 路徑 |
|----------|------|
| **API keys**（`pk_test` / `sk_test`） | 左下 **Developers** → **API keys**（**不是** Workbench → Webhooks 畫面） |
| **Price ID** | **Product catalog** → 點產品 → **Pricing** → `price_...` |

### 5.2 Checkout Session：**務必**帶 `metadata`（與 Webhook 的契約）

**之後實作 Checkout 時**，在伺服器端呼叫 `stripe.checkout.sessions.create` **必須**設定：

```js
metadata: {
  supabase_user_id: '<目前登入使用者的 UUID>', // 須與 Supabase Auth 的 `user.id` 一致
},
```

**原因**：`api/stripe-webhook.js` 處理 `checkout.session.completed` 時，只從 **`session.metadata.supabase_user_id`** 取得要更新的列，再以 `user_app_data.user_id` 做 `.eq('user_id', userId)`。Stripe 的 `customer`／`subscription` ID **不會自動對應** Supabase 使用者，省略 metadata 時 Webhook 會記錄警告並 **直接 return，不寫入 DB**——使用者已付費，但 **`stripe_customer_id`／`stripe_subscription_id`／`subscription_status` 仍為空**。

**實作**：本專案已提供 **`api/create-checkout-session.js`**（POST + `Authorization: Bearer <access_token>`），會寫入 `metadata.supabase_user_id`；設定頁「前往結帳」會呼叫該路由。**不要**讓前端持有 `sk_` 或自行拼帶 Secret 的 Stripe 請求。

### 5.3 AI 掃描免費額度（Phase 1 已接通）

**產品規則（現版）**：

- 手動記帳 **永遠免費**
- 每帳戶 **終生 5 次**免費 **AI 收據掃描**
- `subscription_status ∈ { active, trialing }` 視為 **Pro** → 掃描不限次
- **只有成功解析**並回 200 的掃描才記一筆 `usage_logs.event_type = 'receipt_scan'`

**程式流**：

1. 前端 **`src/services/AIService.js`** 呼叫 **`/api/parse-receipt`** 時，會帶 **`Authorization: Bearer <access_token>`**
2. 伺服器 **`api/parse-receipt.js`** 用 Supabase 驗 JWT 取得 `user.id`
3. 以 **service role** 查：
   - `user_app_data.subscription_status`
   - `usage_logs` 中該 user 的 `receipt_scan` 計數
4. 若為 Free 且已用完 5 次 → 回 **`402`** + `{ code: 'quota_exceeded', billing }`
5. 若可掃描且 Gemini 成功 → 寫入一筆 `usage_logs`
6. API 會回傳 **`_billing`** snapshot，前端立刻更新 Settings / Upload 區的剩餘次數顯示

**必要環境變數（`api/parse-receipt` 也會用到）**：

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`（或 fallback `VITE_SUPABASE_URL`）
- `VITE_SUPABASE_ANON_KEY`（伺服器驗 access token 用）
- `GEMINI_API_KEY`

**驗收清單**：

- [ ] 新帳戶第 1 次掃描成功後，`usage_logs` 新增一筆 `receipt_scan`
- [ ] Free 用戶第 5 次掃描後，Upload 區顯示剩餘 `0`
- [ ] 第 6 次掃描被擋下，前端收到 `quota_exceeded`
- [ ] 完成 Stripe 訂閱後，Settings 顯示 **Pro**，掃描恢復可用

### 5.3a 逐步檢查：到哪裡看、看什麼

#### A. Supabase SQL 是否齊全

**位置**：Supabase Dashboard → **SQL Editor**

**應已執行**：

- `supabase/migrations/001_user_app_data.sql`
- `supabase/migrations/002_usage_logs.sql`
- `supabase/migrations/003_stripe_billing.sql`

**如何確認 `user_app_data` 欄位齊全**：

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_app_data';
```

至少應看到：

- `user_id`
- `trips_data`
- `app_settings`
- `people_list`
- `stripe_customer_id`
- `stripe_subscription_id`
- `subscription_status`

**如何確認 `usage_logs` 欄位齊全**：

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'usage_logs';
```

至少應看到：

- `id`
- `user_id`
- `event_type`
- `metadata`
- `created_at`

#### B. Supabase API keys 是否可用

**位置**：Supabase Dashboard → **Project Settings** → **API**

確認能找到：

- `Project URL`
- `anon public key`
- `service_role secret key`

**對應到 Vercel env**：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### C. Vercel Environment Variables 是否齊

**位置**：Vercel → 專案 → **Settings** → **Environment Variables**

至少要有：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

**特別核對**：

- `VITE_SUPABASE_URL` = Supabase `Project URL`
- `VITE_SUPABASE_ANON_KEY` = Supabase `anon`
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase `service_role`
- `STRIPE_WEBHOOK_SECRET` = 目前成功回 200 的 webhook endpoint 那條 `whsec_...`

**注意**：任何 env 變更後都要 **Redeploy**。

#### D. Stripe webhook endpoint 是否正確

**位置**：Stripe Dashboard → **Workbench / Webhooks**

確認 destination URL 精確為：

`https://<正式網域>/api/stripe-webhook`

**不要有尾斜線**。

另外確認：

- signing secret 已複製到 Vercel 的 `STRIPE_WEBHOOK_SECRET`
- 在 Stripe Workbench / Event deliveries 看到最新測試為 **200**

#### E. 免費額度功能是否真的通

**位置 1**：Supabase → **Table Editor** → `usage_logs`

成功掃描一張收據後，應新增一列：

- `user_id` = 當前登入使用者 UUID
- `event_type` = `receipt_scan`

**位置 2**：Supabase → **Table Editor** → `user_app_data`

確認：

- Free 用戶：`subscription_status` 多半為 `null`
- 已訂閱用戶：`subscription_status` 應為 `active` 或 `trialing`

### 5.3b 實際驗證順序（建議照做）

1. 用 **免費帳戶** 成功掃描 1 次  
   預期：`usage_logs` 多 1 筆 `receipt_scan`

2. 用同帳戶繼續掃到第 5 次  
   預期：Upload 區 / Settings 顯示剩餘 `0`

3. 再掃第 6 次  
   預期：前端被擋下，收到 `quota_exceeded` 或對應升級提示

4. 完成 Stripe 訂閱後再掃  
   預期：Settings 顯示 **Pro**，掃描恢復可用，不再受 5 次限制

---

## 六、相關 Git 參考（非自動更新）

| 說明 | 指令或位置 |
|------|------------|
| 會員／雲端同步前凍結 | `git checkout pre-supabase-auth`（見 `docs/archive/TAG_PRE_SUPABASE_AUTH.md`） |
| 典型 feature 提交 | `feat(auth):…`、`feat(data): Supabase user_app_data…`、`fix(sync): toast on persist failure` |

---

## 七、後續可選（Backlog 提示）

- 縮短 debounce 或改「手動儲存」策略（權衡 API 次數）
- 多分頁同時編輯：**最後寫入為準**；可加入版本欄或 Realtime
- 單據圖若需留存：Supabase **Storage** + 連結寫入 expense

---

## 八、忘記密碼（Password reset · 已上線）

> 官方流程見 [Supabase · Forgot password](https://supabase.com/docs/guides/auth/passwords#forgot-password)。本專案 `supabaseClient` 使用 **PKCE** + `detectSessionInUrl: true`。

### 8.1 已實作行為

- **`Auth.jsx`**（登入模式）：「忘記密碼？」→ 僅 email → `resetPasswordForEmail`；成功後 **`pendingPasswordReset`** 與註冊驗證 **`pendingEmail` 分開**；可「再次寄送重設信」（60s 冷卻）。
- **`ResetPassword.jsx`**（路由 **`/reset-password`**，**不**經 `RequireAuth`）：`onAuthStateChange` 收到 **`PASSWORD_RECOVERY`** 後顯示新密碼／確認；`updateUser({ password })` 成功後 **`navigate('/')`**（沿用 Supabase 更新後之 session）。
- **`AuthContext`**：`resetPasswordForEmail`、`updatePassword`。

### 8.2 後台必做（仍請人工核對）

1. **Redirect URLs** 含本機與正式之 **`…/reset-password`**（本機預設 **port 3000**，見 `vite.config.js`）。
2. **Email**：Reset password 模板可從信內連結回到上述 URL。

### 8.3 產品決策（已定）

- 重設成功後：**導向首頁 `/`**（已登入狀態），非強制回 `/login` 再打一次密碼。
- 前端密碼長度：**至少 6 字元**（與常見 Supabase 預設一致；`signUp` 未另設更嚴規則時與此對齊）。

### 8.4 驗收（上線後自測勾選）

- [ ] 可寄出重設信，信內連結可開啟 App 並設新密碼。
- [ ] 新密碼可 `signInWithPassword`（必要時先 sign out 再測）。
- [ ] 無效／過期連結會出現說明並可回 `/login`。
- [ ] 雙語文案齊全。

---

*維護：雲端或 Auth 行為變更時，請同步更新本檔與 `DATA_FLOW.md` 開頭一段。*
