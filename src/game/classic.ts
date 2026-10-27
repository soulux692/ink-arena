// The original hand-drawn monster designs (restored). Pure rendering, no game state.
import {
  mulberry32,
  wline,
  wcircle,
  wrect,
  wpoly,
  wstar,
  burst,
  hatchCircle,
  scribbleCircle,
} from "./sketch";
import type { EnemyKind } from "./levels";

const TAU = Math.PI * 2;
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

export interface EnemyArt {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  angle: number;
  flash: number;
  fireCd: number;
  phase: number;
  age: number;
  chargeT: number;
  dashT: number;
}

export interface ClassicOpts {
  t: number;
  px: number;
  py: number;
  lod: number;
  boil: number;
}

export function drawMonster(ctx: CanvasRenderingContext2D, e: EnemyArt, o: ClassicOpts) {
  const t = o.t;
  const r = mulberry32(e.id * 131 + o.boil);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  {
    // spawn pop-in and hit squash
    const pop = Math.min(1, e.age / 0.34);
    const ob = 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2);
    ctx.scale(ob, ob);
    if (e.flash > 0) ctx.scale(1.12, 0.9);
  }
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(3, 5, e.r, e.r * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  const flash = e.flash > 0;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;

  if (e.kind === "blob" || e.kind === "splitter") {
    const isSplit = e.kind === "splitter";
    const squash = 1 + Math.sin(t * 10 + e.phase) * 0.12;
    ctx.scale(squash, 1 / squash);
    if (flash) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 2, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      wcircle(ctx, 0, 0, e.r, r, 2.5, 2);
      ctx.lineWidth = 1;
      scribbleCircle(ctx, 0, 3, e.r * 0.8, r, 9);
      if (isSplit) {
        ctx.lineWidth = 1.6;
        for (let i = -1; i <= 1; i++) wline(ctx, i * 7, -e.r * 0.7, i * 7, e.r * 0.7, r, 1.4);
      }
      ctx.lineWidth = 2;
      const ex = Math.cos(e.angle) * 4;
      const ey = Math.sin(e.angle) * 4;
      ctx.beginPath();
      ctx.arc(-5 + ex, -4 + ey, 2.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5 + ex, -4 + ey, 2.2, 0, TAU);
      ctx.fill();
      wline(ctx, -5, 5, 5, 6, r, 1.5);
    }
  } else if (e.kind === "fly") {
    ctx.rotate(e.angle);
    if (flash) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 2, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r, e.r * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      wcircle(ctx, 0, 0, e.r, r, 1.5, 1);
      ctx.lineWidth = 1.3;
      const flap = Math.sin(t * 40 + e.phase) * 6;
      wline(ctx, -2, -3, -10, -10 - flap, r, 1.5);
      wline(ctx, -2, 3, -10, 10 + flap, r, 1.5);
      ctx.beginPath();
      ctx.arc(3, 0, 1.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      wline(ctx, -e.r, 0, -e.r - 10, 0, r, 1);
      ctx.globalAlpha = 1;
    }
  } else if (e.kind === "spiky") {
    const rot = t * 2.5 + e.phase;
    if (flash) {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = rot + (i / 16) * TAU;
        const rr = i % 2 === 0 ? e.r + 4 : e.r * 0.6;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      wstar(ctx, 0, 0, e.r, e.r * 0.6, 8, rot, r, 1.5);
      ctx.lineWidth = 1.2;
      hatchCircle(ctx, 0, 0, e.r * 0.55, rot, 4, r, 0.8);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2;
      wcircle(ctx, 0, 0, 6, r, 1, 1);
      ctx.beginPath();
      ctx.arc(Math.cos(e.angle) * 2.5, Math.sin(e.angle) * 2.5, 2.5, 0, TAU);
      ctx.fill();
    }
  } else if (e.kind === "brute") {
    const breathe = 1 + Math.sin(t * 3 + e.phase) * 0.03;
    ctx.scale(breathe, breathe);
    if (flash) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 4;
      wcircle(ctx, 0, 0, e.r, r, 2.5, 3);
      ctx.lineWidth = 1.3;
      hatchCircle(ctx, 0, 0, e.r - 2, 0.8, 5, r, 1);
      hatchCircle(ctx, 0, 0, e.r - 2, -0.8, 7, r, 1);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, -4, e.r * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2.5;
      wcircle(ctx, 0, -4, e.r * 0.45, r, 1.5, 1);
      ctx.lineWidth = 3.5;
      wline(ctx, -11, -12, -3, -8, r, 1);
      wline(ctx, 11, -12, 3, -8, r, 1);
      ctx.beginPath();
      ctx.arc(-6, -4, 3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, -4, 3, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2;
      wline(ctx, -9, 5, 9, 5, r, 1);
      for (let i = -6; i <= 6; i += 4) wline(ctx, i, 5, i + 1, 9, r, 0.8);
    }
    ctx.save();
    ctx.scale(1 / breathe, 1 / breathe);
    ctx.lineWidth = 2;
    wrect(ctx, -22, -e.r - 16, 44, 7, r, 1);
    ctx.fillRect(-21, -e.r - 15, 42 * Math.max(0, e.hp / e.maxHp), 5);
    ctx.restore();
  } else if (e.kind === "shooter") {
    ctx.rotate(e.angle);
    const s = e.r;
    if (flash) {
      ctx.fillRect(-s - 2, -s - 2, s * 2 + 4, s * 2 + 4);
    } else {
      ctx.fillStyle = PAPER;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.fillStyle = INK;
      wrect(ctx, -s, -s, s * 2, s * 2, r, 2);
      ctx.lineWidth = 1;
      for (let d = -s + 4; d < s; d += 5) wline(ctx, -s, d, -s + 8, d, r, 0.6);
      ctx.lineWidth = 2;
      wcircle(ctx, 4, 0, 6, r, 1, 1);
      ctx.beginPath();
      ctx.arc(6, 0, 2.5, 0, TAU);
      ctx.fill();
      ctx.fillRect(s - 2, -3, 12, 6);
      if (e.fireCd < 0.4) {
        ctx.lineWidth = 1.5;
        burst(ctx, s + 12, 0, 3, 10, 5, r);
      }
    }
  } else if (e.kind === "zipper") {
    const charging = e.chargeT > 0;
    const dashing = e.dashT > 0;
    ctx.rotate(e.angle);
    if (charging) {
      ctx.globalAlpha = 0.3 + Math.sin(t * 30) * 0.2;
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) wline(ctx, -e.r - i * 8, 0, -e.r - 4, 0, r, 2);
      ctx.globalAlpha = 1;
    }
    if (dashing) {
      ctx.globalAlpha = 0.35;
      for (let i = 1; i <= 3; i++) wcircle(ctx, -i * 12, 0, e.r * (1 - i * 0.15), mulberry32(o.boil + i), 2, 1);
      ctx.globalAlpha = 1;
    }
    const pts: [number, number][] = [
      [e.r, 0],
      [-e.r * 0.7, -e.r],
      [-e.r * 0.3, 0],
      [-e.r * 0.7, e.r],
    ];
    if (flash) {
      ctx.beginPath();
      ctx.moveTo(e.r + 4, 0);
      ctx.lineTo(-e.r, -e.r);
      ctx.lineTo(-e.r, e.r);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2.2;
      wpoly(ctx, pts, r, 1.5);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) wline(ctx, 0, -e.r * 0.6 + i * 4, e.r * 0.7, -e.r * 0.5 + i * 4, r, 0.8);
      ctx.beginPath();
      ctx.arc(4, 0, 2.4, 0, TAU);
      ctx.fill();
    }
  } else if (e.kind === "bomber") {
    const fuse = (t * 6 + e.phase) % 1;
    const danger = Math.hypot(o.px - e.x, o.py - e.y) < 130;
    const blink = danger && Math.floor(t * 10) % 2 === 0;
    if (flash || blink) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 3;
      wcircle(ctx, 0, 0, e.r, r, 2, 2);
      ctx.lineWidth = 1.2;
      hatchCircle(ctx, 0, 0, e.r - 2, 1.2, 6, r, 1);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2;
      wcircle(ctx, 0, 0, e.r * 0.55, r, 1.2, 1);
      ctx.beginPath();
      ctx.arc(-4, -3, 2.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -3, 2.2, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2;
      const fx = Math.cos(-1.2) * e.r;
      const fy = Math.sin(-1.2) * e.r;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + 10, fy - 14, fx + 4, fy - 22);
      ctx.stroke();
      ctx.fillRect(fx + 1, fy - 26, 6, 6);
      ctx.lineWidth = 1.5;
      burst(ctx, fx + 4, fy - 24, 4, 10, Math.floor(fuse * 4) + 3, r);
    }
  } else if (e.kind === "sniper") {
    const charging = e.fireCd < 0.7;
    ctx.rotate(e.angle);
    if (charging) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      const dx = o.px - e.x;
      const dy = o.py - e.y;
      for (let d = 30; d < Math.hypot(dx, dy); d += 18) wline(ctx, d, 0, d + 8, 0, mulberry32(o.boil + d), 1);
      ctx.restore();
    }
    const s = e.r;
    if (flash) {
      ctx.beginPath();
      ctx.arc(0, 0, s + 2, 0, TAU);
      ctx.fill();
    } else {
      const body: [number, number][] = [
        [s * 1.2, 0],
        [-s * 0.8, -s],
        [-s * 0.4, 0],
        [-s * 0.8, s],
      ];
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      body.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2.2;
      wpoly(ctx, body, r, 1.5);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) wline(ctx, -s * 0.6 + i * 5, -s * 0.5, -s * 0.2 + i * 5, -s * 0.3, r, 0.8);
      ctx.fillRect(s * 0.7, -2, s * 0.9, 4);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      wcircle(ctx, 0, 0, 6, r, 1, 1);
      ctx.beginPath();
      ctx.arc(2, 0, 2.2, 0, TAU);
      ctx.fill();
      if (charging) {
        ctx.lineWidth = 1.4;
        wcircle(ctx, 0, 0, e.r + 5, r, 2, 1);
      }
    }
  } else if (e.kind === "shield") {
    ctx.rotate(e.angle);
    if (flash) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(-2, 0, e.r * 0.82, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2.5;
      wcircle(ctx, -2, 0, e.r * 0.82, r, 2.5, 2);
      ctx.lineWidth = 1.1;
      hatchCircle(ctx, -2, 0, e.r * 0.75, 1.1, 6, r, 1);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(-2, 0, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 2;
      wcircle(ctx, -2, 0, 7, r, 1.2, 1);
      ctx.fillRect(0, -2, 4, 4);
      ctx.lineWidth = 2.5;
      wline(ctx, -6, -9, 4, -5, r, 1.2);
      const plate: [number, number][] = [
        [7, -e.r],
        [e.r * 0.85, -e.r * 0.7],
        [e.r * 0.95, 0],
        [e.r * 0.85, e.r * 0.7],
        [7, e.r],
      ];
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      plate.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.lineWidth = 3;
      wpoly(ctx, plate, r, 2);
      ctx.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) wline(ctx, e.r * 0.55, i * 6, e.r * 0.82, i * 6, r, 1);
      wcircle(ctx, e.r * 0.55, 0, e.r * 0.28, r, 2, 1);
      for (const yy of [-e.r * 0.68, 0, e.r * 0.68]) {
        ctx.beginPath();
        ctx.arc(e.r * 0.55, yy, 1.6, 0, TAU);
        ctx.fill();
      }
    }
  } else if (e.kind === "ghost") {
    // Torn ink wraith. Its dark core is targetable; its pale echo is not.
    const solid = Math.sin(e.age * 2.6 + e.phase) <= 0.1;
    ctx.translate(0, Math.sin(t * 3.2 + e.phase) * 5);
    ctx.rotate(Math.sin(t * 2 + e.phase) * 0.09);
    ctx.globalAlpha = solid ? 0.93 : 0.38;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < (o.lod === 0 ? 3 : 0); i++) {
      const dx = Math.sin(t * 3 + i * 2 + e.phase) * (12 + i * 4);
      const dy = Math.cos(t * 2.6 + i * 3) * (11 + i * 3);
      wcircle(ctx, dx, dy, 2.3 + i, r, 1, 1);
      wline(ctx, dx, dy, dx + (i - 1) * 7, dy + 11, r, 1);
    }
    if (flash) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r + 5, e.r + 7, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-e.r - 4, 14);
      ctx.quadraticCurveTo(-e.r - 8, -e.r - 12, 0, -e.r - 13);
      ctx.quadraticCurveTo(e.r + 7, -e.r - 9, e.r + 4, 12);
      for (let i = 5; i >= 0; i--) {
        const x = -e.r - 3 + (i * (e.r * 2 + 6)) / 5;
        const y = e.r + (i % 2 ? -9 : 5) + Math.sin(t * 5 + i) * 2;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, -2, e.r * 0.76, e.r * 0.85, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.69, -4);
      ctx.lineTo(-e.r * 0.47, -e.r * 0.5);
      ctx.lineTo(e.r * 0.46, -e.r * 0.55);
      ctx.lineTo(e.r * 0.7, -2);
      ctx.quadraticCurveTo(0, -e.r * 0.17, -e.r * 0.69, -4);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-5.5, -3, 3.1, 5.4, -0.18, 0, TAU);
      ctx.ellipse(5.5, -3, 3.1, 5.4, 0.18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.quadraticCurveTo(0, 12 + Math.sin(t * 4) * 2, 5, 7);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(side * (e.r - 2), 3);
        ctx.quadraticCurveTo(side * (e.r + 13), -5 + Math.sin(t * 5 + side) * 5, side * (e.r + 12), 17);
        ctx.stroke();
        wcircle(ctx, side * (e.r + 12), 17, 3, r, 1, 1);
      }
      if (!solid) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([3, 4]);
        wcircle(ctx, 0, 0, e.r + 7, r, 2, 1);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  } else {
    // legacy "boss"-kind minion
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.lineWidth = 4.5;
    wcircle(ctx, 0, 0, e.r, r, 3, 3);
    ctx.lineWidth = 1.4;
    hatchCircle(ctx, 0, 0, e.r - 3, 0.9, 6, r, 1.4);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * e.r * 0.3, -e.r * 0.2, 5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}
