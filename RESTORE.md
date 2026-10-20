# RESTORE — Travel Expense App Backup

## 快照資訊

| 項目 | 內容 |
|---|---|
| 來源 | `https://github.com/OSCARKILIKYEUNG/travel-expense-app.git` |
| Branch | `main` |
| Commit | `5bfab55 feat(phase1): launch notebook UI and AI scan quota gating` |
| 備份日期 | 2026-05-08 |
| 用途 | 鎖住 GitHub 已 push 嘅「功能上最好」版本，可移植到其他電腦或重新 push |

---

## 包含內容

| 類別 | 來源 | 說明 |
|---|---|---|
| 原始碼 + git 歷史 | `git clone` | 包含完整 `.git/`，可繼續 `git pull` / `git push` |
| `.env` | 從原工作資料夾複製 | ⚠️ 含 API key / Supabase / Stripe secrets |
| `reference/` | 從原工作資料夾複製 | 本機參考圖（`.gitignore` 排除，唔在 git） |

## 不包含（要本機重新產生）

| 項目 | 點重建 |
|---|---|
| `node_modules/` | `npm install` |
| `dist/` | `npm run build` |
| `.claude/` | 本機助手目錄，唔需要 |
| `portable-zips/` | 打包時自動產生 |

---

## 喺新電腦點 set up

### 前置需求

- Node.js 18+（建議 20 LTS）
- npm（隨 Node.js 安裝）
- Git

### 步驟

```bash
# 1. 入到本資料夾
cd "travel-app-backup-2026-05-08"

# 2. 確認 .env 存在
#    如冇 → 複製 .env.example 並填入值
#    如有 → 確認 secrets 仍然有效（Supabase URL/Anon Key、Gemini API Key、Stripe Key 等）

# 3. 安裝 dependencies
npm install

# 4. Dev mode（hot reload）
npm run dev
# → 開 http://localhost:5173

# 或：build + preview production 版
npm run build
npm run preview
```

---

## 點移植到另一部電腦

### Option A：USB / 雲端硬碟複製整個 folder

直接複製成個 `travel-app-backup-2026-05-08` folder 過去。**唔好複製 `node_modules/`**（行 `npm install` 重裝就好，又快又乾淨）。

複製前可以清走：
```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
```

### Option B：再 push 上 GitHub（建立分支或新 repo）

本資料夾已連住 `origin = OSCARKILIKYEUNG/travel-expense-app`。如要：

- **建立 backup branch 推上同一個 repo**：
  ```bash
  git checkout -b backup/snapshot-2026-05-08
  git push -u origin backup/snapshot-2026-05-08
  ```

- **推到另一個 repo**（例如新 private repo）：
  ```bash
  git remote rename origin upstream
  git remote add origin <NEW_REPO_URL>
  git push -u origin main
  ```

> ⚠️ **千祈唔好 push 去 public repo**，`.env` 雖然有 `.gitignore` 保護，但本資料夾內現存 `.env` 唔會自動被 git 追蹤；如果你手動 `git add -f .env` 就會洩漏 secrets。

---

## Secrets 檢查清單（換電腦時）

驗證 `.env` 入面以下 key 仍然有效：

- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- [ ] `GEMINI_API_KEY`（server-only；AI scan via `/api/parse-receipt`。唔係 `VITE_` 前綴）
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`（如有用 billing）
- [ ] 其他 OAuth / 第三方服務 key

---

## 還原到原工作流程

如想對比呢個 backup 同你 local 工作版本：

```bash
# 喺呢個 backup folder
git log --oneline -5
# → 應該見到 5bfab55 為最新

# 喺原 working folder (c:\Users\user\Desktop\Cursor\travel app)
git log --oneline -5
# → 同樣由 5bfab55 起，但 working tree 有未 commit 改動
```

---

## 同步 origin 最新更新

如將來 GitHub `main` 有新 commit 想 sync 落本 backup：

```bash
git pull origin main
```

> 注意：呢個動作會令本 backup 唔再係 2026-05-08 嘅 frozen snapshot。如果想保留快照，可以先：
> ```bash
> git tag snapshot-2026-05-08
> git pull origin main
> # 將來想回到快照：git checkout snapshot-2026-05-08
> ```
