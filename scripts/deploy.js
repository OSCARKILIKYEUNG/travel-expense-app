#!/usr/bin/env node
/**
 * 一鍵部署：git add + commit + push
 * 用法：npm run deploy
 *       npm run deploy -- "修復登入 bug"
 */
import { execSync } from 'child_process';

const message = process.argv.slice(2).join(' ').trim() || `Deploy ${new Date().toISOString().slice(0, 10)}`;
const safeMsg = message.replace(/"/g, "'");

try {
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "${safeMsg}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log('\n✅ 已推送到 GitHub，Vercel 會自動部署');
} catch (err) {
  if (err.status === 1) {
    console.log('\n⚠️ 無變更可提交，或 push 失敗。請檢查 git status');
  }
  process.exit(1);
}
