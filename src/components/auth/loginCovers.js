import tokyoCoverSrc from '../../assets/login-covers/tokyo.webp';
import osakaCoverSrc from '../../assets/login-covers/osaka.webp';
import kyotoCoverSrc from '../../assets/login-covers/kyoto.webp';
import kamakuraCoverSrc from '../../assets/login-covers/kamakura.webp';

export const LOGIN_COVERS = [
  {
    id: 'tokyo',
    city: 'TOKYO',
    src: tokyoCoverSrc,
    alt: 'Oil-painting travel cover of Tokyo with Tokyo Tower',
  },
  {
    id: 'osaka',
    city: 'OSAKA',
    src: osakaCoverSrc,
    alt: 'Oil-painting travel cover of Osaka with Osaka Castle',
  },
  {
    id: 'kyoto',
    city: 'KYOTO',
    src: kyotoCoverSrc,
    alt: 'Oil-painting travel cover of Kyoto with Yasaka Pagoda',
  },
  {
    id: 'kamakura',
    city: 'KAMAKURA',
    src: kamakuraCoverSrc,
    alt: 'Oil-painting travel cover of Kamakura coastal railway',
  },
];

export const LOGIN_COVER_HEADLINE_MODES = ['html', 'painted'];
export const DEFAULT_LOGIN_COVER_HEADLINE = 'painted';

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
