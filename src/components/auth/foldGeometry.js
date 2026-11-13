/**
 * Flat paper-fold geometry for the login cover.
 * All coordinates are sheet pixels. Origin is the sheet top-left.
 * C = (W, H) is the page corner. F is where that corner is held.
 * Crease = perpendicular bisector of segment C–F.
 */

export const FINGER_GAIN_X = 1.15;
export const FINGER_GAIN_Y = 1;
export const FOLD_COMMIT_T = 0.46;
export const FOLD_FLING_T = 0.2;
export const FOLD_FLING_VX = -0.9;
export const FOLD_VELOCITY_WINDOW_MS = 80;
export const FOLD_SPRING_MS = 440;
export const FOLD_CLOSE_MS = 500;
export const FOLD_OPEN_COMMIT_MS = 600;
export const FOLD_OPEN_BUTTON_MS = 740;
/** Auth fallback timers stay at or above the longest settle. */
export const PAGE_TURN_DURATION_MS = 800;
export const PAGE_TURN_ABORT_DURATION_MS = 560;

export const FOLD_DRAG_START_X = 360;
export const FOLD_DRAG_START_Y = 640;

const REST_CUT_X = 0.1446;
const REST_CUT_Y = 0.0684;
const SPRING_K = 360;
const SPRING_C = 32;
const SPRING_MAX_PAST_PX = 3;

function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function finitePoint(point, fallback = { x: 0, y: 0 }) {
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    return { x: point.x, y: point.y };
  }
  if (fallback && Number.isFinite(fallback.x) && Number.isFinite(fallback.y)) {
    return { x: fallback.x, y: fallback.y };
  }
  return { x: 0, y: 0 };
}

export function progress(W, Fx) {
  const w = Number(W);
  if (!(w > 0)) return 0;
  const fx = Number(Fx);
  if (!Number.isFinite(fx)) return 0;
  const t = (w - fx) / (2 * w);
  if (!Number.isFinite(t) || t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function restCrease(W, H) {
  return {
    pb: { x: W * (1 - REST_CUT_X), y: H },
    pr: { x: W, y: H * (1 - REST_CUT_Y) },
  };
}

function reflectAcrossLine(P, A, B) {
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-8) return { x: P.x, y: P.y };
  const t = ((P.x - A.x) * vx + (P.y - A.y) * vy) / len2;
  return {
    x: 2 * (A.x + t * vx) - P.x,
    y: 2 * (A.y + t * vy) - P.y,
  };
}

export function restFoldPoint(W, H) {
  const { pb, pr } = restCrease(W, H);
  return reflectAcrossLine({ x: W, y: H }, pb, pr);
}

export function fingerToFold({ W, H, dx = 0, dy = 0, origin } = {}) {
  const w = Number(W) > 0 ? Number(W) : 0;
  const h = Number(H) > 0 ? Number(H) : 0;
  const rest = restFoldPoint(w, h);
  const base = finitePoint(origin, rest);
  const gdx = finiteOr(dx, 0);
  const gdy = finiteOr(dy, 0);
  let x = base.x + FINGER_GAIN_X * gdx;
  let y = base.y + FINGER_GAIN_Y * gdy;
  const minX = -1.1 * w;
  const maxX = w;
  const minY = 0.15 * h;
  const maxY = 1.05 * h;
  if (x < minX) x = minX;
  if (x > maxX) x = maxX;
  if (y < minY) y = minY;
  if (y > maxY) y = maxY;
  return { x, y };
}

/**
 * clientX that yields fold progress `t` when the pointer went down at startX
 * on the jsdom fallback sheet (or the provided W,H).
 */
export function clientXForFoldProgress(
  t,
  { startX = FOLD_DRAG_START_X, W = 480, H = 656 } = {},
) {
  const F0 = restFoldPoint(W, H);
  const clamped = Math.max(0, Math.min(1, Number(t) || 0));
  const targetFx = W * (1 - 2 * clamped);
  const dx = (targetFx - F0.x) / FINGER_GAIN_X;
  return startX + dx;
}

/** One pixel past the t=0.46 boundary so release commits on the 480×656 fallback sheet. */
export const FOLD_COMMIT_CLIENT_X = Math.floor(
  clientXForFoldProgress(FOLD_COMMIT_T) - 1,
);

export function shouldCommitFold({ t = 0, vx = 0 } = {}) {
  const progressT = Number.isFinite(t) ? t : 0;
  const speed = Number.isFinite(vx) ? vx : 0;
  return progressT >= FOLD_COMMIT_T || (speed <= FOLD_FLING_VX && progressT >= FOLD_FLING_T);
}

export function pointerVelocity(samples) {
  if (!samples || samples.length < 2) return { vx: 0, vy: 0 };
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dt = b.t - a.t;
  if (!(dt >= 8)) return { vx: 0, vy: 0 };
  const vx = (b.x - a.x) / dt;
  const vy = (b.y - a.y) / dt;
  return {
    vx: Number.isFinite(vx) ? vx : 0,
    vy: Number.isFinite(vy) ? vy : 0,
  };
}

/**
 * Pointer samples are `{vx, vy}` px/ms. The fold spring stores F velocity as
 * `{x, y}` px/ms, with the same finger gain as `fingerToFold`.
 * A non-finite component is 0. An `{x, y}` value is already in F units.
 */
export function toFoldVelocity(vel) {
  if (!vel || typeof vel !== 'object') return { x: 0, y: 0 };
  if ('vx' in vel || 'vy' in vel) {
    return {
      x: FINGER_GAIN_X * finiteOr(vel.vx, 0),
      y: FINGER_GAIN_Y * finiteOr(vel.vy, 0),
    };
  }
  return { x: finiteOr(vel.x, 0), y: finiteOr(vel.y, 0) };
}

export function pushVelocitySample(samples, point, now, windowMs = FOLD_VELOCITY_WINDOW_MS) {
  const next = samples ? samples.slice() : [];
  next.push({ t: now, x: point.x, y: point.y });
  const cutoff = now - windowMs;
  while (next.length && next[0].t < cutoff) next.shift();
  return next;
}

function dedupePoly(poly) {
  const out = [];
  for (const p of poly) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 0.02) out.push(p);
  }
  if (
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 0.02
  ) {
    out.pop();
  }
  return out;
}

function clipHalfPlane(subject, inside, intersect) {
  if (!subject || subject.length === 0) return [];
  const output = [];
  let prev = subject[subject.length - 1];
  let prevIn = inside(prev);
  for (let i = 0; i < subject.length; i += 1) {
    const curr = subject[i];
    const currIn = inside(curr);
    if (currIn) {
      if (!prevIn) output.push(intersect(prev, curr));
      output.push(curr);
    } else if (prevIn) {
      output.push(intersect(prev, curr));
    }
    prev = curr;
    prevIn = currIn;
  }
  return dedupePoly(output);
}

function lineRectHits(origin, direction, W, H) {
  const hits = [];
  const eps = 1e-6;
  const add = (t) => {
    if (!Number.isFinite(t)) return;
    const x = origin.x + t * direction.x;
    const y = origin.y + t * direction.y;
    if (x >= -eps && x <= W + eps && y >= -eps && y <= H + eps) {
      hits.push({
        x: Math.min(W, Math.max(0, x)),
        y: Math.min(H, Math.max(0, y)),
        t,
      });
    }
  };
  if (Math.abs(direction.x) > 1e-12) {
    add((0 - origin.x) / direction.x);
    add((W - origin.x) / direction.x);
  }
  if (Math.abs(direction.y) > 1e-12) {
    add((0 - origin.y) / direction.y);
    add((H - origin.y) / direction.y);
  }
  hits.sort((a, b) => a.t - b.t);
  const uniq = [];
  for (const hit of hits) {
    const prev = uniq[uniq.length - 1];
    if (!prev || Math.hypot(prev.x - hit.x, prev.y - hit.y) > 0.05) uniq.push(hit);
  }
  if (uniq.length >= 2) return [uniq[0], uniq[uniq.length - 1]];
  if (uniq.length === 1) return [uniq[0], uniq[0]];
  return [null, null];
}

function cutsFromCrease(creaseA, creaseB, W, H) {
  if (!creaseA || !creaseB || !(W > 0) || !(H > 0)) return { cutX: 0, cutY: 0 };
  const pts = [creaseA, creaseB];
  let bottom = pts[0];
  let right = pts[0];
  for (const p of pts) {
    if (Math.abs(p.y - H) < Math.abs(bottom.y - H)) bottom = p;
    if (Math.abs(p.x - W) < Math.abs(right.x - W)) right = p;
  }
  return {
    cutX: Number((((W - bottom.x) / W) * 100).toFixed(2)),
    cutY: Number((((H - right.y) / H) * 100).toFixed(2)),
  };
}

function noFold(W, H, t) {
  return {
    frontPoly: [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ],
    flapPoly: [],
    foldedPoly: [],
    creaseA: null,
    creaseB: null,
    normal: { x: 0, y: 0 },
    t,
    cutX: 0,
    cutY: 0,
  };
}

export function computeFoldGeometry({ W, H, Fx, Fy } = {}) {
  const w = Number(W) > 0 ? Number(W) : 480;
  const h = Number(H) > 0 ? Number(H) : 656;
  const C = { x: w, y: h };
  let fx = Number(Fx);
  let fy = Number(Fy);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
    const rest = restFoldPoint(w, h);
    fx = rest.x;
    fy = rest.y;
  }
  const F = { x: fx, y: fy };
  const t = progress(w, F.x);
  const dist = Math.hypot(F.x - C.x, F.y - C.y);
  if (!(dist >= 1) || !Number.isFinite(dist)) return noFold(w, h, t);

  const u = { x: (F.x - C.x) / dist, y: (F.y - C.y) / dist };
  const M = { x: (C.x + F.x) / 2, y: (C.y + F.y) / 2 };
  const sOf = (P) => (P.x - M.x) * u.x + (P.y - M.y) * u.y;
  const rect = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const eps = 1e-7;
  const intersect = (p, q) => {
    const sp = sOf(p);
    const sq = sOf(q);
    const denom = sp - sq;
    const k = Math.abs(denom) < 1e-12 ? 0 : sp / denom;
    return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
  };
  const frontPoly = clipHalfPlane(rect, (P) => sOf(P) >= -eps, intersect);
  const foldedPoly = clipHalfPlane(rect, (P) => sOf(P) <= eps, intersect);
  const reflect = (P) => {
    const s = sOf(P);
    return { x: P.x - 2 * s * u.x, y: P.y - 2 * s * u.y };
  };
  const flapPoly = foldedPoly.map(reflect);
  const [creaseA, creaseB] = lineRectHits(M, { x: -u.y, y: u.x }, w, h);
  const cuts = cutsFromCrease(creaseA, creaseB, w, h);
  return {
    frontPoly,
    flapPoly,
    foldedPoly,
    creaseA,
    creaseB,
    normal: u,
    t,
    cutX: cuts.cutX,
    cutY: cuts.cutY,
  };
}

function polyIsFinite(poly) {
  return (
    Array.isArray(poly) &&
    poly.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  );
}

export function polygonCss(poly) {
  if (!poly || poly.length < 3 || !polyIsFinite(poly)) {
    return 'polygon(0px 0px, 0px 0px, 0px 0px)';
  }
  return `polygon(${poly
    .map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`)
    .join(', ')})`;
}

export function pointsAttr(poly) {
  if (!poly || poly.length === 0 || !polyIsFinite(poly)) return '';
  return poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export function easeInOut(u) {
  const x = Math.max(0, Math.min(1, Number(u) || 0));
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

export function openDurationFor(t, arc) {
  if (arc) return FOLD_OPEN_BUTTON_MS;
  const remain = Math.max(0, 1 - Number(t || 0));
  const ref = 1 - FOLD_COMMIT_T;
  return Math.round(200 + (FOLD_OPEN_COMMIT_MS - 200) * Math.min(1, remain / ref));
}

export function foldEndPoint(W, H) {
  return { x: -1.1 * W, y: H };
}

export function sampleOpenPose({ from, W, H, elapsedMs, durationMs, arc = false }) {
  const duration = durationMs > 0 ? durationMs : 1;
  const u = Math.max(0, Math.min(1, elapsedMs / duration));
  const e = easeInOut(u);
  const end = foldEndPoint(W, H);
  let x = from.x + (end.x - from.x) * e;
  let y = from.y + (end.y - from.y) * e;
  if (arc) {
    const yLift = H - 0.18 * H;
    const chord = (from.y + end.y) / 2;
    y += Math.sin(Math.PI * e) * (yLift - chord);
  }
  const minY = 0.15 * H;
  const maxY = 1.05 * H;
  if (x < -1.1 * W) x = -1.1 * W;
  if (x > W) x = W;
  if (y < minY) y = minY;
  if (y > maxY) y = maxY;
  return { pose: { x, y }, done: u >= 1 };
}

function clampOvershoot(value, velocity, target) {
  const delta = value - target;
  if (Math.abs(delta) > SPRING_MAX_PAST_PX && Math.sign(velocity) === Math.sign(delta)) {
    return {
      value: target + Math.sign(delta) * SPRING_MAX_PAST_PX,
      velocity: 0,
    };
  }
  return { value, velocity };
}

/**
 * Damped spring. `vel.x` / `vel.y` are F px/ms (not pointer `{vx, vy}`).
 * Tiny overshoot (≤3px) is allowed; the pose cannot run away past the rest
 * target. Non-finite pose falls back to the target (or 0), non-finite
 * velocity to 0, so a bad sample cannot publish NaN.
 */
export function stepSpring({ pos, vel, target, dtMs } = {}) {
  const tx = finiteOr(target?.x, 0);
  const ty = finiteOr(target?.y, 0);
  const targetPoint = { x: tx, y: ty };
  let x = finiteOr(pos?.x, tx);
  let y = finiteOr(pos?.y, ty);
  let vxMs = finiteOr(vel?.x, 0);
  let vyMs = finiteOr(vel?.y, 0);
  const dt = Math.min(0.034, Math.max(0, finiteOr(dtMs, 0)) / 1000);
  if (!(dt > 0)) {
    return { pos: { x, y }, vel: { x: vxMs, y: vyMs }, settled: false };
  }
  let vx = vxMs * 1000;
  let vy = vyMs * 1000;
  const ax = -SPRING_K * (x - tx) - SPRING_C * vx;
  const ay = -SPRING_K * (y - ty) - SPRING_C * vy;
  vx += ax * dt;
  vy += ay * dt;
  x += vx * dt;
  y += vy * dt;
  const cx = clampOvershoot(x, vx, tx);
  const cy = clampOvershoot(y, vy, ty);
  x = cx.value;
  y = cy.value;
  vx = cx.velocity;
  vy = cy.velocity;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) {
    return { pos: targetPoint, vel: { x: 0, y: 0 }, settled: true };
  }
  const settled = Math.hypot(x - tx, y - ty) < 0.75 && Math.hypot(vx, vy) < 30;
  if (settled) {
    return { pos: targetPoint, vel: { x: 0, y: 0 }, settled: true };
  }
  return { pos: { x, y }, vel: { x: vx / 1000, y: vy / 1000 }, settled: false };
}
