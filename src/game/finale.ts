// The campaign finale. When the Ink King falls, something older reaches over his shoulder:
// the Tentacle Lord from sheet one crushes the King, then tears the page — the whole browser
// window — and only the left half survives. The last fight happens on that torn strip.
import { mulberry32, wline, wcircle, burst, splat } from "./sketch";
import { sfx } from "./sfx";
import { BOSSES, type EnemyKind } from "./levels";
import { clearSpecial } from "./bosses2";
import type { Game } from "./engine";

export const FIN_LIMIT = 560;
const W = 960;
const H = 600;
const TAU = Math.PI * 2;
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

const T_SHADOW = 1.7;
const T_CRUSH = 3.7;
const T_AFTER = 4.6;
const T_CUT = 6.6;
const T_FIGHT = 8.1;

export interface Finale {
  stage: "stagger" | "shadow" | "crush" | "after" | "cut";
  t: number;
  kx: number;
  ky: number;
  rumble: boolean;
  crushed: boolean;
  spawned: boolean;
  cut: boolean;
  dark: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function isFinaleLevel(g: Game) {
  return !g.endless && g.levelIndex === 5 && g.boss?.def.id === "king";
}

/** called the moment the King's last HP is gone */
export function startFinale(g: Game) {
  const b = g.boss!;
  b.state = "finale";
  b.attack = null;
  b.telegraph = 0;
  b.emit = null;
  b.laser = null;
  b.charging = 0;
  b.queenDash = null;
  b.queenSlash = null;
  b.leap = null;
  clearSpecial(g);
  g.ebullets = [];
  g.hazards = [];
  g.damageRings = [];
  g.enemies = [];
  g.spawnQueue = [];
  g.bossBanner = 0;
  g.player.invuln = 99;
  g.fin = { stage: "stagger", t: 0, kx: b.x, ky: b.y, rumble: false, crushed: false, spawned: false, cut: false, dark: 0 };
  g.flash = 0.12;
  g.shake = 22;
  g.freeze = 0.1;
  sfx.bigBoom();
  // the king's kill still counts
  const m = g.meta;
  if (!m.bossKills.includes("king")) m.bossKills.push("king");
  g.unlockSticker("boss_first");
  g.addXp(220 + g.levelIndex * 50);
  g.score += 600 + g.levelIndex * 300;
  g.saveMetaNow();
  g.emit();
}

function placeCut(g: Game) {
  g.pageCut = true;
  g.baseLimit = FIN_LIMIT;
  g.limitTarget = FIN_LIMIT;
  g.obstacles = g.obstacles.filter((o) => o.x < FIN_LIMIT - 70);
  g.obstacleLayers = [null, null, null, null];
  g.hudValid = false;
  g.checkpointPerks = { ...g.perks };
  g.finalCheckpoint = true;
}

/** respawn straight into the last fight (used by "try again" after dying to the Lord) */
export function jumpToFinale(g: Game) {
  g.wave = g.level.waves;
  g.spawnQueue = [];
  g.enemies = [];
  g.bossPending = false;
  g.waveCooldown = 0;
  g.perks = { ...g.checkpointPerks };
  placeCut(g);
  g.limitX = FIN_LIMIT;
  g.cutKey++;
  const lord = g.makeBoss(BOSSES.abyss, BOSSES.abyss.hp);
  lord.x = FIN_LIMIT / 2;
  lord.y = 150;
  lord.state = "intro";
  lord.stateT = 2.4;
  g.boss = lord;
  g.initTentacles();
  g.bossBanner = 3;
  const p = g.player;
  p.x = FIN_LIMIT / 2;
  p.y = H * 0.66;
  p.hp = p.maxHp;
  p.invuln = 2.2;
  g.ult = 100;
  g.fin = null;
  g.finalFight = true;
  g.minionT = 7;
  g.emit();
}

export function updateFinale(g: Game, dt: number) {
  const f = g.fin;
  if (!f) return;
  const b = g.boss!;
  const p = g.player;
  f.t += dt;
  const t = f.t;
  p.invuln = Math.max(p.invuln, 1);
  p.fireCd = Math.max(p.fireCd, 0.25);

  // darkness ramps up while the shadow grows, then lifts after the cut
  f.dark = t < T_SHADOW ? 0 : t < T_CUT ? Math.min(0.62, (t - T_SHADOW) * 0.62) : Math.max(0, 0.62 - (t - T_CUT) * 0.5);

  if (t < T_SHADOW) {
    f.stage = "stagger";
    b.x = f.kx + Math.sin(t * 38) * (2 + t * 3.2);
    b.flash = 0.05;
    g.shake = Math.max(g.shake, 6 + t * 5);
    if (Math.random() < dt * 34) g.drop(b.x + rand(-b.r, b.r) * 0.8, b.y + rand(-b.r, b.r) * 0.6, 200 + Math.random() * 160);
  } else if (t < T_CRUSH) {
    f.stage = "shadow";
    b.x = f.kx + Math.sin(t * 30) * 2.4;
    if (!f.rumble) {
      f.rumble = true;
      sfx.bossIntro();
      g.addText(W / 2, 140, "ЧТО-ТО ИДЁТ СЗАДИ...", 2.2, 1.55);
    }
    g.shake = Math.max(g.shake, 5 + (t - T_SHADOW) * 3.4);
    if (Math.random() < dt * 40) g.drop(rand(40, W - 40), 30, 40 + Math.random() * 120);
  } else if (t < T_AFTER) {
    f.stage = "crush";
    if (!f.crushed) {
      f.crushed = true;
      g.flash = 0.26;
      g.shake = 46;
      g.freeze = 0.22;
      g.zoom = 0.09;
      for (let i = 0; i < 3; i++) g.shock(f.kx, f.ky, 16 + i * 14, 1000 - i * 210, 0.7 + i * 0.22);
      g.petals.push({ x: f.kx, y: f.ky, life: 1.3, max: 1.3, seed: Math.random() * 1e6, n: 12 });
      for (let i = 0; i < 11; i++) {
        g.cracks.push({ x: f.kx, y: f.ky, ang: (i / 11) * TAU + Math.random() * 0.4, len: 120 + Math.random() * 300, life: 0.8, max: 0.8, seed: Math.floor(Math.random() * 1e6) });
      }
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU;
        g.stains.push({ x: f.kx + Math.cos(a) * rand(10, 130), y: f.ky + Math.sin(a) * rand(10, 90), size: 10 + Math.random() * 30, seed: Math.random() * 1e6, born: g.time });
      }
      for (let i = 0; i < 110; i++) g.drop(f.kx, f.ky, 200 + Math.random() * 640);
      g.edgeSplat(6, 54);
      g.addText(f.kx, f.ky - 70, "ХРЯСЬ!", 2, 2.2);
      sfx.bigBoom();
    }
    b.squash = clamp01((t - T_CRUSH) / 0.42);
    b.flash = 0.05;
    g.shake = Math.max(g.shake, 10 * (1 - clamp01((t - T_CRUSH) / 0.9)));
  } else {
    // the King is gone; the Lord takes his place
    if (!f.spawned) {
      f.spawned = true;
      const lord = g.makeBoss(BOSSES.abyss, BOSSES.abyss.hp);
      lord.x = Math.max(150, Math.min(FIN_LIMIT - 150, f.kx));
      lord.y = -180;
      lord.state = "finale";
      g.boss = lord;
      g.initTentacles();
      g.shock(lord.x, 40, 20, 900, 0.9);
      g.flash = 0.1;
      sfx.bossIntro();
    }
    const lord = g.boss!;
    lord.t += 0;
    lord.y += (150 - lord.y) * Math.min(1, dt * 2.6);
    f.stage = "after";
    if (t >= T_CUT && !f.cut) {
      f.cut = true;
      f.stage = "cut";
      g.cutKey++;
      placeCut(g);
      g.flash = 0.32;
      g.shake = 42;
      g.zoom = 0.06;
      sfx.laserFire();
      sfx.bigBoom();
      g.addText(FIN_LIMIT / 2, H * 0.3, "СТРАНИЦА ОБОРВАНА!", 2.4, 1.6);
      p.hp = Math.min(p.maxHp, p.hp + 3);
      g.ult = 100;
      for (let i = 0; i < 70; i++) g.drop(FIN_LIMIT, rand(20, H - 20), 180 + Math.random() * 480);
      g.edgeSplat(5, 46);
      g.emit();
    }
    if (f.cut) {
      f.stage = "cut";
      // the edge slides in with the same easing the page shift uses on the DOM side
      const u = clamp01((t - T_CUT) / 0.9);
      g.limitX = W - (W - FIN_LIMIT) * ease(u);
    }
    if (t >= T_FIGHT) {
      lord.state = "intro";
      lord.stateT = 2.2;
      g.bossBanner = 3;
      g.fin = null;
      g.finalFight = true;
      g.minionT = 7;
      p.invuln = 1.6;
      g.limitX = FIN_LIMIT;
      sfx.bossIntro();
      g.emit();
    }
  }
}

/** minions pour out of the void while the Lord fights */
export function updateFinaleFight(g: Game, dt: number) {
  const b = g.boss;
  if (!g.finalFight || !b || b.state !== "fight") return;
  g.minionT -= dt;
  const cap = 11 + b.phase * 3;
  if (g.minionT <= 0 && g.enemies.length < cap) {
    g.minionT = 7 - b.phase * 1.2;
    const n = 4 + b.phase * 2;
    const kinds: EnemyKind[] = ["blob", "fly", "spiky", "brute", "shooter", "zipper", "splitter", "bomber", "sniper", "shield", "ghost"];
    g.addText(g.limitX - 120, 70, "ИЗ ПУСТОТЫ ЛЕЗУТ КЛЯКСЫ!", 1.4, 1.1);
    sfx.summon();
    for (let i = 0; i < n; i++) g.spawnEnemy(kinds[Math.floor(Math.random() * kinds.length)]);
  }
}

/** the page being let go: called when the Lord finally dies */
export function releasePage(g: Game) {
  g.pageCut = false;
  g.baseLimit = W;
  g.limitTarget = W;
  g.finalFight = false;
  g.finalCheckpoint = false;
  g.cutKey++;
}

/* ------------------------------------------------------------------ drawing */

/** behind the King: the shadow that is coming for him */
export function drawFinaleUnder(g: Game, boil: number) {
  const f = g.fin;
  if (!f || f.t < T_SHADOW - 0.2 || f.t >= T_CRUSH + 0.3) return;
  const ctx = g.ctx;
  const k = clamp01((f.t - T_SHADOW) / 1.9);
  const r = mulberry32(boil * 3 + 11);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  // a vast eye lowering from the top edge
  const ey = -70 + k * 150;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.ellipse(f.kx, ey, 140 + k * 40, 78 + k * 16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.ellipse(f.kx, ey + 8, 96 + k * 26, 50 + k * 10, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  const pupil = Math.sin(f.t * 1.2) * 8;
  ctx.beginPath();
  ctx.ellipse(f.kx + pupil, ey + 14, 14, 38, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    wline(ctx, f.kx + pupil + Math.cos(a) * 18, ey + 14 + Math.sin(a) * 30, f.kx + pupil + Math.cos(a) * 40, ey + 14 + Math.sin(a) * 40, r, 1);
  }
  ctx.strokeStyle = INK;
  // tentacles reaching down on both sides of the King
  for (let i = 0; i < 9; i++) {
    const side = i - 4;
    const x0 = f.kx + side * 82;
    const reach = Math.max(0, k * 1.15 - Math.abs(side) * 0.08);
    const tipY = -40 + reach * (f.ky + 40);
    const tipX = f.kx + side * (60 - reach * 28) + Math.sin(f.t * 3 + i) * 12;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 26 - Math.abs(side) * 2;
    ctx.beginPath();
    ctx.moveTo(x0, -60);
    ctx.quadraticCurveTo(x0 + Math.sin(f.t * 2.2 + i) * 40, tipY * 0.55, tipX, tipY);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = PAPER;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(x0 - 4, -50);
    ctx.quadraticCurveTo(x0 - 4 + Math.sin(f.t * 2.2 + i) * 40, tipY * 0.5, tipX - 4, tipY - 14);
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  ctx.restore();
}

/** above everything in the world: the crushing blow, the title card, the tear itself */
export function drawFinaleOver(g: Game, boil: number) {
  const f = g.fin;
  if (!f) return;
  const ctx = g.ctx;
  const t = f.t;
  const r = mulberry32(boil * 7 + 3);
  ctx.save();
  ctx.lineCap = "round";
  // darkness
  if (f.dark > 0.01) {
    ctx.fillStyle = INK;
    ctx.globalAlpha = f.dark;
    ctx.fillRect(-60, -60, W + 120, H + 120);
  }
  ctx.globalAlpha = 1;
  // the crushing tentacle
  if (t >= T_CRUSH - 0.18 && t < T_CRUSH + 0.9) {
    const drop = clamp01((t - (T_CRUSH - 0.18)) / 0.18);
    const hold = clamp01((t - T_CRUSH) / 0.9);
    const y = -120 + drop * (f.ky + 10 + 120);
    ctx.globalAlpha = 1 - hold * hold;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 62 - hold * 16;
    ctx.beginPath();
    ctx.moveTo(f.kx + 4, -140);
    ctx.quadraticCurveTo(f.kx + 24 + Math.sin(t * 40) * 3, y * 0.5, f.kx, y);
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.strokeStyle = PAPER;
    ctx.globalAlpha *= 0.45;
    ctx.beginPath();
    ctx.moveTo(f.kx - 14, -120);
    ctx.quadraticCurveTo(f.kx + 4, y * 0.5, f.kx - 14, y - 16);
    ctx.stroke();
    ctx.strokeStyle = INK;
    // suckers
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = (1 - hold) * 0.9;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(f.kx + 12, y - i * 34, 5.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    if (drop >= 1 && hold < 0.35) {
      ctx.globalAlpha = 1 - hold * 2.5;
      ctx.lineWidth = 4;
      burst(ctx, f.kx, f.ky, 40, 150 + hold * 220, 22, r, boil);
    }
    ctx.globalAlpha = 1;
  }
  // "the lord returned" title card
  if (t >= T_AFTER + 0.2 && t < T_CUT + 0.2) {
    const a = clamp01((t - T_AFTER - 0.2) / 0.3) * (1 - clamp01((t - (T_CUT - 0.3)) / 0.5));
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.rotate(-0.025);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.rect(-300, -54, 600, 108);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeRect(-290, -44, 580, 88);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 15px "Manrope", sans-serif';
    ctx.fillText("БОСС ПЕРВОГО ЛИСТА", 0, -30);
    ctx.font = 'bold 38px "Kelly Slab", serif';
    ctx.fillText("ВЛАДЫКА ЩУПАЛЕЦ ВЕРНУЛСЯ", 0, 2);
    ctx.font = '24px "Caveat", cursive';
    ctx.fillText("он давно ждал, когда ты закончишь с королём", 0, 34);
    ctx.restore();
  }
  // a bright rip along the tear line
  if (f.cut && t < T_CUT + 0.7) {
    const k = 1 - clamp01((t - T_CUT) / 0.7);
    ctx.globalAlpha = k;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 12 * k + 2;
    ctx.beginPath();
    let x = g.limitX;
    ctx.moveTo(x, -10);
    for (let y = -10; y <= H + 10; y += 18) {
      x = g.limitX + Math.sin(y * 0.37) * 6 + (r() - 0.5) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** the void: the torn-away right side of the page. Drawn after the world, before the HUD. */
export function drawVoid(g: Game, boil: number) {
  if (g.limitX >= W - 0.5) return;
  const ctx = g.ctx;
  const lx = g.limitX;
  const r = mulberry32(boil + 91);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(lx, -40);
  for (let y = -40; y <= H + 40; y += 16) ctx.lineTo(lx - 6 + Math.sin(y * 0.31) * 5 + Math.sin(y * 0.87) * 3, y);
  ctx.lineTo(W + 120, H + 40);
  ctx.lineTo(W + 120, -40);
  ctx.closePath();
  ctx.fill();
  // paper-white torn rim
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  for (let y = -40; y <= H + 40; y += 16) {
    const x = lx - 9 + Math.sin(y * 0.31) * 5 + Math.sin(y * 0.87) * 3;
    if (y === -40) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // drifting specks and watching eyes in the dark
  if (g.quality < 2) {
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.22;
    const n = g.quality ? 10 : 22;
    for (let i = 0; i < n; i++) {
      const sx = lx + 12 + ((i * 97 + g.time * (8 + (i % 5) * 4)) % Math.max(40, W - lx));
      const sy = (i * 53 + g.time * (10 + (i % 3) * 8)) % H;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = PAPER;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const ex = lx + 80 + i * 90;
      const ey = 120 + ((i * 131) % 360);
      wcircle(ctx, ex, ey, 14, r, 1.4, 1);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(ex + Math.sin(g.time + i) * 4, ey, 4, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  void splat;
}
