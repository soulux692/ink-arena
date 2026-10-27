// Hand-drawn monster models. Everything here is pure rendering: ink lines, halftone
// shading and secondary motion, with damage states that appear as the monster dies.
import {
  mulberry32,
  type Rand,
  wline,
  wcircle,
  burst,
  lightning,
} from "./sketch";

const TAU = Math.PI * 2;
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

export interface ArtOpts {
  t: number;
  px: number;
  py: number;
  lod: number;
  boil: number;
}

export interface BossArt {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  phase: number;
  angle: number;
  flash: number;
  bob: number;
  t: number;
  state: "intro" | "fight" | "transition" | "dying" | "finale";
  attack: string | null;
  telegraph: number;
}

/* ------------------------------------------------------------------ helpers */

/** glossy filled ink mass with a soft halftone halo around it */
function inkHalo(ctx: CanvasRenderingContext2D, R: number, t: number, lod: number, dots = 46) {
  if (lod > 1) return;
  ctx.save();
  ctx.fillStyle = INK;
  const n = lod ? Math.floor(dots / 2) : dots;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.12;
    const k = (i % 6) / 6;
    const rad = R * (1.08 + k * 0.4);
    ctx.globalAlpha = 0.3 - k * 0.25;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad * 0.9, 1.1 + (1 - k) * 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function glossClip(ctx: CanvasRenderingContext2D, R: number, strength = 0.42, rings = 4, lod = 0) {
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = PAPER;
  const count = lod ? 2 : rings;
  for (let ring = 0; ring < count; ring++) {
    const rad = R * (0.16 + ring * 0.16);
    const cnt = 8 + ring * 6;
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU + ring * 0.6;
      const x = -R * 0.3 + Math.cos(a) * rad * 0.85;
      const y = -R * 0.34 + Math.sin(a) * rad * 0.85;
      const d = Math.hypot(x + R * 0.3, y + R * 0.34) / (R * 0.95);
      ctx.globalAlpha = Math.max(0, strength - d * strength * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, 1.8 - d * 1.2), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** an eye that follows the player, with an optional lid for anger */
function trackEye(
  ctx: CanvasRenderingContext2D,
  r: Rand,
  x: number,
  y: number,
  R: number,
  o: ArtOpts,
  bx: number,
  by: number,
  mode: "round" | "angry" | "wide" | "squint" = "round",
) {
  const a = Math.atan2(o.py - by, o.px - bx);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, R * 0.22);
  wcircle(ctx, x, y, R, r, 0.8, o.lod ? 1 : 2);
  const px = x + Math.cos(a) * R * 0.3;
  const py = y + Math.sin(a) * R * 0.3;
  ctx.fillStyle = INK;
  if (mode === "squint") {
    ctx.fillRect(x - R * 0.6, py - R * 0.18, R * 1.2, R * 0.36);
  } else {
    ctx.beginPath();
    ctx.arc(px, py, mode === "wide" ? R * 0.56 : R * 0.46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(px - R * 0.22, py - R * 0.24, R * 0.16, 0, TAU);
    ctx.fill();
  }
  if (mode === "angry") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.6, R * 0.3);
    wline(ctx, x - R * 1.1, y - R * 1.15, x + R * 0.5, y - R * 0.62, r, 0.6);
  }
}

/* ------------------------------------------------------------------ bosses */

function bossFrame(ctx: CanvasRenderingContext2D, b: BossArt, boil: number) {
  const r = mulberry32(boil * 2 + 17);
  const dying = b.state === "dying";
  const trans = b.state === "transition";
  const alpha = dying ? 0.6 + Math.sin(b.t * 28) * 0.35 : trans ? 0.8 + Math.sin(b.t * 18) * 0.2 : 1;
  ctx.save();
  ctx.translate(b.x, b.y + Math.sin(b.bob * 2) * 3);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.globalAlpha = alpha * 0.22;
  ctx.beginPath();
  ctx.ellipse(5, b.r * 0.76, b.r * 0.98, b.r * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha;
  if (b.phase >= 1) {
    ctx.save();
    ctx.globalAlpha = alpha * (0.2 + b.phase * 0.13);
    ctx.lineWidth = 2;
    for (let i = 0; i < b.phase + 1; i++) {
      wcircle(ctx, 0, 0, b.r + 17 + i * 10 + Math.sin(b.t * 3 + i) * 3, mulberry32(boil + i * 4), 3, 1);
    }
    ctx.restore();
  }
  return { r, alpha, dying, trans };
}

function bossFinish(ctx: CanvasRenderingContext2D, b: BossArt, f: ReturnType<typeof bossFrame>, boil: number) {
  const { r, alpha, dying, trans } = f;
  if (trans || dying) {
    ctx.globalAlpha = alpha * 0.7;
    ctx.lineWidth = 3;
    burst(ctx, 0, 0, b.r + 6, b.r + 28 + Math.sin(b.t * 20) * 8, 18, r);
    ctx.globalAlpha = alpha * 0.4;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) wcircle(ctx, 0, 0, b.r + 12 + i * 8, mulberry32(Math.floor(b.t * 20) + i), 4, 1);
  }
  if (b.flash > 0) {
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, b.r + 4, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.restore();
  void boil;
}

/** ВСЕВИДЯЩЕЕ ОКО — a lidless eye on a stalk of scribbled nerves */
export function drawEyeBoss(ctx: CanvasRenderingContext2D, b: BossArt, o: ArtOpts, boil: number) {
  const f = bossFrame(ctx, b, boil);
  const { r, alpha } = f;
  const R = b.r;
  const look = Math.atan2(o.py - b.y, o.px - b.x);
  const blinkT = (b.t + 1.7) % 4.6;
  const blink = blinkT < 0.16 ? 0.1 : 1;

  // optic nerves rooting it to the page
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.15 + (i / 5) * Math.PI * 0.7;
    const x1 = Math.cos(a) * R * 0.85;
    const y1 = Math.sin(a) * R * 0.85;
    const x2 = Math.cos(a + Math.sin(b.t * 1.6 + i) * 0.2) * (R + 70);
    const y2 = Math.sin(a + Math.sin(b.t * 1.6 + i) * 0.2) * (R + 70);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + Math.sin(b.t * 3 + i) * 14, (y1 + y2) / 2 + 18, x2, y2);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x2, y2, 3.6, 0, TAU);
    ctx.fill();
  }
  // lashes that whip while an attack winds up
  const agitated = !!b.attack;
  const lashN = b.phase >= 2 ? 20 : 14;
  ctx.lineWidth = agitated ? 3.6 : 2.8;
  for (let i = 0; i < lashN; i++) {
    const a = (i / lashN) * TAU + b.t * 0.25;
    const whip = agitated ? Math.sin(b.t * 22 + i) * 9 : Math.sin(b.t * 3 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.14) * R * 1.26 + whip * 0.4,
      Math.sin(a + 0.14) * R * 1.26,
      Math.cos(a) * R * 1.46 + whip,
      Math.sin(a) * R * 1.46 + whip * 0.5,
    );
    ctx.stroke();
  }
  // orbiting satellite eyes
  for (let i = 0; i < 2 + b.phase; i++) {
    const a = b.t * (i % 2 ? -1.15 : 0.95) + (i / (2 + b.phase)) * TAU;
    trackEye(ctx, r, Math.cos(a) * (R + 34), Math.sin(a) * (R + 24), 11, o, b.x, b.y, b.phase >= 1 ? "angry" : "round");
  }
  inkHalo(ctx, R * 0.95, b.t, o.lod, 56);
  // sclera
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.98, R * 0.98 * blink, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  wcircle(ctx, 0, 0, R * 0.95, r, 2.2, 2);
  // veins
  ctx.lineWidth = 1.4;
  for (let i = 0; i < (o.lod ? 5 : 10); i++) {
    const a = (i / 10) * TAU + 0.35;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94 * blink);
    for (let k = 1; k <= 3; k++) {
      const u = 1 - k * 0.19;
      ctx.lineTo(Math.cos(a + 0.2 * Math.sin(i + k)) * R * 0.94 * u, Math.sin(a + 0.2 * Math.sin(i + k)) * R * 0.94 * blink * u);
    }
    ctx.stroke();
  }
  if (blink > 0.5) {
    // iris
    const ix = Math.cos(look) * R * 0.22;
    const iy = Math.sin(look) * R * 0.22 * blink;
    const irisR = R * 0.5;
    ctx.fillStyle = INK;
    ctx.globalAlpha = alpha * 0.16;
    ctx.beginPath();
    ctx.arc(ix, iy, irisR * 1.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    wcircle(ctx, ix, iy, irisR, r, 1.4, 2);
    // iris rays + halftone
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + b.t * 0.4;
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(a) * irisR * 0.42, iy + Math.sin(a) * irisR * 0.42);
      ctx.lineTo(ix + Math.cos(a) * irisR * 0.96, iy + Math.sin(a) * irisR * 0.96);
      ctx.stroke();
    }
    // pupil: slit in later phases
    ctx.fillStyle = INK;
    ctx.beginPath();
    if (b.phase >= 2) ctx.ellipse(ix, iy, irisR * 0.2, irisR * 0.62, look, 0, TAU);
    else ctx.arc(ix, iy, irisR * 0.46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(ix - irisR * 0.3, iy - irisR * 0.34, irisR * 0.17, 0, TAU);
    ctx.fill();
    // weeping ink
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (const side of [-1, 1]) {
      const dy = ((b.t * 60 + (side + 1) * 25) % 80) * 0.7;
      wline(ctx, side * R * 0.9, R * 0.5, side * R * 0.96, R * 0.5 + dy, r, 1);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(side * R * 0.96, R * 0.52 + dy, 2.6, 0, TAU);
      ctx.fill();
    }
  }
  // heavy upper lid
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.98 * blink, R * 1.04, R * 0.36, 0, Math.PI, TAU);
  ctx.fill();
  // third eye opens in the final phase
  if (b.phase >= 2) {
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(0, -R * 0.62, R * 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    wcircle(ctx, 0, -R * 0.62, R * 0.2, r, 1, 1);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(Math.cos(look) * 3, -R * 0.62 + Math.sin(look) * 3, R * 0.09, 0, TAU);
    ctx.fill();
  }
  // charge ring
  if (b.attack && b.telegraph > 0) {
    ctx.globalAlpha = alpha * (0.55 + Math.sin(b.t * 24) * 0.25);
    ctx.lineWidth = 3;
    wcircle(ctx, 0, 0, R + 14 + Math.sin(b.t * 9) * 5, r, 3, 2);
    if (o.lod === 0) {
      ctx.lineWidth = 1.4;
      lightning(ctx, -R * 1.5, 0, R * 1.5, 0, r, 10, 3);
    }
  }
  bossFinish(ctx, b, f, boil);
}

/** ГОЛОВА-БОМБА — a walking bomb engine: legs, pistons, pressure gauge, cracked shell */
export function drawBombBoss(ctx: CanvasRenderingContext2D, b: BossArt, o: ArtOpts, boil: number) {
  const f = bossFrame(ctx, b, boil);
  const { r, alpha } = f;
  const R = b.r;
  const look = Math.atan2(o.py - b.y, o.px - b.x);
  const hot = b.phase >= 1;
  const critical = b.phase >= 2 || b.attack === "overheat";
  const step = Math.sin(b.t * 6);

  // two stout legs with boots
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  for (const side of [-1, 1]) {
    const lift = step * side * 10;
    ctx.beginPath();
    ctx.moveTo(side * R * 0.4, R * 0.72);
    ctx.quadraticCurveTo(side * R * 0.55, R * 1.1 - lift * 0.4, side * R * 0.5, R * 1.34 - lift);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(side * R * 0.5 + Math.cos(look) * 5, R * 1.4 - lift, R * 0.26, R * 0.13, 0, 0, TAU);
    ctx.fill();
  }
  // pistons pumping on the sides
  ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    const ext = (Math.sin(b.t * 9 + (side > 0 ? 0 : Math.PI)) + 1) * 0.5;
    const bx = side * (R * 0.92 + ext * 10);
    wline(ctx, side * R * 0.8, -R * 0.1, bx, -R * 0.1 + ext * 4, r, 2);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(bx, -R * 0.1 + ext * 4, 5.5, 0, TAU);
    ctx.fill();
    if (o.lod === 0 && ext > 0.82) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 1.6;
      burst(ctx, bx, -R * 0.1, 3, 12, 5, r);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4;
    }
  }
  // shell: cracked, glowing-hot in later phases
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();
  if (hot) {
    // pulsing molten fissures
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 3 + Math.sin(b.t * 8) * 1.4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
      for (let k = 1; k <= 3; k++) {
        const aa = a + (r() - 0.5) * 0.6;
        const rr = R * (0.2 + k * 0.26);
        ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.stroke();
    }
  }
  glossClip(ctx, R, critical ? 0.5 : 0.36, 5, o.lod);
  // rivet belt
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = 0.6 * alpha;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.78, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAPER;
  if (o.lod === 0) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + b.t * 0.2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, 1.8, 0, TAU);
      ctx.fill();
    }
  }
  // pressure gauge with a needle that climbs with damage
  ctx.save();
  ctx.translate(-R * 0.52, -R * 0.18);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.26, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  const danger = 1 - Math.max(0, Math.min(1, b.hp / b.maxHp));
  const na = Math.PI * 0.85 + danger * Math.PI * 1.3 + Math.sin(b.t * 12) * 0.08;
  ctx.lineWidth = 1.8;
  wline(ctx, 0, 0, Math.cos(na) * R * 0.2, Math.sin(na) * R * 0.2, r, 0.6);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
  // valve cap + fuse throwing sparks
  ctx.fillStyle = INK;
  ctx.fillRect(-R * 0.2, -R * 1.14, R * 0.4, R * 0.22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(R * 0.3, -R * 0.94);
  ctx.quadraticCurveTo(R * 0.9, -R * 1.4, R * 0.62, -R * 1.78);
  ctx.stroke();
  const sparkR = mulberry32(boil * 5 + 11);
  burst(ctx, R * 0.62, -R * 1.82, 3, critical ? 26 : 15, critical ? 13 : 8, sparkR, b.t * 7);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(R * 0.62, -R * 1.82, critical ? 5 : 3.4, 0, TAU);
  ctx.fill();
  if (critical && o.lod === 0) {
    // embers drifting off the fuse
    ctx.fillStyle = INK;
    for (let i = 0; i < 5; i++) {
      const p = (b.t * 0.7 + i / 5) % 1;
      ctx.globalAlpha = alpha * (1 - p) * 0.7;
      ctx.beginPath();
      ctx.arc(R * 0.62 + Math.sin(p * 9 + i) * 20, -R * 1.82 - p * 46, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }
  // face plate: eyes + chattering grate mouth
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.1, R * 0.56, R * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  wcircle(ctx, 0, R * 0.1, R * 0.42, r, 1.8, 2);
  trackEye(ctx, r, -R * 0.22, -R * 0.02, R * 0.13, o, b.x, b.y, "angry");
  trackEye(ctx, r, R * 0.24, -R * 0.02, R * 0.12, o, b.x, b.y, "angry");
  const chomp = critical ? 7 + Math.abs(Math.sin(b.t * 15)) * 6 : 4;
  ctx.lineWidth = 2.6;
  wline(ctx, -R * 0.3, R * 0.22, R * 0.3, R * 0.22, r, 1);
  for (let i = -3; i <= 3; i++) {
    wline(ctx, i * R * 0.09, R * 0.22 - chomp * 0.5, i * R * 0.09, R * 0.22 + chomp * 0.5, r, 0.9);
  }
  // warning band when an attack is charging
  if (b.attack && b.telegraph > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * (0.5 + Math.sin(b.t * 20) * 0.3);
    ctx.lineWidth = 3.4;
    for (const side of [-1, 1]) {
      wline(ctx, side * (R + 16), -R * 0.5, side * (R + 30), -R * 0.2, r, 2);
      wline(ctx, side * (R + 16), R * 0.5, side * (R + 30), R * 0.2, r, 2);
    }
    ctx.restore();
  }
  bossFinish(ctx, b, f, boil);
}
