# 備份快照說明（2025-03-27）

> **對應提交**：`1a19649aec9b347d45aa02fe0faaaba4cbbc76b9`（main 上「旅程主要外幣」與記帳幣 OTHER／自訂碼／清單刪除對齊之版本）  
> **Git 分支**：`backup/main-2025-03-27`  
> **Git 標籤**：`snapshot-2025-03-27`

---

## 如何切回這一版（本機）

```powershell
cd "c:\Users\user\Desktop\Cursor\travel app"
git fetch origin
git checkout backup/main-2025-03-27
```

或依標籤：

```powershell
git checkout snapshot-2025-03-27
```

---

## 若要把 main 還原成這一版（會改寫 main）

```powershell
git checkout main
git reset --hard backup/main-2025-03-27
git push origin main --force
```

（與他人協作前請先溝通；`--force` 會覆蓋遠端 main 歷史。）

---

## 在 GitHub 查看／下載

- 分支：`https://github.com/OSCARKILIKYEUNG/travel-expense-app/tree/backup/main-2025-03-27`
- 標籤：在 repo **Releases** 或 **Tags** 頁可找到 `snapshot-2025-03-27`，可下載該 commit 的 ZIP。

---

*建立於 2025-03-27*
