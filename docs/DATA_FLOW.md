# 資料流說明（階段 0 · 維護用）

> **目的**：說明 **支出** 在 **localStorage** 與 **React 狀態** 之間如何流動，避免改儲存／同步邏輯時漏改。  
> **程式唯一真相**：以 **`src/services/DataService.js`**、**`src/store/AppContext.jsx`** 為準；本檔若與程式不一致，**以程式為準**並應更新本檔。

---

## 一、localStorage 四個 key

| Key | 常數名 | 內容摘要 |
|-----|--------|----------|
| `travel_trips_data` | `KEYS.TRIPS` | `{ trips: Trip[], currentTripId }`。每個 **Trip** 含 `expenses[]`（該旅程的支出副本）、`exchangeRates`、`settings.people` 等。 |
| `travel_expenses_data` | `KEYS.EXPENSES` | **目前工作階段**的支出陣列（與「當前旅程」對應的列表）。 |
| `travel_app_settings` | `KEYS.SETTINGS` | API Key、語系、`savedAccountingCodes` / `savedTripCurrencies` 等（**不含**已遷移走的舊版全域匯率；見 `stripLegacyCurrencyFromSettings`）。 |
| `travel_people_list` | `KEYS.PEOPLE` | 當前顯示用的人物列表（與旅程切換連動）。 |

---

## 二、為何是「雙軌」（技術債 TD-01）

- **`travel_expenses_data`**：給 App **快速讀寫「現在這一沓支出」**，不必每次從嵌在 `trips` 裡的陣列解析。
- **`trip.expenses`**：每個旅程 **自帶一份** 支出，切換旅程時 **還原該旅程的列表**；備份／匯出時也常以旅程為單位思考。

兩者 **應保持與「當前 `currentTripId`」一致**；同步責任在 **`AppContext` + DataService**（見下節）。

---

## 三、執行期：誰是「主」資料？

| 層級 | 角色 |
|------|------|
| **React `expenses` state**（`AppContext`） | **使用者操作時的權威來源**（新增／編輯／刪除／匯率重算後的列表）。 |
| **`saveExpenses` → `travel_expenses_data`** | 每次 `setExpenses` 成功後 **立刻** 寫入（見 `AppContext` 內 `setExpenses`）。 |
| **`updateCurrentTripExpenses` → `trip.expenses`** | `expenses` 或 `currentTripId` 變更時 **`useEffect`** 呼叫，把 **同一份** 列表寫入 **當前旅程** 在 `travel_trips_data` 裡的 `expenses`。 |

因此：**記憶體 state 為主**；兩個 localStorage 位置都是它的 **持久化投影**。

---

## 四、流程圖（文字版）

```
使用者操作 → setExpenses(新列表)
    → DataService.saveExpenses → 寫入 KEYS.EXPENSES
    → useEffect[expenses, currentTripId] 觸發
    → DataService.updateCurrentTripExpenses(expenses)
        → 讀取 travel_trips_data → 找到 currentTrip → current.expenses = expenses → saveTripsData
```

**切換旅程**（`switchTrip`）前：

1. 先把 **目前記憶體裡的** `expenses` 寫進 **舊旅程** 的 `trip.expenses`（在 `switchTrip` 內完成）。
2. 改 `currentTripId`，再從 **新旅程** 的 `trip.expenses` **載入** 回傳給 React（空陣列或既有資料）。

**新建旅程**（`createTrip`）前：

1. `updateCurrentTripExpenses(expenses)` 保存 **舊旅程** 的支出。
2. 新旅程建立時 `expenses: []`，React 設為空列表。

**刪除旅程**（非當前）：僅改 `trips`；若刪到需切換，從剩餘旅程載入 `expenses`。

**人物刪除並重指派**（`removePersonAndReassignAll`）：

- 會 **遍歷所有 `trip.expenses`** 做指派人替換並 `saveTripsData`。
- 再對 **當前旅程** 呼叫 `saveExpenses(cur.expenses)`，讓 **`travel_expenses_data`** 與當前一致。

---

## 五、`loadExpenses()` 的後備邏輯

```text
若 KEYS.EXPENSES 有資料 → 直接回傳（主要路徑）
否則 → 從當前 Trip 的 trip.expenses 讀取（相容／首次）
```

若只有一邊更新、另一邊沒更新，可能出現 **短暫不一致**；正常路徑下 **`setExpenses` + `updateCurrentTripExpenses`** 會一併維護兩邊。

---

## 六、修改程式時的檢查清單

| 你若改動… | 至少再檢查… |
|-----------|-------------|
| 新增／刪除支出的寫入路徑 | `setExpenses` 是否仍會觸發 `saveExpenses` 與 `useEffect` 同步旅程 |
| 切換旅程 | `switchTrip` 是否仍先把舊支出寫回舊 `trip` |
| 只改 `trip` 不經 Context | `travel_expenses_data` 是否會落後 → **應避免** 繞過 Context 直接改旅程內支出 |
| 批次改所有旅程的支出 | 對齊 `removePersonAndReassignAll` 模式：改完 `trips` 後 **當前** 再 `saveExpenses` |

---

## 七、相關檔案

| 檔案 | 職責 |
|------|------|
| `src/services/DataService.js` | `loadExpenses` / `saveExpenses` / `updateCurrentTripExpenses` / `switchTrip` / `createTrip` / `removePersonAndReassignAll` |
| `src/store/AppContext.jsx` | `expenses` state、`setExpenses` 內持久化、`useEffect` 同步至旅程；匯率變更重算見 **`recalculateExpensesForRates`** |
| `src/utils/recalculateExpensesForRates.js` | 依 `exchangeRates` 重算 `hkdAmount`（與舊 inline 邏輯一致） |
| `src/utils/savedCurrencyMerge.js` | `buildMergedSavedCurrencySettings`：旅程幣／記帳幣合併進 settings 重用清單 |
| `docs/PRODUCT_MANAGEMENT.md` | 技術債 **TD-01**（雙軌） |

---

## 八、修訂紀錄

| 日期 | 說明 |
|------|------|
| 2025-03-27 | 初版：階段 0 資料流文件（對齊現行 `DataService` / `AppContext`）。 |
