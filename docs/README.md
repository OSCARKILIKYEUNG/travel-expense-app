# 文件導覽（產品 × 工程）

> **建議**：新成員或每季複盤時，從本頁開始，再依角色點進對應檔案。  
> **結論先說**：`src/` 程式目錄結構清楚；「亂」多半來自 **多份 Markdown 用途相近卻未分層**。下方已劃清邊界。

---

## 一、一句話：誰負責什麼

| 我想… | 打開 |
|------|------|
| 安裝、跑專案、部署到 Vercel | [README.md](../README.md)（**專案門面**） |
| 排優先級、路線圖、技術債、發版紀錄 | [PRODUCT_MANAGEMENT.md](./PRODUCT_MANAGEMENT.md)（**產品主控**） |
| 還原「這一輪做了什麼、踩了什麼坑、下次跟進」 | [PRODUCT_ITERATION_2025-03.md](./PRODUCT_ITERATION_2025-03.md) |
| 單據類型 A～H（外稅／免稅／套裝等） | [RECEIPT_TYPES.md](./RECEIPT_TYPES.md) |
| **與 AI 協作 SOP**（意見→對齊→再實作；與 §九／Cursor rule 對照） | [SOP_AI_COLLABORATION.md](./SOP_AI_COLLABORATION.md) |
| Cursor 規則（意見→先對齊再改；**SAVE**→寫 §十） | [../.cursor/rules/feedback-before-implement.mdc](../.cursor/rules/feedback-before-implement.mdc) |
| 畫面/品牌/無障礙等 **UI 規格** | [DESIGN_SPEC.md](../DESIGN_SPEC.md) |
| 為什麼用 Vite、遷移史、目錄對照 | [HANDOFF.md](../HANDOFF.md)（**歷史與決策**） |
| Pencil 檔、色票、mockup 資產 | [designs/README.md](../designs/README.md) |
| 還原 **backup/v1-original** 分支 | [archive/BACKUP_BRANCH_v1.md](./archive/BACKUP_BRANCH_v1.md) |

**不要做的事**：在 README 複製貼上路線圖長表、或在 HANDOFF 寫每週排期 —— 各留一份「單一真相」。

---

## 二、文件是否重疊？怎麼切

| 疑慮 | 說明 |
|------|------|
| README vs HANDOFF | README = **怎麼用專案**；HANDOFF = **當初為何這樣建**。部署步驟只在 README。 |
| README vs PRODUCT_MANAGEMENT | README 只 **連結** 到產品管理檔，不重複貼路線圖全文。 |
| DESIGN_SPEC vs designs/ | DESIGN_SPEC = **產品級設計原則**（色、國旗、無障礙方向）；designs/ = **Pencil 檔與 mockup 清單**。前者定規則，後者放稿。 |
| HANDOFF vs PRODUCT_MANAGEMENT | HANDOFF 偏 **過去**；PRODUCT_MANAGEMENT 偏 **現在與下一步**。 |

---

## 三、程式與資料夾（工程視圖）

```
travel app/                    # 資料夾名含空白，終端機路徑請加引號
├── src/                       # 唯一應用程式碼（React）
│   ├── components/            # 可複用 UI（依功能分子資料夾）
│   ├── pages/                 # 路由頁面
│   ├── services/              # DataService / AIService / ExportService — 業務邊界在這
│   ├── store/                 # AppContext
│   └── utils/                 # 純函式工具
├── public/                    # 靜態資源（icons 等）
├── scripts/                   # 工具腳本（如 deploy.js），非執行路徑
├── designs/                   # 設計資產（.pen 等），不 import 進 src
├── docs/                      # 人類閱讀文件（本導覽、產品管理、歸檔）
└── dist/                      # build 產物（.gitignore，勿手動維護）
```

**沒有重複的程式入口**：單一 `main.jsx` → `App.jsx`，無第二套前端。

---

## 四、維護規則（產品經理 + 工程）

1. **新增功能**：先更新 `PRODUCT_MANAGEMENT.md` 路線圖狀態，再開發（或並行但發版前補齊）。  
2. **新增長篇決策**：技術決策摘要寫 HANDOFF 或 PR 說明；**不要**再開第三份「總覽」除非本導覽已不敷使用。  
3. **設計稿**：檔案放 `designs/`，規則變更寫 `DESIGN_SPEC.md`。  
4. **備份／冷門操作**：放 `docs/archive/`，根目錄只留短連結檔（若需向後相容）。

---

## 五、相關檔案一覽（快速搜）

| 路徑 | 用途 |
|------|------|
| `README.md` | 安裝、部署、專案結構簡表 |
| `HANDOFF.md` | 遷移與決策歷史 |
| `DESIGN_SPEC.md` | UI/UX 規格 |
| `docs/PRODUCT_MANAGEMENT.md` | 路線圖、技術債、發布紀錄 |
| `docs/PRODUCT_ITERATION_2025-03.md` | 2025-03 分帳／免稅迭代之書面 log |
| `docs/SOP_AI_COLLABORATION.md` | 與 AI 協作標準流程（書面 SOP） |
| `docs/README.md` | **本檔：文件地圖** |
| `docs/archive/BACKUP_BRANCH_v1.md` | Git 備份分支操作說明 |
| `designs/README.md` | Pencil mockup 說明 |
| `BACKUP_README.md`（根目錄） | 僅指向 archive，避免舊書籤失效 |

---

*維護本檔時：若新增「第三份總覽」，請先檢查是否應併入本導覽的一節即可。*
