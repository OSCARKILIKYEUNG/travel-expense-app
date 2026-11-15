import { describe, expect, it } from 'vitest';
import {
  FOLD_COMMIT_CLIENT_X,
  FOLD_COMMIT_T,
  FOLD_DRAG_START_X,
  FOLD_SPRING_MS,
  FOLD_CLOSE_MS,
  cancelReleaseVelocity,
  clientXForFoldProgress,
  clampToBoundSpine,
  computeFoldGeometry,
  fingerToFold,
  foldGrabParts,
  foldEndPoint,
  isManualFullEnd,
  MANUAL_VIEWPORT_INSET_PX,
  manualReachForPointer,
  mapManualFold,
  SPINE_GUTTER_PX,
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
    const upR2 = clampedUp.x * clampedUp.x + (clampedUp.y - H) * (clampedUp.y - H);
    expect(upR2).toBeLessThanOrEqual(W * W + 1e-6);
    expect(clampedUp.y).toBeGreaterThan(0.15 * H);
    expect(clampedUp.x).toBeLessThanOrEqual(W);
    expect(clampedUp.x).toBeGreaterThan(0);
  });

  it('keeps the legacy fingerToFold clientX at t>=0.46, which is not the live release rule', () => {
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

  it('does not commit on the old t>=0.46 line or a leftward fling', () => {
    expect(shouldCommitFold({ t: 0.46, vx: 0 })).toBe(false);
    expect(shouldCommitFold({ t: 1, vx: 0 })).toBe(false);
    expect(shouldCommitFold({ t: 0.2, vx: -0.9 })).toBe(false);
    expect(shouldCommitFold({ t: 0.2, vx: -2 })).toBe(false);
    expect(shouldCommitFold({ t: 0.19, vx: -4 })).toBe(false);
    expect(cancelReleaseVelocity({ vx: -1.4, vy: 0.2 }).x).toBe(0);
    expect(cancelReleaseVelocity({ x: 0.4, y: -0.1 }).x).toBeCloseTo(0.4, 5);
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

  it('settles a mid-open release and a full close before the caps with at most 3px overshoot', () => {
    const W = 480;
    const H = 656;
    const target = restFoldPoint(W, H);
    const start = fingerToFold({
      W,
      H,
      dx: clientXForFoldProgress(0.32) - FOLD_DRAG_START_X,
      dy: -20,
    });
    let pos = start;
    let vel = toFoldVelocity({ vx: -0.35, vy: 0.04 });
    let settledAt = null;
    for (let elapsed = 16; elapsed <= FOLD_SPRING_MS; elapsed += 16) {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      expect(Number.isFinite(step.pos.x)).toBe(true);
      expect(Number.isFinite(step.pos.y)).toBe(true);
      expect(Number.isFinite(step.vel.x)).toBe(true);
      expect(Number.isFinite(step.vel.y)).toBe(true);
      expect(step.pos.x).toBeLessThanOrEqual(target.x + 3.01);
      if (start.y <= target.y) {
        expect(step.pos.y).toBeLessThanOrEqual(target.y + 3.01);
      } else {
        expect(step.pos.y).toBeGreaterThanOrEqual(target.y - 3.01);
      }
      pos = step.pos;
      vel = step.vel;
      if (step.settled) {
        settledAt = elapsed;
        break;
      }
    }
    expect(settledAt).not.toBeNull();
    expect(settledAt).toBeLessThanOrEqual(FOLD_SPRING_MS - 48);
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(0.8);

    const closeStart = foldEndPoint(W, H);
    pos = closeStart;
    vel = { x: 0, y: 0 };
    settledAt = null;
    for (let elapsed = 16; elapsed <= FOLD_CLOSE_MS; elapsed += 16) {
      const step = stepSpring({ pos, vel, target, dtMs: 16 });
      expect(Number.isFinite(step.pos.x)).toBe(true);
      expect(step.pos.x).toBeLessThanOrEqual(target.x + 3.01);
      expect(step.pos.y).toBeGreaterThanOrEqual(Math.min(closeStart.y, target.y) - 3.01);
      expect(step.pos.y).toBeLessThanOrEqual(Math.max(closeStart.y, target.y) + 3.01);
      pos = step.pos;
      vel = step.vel;
      if (step.settled) {
        settledAt = elapsed;
        break;
      }
    }
    expect(settledAt).not.toBeNull();
    expect(settledAt).toBeLessThanOrEqual(FOLD_CLOSE_MS - 48);
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(0.8);
  });

  it('covers the flap, the finger pad, and the resting handle corner in the grab hit', () => {
    const W = 480;
    const H = 656;
    const pose = fingerToFold({
      W,
      H,
      dx: clientXForFoldProgress(0.34) - FOLD_DRAG_START_X,
      dy: -16,
    });
    const fold = computeFoldGeometry({ W, H, Fx: pose.x, Fy: pose.y });
    const grab = foldGrabParts({ W, H, fold, Fx: pose.x, Fy: pose.y });
    expect(grab.flap.length).toBeGreaterThanOrEqual(3);
    expect(grab.creaseBand).toHaveLength(4);
    expect(grab.pad).toHaveLength(4);
    expect(pose.x).toBeGreaterThan(grab.pad[0].x);
    expect(pose.x).toBeLessThan(grab.pad[1].x);
    expect(pose.y).toBeGreaterThan(grab.pad[0].y);
    expect(pose.y).toBeLessThan(grab.pad[2].y);
    expect(grab.handle).toHaveLength(4);
    expect(W - 8).toBeGreaterThan(grab.handle[0].x);
    expect(H - 8).toBeGreaterThan(grab.handle[0].y);
    expect(grab.handle[2]).toEqual({ x: W, y: H });
    expect(foldGrabParts({ W, H, fold: null, Fx: pose.x, Fy: pose.y }).flap).toEqual([]);
  });
it('keeps the left spine bound and never starts a peel from the left', () => {
    const W = 390;
    const H = 656;
    const pointIn = (x, y, poly) => {
      let n = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i];
        const b = poly[j];
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-12) + a.x) {
          n += 1;
        }
      }
      return n % 2 === 1;
    };
    const leftEdgeLifted = (fold) => {
      const folded = fold.foldedPoly || [];
      if (folded.length < 3) return false;
      // The crease may touch the spine foot (0, H). That is the legal
      // bound, not a lift. Sample the open left edge above that corner.
      for (let i = 0; i < 20; i += 1) {
        if (pointIn(0.25, (H * 0.98 * i) / 19, folded)) return true;
      }
      return false;
    };

    const rest = restFoldPoint(W, H);
    const restR2 = rest.x * rest.x + (rest.y - H) * (rest.y - H);
    expect(restR2).toBeLessThanOrEqual(W * W + 1e-6);
    expect(leftEdgeLifted(computeFoldGeometry({ W, H, Fx: rest.x, Fy: rest.y }))).toBe(false);

    // A raw upward / horizontal-crease pose is clamped back onto the spine circle.
    const raw = { x: W, y: 0.15 * H };
    const clamped = clampToBoundSpine(raw.x, raw.y, W, H);
    expect(clamped.x * clamped.x + (clamped.y - H) * (clamped.y - H)).toBeLessThanOrEqual(W * W + 1e-6);
    expect(leftEdgeLifted(computeFoldGeometry({ W, H, Fx: raw.x, Fy: raw.y }))).toBe(false);

    const up = fingerToFold({ W, H, dx: 0, dy: -800 });
    expect(up.x * up.x + (up.y - H) * (up.y - H)).toBeLessThanOrEqual(W * W + 1e-6);
    expect(leftEdgeLifted(computeFoldGeometry({ W, H, Fx: up.x, Fy: up.y }))).toBe(false);

    for (let fx = -1.1 * W; fx <= W; fx += W / 10) {
      for (let fy = 0.15 * H; fy <= 1.05 * H; fy += H / 8) {
        const fold = computeFoldGeometry({ W, H, Fx: fx, Fy: fy });
        const lifted = leftEdgeLifted(fold);
        if (fold.t >= 0.98 || clampToBoundSpine(fx, fy, W, H).x <= -W + 0.5) {
          continue;
        }
        expect(lifted, `spine lift at F=(${fx.toFixed(1)},${fy.toFixed(1)}) t=${fold.t}`).toBe(false);
      }
    }

    const end = foldEndPoint(W, H);
    expect(end.x).toBeCloseTo(-1.1 * W, 5);
    const opened = sampleOpenPose({
      from: rest,
      W,
      H,
      elapsedMs: 800,
      durationMs: 800,
      arc: false,
    });
    expect(opened.done).toBe(true);
    expect(opened.pose.x).toBeCloseTo(-1.1 * W, 5);

    const mid = fingerToFold({
      W,
      H,
      dx: clientXForFoldProgress(0.34) - FOLD_DRAG_START_X,
      dy: -16,
    });
    const grab = foldGrabParts({
      W,
      H,
      fold: computeFoldGeometry({ W, H, Fx: mid.x, Fy: mid.y }),
      Fx: mid.x,
      Fy: mid.y,
    });
    expect(grab.flap.length).toBeGreaterThanOrEqual(3);
    for (const p of [...grab.creaseBand, ...grab.pad]) {
      expect(p.x).toBeGreaterThanOrEqual(SPINE_GUTTER_PX - 0.05);
    }
  });

  it('maps a 320 and 390 on-screen span onto the real end, and keeps that path reversible', () => {
    const cases = [
      { vw: 320, vh: 640, W: 304, H: 600, startX: 296, startY: 584 },
      { vw: 390, vh: 844, W: 370, H: 800, startX: 360, startY: 780 },
    ];
    cases.forEach(({ vw, vh, W, H, startX, startY }) => {
      const reach = manualReachForPointer({
        startX,
        startY,
        viewportWidth: vw,
        viewportHeight: vh,
      });
      expect(MANUAL_VIEWPORT_INSET_PX).toBeGreaterThanOrEqual(24);
      expect(reach.targetX).toBeGreaterThanOrEqual(MANUAL_VIEWPORT_INSET_PX);
      expect(reach.targetX).toBeLessThan(vw);
      expect(reach.spanX).toBeGreaterThan(40);
      expect(startY).toBeGreaterThanOrEqual(0);
      expect(startY).toBeLessThan(vh);
      const endPointerX = reach.targetX;
      const endPointerY = Math.min(vh - 1, Math.max(0, startY));
      expect(endPointerY).toBeLessThan(vh);

      const still = mapManualFold({ W, H, dx: 0, dy: 0, reach });
      const rest = restFoldPoint(W, H);
      closeToPoint(still, rest, 0.05);
      expect(isManualFullEnd(still, W, H)).toBe(false);

      const old = fingerToFold({ W, H, dx: endPointerX - startX, dy: 0 });
      expect(isManualFullEnd(old, W, H)).toBe(false);
      expect(old.x).toBeGreaterThan(foldEndPoint(W, H).x + 20);

      let prev = still;
      for (let step = 1; step <= 8; step += 1) {
        const u = step / 8;
        const clientX = startX + (endPointerX - startX) * u;
        const clientY = startY + (endPointerY - startY) * u;
        expect(clientX).toBeGreaterThanOrEqual(0);
        expect(clientX).toBeLessThan(vw);
        expect(clientY).toBeGreaterThanOrEqual(0);
        expect(clientY).toBeLessThan(vh);
        const pose = mapManualFold({
          W,
          H,
          dx: clientX - startX,
          dy: clientY - startY,
          reach,
        });
        const clamped = clampToBoundSpine(pose.x, pose.y, W, H);
        expect(clamped.x).toBeCloseTo(pose.x, 4);
        expect(clamped.y).toBeCloseTo(pose.y, 4);
        expect(pose.x).toBeLessThan(prev.x - 1);
        prev = pose;
      }
      const endPose = mapManualFold({
        W,
        H,
        dx: endPointerX - startX,
        dy: endPointerY - startY,
        reach,
      });
      closeToPoint(endPose, foldEndPoint(W, H), 0.05);
      expect(isManualFullEnd(endPose, W, H)).toBe(true);
      expect(shouldCommitFold({ t: 0.46, vx: -2, pose: endPose, W, H })).toBe(true);

      const midDx = (endPointerX - startX) * 0.45;
      const flat = mapManualFold({ W, H, dx: midDx, dy: 0, reach });
      const raised = mapManualFold({ W, H, dx: midDx, dy: -48, reach });
      expect(isManualFullEnd(raised, W, H)).toBe(false);
      expect(Math.abs(raised.y - flat.y)).toBeGreaterThan(8);
      expect(raised.x).toBeGreaterThanOrEqual(flat.x - 0.02);
      const raisedEnd = mapManualFold({
        W,
        H,
        dx: endPointerX - startX,
        dy: -48,
        reach,
      });
      closeToPoint(raisedEnd, foldEndPoint(W, H), 0.05);
      const raisedClamp = clampToBoundSpine(raised.x, raised.y, W, H);
      expect(raisedClamp.x).toBeCloseTo(raised.x, 4);
      expect(raisedClamp.y).toBeCloseTo(raised.y, 4);
      expect(raised.x).toBeGreaterThan(foldEndPoint(W, H).x + 20);

      const backed = mapManualFold({
        W,
        H,
        dx: (endPointerX - startX) * 0.72,
        dy: 0,
        reach,
      });
      expect(isManualFullEnd(backed, W, H)).toBe(false);
      expect(backed.x).toBeGreaterThan(endPose.x + 10);
      expect(progress(W, backed.x)).toBeGreaterThan(0.2);

      const held = mapManualFold({
        W,
        H,
        dx: endPointerX - startX,
        dy: endPointerY - startY,
        origin: endPose,
        reach,
      });
      closeToPoint(held, endPose, 0.05);
    });
  });

  it('lands on foldEndPoint after a mid-close re-grab, including vertical input', () => {
    const W = 350;
    const H = 600;
    const reach = manualReachForPointer({
      startX: 350,
      startY: 580,
      viewportWidth: 390,
      viewportHeight: 700,
    });
    expect(reach.targetX).toBeGreaterThanOrEqual(MANUAL_VIEWPORT_INSET_PX);
    const opened = mapManualFold({
      W,
      H,
      dx: -120,
      dy: -80,
      reach,
    });
    expect(isManualFullEnd(opened, W, H)).toBe(false);
    const vel = cancelReleaseVelocity({ vx: -1, vy: -0.8 });
    expect(vel.x).toBe(0);
    const sprung = stepSpring({
      pos: opened,
      vel,
      target: restFoldPoint(W, H),
      dtMs: 32,
    });
    expect(isManualFullEnd(sprung.pos, W, H)).toBe(false);
    const regrab = manualReachForPointer({
      startX: 250,
      startY: 500,
      viewportWidth: 390,
      viewportHeight: 700,
    });
    expect(regrab.targetX).toBeGreaterThanOrEqual(24);
    expect(regrab.spanX).toBe(250 - regrab.targetX);
    const still = mapManualFold({
      W,
      H,
      dx: 0,
      dy: 0,
      origin: sprung.pos,
      reach: regrab,
    });
    expect(still.x).toBeCloseTo(sprung.pos.x, 5);
    expect(still.y).toBeCloseTo(sprung.pos.y, 5);

    const partial = mapManualFold({
      W,
      H,
      dx: -regrab.spanX * 0.4,
      dy: -80,
      origin: sprung.pos,
      reach: regrab,
    });
    const partialFlat = mapManualFold({
      W,
      H,
      dx: -regrab.spanX * 0.4,
      dy: 0,
      origin: sprung.pos,
      reach: regrab,
    });
    expect(isManualFullEnd(partial, W, H)).toBe(false);
    expect(partial.x).toBeGreaterThan(foldEndPoint(W, H).x + 20);
    expect(partial.x).toBeGreaterThanOrEqual(partialFlat.x - 0.02);
    expect(Math.abs(partial.y - partialFlat.y)).toBeGreaterThan(1);
    const partialClamp = clampToBoundSpine(partial.x, partial.y, W, H);
    expect(partialClamp.x).toBeCloseTo(partial.x, 4);
    expect(partialClamp.y).toBeCloseTo(partial.y, 4);

    const endPose = mapManualFold({
      W,
      H,
      dx: -regrab.spanX,
      dy: -40,
      origin: sprung.pos,
      reach: regrab,
    });
    expect(endPose.x).toBeCloseTo(-1.1 * W, 5);
    expect(endPose.y).toBeCloseTo(H, 5);
    expect(isManualFullEnd(endPose, W, H)).toBe(true);
    expect(shouldCommitFold({ t: 0.46, vx: -2, pose: endPose, W, H })).toBe(true);
    expect(shouldCommitFold({ t: 0.46, vx: -2, pose: partial, W, H })).toBe(false);
  });
});

