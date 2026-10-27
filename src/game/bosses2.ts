// Signature mechanics for every boss. Each boss owns a few attacks nobody else has:
//   tentacle  — garden of eruptions + slowing ink puddles
//   matriarch — egg clutches that hatch + gravity vortex
//   queen     — honeycomb hive (find the safe cells) + crossing X-slash
//   octopus   — rotating ray fan + blinding ink darkness
//   eye       — searchlight gaze cones (hide behind rocks) + blink teleport
//   bombhead  — detonation chain + scorch lanes + overheat blast
//   king      — royal decree (freeze / keep moving) + boomerang crown
import { mulberry32, wline, wcircle, burst, lightning } from "./sketch";
import { sfx } from "./sfx";
import type { Game } from "./engine";
import type { AttackKind } from "./levels";

const W = 960;
const H = 600;
const TAU = Math.PI * 2;
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

export const SPECIAL_KINDS: AttackKind[] = [
  "garden", "hive", "xslash", "octoray", "darkness", "gaze", "blink",
  "chain", "overheat", "lanes", "decree", "crown", "eggs", "vortex", "bomblets", "tidal", "squeeze", "meteor",
];
export const isSpecial = (k: AttackKind) => SPECIAL_KINDS.includes(k);

export const SPECIAL_LABELS: Record<string, string> = {
  garden: "САД ЩУПАЛЕЦ!",
  hive: "УЛЕЙ: ИЩИ БЕЛЫЕ СОТЫ!",
  xslash: "КРЕСТ-НАКРЕСТ!",
  octoray: "ВЕЕР ЛУЧЕЙ!",
  darkness: "ЧЕРНИЛА ГУСТЕЮТ!",
  gaze: "ПРОЖЕКТОР ВЗГЛЯДА!",
  blink: "МОРГНУЛ!",
  chain: "ЦЕПНОЙ ПОДРЫВ!",
  bomblets: "БОМБЫ В ПОЛЁТЕ!",
  tidal: "ЧЁРНАЯ ВОЛНА — ИЩИ ПРОХОД!",
  squeeze: "СТЕНА НАДВИГАЕТСЯ!",
  meteor: "ЧЕРНИЛЬНЫЕ МЕТЕОРИТЫ!",
  overheat: "ПЕРЕГРЕВ — БЕГИ ПРОЧЬ!",
  lanes: "ОГНЕННЫЕ ПОЛОСЫ!",
  decree: "УКАЗ КОРОЛЯ!",
  crown: "КОРОНА-БУМЕРАНГ!",
  eggs: "КЛАДКА ЯИЦ!",
  vortex: "ВОРОНКА!",
};

interface Lane { horiz: boolean; pos: number; w: number; t: number; tele: number; fireDur: number; fired: boolean; hit: boolean; }
interface Bomb { x: number; y: number; t: number; fuse: number; done: boolean; }
interface Cone { ang: number; spread: number; len: number; dir: number; speed: number; t: number; tele: number; dur: number; hitCd: number; }
interface Egg { x: number; y: number; t: number; max: number; hp: number; seed: number; hurt: number; }
interface Puddle { x: number; y: number; r: number; life: number; max: number; seed: number; }
interface GardenPt { x: number; y: number; at: number; fired: boolean; }
interface HiveCell { x: number; y: number; safe: boolean; }

export interface Special {
  lanes: Lane[];
  chain: Bomb[];
  overheat: { x: number; y: number; r: number; t: number; tele: number; fired: boolean; after: number } | null;
  cones: Cone[];
  decree: { kind: "stop" | "move"; t: number; tele: number; dur: number; hitCd: number } | null;
  decreeFlip: boolean;
  crown: { x: number; y: number; tx: number; ty: number; t: number; tele: number; out: number; stay: number; back: number; spin: number; hitCd: number } | null;
  eggs: Egg[];
  vortex: { t: number; tele: number; dur: number } | null;
  darkness: number;
  darkMax: number;
  darkTick: number;
  octo: { t: number; tele: number; dur: number; ang: number; dir: number; beams: number; len: number; hitCd: number } | null;
  hive: { cells: HiveCell[]; t: number; tele: number; fireDur: number; fired: boolean; hit: boolean } | null;
  lob: { x: number; y: number; sx: number; sy: number; t: number; fly: number; r: number; fired: boolean; spin: number; arc?: number }[];
  tidal: { t: number; tele: number; gapY: number; gapH: number; x: number; speed: number; hit: boolean; fired: boolean } | null;
  squeeze: { t: number; tele: number; hold: number; depth: number; fired: boolean } | null;
  xslash: { lines: { ang: number; off: number }[]; cx: number; cy: number; t: number; tele: number; dur: number; fired: boolean; hit: boolean } | null;
  garden: { pts: GardenPt[]; t: number; tele: number } | null;
  blink: { tx: number; ty: number; fx: number; fy: number; t: number; tele: number; done: boolean } | null;
  puddles: Puddle[];
}

export function makeSpecial(): Special {
  return {
    lanes: [], chain: [], overheat: null, cones: [], decree: null, decreeFlip: false, crown: null,
    eggs: [], vortex: null, darkness: 0, darkMax: 0, darkTick: 0, octo: null, hive: null,
    xslash: null, garden: null, blink: null, lob: [], tidal: null, squeeze: null, puddles: [],
  };
}

export function clearSpecial(g: Game, keepEggs = false) {
  const eggs = keepEggs ? g.special.eggs : [];
  g.special = makeSpecial();
  g.special.eggs = eggs;
  g.moveMul = 1;
  g.limitTarget = g.baseLimit;
}

export function specialBusy(g: Game) {
  const s = g.special;
  return !!(s.lanes.length || s.chain.length || s.overheat || s.cones.length || s.decree || s.crown ||
    s.vortex || s.octo || s.hive || s.xslash || s.garden || s.blink || s.lob.length || s.tidal || s.squeeze);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seedOf = () => Math.random() * 1e6;

function freeSpot(g: Game, x: number, y: number, r: number) {
  return g.obstacles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r);
}

function sparks(g: Game, x: number, y: number, n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = speed * (0.4 + Math.random());
    g.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.4 + Math.random() * 0.4, max: 0.8,
      size: 1.6 + Math.random() * 2.4, kind: "ember", rot: 0 });
  }
}

function stain(g: Game, x: number, y: number, size: number) {
  g.stains.push({ x, y, size, seed: seedOf(), born: g.time });
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    const px = x + Math.cos(a) * R;
    const py = y + Math.sin(a) * R;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** ray from (ox,oy) along ang; returns distance to the first obstacle (or max) */
function rayHit(g: Game, ox: number, oy: number, ang: number, max: number) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let best = max;
  for (const o of g.obstacles) {
    const fx = o.x - ox;
    const fy = o.y - oy;
    const proj = fx * dx + fy * dy;
    if (proj < 0) continue;
    const perp2 = fx * fx + fy * fy - proj * proj;
    if (perp2 > o.r * o.r) continue;
    const t = proj - Math.sqrt(o.r * o.r - perp2);
    if (t < best) best = Math.max(0, t);
  }
  return best;
}

function angDiff(a: number, c: number) {
  let d = (a - c) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const MOVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// ---------------------------------------------------------------------------
// begin: build the warning geometry; everything is visible before it can hurt
// ---------------------------------------------------------------------------
export function beginSpecial(g: Game, kind: AttackKind) {
  const W = g.limitX;
  const b = g.boss!;
  const p = g.player;
  const sp = g.special;
  const tele: Partial<Record<AttackKind, number>> = {
    garden: 1.15, hive: 1.3, xslash: 1.2, octoray: 1.15, darkness: 0.8, gaze: 1.05, blink: 0.95,
    chain: 0.7, overheat: 1.75, lanes: 1.3, decree: 1.45, crown: 0.9, eggs: 0.8, vortex: 1.0, bomblets: 0.85,
    tidal: 1.45, squeeze: 1.55, meteor: 0.9,
  };
  const T = tele[kind] ?? 1;
  b.attack = kind;
  b.telegraph = T;
  b.telegraphTotal = T;
  b.targetX = p.x;
  b.targetY = p.y;
  b.lockAngle = Math.atan2(p.y - b.y, p.x - b.x);
  const toP = b.lockAngle;

  switch (kind) {
    case "garden": {
      const pts: GardenPt[] = [{ x: p.x, y: p.y, at: T, fired: false }];
      const n = 5 + (b.phase >= 2 ? 1 : 0);
      const off = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        const x = p.x + Math.cos(a) * 132;
        const y = p.y + Math.sin(a) * 132;
        if (x < 62 || x > W - 62 || y < 74 || y > H - 66) continue;
        pts.push({ x, y, at: T + 0.16 + i * 0.1, fired: false });
      }
      sp.garden = { pts, t: 0, tele: T };
      sfx.mine();
      break;
    }
    case "hive": {
      const R = 44;
      const cells: HiveCell[] = [];
      for (let c = 0, x = 62; x < W - 56; c++, x += R * 1.5) {
        for (let r = 0, y = 76; y < H - 62; r++, y += R * 1.732) {
          cells.push({ x, y: y + (c % 2 ? R * 0.866 : 0), safe: false });
        }
      }
      const want = b.phase >= 2 ? 2 : 3;
      const cand = cells.filter((c) => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        return d > 70 && d < 250;
      });
      const pool = cand.length >= want ? cand : cells.slice().sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y)).slice(1, 8);
      for (let i = 0; i < want && pool.length; i++) {
        const k = Math.floor(Math.random() * pool.length);
        const c = pool.splice(k, 1)[0];
        c.safe = true;
        for (let j = pool.length - 1; j >= 0; j--) if (Math.hypot(pool[j].x - c.x, pool[j].y - c.y) < 95) pool.splice(j, 1);
      }
      sp.hive = { cells, t: 0, tele: T, fireDur: 0.55, fired: false, hit: false };
      sfx.laserCharge();
      break;
    }
    case "xslash": {
      const cx = Math.max(110, Math.min(W - 110, p.x + rand(-40, 40)));
      const cy = Math.max(120, Math.min(H - 110, p.y + rand(-30, 30)));
      const a0 = Math.random() * Math.PI;
      const lines = [a0, a0 + Math.PI / 2 + rand(-0.25, 0.25)].map((ang) => ({ ang, off: cx * -Math.sin(ang) + cy * Math.cos(ang) }));
      sp.xslash = { lines, cx, cy, t: 0, tele: T, dur: 0.36, fired: false, hit: false };
      sfx.laserCharge();
      break;
    }
    case "octoray": {
      const beams = b.phase >= 2 ? 5 : 4;
      const gap = TAU / beams;
      sp.octo = { t: 0, tele: T, dur: 2.8, ang: toP + gap / 2, dir: Math.random() < 0.5 ? 1 : -1, beams, len: 1100, hitCd: 0 };
      sfx.laserCharge();
      break;
    }
    case "darkness":
      g.addText(b.x, b.y - b.r - 30, "ЧЕРНИЛА ГУСТЕЮТ...", 1.3, 1.5);
      sfx.phase();
      break;
    case "gaze": {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = b.phase >= 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        sp.cones.push({ ang: toP - dir * 0.95 + i * Math.PI, spread: 0.38, len: 560, dir, speed: 0.6 + b.phase * 0.06, t: 0, tele: T, dur: 2.7, hitCd: 0 });
      }
      sfx.laserCharge();
      break;
    }
    case "blink": {
      let tx = W / 2;
      let ty = H / 2;
      for (let k = 0; k < 24; k++) {
        const x = rand(120, W - 120);
        const y = rand(120, H - 110);
        if (Math.hypot(x - p.x, y - p.y) > 230 && Math.hypot(x - b.x, y - b.y) > 200 && freeSpot(g, x, y, b.r)) {
          tx = x;
          ty = y;
          break;
        }
      }
      sp.blink = { tx, ty, fx: b.x, fy: b.y, t: 0, tele: T, done: false };
      sfx.mine();
      break;
    }
    case "chain": {
      const n = 8;
      const off = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        const x = Math.max(60, Math.min(W - 60, p.x + Math.cos(a) * 118));
        const y = Math.max(76, Math.min(H - 66, p.y + Math.sin(a) * 118));
        if (!freeSpot(g, x, y, 20)) continue;
        sp.chain.push({ x, y, t: 0, fuse: 0.95 + i * 0.27, done: false });
      }
      if (b.phase >= 2) sp.chain.push({ x: p.x, y: p.y, t: 0, fuse: 1.25, done: false });
      sfx.mine();
      break;
    }
    case "overheat":
      sp.overheat = { x: b.x, y: b.y, r: 215 + b.phase * 14, t: 0, tele: T, fired: false, after: 0 };
      sfx.laserCharge();
      break;
    case "lanes": {
      const horiz = Math.random() < 0.5;
      const slot = 84;
      const start = 62;
      const n = Math.floor(((horiz ? H : W) - start * 2) / slot);
      const pc = horiz ? p.y : p.x;
      const centers = Array.from({ length: n }, (_, i) => start + (i + 0.5) * slot);
      // the safe pair is always within a short run of the player
      const near = centers.map((c, i) => ({ c, i })).filter((o) => Math.abs(o.c - pc) < 230 && o.i < n - 1);
      const safeStart = (near.length ? near[Math.floor(Math.random() * near.length)] : { i: Math.floor(n / 2) }).i;
      const T2 = T;
      for (let i = 0; i < n; i++) {
        if (i === safeStart || i === safeStart + 1) continue;
        if (Math.abs(centers[i] - pc) > 330 && Math.random() < 0.5) continue;
        sp.lanes.push({ horiz, pos: centers[i], w: 70, t: 0, tele: T2, fireDur: 0.55, fired: false, hit: false });
      }
      sfx.laserCharge();
      break;
    }
    case "decree": {
      sp.decreeFlip = !sp.decreeFlip;
      sp.decree = { kind: sp.decreeFlip ? "stop" : "move", t: 0, tele: T, dur: 1.75, hitCd: 0 };
      sfx.phase();
      break;
    }
    case "crown": {
      const d = Math.min(380, Math.max(180, Math.hypot(p.x - b.x, p.y - b.y)));
      const tx = Math.max(70, Math.min(W - 70, b.x + Math.cos(toP) * d));
      const ty = Math.max(80, Math.min(H - 70, b.y + Math.sin(toP) * d));
      sp.crown = { x: b.x, y: b.y, tx, ty, t: 0, tele: T, out: 0.55, stay: 1.0, back: 0.75, spin: 0, hitCd: 0 };
      sfx.mine();
      break;
    }
    case "eggs": {
      const n = Math.min(8 - sp.eggs.length, 3 + b.phase);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 20; k++) {
          const a = Math.random() * TAU;
          const d = rand(120, 250);
          const x = b.x + Math.cos(a) * d;
          const y = b.y + Math.sin(a) * d;
          if (x < 70 || x > W - 70 || y < 84 || y > H - 74) continue;
          if (!freeSpot(g, x, y, 22) || sp.eggs.some((e) => Math.hypot(e.x - x, e.y - y) < 54)) continue;
          sp.eggs.push({ x, y, t: 5 + T, max: 5 + T, hp: 2.4, seed: seedOf(), hurt: 0 });
          break;
        }
      }
      sfx.summon();
      break;
    }
    case "vortex":
      sp.vortex = { t: 0, tele: T, dur: 2.9 };
      sfx.phase();
      break;
    case "tidal": {
      const gapH = b.phase >= 2 ? 118 : 148;
      const gapY = Math.max(120, Math.min(H - 120, p.y + rand(-100, 100)));
      sp.tidal = { t: 0, tele: T, gapY, gapH, x: W + 30, speed: 330 + b.phase * 30, hit: false, fired: false };
      sfx.laserCharge();
      break;
    }
    case "squeeze":
      sp.squeeze = { t: 0, tele: T, hold: 2.5, depth: 100, fired: false };
      sfx.phase();
      break;
    case "meteor": {
      const n = b.phase >= 2 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const x = Math.max(70, Math.min(W - 70, p.x + (i === 0 ? 0 : rand(-180, 180))));
        const y = Math.max(84, Math.min(H - 74, p.y + (i === 0 ? 0 : rand(-150, 150))));
        sp.lob.push({ x, y, sx: x, sy: -40, t: -i * 0.17, fly: 1.1, r: 54, fired: false, spin: Math.random() * TAU, arc: 0 });
      }
      sfx.summon();
      break;
    }
    case "bomblets": {
      // three arcs; each landing circle is drawn on the floor for the whole flight
      const n = b.phase >= 2 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const a = toP + (i - (n - 1) / 2) * 0.8 + rand(-0.12, 0.12);
        const d = rand(150, 300);
        const x = Math.max(70, Math.min(W - 70, p.x + Math.cos(a) * d * 0.55));
        const y = Math.max(84, Math.min(H - 74, p.y + Math.sin(a) * d * 0.55));
        sp.lob.push({ x, y, sx: b.x, sy: b.y, t: -i * 0.22, fly: 0.95, r: 58, fired: false, spin: Math.random() * TAU });
      }
      sfx.summon();
      break;
    }
    default:
      break;
  }
}

/** slow ink puddles left by tentacle strikes */
export function spawnPuddle(g: Game, x: number, y: number) {
  const s = g.special;
  s.puddles.push({ x, y, r: 56, life: 7.5, max: 7.5, seed: seedOf() });
  if (s.puddles.length > 9) s.puddles.shift();
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
export function updateSpecial(g: Game, dt: number) {
  const W = g.limitX;
  void W;
  const sp = g.special;
  const b = g.boss;
  const p = g.player;
  g.moveMul = 1;
  if (!b || b.state === "dying") {
    if (sp.puddles.length || specialBusy(g) || sp.eggs.length || sp.darkness > 0) clearSpecial(g);
    return;
  }

  // ---- puddles
  for (const pd of sp.puddles) {
    pd.life -= dt;
    if (Math.hypot(p.x - pd.x, p.y - pd.y) < pd.r) g.moveMul = Math.min(g.moveMul, 0.55);
  }
  sp.puddles = sp.puddles.filter((pd) => pd.life > 0);

  // ---- garden of eruptions
  if (sp.garden) {
    const ga = sp.garden;
    ga.t += dt;
    let open = false;
    for (const pt of ga.pts) {
      if (!pt.fired && ga.t >= pt.at) {
        pt.fired = true;
        g.petals.push({ x: pt.x, y: pt.y, life: 0.75, max: 0.75, seed: seedOf(), n: 7 });
        g.shock(pt.x, pt.y, 10, 440, 0.45);
        stain(g, pt.x, pt.y, 22);
        for (let i = 0; i < 9; i++) g.drop(pt.x, pt.y, 170 + Math.random() * 320);
        sparks(g, pt.x, pt.y, 6, 300);
        g.shake = Math.max(g.shake, 10);
        sfx.boom();
        if (Math.hypot(p.x - pt.x, p.y - pt.y) < 46) g.hurtPlayer(Math.atan2(p.y - pt.y, p.x - pt.x), 1, 28);
      }
      if (!pt.fired) open = true;
    }
    if (!open) sp.garden = null;
  }

  // ---- hive
  if (sp.hive) {
    const h = sp.hive;
    h.t += dt;
    if (!h.fired && h.t >= h.tele) {
      h.fired = true;
      g.shake = Math.max(g.shake, 16);
      g.zoom = Math.max(g.zoom, 0.03);
      sfx.bigBoom();
      let n = 0;
      for (const c of h.cells) {
        if (c.safe) continue;
        if (n++ % 7 === 0) {
          g.shock(c.x, c.y, 8, 300, 0.4);
          g.drop(c.x, c.y, 220);
        }
      }
    }
    if (h.fired && !h.hit) {
      for (const c of h.cells) {
        if (!c.safe && Math.hypot(p.x - c.x, p.y - c.y) < 40) {
          h.hit = true;
          g.hurtPlayer(Math.atan2(p.y - c.y, p.x - c.x), 1, 26);
          break;
        }
      }
    }
    if (h.t >= h.tele + h.fireDur) sp.hive = null;
  }

  // ---- X slash
  if (sp.xslash) {
    const x = sp.xslash;
    x.t += dt;
    if (!x.fired && x.t >= x.tele) {
      x.fired = true;
      g.queenCut = { key: ++g.queenCutKey, angle: x.lines[0].ang, phase: false };
      g.emit();
      g.shake = Math.max(g.shake, 15);
      g.flash = Math.max(g.flash, 0.04);
      sfx.laserFire();
      for (const l of x.lines) {
        for (let k = 0; k < 8; k++) {
          const t = rand(-520, 520);
          const px = x.cx + Math.cos(l.ang) * t;
          const py = x.cy + Math.sin(l.ang) * t;
          if (px > 20 && px < W - 20 && py > 20 && py < H - 20) g.drop(px, py, 140);
        }
      }
    }
    if (x.fired && !x.hit) {
      for (const l of x.lines) {
        const nd = p.x * -Math.sin(l.ang) + p.y * Math.cos(l.ang);
        if (Math.abs(nd - l.off) < 25) {
          x.hit = true;
          g.hurtPlayer(l.ang + Math.PI / 2, 1, 26);
          break;
        }
      }
    }
    if (x.t >= x.tele + x.dur) sp.xslash = null;
  }

  // ---- octo ray fan
  if (sp.octo) {
    const o = sp.octo;
    o.t += dt;
    o.hitCd -= dt;
    if (o.t >= o.tele) {
      if (o.t - dt < o.tele) {
        sfx.laserFire();
        g.shake = Math.max(g.shake, 10);
      }
      o.ang += o.dir * 0.52 * dt;
      if (o.hitCd <= 0) {
        for (let i = 0; i < o.beams; i++) {
          const a = o.ang + (i * TAU) / o.beams;
          if (g.distToSegment(p.x, p.y, b.x, b.y, b.x + Math.cos(a) * o.len, b.y + Math.sin(a) * o.len) < 15) {
            o.hitCd = 0.6;
            g.hurtPlayer(a + Math.PI / 2, 1, 26);
            break;
          }
        }
      }
    }
    if (o.t >= o.tele + o.dur) sp.octo = null;
  }

  // ---- darkness
  if (sp.darkness > 0) {
    sp.darkness -= dt;
    sp.darkTick -= dt;
    if (sp.darkTick <= 0 && b.state === "fight") {
      sp.darkTick = 1.05;
      const a = Math.random() * TAU;
      g.addHazard("rain", p.x + Math.cos(a) * rand(70, 150), p.y + Math.sin(a) * rand(70, 150), 34, 1.15);
    }
  }

  // ---- gaze cones
  if (sp.cones.length) {
    for (const c of sp.cones) {
      c.t += dt;
      c.hitCd -= dt;
      if (c.t >= c.tele) {
        if (c.t - dt < c.tele) sfx.laserFire();
        c.ang += c.dir * c.speed * dt;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (c.hitCd <= 0 && dist < c.len && Math.abs(angDiff(Math.atan2(dy, dx), c.ang)) < c.spread) {
          // rocks block the light: no damage while hidden behind one
          if (rayHit(g, b.x, b.y, Math.atan2(dy, dx), dist + 1) >= dist - 1) {
            c.hitCd = 0.85;
            g.hurtPlayer(Math.atan2(dy, dx), 1, 22);
          }
        }
      }
    }
    sp.cones = sp.cones.filter((c) => c.t < c.tele + c.dur);
  }

  // ---- blink teleport
  if (sp.blink) {
    const k = sp.blink;
    k.t += dt;
    if (!k.done && k.t >= k.tele) {
      k.done = true;
      g.shock(b.x, b.y, 10, 520, 0.5);
      for (let i = 0; i < 16; i++) g.drop(b.x, b.y, 200 + Math.random() * 260);
      b.x = k.tx;
      b.y = k.ty;
      g.shock(b.x, b.y, 10, 700, 0.6);
      g.shock(b.x, b.y, 6, 420, 0.8);
      for (let i = 0; i < 20; i++) g.drop(b.x, b.y, 200 + Math.random() * 300);
      g.shake = Math.max(g.shake, 14);
      sfx.slam();
      const base = Math.atan2(p.y - b.y, p.x - b.x);
      const fan = b.phase >= 2 ? 3 : 2;
      for (let i = -fan; i <= fan; i++) {
        if (i === 0) continue;
        const a = base + i * 0.2;
        g.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, life: 4, dmg: 1, r: 6 });
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        g.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 4, dmg: 1, r: 6 });
      }
      sfx.enemyShot();
    }
    if (k.t >= k.tele + 0.35) sp.blink = null;
  }

  // ---- lobbed bombs: the marker on the floor is the whole truth
  if (sp.lob.length) {
    for (const lb of sp.lob) {
      lb.t += dt;
      lb.spin += dt * 7;
      if (!lb.fired && lb.t >= lb.fly) {
        lb.fired = true;
        g.explode(lb.x, lb.y, lb.r * 0.7, 0, 0, true, false);
        g.petals.push({ x: lb.x, y: lb.y, life: 0.6, max: 0.6, seed: seedOf(), n: 6 });
        g.stains.push({ x: lb.x, y: lb.y, size: 20, seed: seedOf(), born: g.time });
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.3;
          g.ebullets.push({ x: lb.x, y: lb.y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, life: 3.4, dmg: 1, r: 6 });
        }
        if (Math.hypot(p.x - lb.x, p.y - lb.y) < lb.r * 0.82) g.hurtPlayer(Math.atan2(p.y - lb.y, p.x - lb.x), 1, 26);
      }
    }
    sp.lob = sp.lob.filter((lb) => !lb.fired || lb.t < lb.fly + 0.35);
  }

  // ---- tidal wall (one safe gap, always shown first)
  if (sp.tidal) {
    const w = sp.tidal;
    w.t += dt;
    if (!w.fired && w.t >= w.tele) {
      w.fired = true;
      w.x = g.limitX + 30;
      g.shake = Math.max(g.shake, 14);
      sfx.slam();
    }
    if (w.fired) {
      w.x -= w.speed * dt;
      const inGap = Math.abs(p.y - w.gapY) < w.gapH / 2 - 6;
      if (!w.hit && Math.abs(p.x - w.x) < 22 && !inGap) {
        w.hit = true;
        g.hurtPlayer(Math.PI, 1, 30);
      }
      if (Math.random() < dt * 44) sparks(g, w.x, rand(40, H - 40), 1, 150);
      if (w.x < -40) sp.tidal = null;
    }
  }

  // ---- squeeze: the torn edge advances, then retreats
  if (sp.squeeze) {
    const q = sp.squeeze;
    q.t += dt;
    if (!q.fired && q.t >= q.tele) {
      q.fired = true;
      g.limitTarget = g.baseLimit - q.depth;
      g.shake = Math.max(g.shake, 18);
      sfx.slam();
    }
    if (q.fired && q.t >= q.tele + q.hold) {
      g.limitTarget = g.baseLimit;
      if (q.t >= q.tele + q.hold + 0.6) sp.squeeze = null;
    }
  }

  // ---- detonation chain
  if (sp.chain.length) {
    for (const bomb of sp.chain) {
      bomb.t += dt;
      if (!bomb.done && bomb.t >= bomb.fuse) {
        bomb.done = true;
        g.explode(bomb.x, bomb.y, 54, 0, 0, true, false);
        g.petals.push({ x: bomb.x, y: bomb.y, life: 0.55, max: 0.55, seed: seedOf(), n: 6 });
        if (Math.hypot(p.x - bomb.x, p.y - bomb.y) < 54 + 4) g.hurtPlayer(Math.atan2(p.y - bomb.y, p.x - bomb.x), 1, 26);
      }
    }
    if (sp.chain.every((x) => x.done && x.t > x.fuse + 0.4)) sp.chain = [];
  }

  // ---- overheat
  if (sp.overheat) {
    const o = sp.overheat;
    o.t += dt;
    if (!o.fired) {
      o.x = b.x;
      o.y = b.y;
      if (Math.random() < dt * 40) sparks(g, o.x + rand(-b.r, b.r) * 0.8, o.y + rand(-b.r, b.r) * 0.8, 1, 140);
    }
    if (!o.fired && o.t >= o.tele) {
      o.fired = true;
      g.explode(o.x, o.y, o.r * 0.78, 0, 0, true, true);
      g.shock(o.x, o.y, 20, 1100, 0.7);
      g.shock(o.x, o.y, 20, 760, 0.9);
      g.cracks.push({ x: o.x, y: o.y, ang: 0, len: 260, life: 0.6, max: 0.6, seed: 1 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        g.ebullets.push({ x: o.x, y: o.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 4, dmg: 1, r: 7 });
      }
      if (Math.hypot(p.x - o.x, p.y - o.y) < o.r) g.hurtPlayer(Math.atan2(p.y - o.y, p.x - o.x), 2, 40);
    }
    if (o.t >= o.tele + 0.7) sp.overheat = null;
  }

  // ---- scorch lanes
  if (sp.lanes.length) {
    for (const l of sp.lanes) {
      l.t += dt;
      if (!l.fired && l.t >= l.tele) {
        l.fired = true;
        sfx.slam();
        g.shake = Math.max(g.shake, 12);
      }
      if (l.fired && !l.hit) {
        const c = l.horiz ? p.y : p.x;
        if (Math.abs(c - l.pos) < l.w / 2 + 6) {
          l.hit = true;
          g.hurtPlayer(l.horiz ? Math.PI / 2 : 0, 1, 28);
        }
      }
      if (l.fired && Math.random() < dt * 30) {
        const along = l.horiz ? rand(40, W - 40) : rand(50, H - 40);
        const x = l.horiz ? along : l.pos + rand(-l.w / 2, l.w / 2);
        const y = l.horiz ? l.pos + rand(-l.w / 2, l.w / 2) : along;
        sparks(g, x, y, 2, 160);
      }
    }
    sp.lanes = sp.lanes.filter((l) => l.t < l.tele + l.fireDur);
  }

  // ---- royal decree
  if (sp.decree) {
    const d = sp.decree;
    d.t += dt;
    d.hitCd -= dt;
    if (d.t >= d.tele + 0.3 && d.t < d.tele + d.dur && d.hitCd <= 0) {
      const moving = MOVE_KEYS.some((k) => g.keys.has(k));
      if ((d.kind === "stop" && moving) || (d.kind === "move" && !moving)) {
        d.hitCd = 0.75;
        g.hurtPlayer(Math.atan2(p.y - b.y, p.x - b.x), 1, 12);
        g.addText(p.x, p.y - 34, d.kind === "stop" ? "СТОЯТЬ!" : "ДВИГАЙСЯ!", 0.6, 1.2);
      }
    }
    if (d.t >= d.tele + d.dur) sp.decree = null;
  }

  // ---- boomerang crown
  if (sp.crown) {
    const c = sp.crown;
    c.t += dt;
    c.hitCd -= dt;
    c.spin += dt * 16;
    const T0 = c.tele;
    if (c.t >= T0) {
      const k = c.t - T0;
      if (k < c.out) {
        const e = k / c.out;
        c.x = b.x + (c.tx - b.x) * (1 - (1 - e) * (1 - e));
        c.y = b.y + (c.ty - b.y) * (1 - (1 - e) * (1 - e));
      } else if (k < c.out + c.stay) {
        c.x = c.tx + Math.cos(c.spin * 0.6) * 12;
        c.y = c.ty + Math.sin(c.spin * 0.6) * 12;
        if (Math.random() < dt * 36) sparks(g, c.x, c.y, 1, 200);
      } else if (k < c.out + c.stay + c.back) {
        const e = (k - c.out - c.stay) / c.back;
        c.x = c.tx + (b.x - c.tx) * e * e;
        c.y = c.ty + (b.y - c.ty) * e * e;
      } else {
        sp.crown = null;
        return;
      }
      if (c.hitCd <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < 26) {
        c.hitCd = 0.55;
        g.hurtPlayer(Math.atan2(p.y - c.y, p.x - c.x), 1, 26);
      }
    }
  }

  // ---- egg clutch
  if (sp.eggs.length) {
    for (const e of sp.eggs) {
      e.t -= dt;
      e.hurt = Math.max(0, e.hurt - dt);
      for (const bl of g.bullets) {
        if (bl.life > 0 && Math.hypot(bl.x - e.x, bl.y - e.y) < 21) {
          bl.life = 0;
          e.hp -= bl.dmg;
          e.hurt = 0.12;
          sparks(g, e.x, e.y, 3, 200);
        }
      }
      if (e.hp <= 0) {
        // smashed before hatching
        g.shock(e.x, e.y, 8, 300, 0.4);
        stain(g, e.x, e.y, 16);
        for (let i = 0; i < 12; i++) g.drop(e.x, e.y, 200 + Math.random() * 220);
        g.addText(e.x, e.y - 24, "ХРУСЬ!", 0.6, 1.1);
        if (Math.random() < 0.3) g.pickups.push({ id: g.nextId++, x: e.x, y: e.y, kind: "heart", life: 9 });
        g.score += 25;
        sfx.hit();
        e.t = -99;
      } else if (e.t <= 0 && e.t > -50) {
        // hatched
        g.shock(e.x, e.y, 10, 380, 0.5);
        for (let i = 0; i < 14; i++) g.drop(e.x, e.y, 180 + Math.random() * 260);
        for (let i = 0; i < 2; i++) g.spawnEnemy("blob", e.x + (i ? 16 : -16), e.y);
        g.addText(e.x, e.y - 24, "ВЫЛУПИЛИСЬ!", 0.8, 1.2);
        sfx.summon();
        e.t = -99;
      }
    }
    sp.eggs = sp.eggs.filter((e) => e.t > -50);
  }

  // ---- gravity vortex
  if (sp.vortex) {
    const v = sp.vortex;
    v.t += dt;
    if (v.t >= v.tele) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > b.r + 20) {
        p.x += (dx / d) * 135 * dt;
        p.y += (dy / d) * 135 * dt;
      }
    }
    if (v.t >= v.tele + v.dur) sp.vortex = null;
  }
}

// ---------------------------------------------------------------------------
// drawing
// ---------------------------------------------------------------------------
function hatchRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap = 11) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.beginPath();
  for (let d = -h; d < w; d += gap) {
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** floor-level hazards: drawn below the boss, enemies and player */
export function drawSpecialUnder(g: Game, boil: number) {
  const W = g.limitX;
  const sp = g.special;
  const b = g.boss;
  if (!b && !sp.puddles.length) return;
  const ctx = g.ctx;
  const q = g.quality;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";

  // puddles
  for (const pd of sp.puddles) {
    const a = clamp01(pd.life / 1.2);
    const r = mulberry32(Math.floor(pd.seed) + (boil >> 1));
    ctx.globalAlpha = 0.5 * a;
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * TAU;
      const rr = pd.r * (0.86 + 0.14 * Math.sin(ang * 3 + pd.seed) + (r() - 0.5) * 0.05);
      const x = pd.x + Math.cos(ang) * rr;
      const y = pd.y + Math.sin(ang) * rr * 0.72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
    ctx.globalAlpha = 0.8 * a;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const ph = (g.time * 0.8 + i / 3) % 1;
      ctx.globalAlpha = (1 - ph) * 0.7 * a;
      ctx.beginPath();
      ctx.ellipse(pd.x, pd.y, pd.r * 0.7 * ph + 6, pd.r * 0.5 * ph + 4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
  }
  ctx.globalAlpha = 1;
  if (!b) {
    ctx.restore();
    return;
  }

  // garden
  if (sp.garden) {
    const ga = sp.garden;
    for (const pt of ga.pts) {
      if (pt.fired) continue;
      const left = pt.at - ga.t;
      const prog = clamp01(1 - left / ga.tele);
      const locked = left < 0.32;
      const rr = mulberry32(Math.floor(pt.x * 3 + pt.y) + boil);
      ctx.globalAlpha = locked ? 0.95 : 0.5 + Math.sin(g.time * 16) * 0.12;
      ctx.lineWidth = locked ? 4 : 2.2;
      if (!locked) ctx.setLineDash([7, 6]);
      wcircle(ctx, pt.x, pt.y, 46, rr, 2.2, locked ? 2 : 1);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.18 + prog * 0.3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 46 * prog, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      // spikes poking up as the strike nears
      const sp2 = 5;
      for (let i = 0; i < sp2; i++) {
        const a = (i / sp2) * TAU + g.time * 2;
        const L = 10 + prog * 24;
        wline(ctx, pt.x + Math.cos(a) * 16, pt.y + Math.sin(a) * 16, pt.x + Math.cos(a) * (16 + L), pt.y + Math.sin(a) * (16 + L), rr, 1);
      }
    }
  }

  // hive
  if (sp.hive) {
    const h = sp.hive;
    const prog = clamp01(h.t / h.tele);
    const R = 41;
    if (!h.fired) {
      ctx.globalAlpha = 0.12 + prog * 0.26;
      ctx.beginPath();
      for (const c of h.cells) if (!c.safe) hexPath(ctx, c.x, c.y, R);
      ctx.fill();
      ctx.globalAlpha = 0.55 + Math.sin(g.time * 14) * 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const c of h.cells) if (!c.safe) hexPath(ctx, c.x, c.y, R);
      ctx.stroke();
      // safe cells: bright double ring and a tick
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3.4;
      for (const c of h.cells) {
        if (!c.safe) continue;
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        hexPath(ctx, c.x, c.y, R);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        hexPath(ctx, c.x, c.y, R - 7);
        ctx.stroke();
        ctx.lineWidth = 3.4;
        ctx.fillStyle = INK;
        ctx.font = 'bold 26px "Kelly Slab", serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✓", c.x, c.y + 1);
      }
    } else {
      const k = 1 - clamp01((h.t - h.tele) / h.fireDur);
      ctx.globalAlpha = 0.92 * k;
      ctx.beginPath();
      for (const c of h.cells) if (!c.safe) hexPath(ctx, c.x, c.y, R + 2);
      ctx.fill();
      if (q === 0) {
        ctx.strokeStyle = PAPER;
        ctx.globalAlpha = 0.5 * k;
        ctx.lineWidth = 1.6;
        let n = 0;
        for (const c of h.cells) {
          if (c.safe || n++ % 3) continue;
          burst(ctx, c.x, c.y, 6, 22, 6, mulberry32(Math.floor(c.x * 7 + c.y) + boil));
        }
        ctx.strokeStyle = INK;
      }
    }
    ctx.globalAlpha = 1;
  }

  // tidal wall: warning first, then the wave
  if (sp.tidal) {
    const w = sp.tidal;
    const gy0 = w.gapY - w.gapH / 2;
    const gy1 = w.gapY + w.gapH / 2;
    if (!w.fired) {
      const prog = clamp01(w.t / w.tele);
      ctx.globalAlpha = 0.14 + prog * 0.26;
      ctx.fillRect(W - 70, 20, 60, gy0 - 20);
      ctx.fillRect(W - 70, gy1, 60, H - gy1 - 20);
      ctx.globalAlpha = 0.6 + Math.sin(g.time * 14) * 0.2;
      ctx.lineWidth = 3;
      for (const yy of [gy0, gy1]) wline(ctx, 24, yy, W - 10, yy, mulberry32(boil + 6), 2);
      ctx.setLineDash([9, 9]);
      wline(ctx, 24, w.gapY, W - 10, w.gapY, mulberry32(boil + 7), 2);
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const ax = W - 80 - i * 24 - ((g.time * 90) % 24);
        ctx.beginPath();
        ctx.moveTo(ax, w.gapY - 10);
        ctx.lineTo(ax - 12, w.gapY);
        ctx.lineTo(ax, w.gapY + 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.font = 'bold 20px "Kelly Slab", serif';
      ctx.textAlign = "center";
      ctx.fillText("ПРОХОД", W - 150, w.gapY - 18);
    } else {
      ctx.globalAlpha = 0.95;
      const wob = (yy: number) => Math.sin(yy * 0.07 + g.time * 12) * 5;
      for (const [y0, y1] of [[20, gy0], [gy1, H - 20]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(w.x + 26, y0);
        for (let yy = y0; yy <= y1; yy += 14) ctx.lineTo(w.x - 6 + wob(yy), yy);
        ctx.lineTo(w.x - 6 + wob(y1), y1);
        ctx.lineTo(w.x + 26, y1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      wline(ctx, w.x - 4, 24, w.x - 4, gy0, mulberry32(boil + 9), 3);
      wline(ctx, w.x - 4, gy1, w.x - 4, H - 24, mulberry32(boil + 10), 3);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 1;
    }
  }

  // squeeze warning: the band that will go dark
  if (sp.squeeze && !sp.squeeze.fired) {
    const q = sp.squeeze;
    const prog = clamp01(q.t / q.tele);
    const x0 = g.baseLimit - q.depth;
    ctx.globalAlpha = 0.1 + prog * 0.26;
    ctx.fillRect(x0, 20, q.depth + 12, H - 40);
    ctx.globalAlpha = 0.6 + Math.sin(g.time * 14) * 0.2;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    wline(ctx, x0, 22, x0, H - 22, mulberry32(boil + 4), 2);
    ctx.setLineDash([]);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = 90 + i * 110;
      const ax = x0 + 46 - ((g.time * 70) % 30);
      ctx.moveTo(ax + 16, yy - 12);
      ctx.lineTo(ax, yy);
      ctx.lineTo(ax + 16, yy + 12);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 22px "Kelly Slab", serif';
    ctx.textAlign = "center";
    ctx.fillText("ОТОЙДИ ОТ КРАЯ!", x0 - 80, H - 40);
  }

  // lobbed bombs: floor marker + the shell arcing over it
  for (const lb of sp.lob) {
    const prog = clamp01(lb.t / lb.fly);
    const rr = mulberry32(Math.floor(lb.x * 3 + lb.y) + boil);
    if (prog > 0) {
      ctx.globalAlpha = 0.2 + prog * 0.35;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(lb.x, lb.y, lb.r * 0.82 * prog, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = prog > 0.75 ? 3.6 : 2.2;
      if (prog < 0.75) ctx.setLineDash([6, 6]);
      wcircle(ctx, lb.x, lb.y, lb.r * 0.82, rr, 2, 1);
      ctx.setLineDash([]);
    }
  }

  // chain bombs
  for (const bomb of sp.chain) {
    if (bomb.done) continue;
    const left = bomb.fuse - bomb.t;
    const prog = clamp01(bomb.t / bomb.fuse);
    const rr = mulberry32(Math.floor(bomb.x * 5 + bomb.y) + boil);
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 54, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.14 + prog * 0.3;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 54 * prog, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const blink = left < 0.5 && Math.floor(g.time * 16) % 2 === 0;
    ctx.fillStyle = blink ? PAPER : INK;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 13, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.lineWidth = 2.4;
    wline(ctx, bomb.x + 4, bomb.y - 11, bomb.x + 10, bomb.y - 20, rr, 1);
    burst(ctx, bomb.x + 11, bomb.y - 22, 2, 8, 5, rr);
    ctx.font = 'bold 15px "Kelly Slab", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!blink) {
      ctx.fillStyle = PAPER;
      ctx.fillText(String(Math.max(1, Math.ceil(left))), bomb.x, bomb.y + 1);
    }
    ctx.fillStyle = INK;
  }

  // overheat disc
  if (sp.overheat) {
    const o = sp.overheat;
    const prog = clamp01(o.t / o.tele);
    if (!o.fired) {
      const rr = mulberry32(boil * 3 + 4);
      ctx.globalAlpha = 0.1 + prog * 0.18;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * (0.35 + prog * 0.65), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 4;
      wcircle(ctx, o.x, o.y, o.r, rr, 3, 2);
      ctx.lineWidth = 1.6;
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.clip();
      ctx.beginPath();
      const step = 15 - prog * 7;
      for (let d = -o.r * 2; d < o.r * 2; d += step) {
        ctx.moveTo(o.x + d, o.y + o.r);
        ctx.lineTo(o.x + d + o.r, o.y - o.r);
      }
      ctx.globalAlpha = 0.35 + prog * 0.35;
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.font = 'bold 26px "Kelly Slab", serif';
      ctx.textAlign = "center";
      ctx.fillText("ВЫБЕГИ ЗА КРУГ!", o.x, o.y - o.r - 14);
    } else {
      const k = 1 - clamp01((o.t - o.tele) / 0.7);
      ctx.globalAlpha = 0.85 * k;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * (1 + (1 - k) * 0.08), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // lanes
  for (const l of sp.lanes) {
    const x = l.horiz ? 20 : l.pos - l.w / 2;
    const y = l.horiz ? l.pos - l.w / 2 : 20;
    const w = l.horiz ? W - 40 : l.w;
    const h = l.horiz ? l.w : H - 40;
    if (!l.fired) {
      const prog = clamp01(l.t / l.tele);
      const locked = l.tele - l.t < 0.35;
      ctx.globalAlpha = 0.1 + prog * 0.18;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = locked ? 0.95 : 0.55 + Math.sin(g.time * 14) * 0.12;
      ctx.lineWidth = locked ? 3.4 : 2;
      if (!locked) ctx.setLineDash([10, 8]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.4;
      hatchRect(ctx, x, y, w, h, 13 - prog * 4);
    } else {
      const k = 1 - clamp01((l.t - l.tele) / l.fireDur);
      ctx.globalAlpha = 0.95 * k;
      ctx.fillRect(x, y, w, h);
      if (q === 0) {
        ctx.strokeStyle = PAPER;
        ctx.globalAlpha = 0.55 * k;
        ctx.lineWidth = 1.6;
        const rr = mulberry32(Math.floor(l.pos) + boil);
        for (let i = 0; i < 12; i++) {
          const along = l.horiz ? 30 + rr() * (W - 60) : 30 + rr() * (H - 60);
          const cx = l.horiz ? along : l.pos + (rr() - 0.5) * l.w * 0.7;
          const cy = l.horiz ? l.pos + (rr() - 0.5) * l.w * 0.7 : along;
          wline(ctx, cx, cy, cx + (rr() - 0.5) * 24, cy - 12 - rr() * 22, rr, 1.5);
        }
        ctx.strokeStyle = INK;
      }
    }
    ctx.globalAlpha = 1;
  }

  // X slash
  if (sp.xslash) {
    const x = sp.xslash;
    const rr = mulberry32(boil * 5 + 2);
    if (!x.fired) {
      const locked = x.tele - x.t < 0.4;
      ctx.globalAlpha = locked ? 0.95 : 0.5 + Math.sin(g.time * 15) * 0.14;
      for (const l of x.lines) {
        const nx = -Math.sin(l.ang);
        const ny = Math.cos(l.ang);
        const dx = Math.cos(l.ang) * 1300;
        const dy = Math.sin(l.ang) * 1300;
        ctx.lineWidth = locked ? 3.6 : 2;
        for (const s of [-1, 1]) wline(ctx, x.cx - dx + nx * 25 * s, x.cy - dy + ny * 25 * s, x.cx + dx + nx * 25 * s, x.cy + dy + ny * 25 * s, rr, 2);
        ctx.setLineDash([8, 10]);
        wline(ctx, x.cx - dx, x.cy - dy, x.cx + dx, x.cy + dy, rr, 2);
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
      ctx.font = 'bold 22px "Kelly Slab", serif';
      ctx.textAlign = "center";
      ctx.fillText(locked ? "ВСТАНЬ В ПРОМЕЖУТОК" : "КРЕСТ ГОТОВИТСЯ", W / 2, H - 46);
    } else {
      const k = 1 - clamp01((x.t - x.tele) / x.dur);
      ctx.globalAlpha = k;
      for (const l of x.lines) {
        const dx = Math.cos(l.ang) * 1300;
        const dy = Math.sin(l.ang) * 1300;
        ctx.lineWidth = 28;
        wline(ctx, x.cx - dx, x.cy - dy, x.cx + dx, x.cy + dy, rr, 3);
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 10;
        wline(ctx, x.cx - dx, x.cy - dy, x.cx + dx, x.cy + dy, rr, 2);
        ctx.strokeStyle = INK;
      }
      ctx.globalAlpha = 1;
    }
  }

  // octopus ray fan
  if (sp.octo) {
    const o = sp.octo;
    const rr = mulberry32(boil * 3 + 8);
    for (let i = 0; i < o.beams; i++) {
      const a = o.ang + (i * TAU) / o.beams;
      const x2 = b.x + Math.cos(a) * o.len;
      const y2 = b.y + Math.sin(a) * o.len;
      if (o.t < o.tele) {
        ctx.globalAlpha = 0.5 + Math.sin(g.time * 16) * 0.15;
        ctx.setLineDash([9, 9]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalAlpha = 0.75 + Math.random() * 0.25;
        ctx.lineWidth = 15;
        lightning(ctx, b.x, b.y, x2, y2, rr, 8, q === 0 ? 5 : 1);
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 6;
        lightning(ctx, b.x, b.y, x2, y2, rr, 5, 0);
        ctx.strokeStyle = INK;
      }
    }
    ctx.globalAlpha = 1;
  }

  // gaze cones: polygon is clipped by rocks, so it shows exactly where the light reaches
  for (const c of sp.cones) {
    const active = c.t >= c.tele;
    const N = q === 0 ? 26 : 12;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    const ends: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const a = c.ang - c.spread + (i / N) * c.spread * 2;
      const d = rayHit(g, b.x, b.y, a, c.len);
      const x = b.x + Math.cos(a) * d;
      const y = b.y + Math.sin(a) * d;
      ends.push([x, y]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = active ? 0.2 : 0.07 + Math.sin(g.time * 12) * 0.03;
    ctx.fill();
    ctx.globalAlpha = active ? 0.95 : 0.55;
    ctx.lineWidth = active ? 3.2 : 2;
    if (!active) ctx.setLineDash([8, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (active) {
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (let i = 0; i < ends.length; i += 2) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(ends[i][0], ends[i][1]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // blink destination marker
  if (sp.blink && !sp.blink.done) {
    const k = sp.blink;
    const prog = clamp01(k.t / k.tele);
    const rr = mulberry32(boil * 7 + 1);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const rad = (1 - prog) * 60 + 20 + i * 14;
      wcircle(ctx, k.tx, k.ty, rad, rr, 2, 1);
    }
    ctx.lineWidth = 2;
    burst(ctx, k.tx, k.ty, 8, 30, 10, rr, g.time * 3);
    ctx.globalAlpha = 1;
  }

  // vortex
  if (sp.vortex) {
    const v = sp.vortex;
    const active = v.t >= v.tele;
    ctx.lineWidth = 2;
    const arms = 4;
    for (let a = 0; a < arms; a++) {
      ctx.globalAlpha = active ? 0.6 : 0.25;
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const t = i / 36;
        const rad = b.r + 6 + t * 300;
        const ang = (a / arms) * TAU + t * 3.1 - g.time * (active ? 3.6 : 1.4);
        const x = b.x + Math.cos(ang) * rad;
        const y = b.y + Math.sin(ang) * rad * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (active && q === 0) {
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 22; i++) {
        const t = (i / 22 + g.time * 0.8) % 1;
        const rad = b.r + 6 + (1 - t) * 300;
        const ang = (i / 22) * TAU * 2 + t * 3;
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(ang) * rad, b.y + Math.sin(ang) * rad * 0.9, 2.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // eggs
  for (const e of sp.eggs) {
    const left = e.t;
    const ready = clamp01(1 - left / e.max);
    const wob = left < 1.5 ? Math.sin(g.time * 34 + e.seed) * (1 + (1.5 - left) * 1.6) : Math.sin(g.time * 4 + e.seed) * 1.2;
    const appear = clamp01((e.max - left) / 0.45);
    ctx.save();
    ctx.translate(e.x + wob, e.y);
    ctx.scale(appear, appear);
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(3, 16, 15, 5, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = e.hurt > 0 ? INK : PAPER;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 19, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const [dx, dy, r] of [[-5, -6, 2.4], [5, 2, 3], [-3, 8, 2], [6, -9, 1.8]] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, TAU);
      ctx.fill();
    }
    // cracks creep across the shell as hatching nears
    ctx.lineWidth = 1.8;
    const crack = Math.floor(ready * 5);
    for (let i = 0; i < crack; i++) {
      ctx.beginPath();
      ctx.moveTo(-10 + i * 4, -14 + (i % 2) * 5);
      ctx.lineTo(-4 + i * 4, -4 + (i % 2) * 8);
      ctx.lineTo(-9 + i * 5, 6);
      ctx.stroke();
    }
    ctx.restore();
    // hatch countdown ring
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 27, -Math.PI / 2, -Math.PI / 2 + ready * TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** things that fly above characters */
export function drawSpecialOver(g: Game, boil: number) {
  const sp = g.special;
  const b = g.boss;
  if (!b || !sp.crown) return;
  const ctx = g.ctx;
  const sp2 = g.special;
  if (sp2.lob.length) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    for (const lb of sp2.lob) {
      const prog = clamp01(lb.t / lb.fly);
      if (prog <= 0 || lb.fired) continue;
      const x = lb.sx + (lb.x - lb.sx) * prog;
      const y = lb.sy + (lb.y - lb.sy) * prog - Math.sin(prog * Math.PI) * (lb.arc ?? 150);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lb.spin);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      wline(ctx, 4, -8, 10, -14, mulberry32(Math.floor(lb.spin * 10)), 1);
      ctx.restore();
    }
    ctx.restore();
  }
  const c = sp.crown;
  const rr = mulberry32(boil + 77);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  if (c.t < c.tele) {
    const prog = clamp01(c.t / c.tele);
    ctx.globalAlpha = 0.6 + Math.sin(g.time * 16) * 0.2;
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.tx, c.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    wcircle(ctx, c.tx, c.ty, 34 + (1 - prog) * 18, rr, 2, 2);
    ctx.globalAlpha = 1;
  } else {
    // blurred trail
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + (b.x - c.x) * 0.1, c.y + (b.y - c.y) * 0.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.spin);
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 10);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-11, -3);
    ctx.lineTo(0, -20);
    ctx.lineTo(11, -3);
    ctx.lineTo(24, -14);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const x of [-11, 0, 11]) {
      ctx.beginPath();
      ctx.arc(x, 3, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 1.6;
    burst(ctx, c.x, c.y, 26, 38, 8, rr, c.spin);
  }
  ctx.restore();
}

/** screen-level: ink darkness + royal decree banner */
export function drawSpecialTop(g: Game, boil: number) {
  const sp = g.special;
  const ctx = g.ctx;
  const p = g.player;
  if (sp.darkness > 0) {
    const fadeIn = clamp01((sp.darkMax - sp.darkness) / 0.5);
    const fadeOut = clamp01(sp.darkness / 0.6);
    const a = Math.min(fadeIn, fadeOut);
    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, 62, p.x, p.y, 215);
    grad.addColorStop(0, "rgba(20,20,20,0)");
    grad.addColorStop(1, `rgba(20,20,20,${0.93 * a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-80, -80, W + 160, H + 160);
    ctx.restore();
    // danger must stay readable inside the dark
    g.drawHazards(boil);
    g.drawBossTelegraph(boil);
    drawSpecialOverlayDanger(g, boil);
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const eb of g.ebullets) {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, (eb.r ?? 6) + 1, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSpecialOverlayDanger(g: Game, boil: number) {
  const sp = g.special;
  const b = g.boss;
  if (!b || !sp.octo) return;
  const o = sp.octo;
  const ctx = g.ctx;
  ctx.save();
  ctx.strokeStyle = PAPER;
  ctx.lineCap = "round";
  for (let i = 0; i < o.beams; i++) {
    const a = o.ang + (i * TAU) / o.beams;
    ctx.globalAlpha = o.t < o.tele ? 0.75 : 1;
    ctx.lineWidth = 5;
    if (o.t < o.tele) ctx.setLineDash([9, 9]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.cos(a) * o.len, b.y + Math.sin(a) * o.len);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  void boil;
  ctx.restore();
}

/** decree is drawn in screen space (after the world), so it reads as an order from the page itself */
export function drawDecree(g: Game, boil: number) {
  const W = g.limitX;
  const d = g.special.decree;
  if (!d) return;
  const ctx = g.ctx;
  const active = d.t >= d.tele;
  const rr = mulberry32(boil * 3 + 1);
  const label = d.kind === "stop" ? "СТОЙ!" : "ДВИГАЙСЯ!";
  const sub = d.kind === "stop" ? "не касайся клавиш движения" : "стоять на месте нельзя";
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  // frame
  ctx.globalAlpha = active ? 0.55 : 0.3;
  ctx.lineWidth = active ? 10 : 5;
  if (!active) ctx.setLineDash([22, 14]);
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.setLineDash([]);
  if (active) {
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y = 14 + i * 22;
      wline(ctx, 14, y, 46, y - 24, rr, 2);
      wline(ctx, W - 14, y, W - 46, y - 24, rr, 2);
    }
  }
  // banner
  const prog = active ? 1 : clamp01(d.t / d.tele);
  const pop = active ? 1 + Math.max(0, 0.35 - (d.t - d.tele)) * 0.8 : 0.6 + prog * 0.4;
  ctx.globalAlpha = active ? 0.92 : clamp01(prog * 1.4);
  ctx.translate(W / 2, H * 0.3);
  ctx.rotate(-0.04);
  ctx.scale(pop, pop);
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 6;
  const bw = 330;
  const bh = 112;
  ctx.beginPath();
  ctx.rect(-bw / 2, -bh / 2, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeRect(-bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 15px "Kelly Slab", serif';
  ctx.fillText("★ ПО ПРИКАЗУ КОРОЛЯ ★", 0, -34);
  ctx.font = 'bold 56px "Kelly Slab", serif';
  ctx.fillText(label, 0, 4);
  ctx.font = '20px "Caveat", cursive';
  ctx.fillText(sub, 0, 40);
  // timer bar
  ctx.fillStyle = INK;
  const t = active ? 1 - (d.t - d.tele) / d.dur : 1 - d.t / d.tele;
  ctx.fillRect(-bw / 2 + 12, bh / 2 - 12, (bw - 24) * clamp01(t), 4);
  ctx.restore();
}

/** attacks that need a trigger exactly when their warning ends */
export function executeSpecial(g: Game, kind: AttackKind) {
  const sp = g.special;
  if (kind === "darkness") {
    sp.darkness = 5.8;
    sp.darkMax = 5.8;
    sp.darkTick = 0.5;
    g.flash = Math.max(g.flash, 0.05);
    g.shake = Math.max(g.shake, 10);
    sfx.bigBoom();
  }
}
