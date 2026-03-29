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
