# 會員／Supabase 實作前快照

> **標籤**：`pre-supabase-auth`  
> **對應提交**：`3adba73`（localStorage 為主、無登入門檻；含 `getAccountingCode` 白屏修復）

---

## 一句話切回這一版（本機）

```powershell
cd "c:\Users\user\Desktop\Cursor\travel app"; git fetch origin; git checkout pre-supabase-auth
```

之後若要回到最新 main：

```powershell
git checkout main; git pull origin main
```

---

## 若要把 main 強制還原成這一版（慎用）

```powershell
git checkout main
git reset --hard pre-supabase-auth
git push origin main --force
```

（與他人協作前請先溝通；`--force` 會覆蓋遠端 main 歷史。）

---

## 在 GitHub 查看

- Tags：`https://github.com/OSCARKILIKYEUNG/travel-expense-app/tags` → `pre-supabase-auth`
