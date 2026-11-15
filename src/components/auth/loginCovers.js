import tokyoCoverSrc from '../../assets/login-covers/default-tokyo.webp';
import osakaCoverSrc from '../../assets/login-covers/default-osaka.webp';
import kyotoCoverSrc from '../../assets/login-covers/default-kyoto.webp';
import kyushuCoverSrc from '../../assets/login-covers/default-kyushu.webp';
import {
  DEFAULT_LOGIN_COVER_ID,
  readDeviceLoginCoverId,
} from '../../utils/loginCoverPreference';

export const LOGIN_COVER_CREDITS_HREF = '/login-cover-credits.html';

export const LOGIN_COVERS = [
  {
    id: 'tokyo',
    city: 'TOKYO',
    src: tokyoCoverSrc,
    alt: 'Scenic ink login cover of Tokyo Tower and the connected low-rise streets around it',
    variant: 'scenic-ink',
    width: 720,
    height: 960,
  },
  {
    id: 'osaka',
    city: 'OSAKA',
    src: osakaCoverSrc,
    alt: 'Scenic ink login cover of Osaka Castle main keep and cherry blossoms',
    variant: 'scenic-ink',
    width: 720,
    height: 960,
  },
  {
    id: 'kyoto',
    city: 'KYOTO',
    src: kyotoCoverSrc,
    alt: 'Scenic ink login cover of the sloping Yasaka-dori street and Yasaka Pagoda',
    variant: 'scenic-ink',
    width: 720,
    height: 960,
  },
  {
    id: 'kyushu',
    city: 'KYUSHU',
    src: kyushuCoverSrc,
    alt: 'Scenic ink login cover of Aso grassland and volcanic hills in the Kyushu region',
    variant: 'scenic-ink',
    width: 720,
    height: 960,
  },
];

export const LOGIN_COVER_HEADLINE_MODES = ['html', 'painted'];
export const DEFAULT_LOGIN_COVER_HEADLINE = 'painted';

/**
 * Legacy uniform-bucket helper. Auth does not call this. A saved id from
 * resolveLoginCover always wins over any bucket this helper would return.
 */
export function pickLoginCover(random = Math.random) {
  const raw = typeof random === 'function' ? Number(random()) : Number(random);
  const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 0.999999999999)) : 0;
  const index = Math.min(
    LOGIN_COVERS.length - 1,
    Math.floor(normalized * LOGIN_COVERS.length),
  );
  return LOGIN_COVERS[index];
}

export function findLoginCover(id) {
  if (!id || typeof id !== 'string') return null;
  const normalized = id.trim().toLowerCase();
  return LOGIN_COVERS.find((cover) => cover.id === normalized) || null;
}

export function resolveLoginCover(id) {
  return findLoginCover(id) || LOGIN_COVERS[0];
}

/** Read the public device enum once. Caller (Auth) must not call this again on the same mount. */
export function resolveMountedLoginCover(readDeviceId = readDeviceLoginCoverId) {
  try {
    const raw = typeof readDeviceId === 'function' ? readDeviceId() : readDeviceId;
    return resolveLoginCover(raw);
  } catch {
    return resolveLoginCover(DEFAULT_LOGIN_COVER_ID);
  }
}
