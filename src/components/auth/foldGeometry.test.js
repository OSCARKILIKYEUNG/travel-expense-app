import { describe, expect, it } from 'vitest';
import {
  FOLD_COMMIT_CLIENT_X,
  FOLD_COMMIT_T,
  FOLD_DRAG_START_X,
  FOLD_SPRING_MS,
  FOLD_CLOSE_MS,
  clientXForFoldProgress,
  computeFoldGeometry,
  fingerToFold,
  foldEndPoint,
  progress,
  restCrease,
  restFoldPoint,
  sampleOpenPose,
  shouldCommitFold,
  stepSpring,
  toFoldVelocity,
} from './foldGeometry';

function closeToPoint(actual, expected, eps = 0.6) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(eps);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(eps);
}

function hasPoint(poly, expected, eps = 0.75) {
  return poly.some((p) => Math.hypot(p.x - expected.x, p.y - expected.y) <= eps);
}

describe('foldGeometry', () => {
  it('rest fold point reproduces the dog-ear crease and matches the rounded offset', () => {
    const W = 360;
    const H = 656;
    const F0 = restFoldPoint(W, H);
    expect(F0.x).toBeCloseTo(W - 44.5, 0);
    expect(F0.y).toBeCloseTo(H - 51.4, 0);

    const { pb, pr } = restCrease(W, H);
    const fold = computeFoldGeometry({ W, H, Fx: F0.x, Fy: F0.y });
    const ends = [fold.creaseA, fold.creaseB];
    expect(ends.filter(Boolean)).toHaveLength(2);
    expect(hasPoint(ends, pb, 0.4)).toBe(true);
    expect(hasPoint(ends, pr, 0.4)).toBe(true);
    expect(fold.cutX).toBeCloseTo(14.46, 2);
    expect(fold.cutY).toBeCloseTo(6.84, 2);
    expect(hasPoint(fold.frontPoly, { x: 0, y: 0 })).toBe(true);
    expect(hasPoint(fold.frontPoly, pb, 0.4)).toBe(true);
    expect(hasPoint(fold.frontPoly, pr, 0.4)).toBe(true);
    expect(hasPoint(fold.frontPoly, { x: W, y: H }, 0.4)).toBe(false);
    expect(hasPoint(fold.foldedPoly, { x: W, y: H }, 0.4)).toBe(true);
    expect(fold.t).toBeGreaterThan(0);
    expect(fold.t).toBeLessThan(0.08);
  });

  it('places a vertical crease at x=(W+Fx)/2 when F moves straight left, and mirrors the flap', () => {
    const W = 200;
    const H = 120;
    const Fx = 40;
    const fold = computeFoldGeometry({ W, H, Fx, Fy: H });
    const creaseX = (W + Fx) / 2;
    expect(fold.creaseA.x).toBeCloseTo(creaseX, 4);
    expect(fold.creaseB.x).toBeCloseTo(creaseX, 4);
    expect(fold.normal.x).toBeCloseTo(-1, 5);
    expect(fold.normal.y).toBeCloseTo(0, 5);
    expect(fold.foldedPoly.length).toBeGreaterThanOrEqual(3);
    expect(fold.flapPoly).toHaveLength(fold.foldedPoly.length);
    fold.foldedPoly.forEach((p, i) => {
      const flap = fold.flapPoly[i];
      expect(flap.x).toBeCloseTo(2 * creaseX - p.x, 4);
      expect(flap.y).toBeCloseTo(p.y, 4);
    });
    expect(progress(W, Fx)).toBeCloseTo((W - Fx) / (2 * W), 6);
  });

  it('maps progress and returns an empty front once the crease has left the sheet', () => {
    const W = 480;
    const H = 656;
    expect(progress(W, W)).toBe(0);
    expect(progress(W, 0)).toBeCloseTo(0.5, 6);
    expect(progress(W, -1.1 * W)).toBe(1);
    expect(progress(W, -4 * W)).toBe(1);

    const open = computeFoldGeometry({ W, H, Fx: -1.1 * W, Fy: H });
    expect(open.t).toBe(1);
    expect(open.frontPoly.length).toBeLessThan(3);
    const creaseX = (W + -1.1 * W) / 2;
    expect(creaseX).toBeLessThanOrEqual(0);
    if (open.creaseA) expect(open.creaseA.x).toBeLessThanOrEqual(0.01);
    if (open.creaseB) expect(open.creaseB.x).toBeLessThanOrEqual(0.01);
  });

  it('returns no fold when the held point is within 1px of the corner', () => {
    const fold = computeFoldGeometry({ W: 200, H: 100, Fx: 200.4, Fy: 100.2 });
    expect(fold.flapPoly).toEqual([]);
    expect(fold.foldedPoly).toEqual([]);
    expect(fold.frontPoly).toHaveLength(4);
    expect(fold.creaseA).toBeNull();
  });

  it('maps the finger from F0 with gain and clamps', () => {
    const W = 480;
    const H = 656;
    const F0 = restFoldPoint(W, H);
    const moved = fingerToFold({ W, H, dx: -100, dy: 12 });
    expect(moved.x).toBeCloseTo(F0.x - 115, 5);
    expect(moved.y).toBeCloseTo(F0.y + 12, 5);

    const clamped = fingerToFold({ W, H, dx: -5000, dy: 5000 });
    expect(clamped.x).toBeCloseTo(-1.1 * W, 5);
    expect(clamped.y).toBeCloseTo(1.05 * H, 5);
    const clampedUp = fingerToFold({ W, H, dx: 0, dy: -5000 });
    expect(clampedUp.y).toBeCloseTo(0.15 * H, 5);
    expect(clampedUp.x).toBeLessThanOrEqual(W);
  });

  it('derives a commit clientX that reaches t>=0.46 from the jsdom fallback sheet', () => {
    const W = 480;
    const H = 656;
    const dx = FOLD_COMMIT_CLIENT_X - FOLD_DRAG_START_X;
    const pose = fingerToFold({ W, H, dx, dy: -40 });
    expect(progress(W, pose.x)).toBeGreaterThanOrEqual(FOLD_COMMIT_T);
    const short = fingerToFold({
      W,
      H,
      dx: FOLD_COMMIT_CLIENT_X + 40 - FOLD_DRAG_START_X,
      dy: 0,
    });
    expect(progress(W, short.x)).toBeLessThan(FOLD_COMMIT_T);
    expect(clientXForFoldProgress(0.5)).toBeLessThan(FOLD_COMMIT_CLIENT_X);
  });

  it('commits on t>=0.46 or a leftward fling at t>=0.2', () => {
    expect(shouldCommitFold({ t: 0.46, vx: 0 })).toBe(true);
    expect(shouldCommitFold({ t: 0.459, vx: 0 })).toBe(false);
    expect(shouldCommitFold({ t: 0.2, vx: -0.9 })).toBe(true);
    expect(shouldCommitFold({ t: 0.2, vx: -0.89 })).toBe(false);
    expect(shouldCommitFold({ t: 0.19, vx: -2 })).toBe(false);
  });

  it('opens to F_end and lifts the button arc above the chord', () => {
    const W = 400;
    const H = 600;
    const from = restFoldPoint(W, H);
    const start = sampleOpenPose({
      from,
      W,
      H,
      elapsedMs: 0,
      durationMs: 740,
      arc: true,
    });
    expect(start.pose.x).toBeCloseTo(from.x, 4);
    expect(start.pose.y).toBeCloseTo(from.y, 4);
    const end = sampleOpenPose({
      from,
      W,
      H,
      elapsedMs: 740,
      durationMs: 740,
      arc: true,
    });
    closeToPoint(end.pose, foldEndPoint(W, H), 0.01);
    expect(end.done).toBe(true);
    const mid = sampleOpenPose({
      from,
      W,
      H,
      elapsedMs: 370,
      durationMs: 740,
      arc: true,
    });
    const chordY = (from.y + H) / 2;
    expect(mid.pose.y).toBeLessThan(chordY);
  });

  it('springs back to rest within the settle window without running past it', () => {
    const W = 480;
    const H = 656;
    const target = restFoldPoint(W, H);
    let pos = fingerToFold({
      W,
      H,
      dx: clientXForFoldProgress(0.3) - FOLD_DRAG_START_X,
      dy: -30,
    });
    let vel = { x: -0.4, y: 0.05 };
    let minX = pos.x;
    for (let elapsed = 0; elapsed < FOLD_SPRING_MS; elapsed += 16) {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      pos = step.pos;
      vel = step.vel;
      if (pos.x < minX) minX = pos.x;
      expect(pos.x).toBeLessThanOrEqual(target.x + 3.01);
      if (step.settled) break;
    }
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(1.5);

    pos = foldEndPoint(W, H);
    vel = { x: 0, y: 0 };
    for (let elapsed = 0; elapsed < FOLD_CLOSE_MS; elapsed += 16) {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      pos = step.pos;
      vel = step.vel;
      expect(pos.x).toBeLessThanOrEqual(target.x + 3.01);
      if (step.settled) break;
    }
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(1.5);
  });

  it('springs from a finite pointer release velocity and stays finite until rest', () => {
    const W = 480;
    const H = 656;
    const target = restFoldPoint(W, H);
    let pos = fingerToFold({
      W,
      H,
      dx: clientXForFoldProgress(0.3) - FOLD_DRAG_START_X,
      dy: -20,
    });
    let vel = toFoldVelocity({ vx: -0.4, vy: 0.05 });
    expect(vel.x).toBeCloseTo(1.15 * -0.4, 6);
    expect(vel.y).toBeCloseTo(1 * 0.05, 6);
    let steps = 0;
    for (let elapsed = 0; elapsed < FOLD_SPRING_MS; elapsed += 16) {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      expect(Number.isFinite(step.pos.x)).toBe(true);
      expect(Number.isFinite(step.pos.y)).toBe(true);
      expect(Number.isFinite(step.vel.x)).toBe(true);
      expect(Number.isFinite(step.vel.y)).toBe(true);
      expect(Number.isFinite(progress(W, step.pos.x))).toBe(true);
      pos = step.pos;
      vel = step.vel;
      steps += 1;
      if (step.settled) break;
    }
    expect(steps).toBeGreaterThan(2);
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(1.5);
    expect(progress(W, pos.x)).toBeCloseTo(progress(W, target.x), 3);
  });

  it('treats NaN or undefined spring velocity as zero', () => {
    const target = restFoldPoint(480, 656);
    const pos = fingerToFold({ W: 480, H: 656, dx: -80, dy: 0 });
    const zero = stepSpring({ pos, vel: { x: 0, y: 0 }, target, dtMs: 16 });
    const cases = [
      { x: NaN, y: undefined },
      undefined,
      { vx: -1.2, vy: 0.4 },
      { x: undefined, y: NaN },
    ];
    cases.forEach((vel) => {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      expect(Number.isFinite(step.pos.x)).toBe(true);
      expect(Number.isFinite(step.pos.y)).toBe(true);
      expect(Number.isFinite(step.vel.x)).toBe(true);
      expect(Number.isFinite(step.vel.y)).toBe(true);
      expect(step.pos.x).toBeCloseTo(zero.pos.x, 5);
      expect(step.pos.y).toBeCloseTo(zero.pos.y, 5);
      expect(Number.isFinite(progress(480, step.pos.x))).toBe(true);
    });
    expect(toFoldVelocity(undefined)).toEqual({ x: 0, y: 0 });
    expect(toFoldVelocity({ vx: undefined, vy: NaN })).toEqual({ x: 0, y: 0 });
    expect(toFoldVelocity({ x: NaN, y: undefined })).toEqual({ x: 0, y: 0 });
  });

  it('never returns a non-finite progress, including a non-finite held point', () => {
    expect(progress(480, NaN)).toBe(0);
    expect(progress(480, undefined)).toBe(0);
    expect(progress(NaN, 10)).toBe(0);
    expect(progress(0, 10)).toBe(0);
    expect(progress(480, Infinity)).toBe(0);
    expect(Number.isFinite(progress(480, -100))).toBe(true);

    const W = 360;
    const H = 656;
    const rest = restFoldPoint(W, H);
    const fold = computeFoldGeometry({ W, H, Fx: NaN, Fy: undefined });
    expect(Number.isFinite(fold.t)).toBe(true);
    expect(fold.t).toBeCloseTo(progress(W, rest.x), 5);
    expect(fold.flapPoly.length).toBeGreaterThanOrEqual(3);
    expect(fold.frontPoly).not.toEqual([
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ]);
    expect(shouldCommitFold({ t: 0.3, vx: undefined })).toBe(false);
    expect(shouldCommitFold({ t: 0.3, vx: NaN })).toBe(false);
    expect(shouldCommitFold({ t: NaN, vx: -2 })).toBe(false);
  });

  it('continues a grab from the current pose instead of from rest', () => {
    const W = 480;
    const H = 656;
    const origin = { x: 300, y: 520 };
    const moved = fingerToFold({ W, H, dx: -7, dy: 4, origin });
    expect(moved.x).toBeCloseTo(origin.x + 1.15 * -7, 5);
    expect(moved.y).toBeCloseTo(origin.y + 1 * 4, 5);
    const fromRest = fingerToFold({ W, H, dx: -7, dy: 4 });
    expect(Math.hypot(moved.x - fromRest.x, moved.y - fromRest.y)).toBeGreaterThan(30);
  });
});
