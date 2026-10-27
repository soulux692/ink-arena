// Hand-drawn screen transitions: ink floods, brush wipes, paper tears, scribble fills.
import { mulberry32, wcircle, wline, splat, wpoly, Rand } from "./sketch";

const TAU = Math.PI * 2;
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

export type TransitionKind =
  | "blot" | "brush" | "scribble" | "tear" | "iris" | "flood" | "crack"
  | "pages" | "drip" | "shutter" | "halftone";

export const TRANSITION_KINDS: TransitionKind[] = ["blot", "brush", "scribble", "tear", "iris", "flood", "crack", "pages", "drip", "shutter", "halftone"];

export interface TransitionState {
  kind: TransitionKind;
  t: number;
  dur: number;
  seed: number;
  swapped: boolean;
  /** origin for radial kinds */
  ox: number;
  oy: number;
}

export function makeTransition(kind: TransitionKind, dur = 0.62, ox = 0.5, oy = 0.5): TransitionState {
  return {
    kind,
    t: 0,
    dur,
    seed: Math.floor(Math.random() * 1e6),
    swapped: false,
    ox,
    oy,
  };
}

/** progress 0..1 through the whole transition; coverage peaks at 0.5 */
export function coverage(t: number) {
  const x = Math.min(1, Math.max(0, t));
  // smooth in / smooth out, fully covered around the middle
  if (x < 0.5) return easeInOut(x * 2);
  return 1 - easeInOut((x - 0.5) * 2);
}

function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function drawTransition(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  st: TransitionState,
  time: number,
) {
  const p = st.t / st.dur;
  const cov = coverage(p);
  if (cov <= 0.001) return;
  const r = mulberry32(st.seed);
  const boil = Math.floor(time * 12);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (st.kind) {
    case "blot": {
      // many ink blots grow from the origin and merge into a flood
      const n = 26;
      const cx = st.ox * W;
      const cy = st.oy * H;
      const reach = Math.hypot(W, H) * 0.75;
      ctx.fillStyle = INK;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r() * 0.4;
        const d = r() * reach * 0.55;
        const x = cx + Math.cos(a) * d * cov;
        const y = cy + Math.sin(a) * d * cov;
        const size = (30 + r() * 130) * (0.35 + cov * 1.5);
        splat(ctx, x, y, size, mulberry32(st.seed + i * 31), 7);
      }
      // outer ring of droplets
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        const d = reach * (0.5 + cov * 0.6) * (0.5 + r() * 0.7);
        splat(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 10 + r() * 26, mulberry32(st.seed + i * 7), 3);
      }
      break;
    }
    case "brush": {
      // one huge brush stroke sweeps across, then peels back
      const dir = p < 0.5 ? 1 : -1;
      const prog = p < 0.5 ? cov : cov;
      ctx.fillStyle = INK;
      const band = H * 1.5;
      const x = dir > 0 ? -W * 0.4 + (W * 1.8) * (1 - prog) * -1 : W * 1.4 - W * 1.8 * (1 - prog);
      const edge = dir > 0 ? W * 1.8 * prog - W * 0.4 : W - (W * 1.8 * prog - W * 0.4);
      ctx.beginPath();
      ctx.moveTo(dir > 0 ? -10 : W + 10, -20);
      ctx.lineTo(edge, -20);
      for (let y = -20; y <= H + 20; y += 22) {
        const wob = Math.sin(y * 0.03 + time * 6) * 16 * (1 - prog * 0.3) + (mulberry32(boil + y)() - 0.5) * 18;
        ctx.lineTo(edge + wob, y);
      }
      ctx.lineTo(dir > 0 ? -10 : W + 10, H + 20);
      ctx.closePath();
      ctx.fill();
      // bristle texture on the leading edge
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.25 * prog;
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const y = r() * H;
        wline(ctx, edge + (r() - 0.5) * 40, y, edge + (r() - 0.5) * 90, y + (r() - 0.5) * 30, mulberry32(boil + i), 3);
      }
      ctx.globalAlpha = 1;
      void x;
      void band;
      break;
    }
    case "scribble": {
      // dense scribbles fill the page row by row
      ctx.strokeStyle = INK;
      const rows = 22;
      for (let i = 0; i < rows; i++) {
        const rowP = Math.max(0, Math.min(1, cov * rows - i));
        if (rowP <= 0) continue;
        const y = (i / rows) * H + 8;
        ctx.lineWidth = H / rows + 6;
        const rr = mulberry32(st.seed + i * 13 + boil);
        ctx.globalAlpha = Math.min(1, rowP * 1.4);
        ctx.beginPath();
        const steps = 26;
        for (let s = 0; s <= steps * rowP; s++) {
          const x = (s / steps) * W;
          const yy = y + Math.sin(s * 1.7 + i) * (H / rows) * 0.4 + (rr() - 0.5) * 5;
          if (s === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "tear": {
      // the page rips along a jagged line, halves slide away
      const rip = cov;
      const cx = W * 0.5;
      ctx.fillStyle = INK;
      // left half
      ctx.save();
      ctx.translate(-rip * W * 0.62, rip * 30);
      ctx.rotate(-rip * 0.05);
      drawTornHalf(ctx, W, H, cx, r, false);
      ctx.restore();
      // right half
      ctx.save();
      ctx.translate(rip * W * 0.62, -rip * 24);
      ctx.rotate(rip * 0.05);
      drawTornHalf(ctx, W, H, cx, mulberry32(st.seed + 999), true);
      ctx.restore();
      // paper scraps flying in the gap
      ctx.globalAlpha = 1 - rip * 0.2;
      for (let i = 0; i < 14; i++) {
        const a = r() * TAU;
        const d = rip * W * 0.5 * r();
        const x = cx + Math.cos(a) * d * 0.25;
        const y = H * 0.5 + Math.sin(a) * d;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + time * 3);
        wpoly(
          ctx,
          [
            [-6, -4],
            [7, -6],
            [5, 6],
            [-7, 3],
          ],
          mulberry32(st.seed + i),
          1.5,
        );
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "iris": {
      // a hand-drawn circle closes on the origin then opens
      const R = Math.hypot(W, H) * 0.62;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      const rr = R * (1 - cov);
      ctx.arc(st.ox * W, st.oy * H, Math.max(0.5, rr), 0, TAU, true);
      ctx.fill("evenodd");
      // rough ink rim
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      wcircle(ctx, st.ox * W, st.oy * H, Math.max(1, rr), mulberry32(st.seed + boil), 5, 2);
      ctx.lineWidth = 2;
      wcircle(ctx, st.ox * W, st.oy * H, Math.max(1, rr * 1.06), mulberry32(st.seed + boil + 5), 7, 1);
      break;
    }
    case "flood": {
      // ink floods up from the bottom with a wobbly surface
      const level = H * (1 - cov) + 10;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-10, H + 10);
      ctx.lineTo(-10, level);
      for (let x = -10; x <= W + 10; x += 16) {
        const y = level + Math.sin(x * 0.02 + time * 7) * 12 + Math.sin(x * 0.05 - time * 4) * 7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 10, H + 10);
      ctx.closePath();
      ctx.fill();
      // droplets above the surface
      for (let i = 0; i < 20; i++) {
        const x = r() * W;
        const y = level - 20 - r() * 120 * cov;
        splat(ctx, x, y, 4 + r() * 12, mulberry32(st.seed + i * 3), 2);
      }
      break;
    }
    case "crack": {
      // ink cracks spread from the origin, then the page goes black
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      const cx = st.ox * W;
      const cy = st.oy * H;
      const arms = 14;
      const maxLen = Math.hypot(W, H);
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * TAU + r() * 0.3;
        const rr = mulberry32(st.seed + i * 17 + boil);
        let x = cx;
        let y = cy;
        let ang = a;
        const segs = 9;
        ctx.lineWidth = 2 + (i % 3) * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < segs; s++) {
          const step = (maxLen / segs) * cov * (0.6 + rr() * 0.8);
          ang += (rr() - 0.5) * 0.7;
          x += Math.cos(ang) * step;
          y += Math.sin(ang) * step;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (cov > 0.55) {
        ctx.globalAlpha = (cov - 0.55) / 0.45;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      break;
    }
  }
  ctx.restore();
}

function drawTornHalf(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cx: number,
  r: Rand,
  right: boolean,
) {
  ctx.beginPath();
  if (right) {
    ctx.moveTo(cx, -20);
    for (let y = -20; y <= H + 20; y += 18) {
      ctx.lineTo(cx + (r() - 0.5) * 26, y);
    }
    ctx.lineTo(W + 20, H + 20);
    ctx.lineTo(W + 20, -20);
  } else {
    ctx.moveTo(cx, -20);
    for (let y = -20; y <= H + 20; y += 18) {
      ctx.lineTo(cx + (r() - 0.5) * 26, y);
    }
    ctx.lineTo(-20, H + 20);
    ctx.lineTo(-20, -20);
  }
  ctx.closePath();
  ctx.fill();
  // torn white edge
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let y = -20; y <= H + 20; y += 18) {
    const x = cx + (r() - 0.5) * 20;
    if (y === -20) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** small impact flourish drawn right where a transition starts (optional spice) */
export function drawImpactStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  seed: number,
) {
  const r = mulberry32(seed + Math.floor(time * 10));
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.sin(time * 3 + i) * 0.1;
    wline(ctx, Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, Math.cos(a) * size, Math.sin(a) * size, r, 2);
  }
  ctx.restore();
}
