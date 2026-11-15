// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOGIN_COVERS } from '../components/auth/loginCovers';
import i18n from '../i18n';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import {
  DEVICE_LOGIN_COVER_KEY,
  writeDeviceLoginCoverId,
} from '../utils/loginCoverPreference';
import SettingsView from './SettingsView';

afterEach(async () => {
  cleanup();
  localStorage.removeItem(DEVICE_LOGIN_COVER_KEY);
  await i18n.changeLanguage('zh-TW');
});

function renderSettings(props = {}) {
  const trip = props.trip || createRefTrip();
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(SettingsView, {
        trip,
        trips: [trip],
        today: '2026-11-15',
        onToast: props.onToast,
        uiLanguage: props.uiLanguage || 'zh-TW',
        updateSettings: props.updateSettings,
        loginCoverId: props.loginCoverId,
        account: props.account,
      }),
    ),
  );
}

describe('SettingsView free login-cover radios', () => {
  it('shows four free native radios in catalog order without a billing gate or custom generator', async () => {
    await i18n.changeLanguage('zh-TW');
    const updateSettings = vi.fn();
    const onToast = vi.fn();
    renderSettings({ updateSettings, onToast, loginCoverId: 'tokyo' });

    const section = screen.getByTestId('login-cover-section');
    expect(section.textContent).toContain('登入封面');
    expect(section.textContent).toContain('免費');
    expect(section.textContent).not.toMatch(/結帳|Stripe|Pro|生成/);
    expect(screen.queryByTestId('account-card')).toBeNull();
    expect(screen.queryByRole('button', { name: /自訂|生成|custom|generate/i })).toBeNull();

    const group = screen.getByRole('radiogroup', { name: '登入封面' });
    expect(group.getAttribute('aria-describedby')).toBe('login-cover-help');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((node) => node.getAttribute('value'))).toEqual(['tokyo', 'osaka', 'kyoto', 'kyushu']);
    for (const radio of radios) {
      expect(radio.getAttribute('type')).toBe('radio');
      expect(radio.getAttribute('name')).toBe('loginCoverId');
      expect(radio.className).not.toMatch(/sr-only|hidden/);
    }
    expect(radios[0].checked).toBe(true);
    expect(screen.getByTestId('login-cover-selected-tokyo').textContent).toContain('已選');
    expect(screen.getByTestId('login-cover-choice-tokyo').className).toContain('min-h-11');
    expect(screen.getByTestId('login-cover-choice-tokyo').className).toContain('border-route');

    for (const cover of LOGIN_COVERS) {
      const thumb = screen.getByTestId(`login-cover-thumb-${cover.id}`);
      expect(thumb.getAttribute('src')).toBe(cover.src);
      expect(thumb.getAttribute('alt')).toBe(i18n.t(`auth.coverAlt.${cover.id}`));
      expect(thumb.getAttribute('alt')).toContain('手繪墨線');
      expect(screen.getByTestId(`login-cover-choice-${cover.id}`).textContent).toContain(cover.city);
    }
    expect(screen.getByTestId('login-cover-choice-tokyo').textContent).toContain('東京');
    expect(screen.getByTestId('login-cover-choice-kyushu').textContent).toContain('九州');

    const credits = screen.getByTestId('login-cover-credits-link');
    expect(credits.getAttribute('href')).toBe('/login-cover-credits.html');
    expect(credits.className).toContain('jr-btn-paper');
    expect(credits.className).toContain('min-h-11');
    const creditsHtml = readFileSync(path.resolve('public/login-cover-credits.html'), 'utf8');
    expect(creditsHtml).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(creditsHtml).toContain('手繪墨線');

    const kyoto = screen.getByTestId('login-cover-option-kyoto');
    kyoto.focus();
    expect(document.activeElement).toBe(kyoto);
    fireEvent.click(kyoto);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ loginCoverId: 'kyoto' });
    expect(onToast).toHaveBeenCalledWith('已套用登入封面');
    expect(screen.getByTestId('login-cover-status').textContent).toBe('已套用登入封面');
    expect(screen.getByTestId('login-cover-option-kyoto').checked).toBe(true);
    expect(screen.getByTestId('login-cover-selected-kyoto').textContent).toMatch(/✓\s*已選/);
    expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBeNull();
  });

  it('uses English copy and does not write the device mirror when account settings exist', async () => {
    await i18n.changeLanguage('en');
    const updateSettings = vi.fn();
    renderSettings({ updateSettings, uiLanguage: 'en', loginCoverId: 'osaka' });
    expect(screen.getByTestId('login-cover-section').textContent).toContain(
      'These four default covers are free.',
    );
    expect(screen.getByTestId('login-cover-option-osaka').checked).toBe(true);
    expect(screen.getByTestId('login-cover-selected-osaka').textContent).toContain('Selected');
    expect(screen.getByTestId('login-cover-choice-kyushu').textContent).toContain('Kyushu');
    expect(screen.getByTestId('login-cover-thumb-osaka').getAttribute('alt')).toMatch(/Osaka Castle/i);
    fireEvent.click(screen.getByTestId('login-cover-option-kyushu'));
    expect(updateSettings).toHaveBeenCalledWith({ loginCoverId: 'kyushu' });
    expect(screen.getByTestId('login-cover-status').textContent).toBe('Login cover saved');
    expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBeNull();
  });

  it('mirrors a selection only when there is no account updateSettings callback', () => {
    writeDeviceLoginCoverId('osaka');
    renderSettings();
    expect(screen.getByTestId('login-cover-option-osaka').checked).toBe(true);
    fireEvent.click(screen.getByTestId('login-cover-option-kyoto'));
    expect(localStorage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('kyoto');
    expect(screen.getByTestId('login-cover-option-kyoto').checked).toBe(true);
  });

  it('keeps the stored radio checked when a thumbnail fails and describes the tokyo image actually shown', async () => {
    await i18n.changeLanguage('zh-TW');
    const updateSettings = vi.fn();
    renderSettings({ updateSettings, loginCoverId: 'kyoto' });
    const kyotoAlt = i18n.t('auth.coverAlt.kyoto');
    const tokyoAlt = i18n.t('auth.coverAlt.tokyo');
    expect(screen.getByTestId('login-cover-thumb-kyoto').getAttribute('alt')).toBe(kyotoAlt);
    fireEvent.error(screen.getByTestId('login-cover-thumb-kyoto'));
    const fallen = screen.getByTestId('login-cover-thumb-kyoto');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-cover-option-kyoto').checked).toBe(true);
    expect(fallen.getAttribute('data-thumb-id')).toBe('tokyo');
    expect(fallen.getAttribute('src')).toBe(LOGIN_COVERS[0].src);
    expect(fallen.getAttribute('alt')).toBe(tokyoAlt);
    expect(fallen.getAttribute('alt')).toContain('東京鐵塔');
    expect(screen.getByTestId('login-cover-thumb-osaka').getAttribute('alt')).toBe(i18n.t('auth.coverAlt.osaka'));
  });

  it('groups native radios by name, leaves them focusable, and does not cancel Arrow or Space', async () => {
    // jsdom does not move radio selection on Arrow or Space. This test locks
    // the native contract only: one named group, each input focusable, and no
    // handler calling preventDefault. Browser key activation stays manual.
    await i18n.changeLanguage('zh-TW');
    renderSettings({ updateSettings: vi.fn(), loginCoverId: 'tokyo' });
    const group = screen.getByRole('radiogroup', { name: '登入封面' });
    const radios = [...group.querySelectorAll('input')];
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['tokyo', 'osaka', 'kyoto', 'kyushu']);
    expect(new Set(radios.map((radio) => radio.getAttribute('name')))).toEqual(new Set(['loginCoverId']));
    for (const radio of radios) {
      expect(radio.getAttribute('type')).toBe('radio');
      expect(radio.disabled).toBe(false);
      expect(radio.getAttribute('tabindex')).not.toBe('-1');
      radio.focus();
      expect(document.activeElement).toBe(radio);
    }

    const kyoto = screen.getByTestId('login-cover-option-kyoto');
    kyoto.focus();
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      kyoto.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(document.activeElement).toBe(kyoto);
    expect(screen.getByTestId('login-cover-option-tokyo').checked).toBe(true);
    expect(kyoto.checked).toBe(false);
  });

  it('keeps the authenticated mirror writer in AppContext and out of the notebook shell', () => {
    const app = readFileSync(path.resolve('src/store/AppContext.jsx'), 'utf8');
    const shell = readFileSync(path.resolve('src/notebook/NotebookShell.jsx'), 'utf8');
    const notebook = readFileSync(path.resolve('src/notebook/NotebookApp.jsx'), 'utf8');
    expect(app).toContain('writeDeviceLoginCoverId(settings.loginCoverId)');
    expect(shell).not.toContain('writeDeviceLoginCoverId');
    expect(notebook).not.toContain('writeDeviceLoginCoverId');
  });
});
