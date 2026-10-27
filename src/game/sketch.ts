// Hand-drawn ("sketchy") drawing primitives for canvas.
// All shapes are drawn with slight random wobble seeded by a value so that
// the drawing "boils" like a pencil animation when the seed changes.

export type Rand = () => number;
const TAU = Math.PI * 2;

/** 0 = full detail, 1 = reduced, 2 = minimal. Set once per frame by the engine's quality governor. */
let LOD = 0;
export function setLod(n: number) {
  LOD = n;
}

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wline(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rand,
  rough = 1.5,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const segs = LOD ? Math.max(2, Math.min(4, Math.floor(len / 40))) : Math.max(2, Math.min(10, Math.floor(len / 22)));
  ctx.beginPath();
  ctx.moveTo(x1 + (r() - 0.5) * rough, y1 + (r() - 0.5) * rough);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const amp = i === segs ? rough : rough * 2;
    ctx.lineTo(px + (r() - 0.5) * amp, py + (r() - 0.5) * amp);
  }
  ctx.stroke();
}

export function wcircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  r: Rand,
  rough = 1.5,
  passes = 2,
) {
  const passCount = LOD ? 1 : passes;
  for (let p = 0; p < passCount; p++) {
    let steps = Math.min(56, Math.max(10, Math.floor(rad * 0.9)));
    if (LOD > 1) steps = Math.min(steps, 22);
    const start = r() * TAU;
    const phase = r() * TAU;
    const over = 1 + r() * 0.08;
    ctx.beginPath();
    for (let i = 0; i <= steps * over; i++) {
      const a = start + (i / steps) * TAU;
      const rr =
        rad * (1 + Math.sin(a * 3 + phase) * 0.025 + Math.sin(a * 5 + phase * 2) * 0.015) +
        (r() - 0.5) * rough;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

export function wpoly(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  r: Rand,
  rough = 1.5,
  close = true,
) {
  const n = pts.length;
  const count = close ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    wline(ctx, a[0], a[1], b[0], b[1], r, rough);
  }
}

export function wrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Rand,
  rough = 1.5,
) {
  wpoly(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    r,
    rough,
  );
}

// Parallel hatching inside a circle
export function hatchCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  angle: number,
  spacing: number,
  r: Rand,
  rough = 1,
) {
  // thinner hatching when the frame budget is tight (the clip + dozens of lines is costly)
  if (LOD > 1) return; // minimal detail: skip clipped hatching entirely
  if (LOD) spacing *= 1 + LOD * 0.75;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(angle);
  for (let d = -rad; d <= rad; d += spacing) {
    const half = Math.sqrt(Math.max(0, rad * rad - d * d));
    wline(ctx, -half - 2, d, half + 2, d, r, rough);
  }
  ctx.restore();
}

// Fast zig-zag scribble inside a circle
export function scribbleCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  r: Rand,
  density = 10,
) {
  if (LOD) density = Math.ceil(density / 2);
  ctx.beginPath();
  let a = r() * TAU;
  ctx.moveTo(x + Math.cos(a) * rad * 0.8, y + Math.sin(a) * rad * 0.8);
  for (let i = 0; i < density; i++) {
    a += Math.PI * (0.7 + r() * 0.6);
    const rr = rad * (0.3 + r() * 0.65);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.stroke();
}

// Filled irregular ink blob
export function splat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  r: Rand,
  droplets = 5,
) {
  if (LOD) droplets = Math.min(droplets, 2);
  const n = 10 + Math.floor(r() * 6);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = size * (0.55 + r() * 0.7);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < droplets; i++) {
    const a = r() * TAU;
    const d = size * (1 + r() * 1.3);
    const s = size * (0.08 + r() * 0.2);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, TAU);
    ctx.fill();
  }
}

export function wstar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  points: number,
  rot: number,
  r: Rand,
  rough = 1.5,
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * TAU;
    const rr = i % 2 === 0 ? outer : inner;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  wpoly(ctx, pts, r, rough);
}

export function wheart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  r: Rand,
  fill: boolean,
) {
  const pts: [number, number][] = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x + (hx * s) / 16 + (r() - 0.5) * 1.2, y + (hy * s) / 16 + (r() - 0.5) * 1.2]);
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.closePath();
  if (fill) ctx.fill();
  ctx.stroke();
}

// Jagged lightning / energy beam between two points
export function lightning(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rand,
  amp = 10,
  branches = 4,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(4, Math.floor(len / 40));
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = i === 0 || i === steps ? 0 : (r() - 0.5) * amp * 2;
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.stroke();
  // short side branches
  for (let i = 0; i < branches; i++) {
    if (steps < 2) break;
    const idx = 1 + Math.floor(r() * (steps - 1));
    const p = pts[idx];
    const a = Math.atan2(dy, dx) + (r() - 0.5) * 2.2;
    const bl = 10 + r() * amp * 3;
    wline(ctx, p[0], p[1], p[0] + Math.cos(a) * bl, p[1] + Math.sin(a) * bl, r, 2);
  }
}

// Rough spiral doodle (for smoke / ink swirls)
export function spiral(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  rot: number,
  turns: number,
  r: Rand,
) {
  const steps = Math.max(12, Math.floor(turns * 14));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = rot + t * turns * TAU;
    const rr = rad * t;
    const px = x + Math.cos(a) * rr + (r() - 0.5) * 1.2;
    const py = y + Math.sin(a) * rr + (r() - 0.5) * 1.2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

// Burst of short radial lines (muzzle flash / impact)
export function burst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rInner: number,
  rOuter: number,
  count: number,
  r: Rand,
  baseAngle = 0,
) {
  for (let i = 0; i < count; i++) {
    const a = baseAngle + (i / count) * TAU + (r() - 0.5) * 0.4;
    const ro = rOuter * (0.6 + r() * 0.6);
    wline(
      ctx,
      x + Math.cos(a) * rInner,
      y + Math.sin(a) * rInner,
      x + Math.cos(a) * ro,
      y + Math.sin(a) * ro,
      r,
      1,
    );
  }
}
