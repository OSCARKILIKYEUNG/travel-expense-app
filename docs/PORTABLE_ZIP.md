# 可攜式 zip 備份（換機／其他平台）

## 目的

把專案**原始碼與設定**打成一份 `.zip`，方便整包複製到另一台電腦或雲端工作。**不含** `node_modules`（體積大、可 `npm install` 還原）。

## 怎麼產生

在專案根目錄：

```powershell
cd "c:\Users\user\Desktop\Cursor\travel app"
npm run zip:portable
```

產物在 **`portable-zips/`**，檔名含時間戳，例如：`travel-expense-app-2026-03-27T12-14-24.zip`。

### 可選：連 Git 歷史一起打包

需要在新環境繼續 `git pull`／分支時：

```powershell
npm run zip:portable -- --with-git
```

檔會較大，但含 **`.git`**。

## 在別台還原

1. 解壓 zip 到任意資料夾。  
2. `npm install`  
3. `npm run dev` 或 `npm run build`

## 關於「定期」

助手無法在背景自動幫你執行；建議你：

- **出門／換機前**手動跑一次 `npm run zip:portable`，或  
- 用系統**工作排程器**（Windows Task Scheduler）定期執行同一指令。

`portable-zips/` 已列入 **`.gitignore`**，zip 不會被推上 GitHub。
