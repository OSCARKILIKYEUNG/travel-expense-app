/**
 * 設定頁匯率輸入框顯示字串。
 * 網路更新後預設兩位小數；手動列或使用者曾編輯的幣別顯示完整數值（與存檔精度一致）。
 */
export function formatExchangeRateInputValue(code, rate, homeCode, isManual, userEditedCodes) {
  if (code === homeCode) return '1';
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return '1';
  if (isManual || (userEditedCodes || []).includes(code)) {
    return String(n);
  }
  return n.toFixed(2);
}
