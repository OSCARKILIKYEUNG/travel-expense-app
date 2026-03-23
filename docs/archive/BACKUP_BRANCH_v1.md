# 備份分支說明（backup/v1-original）

> **歸檔位置**：此內容自根目錄 `BACKUP_README.md` 收斂至此，避免根目錄文件過多。  
> **何時會用**：需要還原 UI 重設計前版本、或比對歷史程式時。

---

## 如何回到該版 App

這份專案已建立 **backup/v1-original** 分支，保留 UI 重設計前的完整版本。

### 方法 A：切換到備份分支（本機）

```powershell
cd "c:\Users\user\Desktop\Cursor\travel app"
git checkout backup/v1-original
```

### 方法 B：從備份分支恢復到 main

若你想把 main 完全還原成這版：

```powershell
git checkout main
git reset --hard backup/v1-original
git push origin main --force
```

### 方法 C：在 GitHub 查看

- 備份分支：https://github.com/OSCARKILIKYEUNG/travel-expense-app/tree/backup/v1-original
- 可下載 ZIP 或 clone 該分支

---

*建立於 2026-03-15，Pencil mockup 重設計前*
