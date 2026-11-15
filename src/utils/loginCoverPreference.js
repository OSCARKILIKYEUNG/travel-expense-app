/** Public login-cover ids. No images, auth, or account payloads. */

export const LOGIN_COVER_IDS = Object.freeze(['tokyo', 'osaka', 'kyoto', 'kyushu']);
export const DEFAULT_LOGIN_COVER_ID = 'tokyo';

/** Device mirror for signed-out Auth. Enum only — never a token, user id, or URL. */
export const DEVICE_LOGIN_COVER_KEY = 'travel_login_default_cover_v1';

export function normalizeLoginCoverId(value) {
  if (typeof value !== 'string') return DEFAULT_LOGIN_COVER_ID;
  const id = value.trim().toLowerCase();
  return LOGIN_COVER_IDS.includes(id) ? id : DEFAULT_LOGIN_COVER_ID;
}

function defaultStore() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readDeviceLoginCoverId(storage) {
  const store = storage === undefined ? defaultStore() : storage;
  try {
    if (!store || typeof store.getItem !== 'function') return DEFAULT_LOGIN_COVER_ID;
    return normalizeLoginCoverId(store.getItem(DEVICE_LOGIN_COVER_KEY));
  } catch {
    return DEFAULT_LOGIN_COVER_ID;
  }
}

export function writeDeviceLoginCoverId(value, storage) {
  const id = normalizeLoginCoverId(value);
  const store = storage === undefined ? defaultStore() : storage;
  try {
    if (store && typeof store.setItem === 'function') {
      store.setItem(DEVICE_LOGIN_COVER_KEY, id);
    }
  } catch {
    // A storage failure must not block login or Settings.
  }
  return id;
}
