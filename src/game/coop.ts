// Co-op wire format. The host runs the whole simulation and ships a compact snapshot;
// the guest only renders it and streams its own input back.
import type { Game } from "./engine";
import { ENDLESS, LEVELS } from "./levels";
import type { WeaponId } from "./levels";

export interface RemoteInput {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  fire: boolean;
  dash: boolean;
  ult: boolean;
  weapon: WeaponId | null;
}

type Num = number;
/** [x, y, angle, hp, maxHp, down, reviveT, dashTime, moving, recoil, flash, invuln, muzzle, weaponIdx] */
type PlayerWire = Num[];
/** [id, kindIdx, x, y, r, hp, maxHp, angle, flash, age, phase, fireCd, chargeT, dashT] */
type EnemyWire = Num[];

export interface CoopSnap {
  t: number;
  p1: PlayerWire;
  p2: PlayerWire;
  en: EnemyWire[];
  bu: Num[][];
  eb: Num[][];
  pk: Num[][];
  ob: Num[][];
  boss: Record<string, unknown> | null;
  sp: Record<string, unknown> | null;
  st: Num[][];
  hud: Record<string, unknown>;
}

const KINDS = ["blob", "fly", "spiky", "brute", "shooter", "zipper", "splitter", "bomber", "sniper", "shield", "ghost", "boss"] as const;
const WEAPONS = ["pistol", "shotgun", "smg", "rail", "rocket"] as const;
const PICKUPS = ["heart", "shotgun", "smg", "rail", "rocket"] as const;
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

type P = Game["player"];

function packPlayer(p: P): PlayerWire {
  return [
    r1(p.x), r1(p.y), r2(p.angle), p.hp, p.maxHp, p.down ? 1 : 0, r2(p.reviveT),
    r2(p.dashTime), p.moving > 0 ? 1 : 0, r2(p.recoil), r2(p.flash), r2(p.invuln), r2(p.muzzle),
    Math.max(0, WEAPONS.indexOf(p.weapon as never)), p.active ? 1 : 0, p.shield ? 1 : 0,
  ];
}
function applyPlayer(p: P, w: PlayerWire) {
  if (!w) return;
  p.x = w[0];
  p.y = w[1];
  p.angle = w[2];
  p.hp = w[3];
  p.maxHp = w[4];
  p.down = !!w[5];
  p.reviveT = w[6];
  p.dashTime = w[7];
  p.moving = w[8];
  p.recoil = w[9];
  p.flash = w[10];
  p.invuln = w[11];
  p.muzzle = w[12];
  p.weapon = WEAPONS[w[13]] ?? "pistol";
  p.active = !!w[14];
  p.shield = !!w[15];
}

/** everything the guest needs for one rendered frame */
export function snapshot(g: Game): CoopSnap {
  const b = g.boss;
  return {
    t: r2(g.time),
    p1: packPlayer(g.player),
    p2: packPlayer(g.mate),
    en: g.enemies.map((e) => [
      e.id, Math.max(0, KINDS.indexOf(e.kind as never)), r1(e.x), r1(e.y), e.r, r1(e.hp), r1(e.maxHp),
      r2(e.angle), r2(e.flash), r2(e.age), r2(e.phase), r2(e.fireCd), r2(e.chargeT), r2(e.dashT),
    ]),
    bu: g.bullets.map((x) => [r1(x.x), r1(x.y), r1(x.vx), r1(x.vy), x.rocket ? 1 : 0]),
    eb: g.ebullets.map((x) => [r1(x.x), r1(x.y), r1(x.vx), r1(x.vy), x.r, x.needle ? 1 : 0]),
    pk: g.pickups.map((x) => [x.id, r1(x.x), r1(x.y), Math.max(0, PICKUPS.indexOf(x.kind as never)), r1(x.life)]),
    ob: g.obstacles.map((o) => [o.x, o.y, o.r, o.seed]),
    st: g.stains.slice(-26).map((x) => [r1(x.x), r1(x.y), r1(x.size), x.seed]),
    boss: b
      ? {
          id: b.def.id, x: r1(b.x), y: r1(b.y), r: b.r, hp: r1(b.hp), maxHp: b.maxHp, phase: b.phase,
          state: b.state, angle: r2(b.angle), t: r2(b.t), bob: r2(b.bob), flash: r2(b.flash), hop: r1(b.hop),
          squash: b.squash ? r2(b.squash) : 0, attack: b.attack, tele: r2(b.telegraph), teleT: r2(b.telegraphTotal),
          tx: r1(b.targetX), ty: r1(b.targetY), lock: r2(b.lockAngle), charging: r2(b.charging), chargeAngle: r2(b.chargeAngle),
          laser: b.laser ? [r2(b.laser.angle), r2(b.laser.charge), r2(b.laser.active)] : null,
          qd: b.queenDash ? [r1(b.queenDash.x1), r1(b.queenDash.y1), r1(b.queenDash.x2), r1(b.queenDash.y2), r2(b.queenDash.t), b.queenDash.duration] : null,
          qs: b.queenSlash ? [r2(b.queenSlash.angle), r1(b.queenSlash.offset), r2(b.queenSlash.t), b.queenSlash.duration] : null,
          tents: b.tents.map((t) => [r1(t.tipX), r1(t.tipY), r2(t.base), r2(t.phase), r1(t.bend), r2(t.glow), ["idle", "windup", "strike", "recover", "sweep"].indexOf(t.mode), t.arm]),
          sweep: b.sweep ? [r2(b.sweep.t), b.sweep.tele, b.sweep.dur, r2(b.sweep.angle), b.sweep.dir, b.sweep.speed, b.sweep.arms, b.sweep.len, b.sweep.active ? 1 : 0] : null,
          lashes: b.lashes.map((l) => [l.tent, r1(l.x), r1(l.y), r2(l.t), l.tele, ["wait", "tele", "strike", "done"].indexOf(l.state)]),
        }
      : null,
    sp: g.special as unknown as Record<string, unknown>,
    hud: {
      hp: g.player.hp, maxHp: g.player.maxHp, score: g.score, wave: g.wave, waves: g.level.waves, kills: g.kills,
      combo: g.combo, ult: g.ult, ammo: g.ammo, limitX: r1(g.limitX), pageCut: g.pageCut, frenzyOn: g.frenzyOn,
      bossHp: b ? b.hp / b.maxHp : -1, bossName: b?.def.name ?? "", bossPhase: b?.phase ?? 0, bossAttack: b?.attack ?? null,
      levelIndex: g.levelIndex, status: g.status, perks: g.perks, perkChoices: g.perkChoices, perkArm: r2(g.perkArm),
      vote: g.vote, dark: r2(g.darkT), shake: r1(g.shake), zoom: r2(g.zoom), flash: r2(g.flash),
    },
  };
}

/** the guest rebuilds a renderable world out of the snapshot */
export function applySnapshot(g: Game, s: CoopSnap) {
  applyPlayer(g.player, s.p1);
  applyPlayer(g.mate, s.p2);
  g.mate.active = true;

  const seen = new Map<number, Game["enemies"][number]>();
  for (const e of g.enemies) seen.set(e.id, e);
  g.enemies = s.en.map((w) => {
    const prev = seen.get(w[0]);
    const e = prev ?? g.makeEnemy(KINDS[w[1]] as never, w[2], w[3]);
    e.id = w[0];
    e.kind = KINDS[w[1]] as never;
    // smooth the 20 Hz stream into 60 fps motion
    if (prev) {
      e.x += (w[2] - e.x) * 0.5;
      e.y += (w[3] - e.y) * 0.5;
    } else {
      e.x = w[2];
      e.y = w[3];
    }
    e.r = w[4];
    e.hp = w[5];
    e.maxHp = w[6];
    e.angle = w[7];
    e.flash = w[8];
    e.age = w[9];
    e.phase = w[10];
    e.fireCd = w[11];
    e.chargeT = w[12];
    e.dashT = w[13];
    e.dead = false;
    return e;
  });

  g.bullets = s.bu.map((w) => ({ x: w[0], y: w[1], vx: w[2], vy: w[3], life: 1, dmg: 1, rocket: !!w[4] }));
  g.ebullets = s.eb.map((w) => ({ x: w[0], y: w[1], vx: w[2], vy: w[3], life: 1, dmg: 1, r: w[4], needle: !!w[5] }));
  g.pickups = s.pk.map((w) => ({ id: w[0], x: w[1], y: w[2], kind: PICKUPS[w[3]] as never, life: w[4] }));
  if (s.ob.length !== g.obstacles.length) {
    g.obstacles = s.ob.map((w) => ({ x: w[0], y: w[1], r: w[2], seed: w[3] }));
    g.obstacleLayers = [null, null, null, null];
  }
  for (const w of s.st) {
    if (!g.stains.some((old) => old.seed === w[3])) {
      g.stains.push({ x: w[0], y: w[1], size: w[2], seed: w[3], born: g.time });
    }
  }

  const bw = s.boss as Record<string, never> | null;
  if (!bw) {
    g.boss = null;
  } else {
    const def = g.bossDef(bw.id as unknown as string);
    if (!g.boss || g.boss.def.id !== def.id) {
      g.boss = g.makeBoss(def, bw.maxHp as unknown as number);
      g.initTentacles();
    }
    const b = g.boss;
    b.x = bw.x as unknown as number;
    b.y = bw.y as unknown as number;
    b.r = bw.r as unknown as number;
    b.hp = bw.hp as unknown as number;
    b.maxHp = bw.maxHp as unknown as number;
    b.phase = bw.phase as unknown as number;
    b.state = bw.state as never;
    b.angle = bw.angle as unknown as number;
    b.t = bw.t as unknown as number;
    b.bob = bw.bob as unknown as number;
    b.flash = bw.flash as unknown as number;
    b.hop = bw.hop as unknown as number;
    b.squash = bw.squash as unknown as number;
    b.attack = bw.attack as never;
    b.telegraph = bw.tele as unknown as number;
    b.telegraphTotal = bw.teleT as unknown as number;
    b.targetX = bw.tx as unknown as number;
    b.targetY = bw.ty as unknown as number;
    b.lockAngle = bw.lock as unknown as number;
    b.charging = bw.charging as unknown as number;
    b.chargeAngle = bw.chargeAngle as unknown as number;
    const la = bw.laser as unknown as number[] | null;
    b.laser = la ? { angle: la[0], charge: la[1], active: la[2] } : null;
    const qd = bw.qd as unknown as number[] | null;
    b.queenDash = qd ? { x1: qd[0], y1: qd[1], x2: qd[2], y2: qd[3], t: qd[4], duration: qd[5], hit: false } : null;
    const qs = bw.qs as unknown as number[] | null;
    b.queenSlash = qs ? { angle: qs[0], offset: qs[1], t: qs[2], duration: qs[3], hit: false } : null;
    const tents = bw.tents as unknown as number[][];
    if (b.tents.length !== tents.length) g.initTentacles();
    tents.forEach((w, i) => {
      const t = b.tents[i];
      if (!t) return;
      t.tipX = w[0];
      t.tipY = w[1];
      t.base = w[2];
      t.phase = w[3];
      t.bend = w[4];
      t.glow = w[5];
      t.mode = (["idle", "windup", "strike", "recover", "sweep"][w[6]] ?? "idle") as never;
      t.arm = w[7];
    });
    const sw = bw.sweep as unknown as number[] | null;
    b.sweep = sw ? { t: sw[0], tele: sw[1], dur: sw[2], angle: sw[3], dir: sw[4], speed: sw[5], arms: sw[6], len: sw[7], active: !!sw[8] } : null;
    b.lashes = (bw.lashes as unknown as number[][]).map((w) => ({
      tent: w[0], x: w[1], y: w[2], t: w[3], tele: w[4],
      state: (["wait", "tele", "strike", "done"][w[5]] ?? "wait") as never,
      wait: 0, timer: 0, hit: false,
    }));
  }

  if (s.sp) g.special = s.sp as never;

  const h = s.hud as Record<string, never>;
  g.score = h.score as unknown as number;
  g.wave = h.wave as unknown as number;
  g.kills = h.kills as unknown as number;
  g.combo = h.combo as unknown as number;
  g.ult = h.ult as unknown as number;
  g.ammo = h.ammo as never;
  g.limitX = h.limitX as unknown as number;
  g.limitTarget = g.limitX;
  g.pageCut = h.pageCut as unknown as boolean;
  g.frenzyOn = h.frenzyOn as unknown as boolean;
  g.levelIndex = h.levelIndex as unknown as number;
  g.endless = !!h.endless;
  g.level = g.endless ? ENDLESS : LEVELS[g.levelIndex] ?? LEVELS[0];
  g.perks = h.perks as never;
  g.perkChoices = h.perkChoices as never;
  g.perkArm = h.perkArm as unknown as number;
  g.vote = h.vote as never;
  g.shake = Math.max(g.shake, h.shake as unknown as number);
  g.flash = Math.max(g.flash, h.flash as unknown as number);
  g.zoom = Math.max(g.zoom, h.zoom as unknown as number);

  const st = h.status as unknown as string;
  if (st === "playing" || st === "perks" || st === "levelclear" || st === "gameover" || st === "victory") {
    if (g.status !== st) {
      g.status = st as never;
      g.hudValid = false;
      g.emit();
    }
  }
}

/** cosmetic one-shots the host fires off so the guest sees the same punch */
export function playFx(g: Game, fx: Record<string, unknown>) {
  const x = (fx.x as number) ?? 0;
  const y = (fx.y as number) ?? 0;
  switch (fx.k) {
    case "boom":
      g.explode(x, y, (fx.r as number) ?? 80, 0, 0, true, !!fx.big);
      break;
    case "down":
      g.shock(x, y, 12, 420, 0.6);
      for (let i = 0; i < 20; i++) g.drop(x, y, 160 + Math.random() * 240);
      break;
    case "revive":
      g.confetti(x, y, 16);
      g.shock(x, y, 10, 520, 0.6);
      break;
    case "text":
      g.addText(x, y, String(fx.s ?? ""), (fx.life as number) ?? 1.2, (fx.sc as number) ?? 1.3);
      break;
    default:
      break;
  }
}

export function packInput(g: Game, keys: Set<string>, mouse: { x: number; y: number; down: boolean }, dash: boolean, ult: boolean): RemoteInput {
  let mx = 0;
  let my = 0;
  if (Math.hypot(g.stick.x, g.stick.y) > 0.12) {
    mx = r2(g.stick.x);
    my = r2(g.stick.y);
  } else {
    if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  }
  return { mx, my, ax: Math.round(mouse.x), ay: Math.round(mouse.y), fire: mouse.down, dash, ult, weapon: g.remote.weapon ?? g.mate.weapon };
}
