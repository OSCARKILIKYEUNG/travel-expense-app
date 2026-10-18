import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../i18n', () => ({ default: { t: (k) => k } }));
import { parseReceipt } from './AIService.js';

afterEach(() => vi.unstubAllGlobals());

// resizeImage 需要 DOM；在 node 環境以最小 stub 取代
function stubDom() {
  vi.stubGlobal('FileReader', class {
    readAsDataURL() { setTimeout(() => this.onload({ target: { result: 'data:image/jpeg;base64,AA' } }), 0); }
  });
  vi.stubGlobal('Image', class {
    set src(_) { setTimeout(() => this.onload(), 0); }
  });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,AA' }) });
}

describe('parseReceipt timeout errors', () => {
  const file = new Blob(['x'], { type: 'image/jpeg' });
  const stub = (status, body) => { stubDom(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, text: async () => body }))); };

  it('maps gemini_timeout JSON to timeout message', async () => {
    stub(502, JSON.stringify({ error: 'x', code: 'gemini_timeout' }));
    await expect(parseReceipt(file)).rejects.toMatchObject({ message: 'errors.parseReceiptTimeout', code: 'gemini_timeout' });
  });
  it('maps platform 504 HTML to timeout message', async () => {
    stub(504, '<html>Gateway Timeout</html>');
    await expect(parseReceipt(file)).rejects.toMatchObject({ message: 'errors.parseReceiptTimeout' });
  });
});
