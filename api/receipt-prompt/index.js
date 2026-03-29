import { buildSystemPrompt } from './assemble.js';
import { USER_TEXT } from './user-text.js';

export const SYSTEM_PROMPT = buildSystemPrompt();
export { USER_TEXT };
