import {
  mulberry32,
  wline,
  wcircle,
  wrect,
  hatchCircle,
  splat,
  wstar,
  wheart,
  burst,
  wpoly,
  lightning,
  spiral,
  type Rand,
  setLod,
} from "./sketch";
import { drawEyeBoss, drawBombBoss } from "./models";
import { snapshot, applySnapshot, smoothCoopPlayers, playFx, type CoopSnap, type RemoteInput } from "./coop";
import {
  startFinale,
  updateFinale,
  updateFinaleFight,
  jumpToFinale,
  releasePage,
  drawFinaleUnder,
  drawFinaleOver,
  drawVoid,
  isFinaleLevel,
  type Finale,
} from "./finale";
import { drawMonster } from "./classic";
import { initAudio, sfx, setVolume } from "./sfx";
import { makeTransition, coverage, TRANSITION_KINDS, type TransitionKind, type TransitionState } from "./transition";
import {
  LEVELS,
  BOSSES,
  LevelDef,
  LevelRecord,
  BossDef,
  AttackKind,
  loadProgress,
  saveProgress,
  isUnlocked,
  ENDLESS,
} from "./levels";
import { PERK_BY_ID, rollPerks, type PerkId } from "./perks";
import { STICKERS, loadMeta, saveMeta, type Meta, type StickerId } from "./stickers";
import { RANKS, rankIndexFor, rankInfo, rankHearts } from "./ranks";
import { loadSettings, saveSettings, type Settings } from "./settings";
import {
  makeSpecial,
  clearSpecial,
  isSpecial,
  beginSpecial,
  executeSpecial,
  updateSpecial,
  specialBusy,
  spawnPuddle,
  drawSpecialUnder,
  drawSpecialOver,
  drawSpecialTop,
  drawDecree,
  SPECIAL_LABELS,
  type Special,
} from "./bosses2";


/** loose looping scribble used for ghost traces */
function ctxGhostScribble(g: CanvasRenderingContext2D, x: number, y: number, rad: number, r: () => number) {
  g.beginPath();
  let a = r() * TAU;
  g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  for (let i = 0; i < 9; i++) {
    a += Math.PI * (0.6 + r() * 0.7);
    const rr = rad * (0.35 + r() * 0.7);
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.stroke();
}

export const W = 960;
export const H = 600;
const TAU = Math.PI * 2;
const isTent = (b: { def: { id: string } }) => b.def.id === "tentacle" || b.def.id === "abyss";
const INK = "#1a1a1a";
const PAPER = "#f3efe4";

export type Status =
  | "menu"
  | "levels"
  | "briefing"
  | "playing"
  | "paused"
  | "levelclear"
  | "gameover"
  | "victory"
  | "perks"
  | "coop";
export type { WeaponId, EnemyKind } from "./levels";
import type { WeaponId, EnemyKind } from "./levels";
type PickupKind = "heart" | "shotgun" | "smg" | "rail" | "rocket";

export interface PublicState {
  status: Status;
  score: number;
  wave: number;
  waves: number;
  kills: number;
  maxCombo: number;
  levelIndex: number;
  levelName: string;
  levelSubtitle: string;
  levelTip: string;
  levelWeapon: WeaponId;
  levelWeaponNote: string;
  stars: number;
  levelTime: number;
  noDamage: boolean;
  progress: LevelRecord[];
  totalStars: number;
  isLast: boolean;
  perks: Partial<Record<PerkId, number>>;
  perkChoices: PerkId[];
  perkArm: number;
  pageCut: boolean;
  coop: {
    on: boolean;
    role: "off" | "host" | "guest";
    mateHere: boolean;
    p1Ready: boolean;
    p2Ready: boolean;
    levelIndex: number;
    mode: "levels" | "endless";
    started: boolean;
  };
  mate: { active: boolean; hp: number; maxHp: number; down: boolean; reviveT: number } | null;
  vote: { open: boolean; p1: PerkId | null; p2: PerkId | null; locked: PerkId | null; tie: boolean; left: number } | null;
  finale: { stage: string; cutKey: number } | null;
  endless: boolean;
  bestEndless: number;
  stickers: StickerId[];
  totalKills: number;
  recentSticker: { id: StickerId; name: string; key: number } | null;
  hp: number;
  maxHp: number;
  combo: number;
  bossHp: number;
  /** shared ink-ult charge 0..100 (drives the mobile ULT button) */
  ult: number;
  /** current weapon of the local hero (mate for coop guests) */
  weapon: WeaponId;
  /** dash cooldown seconds of the local hero */
  dashCd: number;
  frenzy: number;
  frenzyOn: boolean;
  transitioning: boolean;
  xp: number;
  rankIndex: number;
  rankName: string;
  rankNote: string;
  rankProgress: number;
  rankNext: number | null;
  rankNextName: string | null;
  levelXp: number;
  recentRank: { key: number; name: string; index: number } | null;
  rankAtStart: number;
  rankUpDuringLevel: boolean;
  heartsFromRank: number;
  queenCut: { key: number; angle: number; phase: boolean } | null;
  trans: { id: number; kind: TransitionKind; dur: number; ox: number; oy: number } | null;
  settings: Settings;
}

interface WeaponDef {
  name: string;
  short: string;
  cd: number;
  dmg: number;
  pellets: number;
  spread: number;
  speed: number;
  maxAmmo: number;
  pickup: number;
}

const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { name: "ПИСТОЛЕТ", short: "ПМ", cd: 0.13, dmg: 1.05, pellets: 1, spread: 0.03, speed: 820, maxAmmo: 0, pickup: 0 },
  shotgun: { name: "ДРОБОВИК", short: "ДРБ", cd: 0.46, dmg: 1.15, pellets: 8, spread: 0.45, speed: 720, maxAmmo: 48, pickup: 20 },
  smg: { name: "АВТОМАТ", short: "АВТ", cd: 0.055, dmg: 0.55, pellets: 1, spread: 0.15, speed: 900, maxAmmo: 260, pickup: 140 },
  rail: { name: "РЕЛЬСА", short: "РЕЛ", cd: 0.82, dmg: 7, pellets: 1, spread: 0, speed: 0, maxAmmo: 16, pickup: 7 },
  rocket: { name: "РПГ", short: "РПГ", cd: 0.95, dmg: 4, pellets: 1, spread: 0.02, speed: 430, maxAmmo: 14, pickup: 6 },
};
const WEAPON_ORDER: WeaponId[] = ["pistol", "shotgun", "smg", "rail", "rocket"];

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
  flash: number;
  fireCd: number;
  phase: number;
  score: number;
  age: number;
  burst: number;
  dashT: number;
  chargeT: number;
  dashAngle: number;
  dead: boolean;
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  rocket?: boolean;
  pierce?: number;
  bounce?: number;
  home?: number;
}
interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  r: number;
  needle?: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "drop" | "dash" | "smoke" | "shard" | "ember" | "debris";
  rot: number;
}
interface Shock {
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  max: number;
  w: number;
}
interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
}
interface Stain {
  x: number;
  y: number;
  size: number;
  seed: number;
  born?: number;
  baked?: boolean;
}
interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  rot: number;
  scale: number;
}
interface Ghost {
  x: number;
  y: number;
  angle: number;
  life: number;
  weapon: WeaponId;
}
interface Pickup {
  id: number;
  x: number;
  y: number;
  kind: PickupKind;
  life: number;
}
interface Obstacle {
  x: number;
  y: number;
  r: number;
  seed: number;
}
interface Hitmark {
  x: number;
  y: number;
  life: number;
}

interface Tent {
  base: number;
  phase: number;
  mode: "idle" | "windup" | "strike" | "recover" | "sweep";
  arm: number;
  tipX: number;
  tipY: number;
  bend: number;
  glow: number;
}
interface Lash {
  tent: number;
  x: number;
  y: number;
  wait: number;
  tele: number;
  t: number;
  state: "wait" | "tele" | "strike" | "done";
  timer: number;
  hit: boolean;
}
interface Sweep {
  t: number;
  tele: number;
  dur: number;
  angle: number;
  dir: number;
  speed: number;
  arms: number;
  len: number;
  active: boolean;
}
interface Petal {
  x: number;
  y: number;
  life: number;
  max: number;
  seed: number;
  n: number;
}
interface KillBurst {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  seed: number;
}
interface Print {
  x: number;
  y: number;
  a: number;
  life: number;
}

export interface BossState {
  def: BossDef;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  phase: number;
  angle: number;
  t: number;
  state: "intro" | "fight" | "transition" | "dying" | "finale";
  stateT: number;
  attackCd: number;
  attackIndex: number;
  attack: AttackKind | null;
  telegraph: number;
  telegraphTotal: number;
  targetX: number;
  targetY: number;
  flash: number;
  spin: number;
  bob: number;
  emit: { t: number; duration: number; acc: number; angle: number } | null;
  laser: { angle: number; charge: number; active: number } | null;
  charging: number;
  chargeAngle: number;
  deathTick: number;
  tents: Tent[];
  lashes: Lash[];
  sweep: Sweep | null;
  lockAngle: number;
  leap: { fx: number; fy: number; tx: number; ty: number; t: number; dur: number } | null;
  hop: number;
  squash?: number;
  queenDash: { x1: number; y1: number; x2: number; y2: number; t: number; duration: number; hit: boolean } | null;
  queenSlash: { angle: number; offset: number; t: number; duration: number; hit: boolean } | null;
}

interface Hazard {
  kind: "rain" | "mine";
  x: number;
  y: number;
  t: number;
  max: number;
  r: number;
  seed: number;
}

interface DamageRing {
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  max: number;
  hit: boolean;
  w: number;
}

const HIT_WORDS = ["БАХ!", "ХРЯСЬ!", "ПЛЮХ!", "ШМЯК!", "БУМ!", "ХЛОП!", "ВЖУХ!", "ТРЕСЬ!"];
const STREAKS: [number, string][] = [
  [10, "МАНИАК!"],
  [20, "МЯСОРУБКА!"],
  [35, "БЕЗУМИЕ!"],
  [50, "ЧЕРНИЛЬНЫЙ БОГ!"],
];

export class Game {
  ctx: CanvasRenderingContext2D;
  paper: HTMLCanvasElement;
  status: Status = "menu";
  time = 0;
  score = 0;
  kills = 0;
  wave = 0;
  levelIndex = 0;
  level: LevelDef = LEVELS[0];
  levelTime = 0;
  damageTaken = 0;
  stars = 0;
  progress: LevelRecord[] = loadProgress();
  perks: Partial<Record<PerkId, number>> = {};
  perkChoices: PerkId[] = [];
  endless = false;
  meta: Meta = loadMeta();
  recentSticker: { id: StickerId; name: string; key: number } | null = null;
  stickerKey = 0;
  usedWeapons = new Set<WeaponId>();
  dashFlare = false;
  bossPick: keyof typeof BOSSES | null = null;
  queenCut: { key: number; angle: number; phase: boolean } | null = null;
  queenCutKey = 0;
  queenFlood = 0;
  borderScars: { side: number; at: number; life: number; seed: number }[] = [];
  warnings: { x: number; y: number; t: number; max: number; seed: number }[] = [];
  petals: Petal[] = [];
  bursts: KillBurst[] = [];
  prints: Print[] = [];
  levelXp = 0;
  rankAtStart = 0;
  recentRank: { key: number; name: string; index: number } | null = null;
  rankKey = 0;
  metaDirty = false;
  metaSaveT = 2;
  stepT = 0;
  trans: TransitionState | null = null;
  pendingStatus: Status | null = null;
  frenzy = 0;
  frenzyOn = false;
  swarmTimer = 0;
  inkDrops: { x: number; y: number; vy: number; r: number; seed: number }[] = [];
  cracks: { x: number; y: number; ang: number; len: number; life: number; max: number; seed: number }[] = [];
  speedLines = 0;
  rainTimer = 3;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  comboPop = 0;
  ult = 0;
  slow = 0;
  freeze = 0;
  zoom = 0;
  shake = 0;
  flash = 0;
  muzzle = 0;
  waveBanner = 0;
  waveCooldown = 0;
  spawnTimer = 0;
  spawnQueue: EnemyKind[] = [];
  waveTotal = 0;
  waveClock = 0;
  rage = false;
  ammo: Record<WeaponId, number> = { pistol: 0, shotgun: 0, smg: 0, rail: 0, rocket: 0 };

  player = {
    x: W / 2,
    y: H / 2,
    r: 15,
    hp: 8,
    maxHp: 8,
    angle: 0,
    speed: 245,
    fireCd: 0,
    invuln: 0,
    weapon: "pistol" as WeaponId,
    moving: 0,
    flash: 0,
    recoil: 0,
    dashCd: 0,
    dashTime: 0,
    dashAngle: 0,
    svx: 0,
    svy: 0,
    shield: false,
    shieldT: 0,
    regenT: 0,
    muzzle: 0,
    pid: 1,
    active: true,
    down: false,
    downT: 0,
    reviveT: 0,
  };

  /** the partner. Inactive in solo play; driven by remote input while hosting. */
  mate = {
    x: W / 2 + 60,
    y: H / 2,
    r: 15,
    hp: 8,
    maxHp: 8,
    angle: 0,
    speed: 245,
    fireCd: 0,
    invuln: 0,
    weapon: "pistol" as WeaponId,
    moving: 0,
    flash: 0,
    recoil: 0,
    dashCd: 0,
    dashTime: 0,
    dashAngle: 0,
    svx: 0,
    svy: 0,
    shield: false,
    shieldT: 0,
    regenT: 0,
    muzzle: 0,
    pid: 2,
    active: false,
    down: false,
    downT: 0,
    reviveT: 0,
  };

  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  ebullets: EBullet[] = [];
  particles: Particle[] = [];
  _stains: Stain[] = [];
  settings: Settings = loadSettings();
  quality = 0;
  costEma = 4;
  fpsEma = 60;
  qualityTimer = 0;
  frameNo = 0;
  transSeq = 0;
  lastSig = "";
  paperCache = new Map<string, HTMLCanvasElement>();
  stainLayer: HTMLCanvasElement;
  stainCtx: CanvasRenderingContext2D | null;
  stainFadeT = 3;
  hudLayer: HTMLCanvasElement;
  hudCtx: CanvasRenderingContext2D | null;
  hudValid = false;
  obstacleLayers: (HTMLCanvasElement | null)[] = [null, null, null, null];
  moveMul = 1;
  special: Special = makeSpecial();
  netRole: "off" | "host" | "guest" = "off";
  coop = {
    on: false,
    mode: "levels" as "levels" | "endless",
    levelIndex: 0,
    p1Ready: false,
    p2Ready: false,
    mateHere: false,
    started: false,
  };
  remote: RemoteInput = { mx: 0, my: 0, ax: W / 2, ay: H / 2, fire: false, dash: false, ult: false, weapon: null };
  vote = {
    open: false,
    endsAt: 0,
    p1: null as PerkId | null,
    p2: null as PerkId | null,
    locked: null as PerkId | null,
    tie: false,
  };
  netSend: ((m: Record<string, unknown>) => void) | null = null;
  snapT = 0;
  edge = { dash: false, ult: false };
  pendingSnap: CoopSnap | null = null;
  fxQueue: Record<string, unknown>[] = [];
  limitX = W;
  baseLimit = W;
  limitTarget = W;
  fin: Finale | null = null;
  pageCut = false;
  cutKey = 0;
  finalFight = false;
  finalCheckpoint = false;
  checkpointPerks: Partial<Record<PerkId, number>> = {};
  minionT = 0;
  chainBlast = false;
  orbitAng = 0;
  orbitCd = new Map<number, number>();
  dilation = 1;
  darkT = 0;
  perkArm = 0;
  uiEmitT = 0;

  get stains(): Stain[] {
    return this._stains;
  }
  set stains(v: Stain[]) {
    this._stains = v;
    this.stainCtx?.clearRect(0, 0, W, H);
  }
  texts: FloatText[] = [];
  pickups: Pickup[] = [];
  obstacles: Obstacle[] = [];
  shocks: Shock[] = [];
  beams: Beam[] = [];
  ghosts: Ghost[] = [];
  hitmarks: Hitmark[] = [];
  boss: BossState | null = null;
  bossPending = false;
  bossBanner = 0;
  hazards: Hazard[] = [];
  damageRings: DamageRing[] = [];
  edgeSplats: { x: number; y: number; size: number; seed: number; life: number; max: number }[] = [];

  keys = new Set<string>();
  /** analog move vector from the touch joystick (-1..1); overrides WASD keys when engaged */
  stick = { x: 0, y: 0 };
  mouse = { x: W / 2, y: H / 2, down: false };
  nextId = 1;
  hudTimer = 0;
  listener: ((s: PublicState) => void) | null = null;
  raf = 0;
  last = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d")!;
    this.stainLayer = document.createElement("canvas");
    this.stainLayer.width = W;
    this.stainLayer.height = H;
    this.stainCtx = this.stainLayer.getContext("2d");
    this.hudLayer = document.createElement("canvas");
    this.hudLayer.width = W;
    this.hudLayer.height = H;
    this.hudCtx = this.hudLayer.getContext("2d");
    setVolume(this.settings.volume);
    this.paper = this.makePaper();
    this.applyArena(LEVELS[0]);
    this.decorate();
    this.loop = this.loop.bind(this);
  }

  decorate() {
    const kinds: EnemyKind[] = ["spiky", "brute", "zipper", "fly", "sniper"];
    const spots: [number, number][] = [
      [100, 290],
      [865, 315],
      [345, 555],
      [630, 55],
      [800, 545],
    ];
    this.enemies = kinds.map((kind, i) => this.makeEnemy(kind, spots[i][0], spots[i][1]));
    this.stains = [
      { x: 330, y: 230, size: 18, seed: 3 },
      { x: 640, y: 380, size: 24, seed: 5 },
      { x: 860, y: 200, size: 12, seed: 9 },
      { x: 120, y: 430, size: 15, seed: 17 },
    ];
  }

  // ---------- lifecycle ----------
  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
  }
  emit() {
    const lv = this.level;
    this.listener?.({
      status: this.status,
      score: this.score,
      wave: this.wave,
      waves: lv.waves,
      kills: this.kills,
      maxCombo: this.maxCombo,
      levelIndex: this.levelIndex,
      levelName: lv.name,
      levelSubtitle: lv.subtitle,
      levelTip: lv.tip,
      levelWeapon: lv.weapon,
      levelWeaponNote: lv.weaponNote,
      stars: this.stars,
      levelTime: this.levelTime,
      noDamage: this.damageTaken === 0,
      progress: this.progress.map((r) => ({ ...r })),
      totalStars: this.progress.reduce((a, r) => a + r.stars, 0),
      isLast: !this.endless && this.levelIndex >= LEVELS.length - 1,
      perks: { ...this.perks },
      perkChoices: [...this.perkChoices],
      perkArm: this.perkArm,
      pageCut: this.pageCut,
      coop: {
        on: this.coop.on,
        role: this.netRole,
        mateHere: this.coop.mateHere,
        p1Ready: this.coop.p1Ready,
        p2Ready: this.coop.p2Ready,
        levelIndex: this.coop.levelIndex,
        mode: this.coop.mode,
        started: this.coop.started,
      },
      mate: this.mate.active
        ? { active: true, hp: this.mate.hp, maxHp: this.mate.maxHp, down: this.mate.down, reviveT: this.mate.reviveT }
        : null,
      vote: this.vote.open
        ? { open: true, p1: this.vote.p1, p2: this.vote.p2, locked: this.vote.locked, tie: this.vote.tie, left: Math.max(0, this.vote.endsAt - this.time) }
        : null,
      finale: this.fin ? { stage: this.fin.stage, cutKey: this.cutKey } : this.pageCut || this.cutKey ? { stage: "fight", cutKey: this.cutKey } : null,
      endless: this.endless,
      bestEndless: this.meta.bestEndless,
      stickers: [...this.meta.stickers],
      totalKills: this.meta.totalKills,
      recentSticker: this.recentSticker,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      combo: this.combo,
      bossHp: this.boss ? this.boss.hp / this.boss.maxHp : -1,
      ult: Math.round(this.ult),
      weapon: (this.netRole === "guest" ? this.mate.weapon : this.player.weapon) as WeaponId,
      dashCd: Math.round((this.netRole === "guest" ? this.mate.dashCd : this.player.dashCd) * 100) / 100,
      frenzy: this.frenzy,
      frenzyOn: this.frenzyOn,
      transitioning: !!this.trans,
      xp: this.meta.xp,
      rankIndex: this.rankIndex,
      rankName: this.rankInfoNow().name,
      rankNote: this.rankInfoNow().note,
      rankProgress: this.rankInfoNow().progress,
      rankNext: this.rankInfoNow().next,
      rankNextName: this.rankInfoNow().nextName,
      levelXp: this.levelXp,
      recentRank: this.recentRank,
      rankAtStart: this.rankAtStart,
      rankUpDuringLevel: this.rankIndex > this.rankAtStart,
      heartsFromRank: rankHearts(this.rankIndex),
      queenCut: this.queenCut,
      trans: this.trans
        ? { id: this.transSeq, kind: this.trans.kind, dur: this.trans.dur, ox: this.trans.ox, oy: this.trans.oy }
        : null,
      settings: { ...this.settings },
    });
    this.lastSig = this.hudSignature();
  }

  offerPerks() {
    const choices = rollPerks(this.perks, 3);
    if (choices.length === 0) return false;
    if (this.isCoop()) {
      this.openVote(choices);
      return true;
    }
    this.perkChoices = choices;
    this.perkArm = 1.25;
    this.status = "perks";
    this.emit();
    return true;
  }

  choosePerk(id: PerkId, fromVote = false) {
    if (this.status !== "perks") return;
    if (this.perkArm > 0) return; // cards are still spinning: no accidental picks
    if (!this.perkChoices.includes(id)) return;
    if (this.isCoop() && !fromVote) {
      // in co-op a pick is a vote, not a decision
      this.castVote(1, id);
      return;
    }
    const lvl = (this.perks[id] ?? 0) + 1;
    this.perks[id] = lvl;
    for (const pl of this.allPlayers()) {
      if (id === "shield") pl.shield = true;
      if (id === "heart") {
        pl.maxHp += 1;
        pl.hp = Math.min(pl.maxHp, pl.hp + 2);
      }
    }
    this.perkChoices = [];
    this.vote.open = false;
    this.vote.p1 = null;
    this.vote.p2 = null;
    this.vote.locked = null;
    this.vote.tie = false;
    this.status = "playing";
    this.waveCooldown = 1.2;
    this.spawnBurst(this.player.x, this.player.y);
    this.confetti(this.player.x, this.player.y, 24);
    this.addText(W / 2, H / 2 - 30, `ПЕРК: ${PERK_BY_ID[id].name}`, 1.6, 1.6);
    this.shock(this.player.x, this.player.y, 12, 380, 0.5);
    sfx.pickup();
    this.emit();
  }

  /** a shower of torn paper scraps that tumble, bounce and settle */
  confetti(x: number, y: number, n = 20) {
    const cap = this.quality === 0 ? n : Math.ceil(n * 0.5);
    for (let i = 0; i < cap; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 220 + Math.random() * 520;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1.2 + Math.random() * 0.9,
        max: 2.1,
        size: 3.5 + Math.random() * 5,
        kind: "debris",
        rot: Math.random() * TAU,
      });
    }
  }

  spawnBurst(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      this.particles.push({ x, y, vx: Math.cos(a) * (140 + Math.random() * 420), vy: Math.sin(a) * (140 + Math.random() * 420) - 140, life: 0.5 + Math.random() * 0.5, max: 1, size: 3 + Math.random() * 5, kind: "smoke", rot: 0 });
    }
  }

  skipPerk() {
    if (this.status !== "perks") return;
    if (this.isCoop() && this.netRole === "guest") return;
    this.vote.open = false;
    if (this.perkArm > 0) return;
    this.perkChoices = [];
    this.status = "playing";
    this.waveCooldown = 1.0;
    this.emit();
  }

  get rankIndex() {
    return rankIndexFor(this.meta.xp);
  }

  rankInfoNow() {
    return rankInfo(this.meta.xp);
  }

  addXp(n: number) {
    if (n <= 0) return;
    const before = rankIndexFor(this.meta.xp);
    this.meta.xp += n;
    this.levelXp += n;
    this.metaDirty = true;
    const after = rankIndexFor(this.meta.xp);
    if (after > before) this.rankUp(before, after);
  }

  rankUp(before: number, after: number) {
    const def = RANKS[after];
    this.recentRank = { key: ++this.rankKey, name: def.name, index: after };
    const p = this.player;
    if (rankHearts(after) > rankHearts(before) && this.status === "playing") {
      p.maxHp += 1;
      p.hp = Math.min(p.maxHp, p.hp + 1);
    }
    // Rank is revealed only on the results screen, never in the middle of a wave.
    saveMeta(this.meta);
  }

  unlockSticker(id: StickerId) {
    if (this.meta.stickers.includes(id)) return;
    const def = STICKERS.find((st) => st.id === id);
    if (!def) return;
    this.meta.stickers.push(id);
    this.recentSticker = { id, name: def.name, key: ++this.stickerKey };
    saveMeta(this.meta);
    this.addText(W / 2, 210, `НАКЛЕЙКА: ${def.name}`, 2.6, 1.8);
    this.shock(W / 2, 210, 10, 420, 0.6);
    sfx.levelClear();
    this.emit();
  }

  saveMetaNow() {
    saveMeta(this.meta);
  }

  goAlbum() {
    this.emit();
  }

  /** animated status change: ink covers the page, we swap, ink clears */
  goTo(next: Status, kind?: TransitionKind, dur = 0.6, ox = 0.5, oy = 0.5) {
    if (this.status === next) {
      // asked to go where we already are while another screen is pending: cancel the pending hop
      if (this.pendingStatus && this.pendingStatus !== next) {
        this.pendingStatus = null;
        this.trans = null;
      }
      return;
    }
    // a transition to this screen is already running — never restart it
    if (this.trans && this.pendingStatus === next) return;
    this.pendingStatus = next;
    this.transSeq++;
    this.trans = makeTransition(kind ?? TRANSITION_KINDS[Math.floor(Math.random() * TRANSITION_KINDS.length)], dur, ox, oy);
    if (next === "playing") sfx.dash();
    this.emit();
  }

  applyArena(lv: LevelDef) {
    this.obstacleLayers = [null, null, null, null];
    this.obstacles = lv.obstacles.map(([x, y, r], i) => ({ x, y, r, seed: (i + 1) * 37 + lv.id * 11 }));
  }

  goMenu() {
    this.decorate();
    this.goTo("menu", "pages", 0.7);
  }

  goLevels() {
    initAudio();
    this.goTo("levels", "shutter", 0.62);
  }

  openBriefing(index: number) {
    if (!isUnlocked(this.progress, index, this.settings.freePlay)) return;
    initAudio();
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.applyArena(this.level);
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.pickups = [];
    this.texts = [];
    this.stains = this.level.obstacles.map(([x, y], i) => ({
      x: x + (i % 2 ? 50 : -50),
      y: y + (i % 2 ? -40 : 40),
      size: 9 + (i % 3) * 4,
      seed: i * 97 + 5,
    }));
    this.goTo("briefing", "drip", 0.62);
  }

  /** start the endless sheet (unlocked by clearing 3 campaign levels) */
  startEndless() {
    if (this.clearedCount() < 3 && !this.settings.freePlay) return;
    this.meta.runs++;
    saveMeta(this.meta);
    this.startLevel(0, true);
  }

  levelUnlocked(index: number) {
    return isUnlocked(this.progress, index, this.settings.freePlay);
  }

  clearedCount() {
    return this.progress.filter((p) => p.cleared).length;
  }

  /** start (or restart) the currently selected level */
  startLevel(index = this.levelIndex, endless = false, checkpoint = false) {
    const useCp = checkpoint && this.finalCheckpoint && !endless;
    initAudio();
    if (!endless && !isUnlocked(this.progress, index, this.settings.freePlay)) return;
    this.endless = endless;
    this.levelIndex = endless ? 0 : index;
    this.level = endless ? ENDLESS : LEVELS[index];
    this.applyArena(this.level);
    this.paper = this.makePaper();
    this.perks = {};
    this.perkChoices = [];
    this.warnings = [];
    this.usedWeapons.clear();
    this.dashFlare = false;
    this.bossPick = null;
    this.meta.runs++;
    saveMeta(this.meta);
    this.stick.x = 0;
    this.stick.y = 0;
    const p = this.player;
    p.x = W / 2;
    p.y = H / 2;
    p.maxHp = 8 + rankHearts(this.rankIndex);
    p.hp = p.maxHp;
    p.invuln = 1.2;
    p.fireCd = 0;
    p.dashCd = 0;
    p.dashTime = 0;
    p.weapon = this.level.weapon;
    this.ammo = { pistol: 0, shotgun: 0, smg: 0, rail: 0, rocket: 0 };
    if (this.levelIndex >= LEVELS.length - 1 && !endless) {
      // finale: full arsenal
      for (const w of WEAPON_ORDER) this.ammo[w] = WEAPONS[w].maxAmmo;
    }
    if (endless) {
      for (const w of WEAPON_ORDER) this.ammo[w] = WEAPONS[w].maxAmmo;
    }
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.particles = [];
    this.stains = [];
    this.texts = [];
    this.pickups = [];
    this.shocks = [];
    this.beams = [];
    this.ghosts = [];
    this.hitmarks = [];
    this.boss = null;
    clearSpecial(this);
    this.queenCut = null;
    this.queenFlood = 0;
    this.borderScars = [];
    this.bossPending = false;
    this.bossBanner = 0;
    this.hazards = [];
    this.damageRings = [];
    this.edgeSplats = [];
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.levelTime = 0;
    this.damageTaken = 0;
    this.stars = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboPop = 0;
    this.ult = 0;
    this.slow = 0;
    this.freeze = 0;
    this.zoom = 0;
    this.waveCooldown = 1.1;
    this.spawnQueue = [];
    this.waveClock = 0;
    this.rage = false;
    this.frenzy = 0;
    this.frenzyOn = false;
    this.swarmTimer = 9;
    this.inkDrops = [];
    this.cracks = [];
    this.petals = [];
    this.bursts = [];
    this.prints = [];
    this.levelXp = 0;
    this.rankAtStart = this.rankIndex;
    this.hudValid = false;
    this.rainTimer = 4;
    this.limitX = W;
    this.baseLimit = W;
    this.limitTarget = W;
    this.fin = null;
    this.pageCut = false;
    this.finalFight = false;
    this.minionT = 0;
    this.orbitCd.clear();
    this.player.down = false;
    this.player.downT = 0;
    this.player.reviveT = 0;
    this.player.muzzle = 0;
    if (this.mate.active) {
      const m = this.mate;
      m.x = W / 2 + 58;
      m.y = H / 2;
      m.hp = m.maxHp = this.player.maxHp;
      m.down = false;
      m.downT = 0;
      m.reviveT = 0;
      m.invuln = 1.2;
      m.fireCd = 0;
      m.dashCd = 0;
      m.dashTime = 0;
      m.muzzle = 0;
      m.weapon = this.level.weapon;
      m.shield = (this.perks.shield ?? 0) > 0;
      m.shieldT = 0;
      m.regenT = 0;
      this.player.x = W / 2 - 58;
    }
    this.player.shield = (this.perks.shield ?? 0) > 0;
    this.player.shieldT = 0;
    this.player.regenT = 0;
    if (!useCp) this.finalCheckpoint = false;
    this.speedLines = 0;
    this.dilation = 1;
    this.darkT = 0;
    this.perkArm = 0;
    if (useCp) jumpToFinale(this);
    else this.addText(W / 2, H / 2 + 40, WEAPONS[this.level.weapon].name, 1.6, 1.4);
    this.goTo("playing", "flood", 0.7);
  }

  retryLevel() {
    this.startLevel(this.levelIndex, this.endless, true);
  }

  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      this.status = "victory";
      this.emit();
      return;
    }
    this.openBriefing(next);
  }

  completeLevel() {
    if (this.status !== "playing" || this.trans || this.pendingStatus) return;
    const lv = this.level;
    const timeBonus = Math.max(0, Math.round((lv.parTime - this.levelTime) * 12));
    const hpBonus = this.player.hp * 60;
    this.score += timeBonus + hpBonus;
    let stars = 1;
    if (this.damageTaken <= 5) stars = 2;
    if (this.damageTaken <= 2 && this.levelTime < lv.parTime * 1.25) stars = 3;
    this.stars = stars;
    const rec = this.progress[this.levelIndex] || { cleared: false, stars: 0, best: 0 };
    this.progress[this.levelIndex] = {
      cleared: true,
      stars: Math.max(rec.stars, stars),
      best: Math.max(rec.best, this.score),
    };
    saveProgress(this.progress);
    this.addXp(120 + stars * 60 + (this.damageTaken === 0 ? 100 : 0));
    saveMeta(this.meta);
    if (this.damageTaken === 0) this.unlockSticker("no_damage");
    if (stars === 3) this.unlockSticker("perfection");
    if (!this.endless && this.levelIndex >= LEVELS.length - 1) this.unlockSticker("victory");
    const target: Status = this.endless
      ? "levelclear"
      : this.levelIndex >= LEVELS.length - 1
        ? "victory"
        : "levelclear";
    this.goTo(target, "halftone", 0.85);
    this.slow = 1.2;
    this.flash = 0.1;
    this.shake = 16;
    sfx.streak();
    this.confetti(this.player.x, this.player.y - 10, 26);
    // The baked stain canvas survives between frames; clear both live and baked ink
    // when a sheet is completed so enemy trails cannot remain on the victory screen.
    this.stains = [];
    this._stains = [];
    this.stainCtx?.clearRect(0, 0, W, H);
    this.hudValid = false;
    this.emit();
  }

  togglePause() {
    if (this.status === "playing") this.status = "paused";
    else if (this.status === "paused") this.status = "playing";
    this.emit();
  }


  // ---------- input ----------
  keyDown(code: string) {
    if (this.netRole === "guest") {
      this.keys.add(code);
      if (code === "Space") this.edge.dash = true;
      if (code === "KeyE") this.edge.ult = true;
      const n = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(code);
      if (n >= 0) this.remote.weapon = WEAPON_ORDER[n];
      if (code === "KeyQ") {
        const owned = this.ownedWeapons();
        const cur = this.remote.weapon ?? this.mate.weapon;
        this.remote.weapon = owned[(owned.indexOf(cur) + 1) % owned.length];
      }
      return;
    }
    this.keys.add(code);
    if (code === "Escape" || code === "KeyP") {
      if (this.status === "playing" || this.status === "paused") this.togglePause();
      else if (this.status === "briefing") this.goLevels();
      return;
    }
    if (this.status === "menu" && code === "Enter") {
      this.goLevels();
      return;
    }
    if (this.status === "briefing" && code === "Enter") {
      this.startLevel();
      return;
    }
    if (this.status === "levelclear" && code === "Enter") {
      this.nextLevel();
      return;
    }
    if (this.status === "gameover" && (code === "KeyR" || code === "Enter")) {
      this.retryLevel();
      return;
    }
    if (this.status !== "playing") return;
    if (code === "Space") this.tryDash();
    if (code === "KeyE") this.useUlt();
    if (code === "KeyQ") this.cycleWeapon();
    const n = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(code);
    if (n >= 0) this.switchWeapon(WEAPON_ORDER[n]);
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  setMouse(x: number, y: number) {
    this.mouse.x = x;
    this.mouse.y = y;
  }
  setMouseDown(d: boolean) {
    this.mouse.down = d;
  }
  pressAlt() {
    this.useUlt();
  }
  /** weapons with endless ammo on the current level */
  isInfinite(w: WeaponId) {
    return w === "pistol" || w === this.level.weapon;
  }
  ownedWeapons(): WeaponId[] {
    return WEAPON_ORDER.filter((w) => this.isInfinite(w) || this.ammo[w] > 0);
  }
  cycleWeapon() {
    if (this.status !== "playing") return;
    const owned = this.ownedWeapons();
    const idx = owned.indexOf(this.player.weapon);
    this.switchWeapon(owned[(idx + 1) % owned.length]);
  }
  switchWeapon(w: WeaponId) {
    if (this.status !== "playing") return;
    if (!this.isInfinite(w) && this.ammo[w] <= 0) return;
    if (w === this.player.weapon) return;
    this.player.weapon = w;
    const p = this.player;
    this.addText(p.x, p.y - 34, WEAPONS[w].name, 0.8, 1.05);
    this.ring(p.x, p.y);
  }
  tryDash() {
    const p = this.player;
    if (this.status !== "playing" || p.dashCd > 0 || p.down) return;
    let mx = 0;
    let my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    p.dashAngle =
      Math.hypot(this.stick.x, this.stick.y) > 0.12
        ? Math.atan2(this.stick.y, this.stick.x)
        : mx || my
          ? Math.atan2(my, mx)
          : p.angle;
    p.dashTime = 0.17;
    p.dashCd = 0.8;
    this.dashFlare = true;
    this.speedLines = Math.max(this.speedLines, 0.55);
    p.invuln = Math.max(p.invuln, 0.32);
    this.shake = Math.max(this.shake, 6);
    sfx.dash();
    for (let i = 0; i < 10; i++) {
      const a = p.dashAngle + Math.PI + (Math.random() - 0.5) * 1.4;
      this.drop(p.x, p.y, a, 220);
    }
  }

  /** per-frame upkeep for passive perks (shield, regen, orbiting ink) */
  perkTick(dt: number) {
    for (const pl of this.allPlayers()) this.perkTickFor(pl, dt);
  }

  perkTickFor(p: typeof this.player, dt: number) {
    const sh = this.perks.shield ?? 0;
    if (sh > 0 && !p.shield) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) {
        p.shield = true;
        this.addText(p.x, p.y - 36, "ЩИТ ГОТОВ", 0.8, 1);
        this.ring(p.x, p.y);
      }
    }
    const rg = this.perks.regen ?? 0;
    if (rg > 0 && p.hp < p.maxHp) {
      p.regenT += dt;
      if (p.regenT >= 31 - 6 * rg) {
        p.regenT = 0;
        p.hp += 1;
        this.addText(p.x, p.y - 34, "+1 ♥", 0.9, 1.1);
        this.ring(p.x, p.y);
      }
    }
    const orb = this.perks.orbit ?? 0;
    if (orb > 0) {
      this.orbitAng += dt * 3.3;
      for (let i = 0; i < orb; i++) {
        const a = this.orbitAng + (i / orb) * TAU;
        const ox = p.x + Math.cos(a) * 56;
        const oy = p.y + Math.sin(a) * 56;
        for (const e of this.enemies) {
          if (e.hp <= 0 || Math.hypot(e.x - ox, e.y - oy) > e.r + 11) continue;
          if ((this.orbitCd.get(e.id) ?? 0) > this.time) continue;
          this.orbitCd.set(e.id, this.time + 0.32);
          this.hitEnemy(e, 1.15, ox, oy);
        }
        const b = this.boss;
        if (b && this.bossHittable() && Math.hypot(b.x - ox, b.y - oy) < b.r + 11 && (this.orbitCd.get(-1) ?? 0) <= this.time) {
          this.orbitCd.set(-1, this.time + 0.32);
          this.damageBoss(1.1, ox, oy);
        }
      }
      if (this.orbitCd.size > 90) this.orbitCd.clear();
    }
  }

  /** a fallen partner: flattened silhouette, dashed outline and a revive dial */
  drawDowned(boil: number, p: typeof this.player) {
    const ctx = this.ctx;
    const r = mulberry32(boil + p.pid * 71);
    const t = this.time;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(3, 10, p.r + 8, p.r * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    // a puddle with the hero melting into it
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 6, p.r + 5, p.r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.ellipse(0, 2, p.r * 0.72, p.r * 0.44, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const sx of [-5, 5]) {
      ctx.lineWidth = 2;
      wline(ctx, sx - 3, -1, sx + 3, 5, r, 0.4);
      wline(ctx, sx + 3, -1, sx - 3, 5, r, 0.4);
    }
    // an arm reaching up for help
    ctx.lineWidth = 3;
    const wave = Math.sin(t * 5 + p.pid) * 6;
    wline(ctx, p.r * 0.5, 0, p.r * 0.9 + wave, -p.r - 6, r, 1);
    // revive dial
    const k = Math.max(0, Math.min(1, p.reviveT / 2.4));
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3.4;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 20;
    wcircle(ctx, 0, 0, p.r + 16, r, 1.4, 1);
    ctx.setLineDash([]);
    if (k > 0) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 16, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    }
    ctx.font = 'bold 15px "Kelly Slab", serif';
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.fillText(k > 0 ? "ПОДНИМАЮ..." : "ПОДОЙДИ!", 0, -p.r - 26);
    ctx.restore();
  }

  /** small P1 / P2 tags so nobody loses their hero in the ink */
  drawNameplates(boil: number) {
    const ctx = this.ctx;
    void boil;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of this.allPlayers()) {
      const label = p.pid === 1 ? "P1" : "P2";
      const y = p.y - p.r - (p.down ? 44 : 30);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.pid === 1 ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(p.x - 15, y - 9, 30, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.pid === 1 ? PAPER : INK;
      ctx.font = 'bold 12px "Manrope", sans-serif';
      ctx.fillText(label, p.x, y + 1);
      // partner hearts float next to the tag
      if (p.pid === 2 && !p.down) {
        ctx.fillStyle = INK;
        ctx.font = 'bold 11px "Manrope", sans-serif';
        ctx.fillText(`${p.hp}/${p.maxHp}`, p.x, y - 15);
      }
    }
    ctx.restore();
  }

  /** visuals for passive perks: orbiting ink drops and the folded paper shield */
  drawPerkFx(boil: number) {
    const p = this.player;
    const ctx = this.ctx;
    const orb = this.perks.orbit ?? 0;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    if (orb > 0) {
      for (let i = 0; i < orb; i++) {
        const a = this.orbitAng + (i / orb) * TAU;
        const x = p.x + Math.cos(a) * 56;
        const y = p.y + Math.sin(a) * 56;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 56, a - 0.7, a);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, 8.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(x - 2.6, y - 2.8, 2.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
      }
    }
    if (p.shield) {
      const pulse = 0.6 + Math.sin(this.time * 6) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([9, 6]);
      ctx.lineDashOffset = -this.time * 22;
      wcircle(ctx, p.x, p.y, p.r + 12, mulberry32(Math.floor(boil / 2) + 5), 1.6, 1);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** host: ship the world to the partner about 20 times a second */
  coopHostPump(raw: number) {
    if (this.netRole !== "host" || !this.netSend) return;
    this.snapT -= raw;
    if (this.snapT > 0) return;
    this.snapT = 0.05;
    if (this.fxQueue.length) {
      this.netSend({ t: "fx", list: this.fxQueue.slice() });
      this.fxQueue.length = 0;
    }
    if (this.coop.started) this.netSend({ t: "snap", s: snapshot(this) as unknown as Record<string, unknown> });
  }

  /** guest: no simulation, just smooth playback of what the host sent */
  coopGuestStep(raw: number) {
    if (this.pendingSnap) {
      applySnapshot(this, this.pendingSnap);
      this.pendingSnap = null;
    }
    smoothCoopPlayers(this, raw);
    this.dilation += ((this.status === "perks" ? 0.2 : 1) - this.dilation) * Math.min(1, raw * 3.4);
    this.darkT += ((this.status === "perks" ? 1 : 0) - this.darkT) * Math.min(1, raw * 3.4);
    if (this.perkArm > 0) this.perkArm = Math.max(0, this.perkArm - raw);
    this.tickFx(raw * this.dilation);
    this.time += raw * this.dilation;
    this.frameNo++;
    this.render();
    this.uiEmit(raw);
  }

  /** guest: queue the newest snapshot (older ones are simply dropped) */
  onSnapshot(s: CoopSnap) {
    this.pendingSnap = s;
  }
  onRemoteFx(list: Record<string, unknown>[]) {
    for (const fx of list) playFx(this, fx);
  }
  setRemoteInput(i: RemoteInput) {
    this.remote = i;
  }

  /* ----------------------------------------------------------------- co-op */
  /** every player that can still act (and be shot at) */
  livePlayers() {
    const out = [this.player];
    if (this.mate.active) out.push(this.mate);
    return out.filter((p) => !p.down);
  }
  allPlayers() {
    return this.mate.active ? [this.player, this.mate] : [this.player];
  }
  /** the player a monster should walk toward / aim at */
  nearestLive(x: number, y: number) {
    const live = this.livePlayers();
    if (!live.length) return this.player;
    let best = live[0];
    let bd = Infinity;
    for (const p of live) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  /** area damage: hits every player standing inside the circle */
  hurtAt(x: number, y: number, r: number, dmg = 1, knock = 26) {
    let any = false;
    for (const p of this.livePlayers()) {
      if (Math.hypot(p.x - x, p.y - y) >= r) continue;
      this.hurtPlayer(Math.atan2(p.y - y, p.x - x) || 0, dmg, knock, p);
      any = true;
    }
    return any;
  }
  isCoop() {
    return this.coop.on && this.mate.active;
  }

  /** a player ran out of hearts: in co-op they fall instead of ending the run */
  downPlayer(p: typeof this.player) {
    p.down = true;
    p.hp = 0;
    p.downT = 0;
    p.reviveT = 0;
    p.dashTime = 0;
    p.invuln = 0.6;
    this.addText(p.x, p.y - 42, p.pid === 1 ? "ИГРОК 1 УПАЛ!" : "ИГРОК 2 УПАЛ!", 2, 1.5);
    this.shock(p.x, p.y, 12, 420, 0.6);
    this.stains.push({ x: p.x, y: p.y, size: 26, seed: Math.random() * 1e6, born: this.time });
    for (let i = 0; i < 24; i++) this.drop(p.x, p.y, 160 + Math.random() * 260);
    this.shake = Math.max(this.shake, 16);
    this.flash = Math.max(this.flash, 0.07);
    sfx.hurt();
    this.pushFx({ k: "down", pid: p.pid, x: p.x, y: p.y });
    this.emit();
  }

  /** standing next to a downed partner brings them back */
  tickRevive(dt: number) {
    if (!this.isCoop()) return;
    for (const p of this.allPlayers()) {
      if (!p.down) continue;
      p.downT += dt;
      const helper = this.allPlayers().find((o) => o !== p && !o.down);
      const near = helper && Math.hypot(helper.x - p.x, helper.y - p.y) < 64;
      if (near) {
        p.reviveT += dt;
        if (Math.random() < dt * 24) this.drop(p.x, p.y, 110);
        if (p.reviveT >= 2.4) {
          p.down = false;
          p.hp = Math.min(p.maxHp, 3);
          p.reviveT = 0;
          p.invuln = 2;
          this.addText(p.x, p.y - 44, "ПОДНЯЛСЯ!", 1.6, 1.5);
          this.shock(p.x, p.y, 10, 520, 0.6);
          this.confetti(p.x, p.y, 18);
          sfx.pickup();
          this.pushFx({ k: "revive", pid: p.pid, x: p.x, y: p.y });
          this.emit();
        }
      } else {
        p.reviveT = Math.max(0, p.reviveT - dt * 0.6);
      }
    }
    // nobody left standing
    if (this.allPlayers().every((p) => p.down) && this.status === "playing" && !this.trans && !this.pendingStatus) {
      this.player.hp = 0;
      this.mate.hp = 0;
      if (this.endless) {
        this.meta.bestEndless = Math.max(this.meta.bestEndless, Math.max(1, this.wave));
        this.saveMetaNow();
      }
      this.goTo("gameover", "crack", 0.9, this.player.x / W, this.player.y / H);
      sfx.gameover();
    }
  }

  /** host drives the partner from the input packets the guest sends */
  moveMate(dt: number) {
    const m = this.mate;
    if (!m.active) return;
    const inp = this.remote;
    m.invuln = Math.max(0, m.invuln - dt);
    m.flash = Math.max(0, m.flash - dt);
    m.recoil = Math.max(0, m.recoil - dt * 6);
    m.muzzle = Math.max(0, m.muzzle - dt);
    m.dashCd = Math.max(0, m.dashCd - dt * (1 + 0.25 * (this.perks.dashcd ?? 0)));
    m.fireCd -= dt;
    if (m.down) {
      m.moving = 0;
      return;
    }
    const px0 = m.x;
    const py0 = m.y;
    const ml = Math.hypot(inp.mx, inp.my) || 1;
    if (m.dashTime > 0) {
      m.dashTime -= dt;
      m.x += Math.cos(m.dashAngle) * 900 * dt;
      m.y += Math.sin(m.dashAngle) * 900 * dt;
      this.ghosts.push({ x: m.x, y: m.y, angle: m.angle, life: 0.25, weapon: m.weapon });
    } else if (inp.mx || inp.my) {
      const spd = m.speed * (1 + 0.1 * (this.perks.boots ?? 0)) * this.moveMul;
      m.x += (inp.mx / ml) * spd * dt;
      m.y += (inp.my / ml) * spd * dt;
      m.moving += dt;
    } else m.moving = 0;
    m.x = Math.max(26 + m.r, Math.min(this.limitX - 26 - m.r, m.x));
    m.y = Math.max(26 + m.r, Math.min(H - 26 - m.r, m.y));
    this.pushOutObstacles(m);
    const ivx = (m.x - px0) / Math.max(dt, 0.0001);
    const ivy = (m.y - py0) / Math.max(dt, 0.0001);
    m.svx += (ivx - m.svx) * Math.min(1, dt * 9);
    m.svy += (ivy - m.svy) * Math.min(1, dt * 9);
    m.angle = Math.atan2(inp.ay - m.y, inp.ax - m.x);
    if (inp.weapon && inp.weapon !== m.weapon && (this.isInfinite(inp.weapon) || this.ammo[inp.weapon] > 0)) {
      m.weapon = inp.weapon;
    }
    if (inp.dash && m.dashCd <= 0) {
      m.dashAngle = inp.mx || inp.my ? Math.atan2(inp.my, inp.mx) : m.angle;
      m.dashTime = 0.17;
      m.dashCd = 0.8;
      m.invuln = Math.max(m.invuln, 0.32);
      for (let i = 0; i < 8; i++) this.drop(m.x, m.y, m.dashAngle + Math.PI + (Math.random() - 0.5) * 1.4, 220);
      sfx.dash();
    }
    if (inp.fire && m.fireCd <= 0) this.fire(m);
    if (inp.ult && this.ult >= 100) this.useUlt();
  }

  pushFx(fx: Record<string, unknown>) {
    if (this.netRole !== "host") return;
    this.fxQueue.push(fx);
    if (this.fxQueue.length > 24) this.fxQueue.shift();
  }

  /* --------------------------------------------------------- co-op lobby */
  coopOpen(role: "host" | "guest", levelIndex = 0) {
    this.netRole = role;
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.pickups = [];
    this.boss = null;
    this.stains = [];
    this.applyArena(LEVELS[levelIndex] ?? LEVELS[0]);
    this.level = LEVELS[levelIndex] ?? LEVELS[0];
    this.paper = this.makePaper();
    this.player.x = W / 2 - 70;
    this.player.y = H / 2 + 30;
    this.player.angle = -Math.PI / 2;
    this.player.down = false;
    this.player.hp = this.player.maxHp;
    this.mate.x = W / 2 + 70;
    this.mate.y = H / 2 + 30;
    this.mate.angle = -Math.PI / 2;
    this.mate.down = false;
    this.mate.hp = this.mate.maxHp;
    this.coop = { on: true, mode: "levels", levelIndex, p1Ready: false, p2Ready: false, mateHere: false, started: false };
    this.mate.active = false;
    this.status = "coop";
    this.decorate();
    this.emit();
  }
  coopMateJoined(here: boolean) {
    this.coop.mateHere = here;
    this.mate.active = here;
    if (!here) {
      this.coop.p2Ready = false;
      this.mate.active = false;
    }
    this.emit();
  }
  coopSetLevel(i: number) {
    let idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    if (this.netRole === "host" && !isUnlocked(this.progress, idx, this.settings.freePlay)) idx = 0;
    this.coop.mode = "levels";
    this.coop.levelIndex = idx;
    this.level = LEVELS[this.coop.levelIndex];
    this.applyArena(this.level);
    this.paper = this.makePaper();
    this.coop.p1Ready = false;
    this.coop.p2Ready = false;
    this.emit();
  }
  coopSetMode(mode: "levels" | "endless") {
    if (mode === "endless" && this.netRole === "host" && this.clearedCount() < 3 && !this.settings.freePlay) return;
    this.coop.mode = mode;
    if (mode === "endless") this.coop.levelIndex = 0;
    this.level = mode === "endless" ? ENDLESS : LEVELS[this.coop.levelIndex] ?? LEVELS[0];
    this.applyArena(this.level);
    this.paper = this.makePaper();
    this.coop.p1Ready = false;
    this.coop.p2Ready = false;
    this.emit();
  }
  coopReady(which: 1 | 2, v: boolean) {
    if (which === 1) this.coop.p1Ready = v;
    else this.coop.p2Ready = v;
    this.emit();
  }
  coopCanStart() {
    return this.coop.mateHere && this.coop.p1Ready && this.coop.p2Ready;
  }
  coopBegin() {
    if (this.netRole !== "host" || !this.coopCanStart()) return;
    // never stall on a sheet this save has not opened yet
    if (!isUnlocked(this.progress, this.coop.levelIndex, this.settings.freePlay)) this.coop.levelIndex = 0;
    this.coop.started = true;
    this.mate.active = true;
    this.startLevel(this.coop.mode === "endless" ? 0 : this.coop.levelIndex, this.coop.mode === "endless");
  }
  coopLeave() {
    this.netRole = "off";
    this.coop.on = false;
    this.coop.started = false;
    this.mate.active = false;
    this.vote.open = false;
    this.netSend = null;
    this.goMenu();
  }

  /* ------------------------------------------------------- perk voting */
  openVote(choices: PerkId[]) {
    this.vote = { open: true, endsAt: this.time + 900, p1: null, p2: null, locked: null, tie: false };
    this.perkChoices = choices;
    this.perkArm = 1.25;
    this.status = "perks";
    this.emit();
  }
  castVote(which: 1 | 2, id: PerkId) {
    if (this.status !== "perks" || !this.vote.open || this.vote.locked) return;
    if (this.perkArm > 0) return;
    if (!this.perkChoices.includes(id)) return;
    if (which === 1) this.vote.p1 = id;
    else this.vote.p2 = id;
    this.vote.tie = false;
    sfx.pickup();
    this.resolveVote();
    this.emit();
  }
  resolveVote() {
    const { p1, p2 } = this.vote;
    if (!p1 || !p2) return;
    if (p1 === p2) {
      this.vote.locked = p1;
      setTimeout(() => this.applyVote(p1), 650);
      return;
    }
    // disagreement: the page flips a coin between the two picks
    this.vote.tie = true;
    const pick = Math.random() < 0.5 ? p1 : p2;
    this.vote.locked = pick;
    setTimeout(() => this.applyVote(pick), 1500);
  }
  applyVote(id: PerkId) {
    if (this.status !== "perks") return;
    this.vote.open = false;
    this.vote.locked = null;
    this.choosePerk(id, true);
  }

  /** ink explosion left behind by a dash with the perk */
  dashBlast(x: number, y: number, rank: number) {
    const R = 78 + 26 * rank;
    this.explode(x, y, R, 2.2 * rank, 0, false, false);
    this.shock(x, y, 16, 560, 0.5);
    this.shock(x, y, 10, 340, 0.75);
    this.petals.push({ x, y, life: 0.75, max: 0.75, seed: Math.random() * 1e6, n: 8 });
    for (let i = 0; i < 3; i++) {
      this.cracks.push({ x, y, ang: Math.random() * TAU, len: 50 + Math.random() * 90, life: 0.35, max: 0.35, seed: Math.random() * 1e6 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * TAU;
      const sp = 160 + Math.random() * 340;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 0.4 + Math.random() * 0.4,
        max: 0.8,
        size: 2 + Math.random() * 3,
        kind: "ember",
        rot: 0,
      });
    }
    this.shake = Math.max(this.shake, 9);
    sfx.boom();
  }

  // ---------- paper ----------
  makePaper() {
    const key = this.endless ? "e" : String(this.level.id);
    const cached = this.paperCache.get(key);
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    const r = mulberry32(7);
    for (let i = 0; i < 4200; i++) {
      const v = 155 + Math.floor(r() * 65);
      g.fillStyle = `rgba(${v},${v - 5},${v - 15},${0.05 + r() * 0.1})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 1.6, 1 + r() * 1.6);
    }
    g.strokeStyle = "rgba(50,50,50,0.05)";
    g.lineWidth = 8;
    for (let i = 0; i < 16; i++) wline(g, r() * W, r() * H, r() * W, r() * H, r, 14);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.lineCap = "round";
    wrect(g, 10, 10, W - 20, H - 20, r, 2);
    g.lineWidth = 1.2;
    wrect(g, 17, 17, W - 34, H - 34, r, 1.5);
    for (const [cx, cy] of [
      [30, 30],
      [W - 30, 30],
      [30, H - 30],
      [W - 30, H - 30],
    ]) {
      wcircle(g, cx, cy, 5, r, 1, 1);
    }
    const grad = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.14)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    this.drawMapGeometry(g);
    this.drawMonsterTraces(g);
    this.drawPageDoodles(g);
    this.drawArenaStatic(g);
    this.paperCache.set(key, c);
    return c;
  }

  /** faint pencil traces that hint at what lives on this sheet */
  drawMonsterTraces(g: CanvasRenderingContext2D) {
    const pool = Object.keys(this.level.pool) as EnemyKind[];
    const r = mulberry32(this.level.id * 613 + 29);
    g.save();
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.globalAlpha = 0.13;
    g.lineWidth = 1.4;
    const has = (k: EnemyKind) => pool.includes(k);
    // little trails everywhere: footprints and drips
    for (let i = 0; i < 22; i++) {
      const x = 60 + r() * (W - 120);
      const y = 70 + r() * (H - 140);
      const a = r() * TAU;
      const step = 12 + r() * 8;
      for (let k = 0; k < 4; k++) {
        const px = x + Math.cos(a) * k * step;
        const py = y + Math.sin(a) * k * step;
        g.beginPath();
        g.ellipse(px, py, 3.2, 2, a, 0, TAU);
        g.fill();
      }
    }
    if (has("fly")) {
      // dashed buzz paths
      g.globalAlpha = 0.16;
      for (let i = 0; i < 10; i++) {
        const x = 60 + r() * (W - 120);
        const y = 80 + r() * (H - 160);
        g.setLineDash([4, 6]);
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + 60, y - 34, x + 110, y + 40, x + 170, y - 12);
        g.stroke();
        g.setLineDash([]);
      }
    }
    if (has("blob") || has("splitter")) {
      // dried splats with satellite droplets
      for (let i = 0; i < 12; i++) splat(g, 70 + r() * (W - 140), 80 + r() * (H - 160), 5 + r() * 12, r, 3);
    }
    if (has("spiky")) {
      // scratched star bursts
      for (let i = 0; i < 8; i++) {
        const x = 80 + r() * (W - 160);
        const y = 90 + r() * (H - 180);
        const rr = mulberry32(i * 71 + this.level.id);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU;
          wline(g, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * (14 + rr() * 12), y + Math.sin(a) * (14 + rr() * 12), rr, 1);
        }
      }
    }
    if (has("brute")) {
      // heavy dents with cracks
      g.globalAlpha = 0.15;
      for (let i = 0; i < 5; i++) {
        const x = 110 + r() * (W - 220);
        const y = 130 + r() * (H - 260);
        wcircle(g, x, y, 20 + r() * 10, r, 2, 1);
        for (let k = 0; k < 5; k++) {
          const a = r() * TAU;
          wline(g, x, y, x + Math.cos(a) * (26 + r() * 16), y + Math.sin(a) * (26 + r() * 16), r, 2);
        }
      }
    }
    if (has("shooter") || has("sniper")) {
      // spent cartridges and bullet streaks
      g.globalAlpha = 0.17;
      for (let i = 0; i < 16; i++) {
        const x = 60 + r() * (W - 120);
        const y = 80 + r() * (H - 160);
        g.save();
        g.translate(x, y);
        g.rotate(r() * TAU);
        wline(g, 0, 0, 16 + r() * 14, 0, r, 1);
        g.restore();
      }
    }
    if (has("zipper")) {
      // long slash lines
      g.globalAlpha = 0.15;
      for (let i = 0; i < 7; i++) {
        const x = 90 + r() * (W - 180);
        const y = 90 + r() * (H - 180);
        const a = r() * TAU;
        const len = 90 + r() * 120;
        wline(g, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, r, 2);
      }
    }
    if (has("bomber")) {
      // scorch rings
      g.globalAlpha = 0.16;
      for (let i = 0; i < 8; i++) {
        const x = 90 + r() * (W - 180);
        const y = 100 + r() * (H - 200);
        burst(g, x, y, 8, 24 + r() * 14, 9, r);
        wcircle(g, x, y, 6, r, 1, 1);
      }
    }
    if (has("shield")) {
      // shield outlines stuck in the paper
      g.globalAlpha = 0.15;
      for (let i = 0; i < 5; i++) {
        const x = 120 + r() * (W - 240);
        const y = 130 + r() * (H - 260);
        const rr = mulberry32(i * 53 + this.level.id * 3);
        wpoly(g, [[x - 10, y - 16], [x + 8, y - 12], [x + 11, y + 4], [x - 4, y + 18], [x - 13, y + 2]], rr, 1.5);
        for (let k = 0; k < 3; k++) wline(g, x - 8 + k * 6, y - 10, x - 6 + k * 6, y + 10, rr, 1);
      }
    }
    if (has("ghost")) {
      // spectral scribbles and floating orbs
      g.globalAlpha = 0.14;
      for (let i = 0; i < 6; i++) {
        const x = 100 + r() * (W - 200);
        const y = 110 + r() * (H - 220);
        const rr = mulberry32(i * 97 + this.level.id * 7);
        ctxGhostScribble(g, x, y, 22 + rr() * 16, rr);
        wcircle(g, x, y, 3, rr, 1, 1);
      }
    }
    g.restore();
  }

  /** Each compact arena has its own light pencil floor plan. */
  drawMapGeometry(g: CanvasRenderingContext2D) {
    const id = this.level.id;
    const r = mulberry32(id * 293);
    g.save();
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.globalAlpha = 0.14;
    g.lineWidth = 1.3;
    if (id === 1) {
      for (const [x, y] of [[180, 150], [780, 450]]) {
        for (let i = 1; i <= 4; i++) wcircle(g, x, y, 29 + i * 15, r, 2, 1);
      }
      for (let i = 0; i < 9; i++) wline(g, 110 + i * 88, 80, 140 + i * 88, 100, r, 1);
    } else if (id === 2) {
      // Honeycomb marks run around the outside, leaving the center clear.
      for (let col = 0; col < 15; col++) for (const row of [0, 1, 6, 7]) {
        const x = 72 + col * 58 + (row % 2) * 27;
        const y = 70 + row * 65;
        const pts: [number, number][] = [];
        for (let i = 0; i < 6; i++) pts.push([x + Math.cos(i * TAU / 6) * 23, y + Math.sin(i * TAU / 6) * 23]);
        wpoly(g, pts, r, 1);
      }
    } else if (id === 3) {
      for (let y = 76; y < H - 40; y += 43) wline(g, 46, y, W - 46, y, r, 1);
      for (let x = 110; x < W - 50; x += 165) {
        wline(g, x, 50, x, H - 50, r, 1);
        for (const y of [134, H - 134]) {
          wcircle(g, x, y, 17, r, 2, 1);
          wcircle(g, x, y, 5, r, 1, 1);
        }
      }
    } else if (id === 4) {
      for (const x of [160, 800]) for (const y of [120, 480]) {
        for (let i = 0; i < 3; i++) wcircle(g, x, y, 25 + i * 18, r, 1.4, 1);
        wline(g, x - 68, y, x + 68, y, r, 1);
        wline(g, x, y - 68, x, y + 68, r, 1);
      }
    } else if (id === 5) {
      for (const [x, y] of [[170, 150], [790, 450], [790, 150], [170, 450]]) {
        burst(g, x, y, 30, 90, 19, r);
        wcircle(g, x, y, 45, r, 3, 1);
      }
      for (let i = 0; i < 28; i++) splat(g, 55 + r() * (W - 110), 45 + r() * (H - 90), 1 + r() * 3, r, 1);
    } else {
      const pts: [number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 - Math.PI / 2;
        pts.push([W / 2 + Math.cos(a) * 225, H / 2 + Math.sin(a) * 225]);
      }
      wpoly(g, pts, r, 2);
      for (const [x, y] of pts) wcircle(g, x, y, 30, r, 2, 1);
      for (let i = 0; i < 24; i++) {
        const a = i * TAU / 24;
        const x = W / 2 + Math.cos(a) * 255;
        const y = H / 2 + Math.sin(a) * 255;
        wline(g, x, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14, r, 1);
      }
    }
    g.restore();
  }

  /** lovely hand-drawn page junk: sticky note, paperclip, coffee ring, margin notes */
  drawPageDoodles(g: CanvasRenderingContext2D) {
    const r = mulberry32(31 + this.level.id * 17 + (this.endless ? 5 : 0));
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    // margin line + punch holes
    g.strokeStyle = INK;
    g.globalAlpha = 0.28;
    g.lineWidth = 1.6;
    wline(g, 36, 22, 36, H - 22, r, 2);
    g.globalAlpha = 0.5;
    for (const y of [100, H / 2, H - 100]) {
      g.fillStyle = PAPER;
      g.beginPath();
      g.arc(24, y, 7, 0, TAU);
      g.fill();
      g.lineWidth = 1.5;
      wcircle(g, 24, y, 7, r, 1, 1);
    }
    // margin scribble
    g.globalAlpha = 0.4;
    g.font = `16px "Caveat", "Comic Sans MS", cursive`;
    g.textAlign = "center";
    g.save();
    g.translate(24, H / 2 + 140);
    g.rotate(-Math.PI / 2);
    g.fillStyle = INK;
    g.fillText(this.endless ? "лист не кончается..." : `тетрадь · лист ${this.level.id}`, 0, 0);
    g.restore();
    // coffee ring
    g.globalAlpha = 0.16;
    g.lineWidth = 5;
    wcircle(g, 132, H - 148, 34, r, 4, 2);
    g.lineWidth = 2;
    wcircle(g, 132, H - 148, 27, r, 3, 1);
    g.globalAlpha = 0.1;
    for (let i = 0; i < 4; i++) splat(g, 132 + (r() - 0.5) * 90, H - 148 + (r() - 0.5) * 70, 5 + r() * 7, r, 2);
    // paperclip
    g.globalAlpha = 0.45;
    g.strokeStyle = INK;
    g.lineWidth = 2.4;
    g.save();
    g.translate(W - 78, 112);
    g.rotate(0.5);
    g.beginPath();
    g.moveTo(-8, 22);
    g.lineTo(-8, -10);
    g.arc(0, -10, 8, Math.PI, 0);
    g.lineTo(8, 16);
    g.arc(0, 16, 8, 0, Math.PI, true);
    g.lineTo(-3, -6);
    g.arc(0, -6, 3, Math.PI, 0);
    g.stroke();
    g.restore();
    // sticky note with a tip (soft, so it never covers the action)
    const tip = this.endless ? "перки копятся — не стой на месте" : this.level.tip;
    const words = tip.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 34) {
        lines.push(cur.trim());
        cur = w;
      } else cur += " " + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    g.save();
    g.translate(W - 262, H - 196);
    g.rotate(0.035);
    g.globalAlpha = 0.85;
    g.fillStyle = "#f7f2e3";
    g.fillRect(0, 0, 224, 42 + lines.slice(0, 3).length * 20);
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    wrect(g, 0, 0, 224, 42 + lines.slice(0, 3).length * 20, r, 2);
    g.fillStyle = "rgba(26,26,26,0.18)";
    g.fillRect(24, -6, 84, 18);
    g.fillStyle = "rgba(26,26,26,0.09)";
    g.fillRect(30, -5, 72, 16);
    g.fillStyle = INK;
    g.globalAlpha = 0.72;
    g.font = `bold 16px "Kelly Slab", serif`;
    g.textAlign = "left";
    g.fillText("✎ подсказка", 10, 20);
    g.font = `15px "Caveat", "Comic Sans MS", cursive`;
    lines.slice(0, 3).forEach((ln, i) => g.fillText(ln, 10, 42 + i * 20));
    g.restore();
    // teacher stamp
    g.save();
    g.translate(W - 210, 150);
    g.rotate(-0.18);
    g.globalAlpha = 0.18;
    g.lineWidth = 3;
    wrect(g, -70, -20, 140, 40, r, 2);
    g.fillStyle = INK;
    g.font = `bold 24px "Kelly Slab", serif`;
    g.textAlign = "center";
    g.fillText("МОЛОДЕЦ!", 0, 9);
    g.restore();
    // eraser crumbs + pencil shavings in a corner
    g.globalAlpha = 0.25;
    for (let i = 0; i < 22; i++) {
      const x = 70 + r() * 130;
      const y = 120 + r() * 90;
      if (r() < 0.5) {
        g.fillStyle = INK;
        g.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2.5);
      } else {
        g.strokeStyle = INK;
        g.lineWidth = 1.2;
        wline(g, x, y, x + 3 + r() * 5, y + 2, r, 1);
      }
    }
    // crossed-out doodle enemies in the margin (trophy wall)
    g.globalAlpha = 0.2;
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const x = W - 46;
      const y = 300 + i * 34;
      wcircle(g, x, y, 8, r, 1.5, 1);
      wline(g, x - 10, y - 10, x + 10, y + 10, r, 1.5);
      wline(g, x + 10, y - 10, x - 10, y + 10, r, 1.5);
    }
    // dog ear corner
    g.globalAlpha = 0.5;
    g.fillStyle = "#e8e2d2";
    g.beginPath();
    g.moveTo(W - 56, 18);
    g.lineTo(W - 18, 18);
    g.lineTo(W - 18, 56);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  // ---------- loop ----------
  loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    const elapsed = now - this.last;
    // Cap at ~72 fps: high-refresh monitors used to render the whole scene 144 times a second.
    if (elapsed < 13.2) return;
    const raw = Math.min(0.033, elapsed / 1000);
    this.last = now;
    const t0 = performance.now();
    this.step(raw);
    // Cosmetic-only safety budgets for long endless runs; combat objects are untouched.
    if (this.ghosts.length > 60) this.ghosts.splice(0, this.ghosts.length - 60);
    if (this.cracks.length > 120) this.cracks.splice(0, this.cracks.length - 120);
    this.governQuality(elapsed, performance.now() - t0, raw);
  }

  /** one frame of the whole machine: transitions, cutscene, bullet time, gameplay, render */
  step(raw: number) {
    if (this.netRole === "guest") {
      this.tickTransitions(raw);
      this.coopGuestStep(raw);
      return;
    }
    this.tickTransitions(raw);
    const frozen = this.transitionFrozen();
    if (this.status === "perks" && !frozen) {
      // bullet time: the page slowly grinds to a halt while the cards hover
      this.perkArm = Math.max(0, this.perkArm - raw);
      this.dilation += (0.2 - this.dilation) * Math.min(1, raw * 2.8);
      this.tickFx(raw * this.dilation);
      this.uiEmit(raw);
    } else if (this.status === "playing" && !frozen) {
      if (this.freeze > 0) {
        this.freeze -= raw;
        this.update(raw * 0.18);
      } else {
        this.update(raw);
      }
      this.dilation += (1 - this.dilation) * Math.min(1, raw * 3.4);
      this.hudTimer -= raw;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.25;
        if (this.hudSignature() !== this.lastSig) this.emit();
      }
    } else {
      this.dilation += (1 - this.dilation) * Math.min(1, raw * 3.4);
    }
    this.darkT += ((this.status === "perks" ? 1 : 0) - this.darkT) * Math.min(1, raw * 3.4);
    this.time += raw * this.dilation;
    this.frameNo++;
    this.coopHostPump(raw);
    this.render();
  }

  uiEmit(raw: number) {
    this.uiEmitT -= raw;
    if (this.uiEmitT <= 0) {
      this.uiEmitT = 0.1;
      this.emit();
    }
  }

  /** cosmetic-only simulation: keeps particles and ripples alive while gameplay is paused */
  tickFx(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === "ember" || pt.kind === "debris") {
        pt.vy += 900 * dt;
        pt.vx *= 0.985;
        pt.rot += dt * (pt.kind === "debris" ? 9 : 3);
        if (pt.y > H - 22) {
          pt.y = H - 22;
          pt.vy *= -0.42;
          pt.vx *= 0.7;
          if (Math.abs(pt.vy) < 40) pt.vy = 0;
        }
        if (pt.x < 20 || pt.x > W - 20) pt.vx *= -0.6;
      } else if (pt.kind === "smoke") {
        pt.vy -= 26 * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
      } else {
        pt.vx *= 0.92;
        pt.vy *= 0.92;
      }
    }
    if (this.particles.length > 520) this.particles.splice(0, this.particles.length - 520);
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const s of this.shocks) {
      s.life -= dt;
      s.r += s.vr * dt;
    }
    this.shocks = this.shocks.filter((s) => s.life > 0);
    for (const bm of this.beams) bm.life -= dt;
    this.beams = this.beams.filter((bm) => bm.life > 0);
    for (const gh of this.ghosts) gh.life -= dt;
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
    for (const h of this.hitmarks) h.life -= dt;
    this.hitmarks = this.hitmarks.filter((h) => h.life > 0);
    for (const c of this.cracks) c.life -= dt;
    this.cracks = this.cracks.filter((c) => c.life > 0);
    for (const pe of this.petals) pe.life -= dt;
    this.petals = this.petals.filter((pe) => pe.life > 0);
    for (const bu of this.bursts) bu.life -= dt;
    this.bursts = this.bursts.filter((bu) => bu.life > 0);
    for (const pr of this.prints) pr.life -= dt;
    this.prints = this.prints.filter((pr) => pr.life > 0);
    for (const sp of this.edgeSplats) sp.life -= dt;
    this.edgeSplats = this.edgeSplats.filter((sp) => sp.life > 0);
    for (const wn of this.warnings) wn.t -= dt;
    this.warnings = this.warnings.filter((wn) => wn.t > 0);
    for (const sc of this.borderScars) sc.life -= dt;
    this.borderScars = this.borderScars.filter((sc) => sc.life > 0);
    for (const r of this.damageRings) {
      r.life -= dt;
      r.r += r.vr * dt;
    }
    this.damageRings = this.damageRings.filter((r) => r.life > 0);
    this.shake = Math.max(0, this.shake - dt * 34);
    this.zoom = Math.max(0, this.zoom - dt * 0.55);
    this.flash = Math.max(0, this.flash - dt);
    this.slow = Math.max(0, this.slow - dt);
  }

  /** drops effect fidelity when frames get expensive, restores it when there is headroom */
  governQuality(elapsed: number, cost: number, raw: number) {
    this.costEma += (cost - this.costEma) * 0.08;
    this.fpsEma += (1000 / Math.max(1, elapsed) - this.fpsEma) * 0.06;
    this.qualityTimer += raw;
    if (this.qualityTimer < 1) return;
    if ((this.costEma > 11 || this.fpsEma < 45) && this.quality < 2) {
      this.quality++;
      this.qualityTimer = -1.5;
    } else if (this.costEma < 4.5 && this.fpsEma > 55 && this.quality > 0 && this.qualityTimer > 9) {
      this.quality--;
      this.qualityTimer = 0;
    }
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    if (patch.volume !== undefined) setVolume(this.settings.volume);
    this.emit();
  }

  hudSignature() {
    const b = this.boss;
    return [
      this.score,
      this.wave,
      this.kills,
      this.player.hp,
      this.player.maxHp,
      this.combo,
      b ? Math.ceil((b.hp / b.maxHp) * 20) : -1,
      this.frenzyOn ? 1 : 0,
      this.meta.xp,
      this.quality,
      Math.round(this.ult),
      this.netRole === "guest" ? this.mate.weapon : this.player.weapon,
      Math.ceil((this.netRole === "guest" ? this.mate.dashCd : this.player.dashCd) * 4),
    ].join("|");
  }

  /** the torn page grows back whenever we leave the fight */
  resetArena() {
    this.limitX = W;
    this.baseLimit = W;
    this.limitTarget = W;
    this.pageCut = false;
    this.fin = null;
    this.finalFight = false;
  }

  /** advance the ink transition; swaps the screen at the halfway point */
  tickTransitions(raw: number) {
    if (!this.trans) return;
    this.trans.t += raw;
    const p = this.trans.t / this.trans.dur;
    if (!this.trans.swapped && p >= 0.5 && this.pendingStatus) {
      this.trans.swapped = true;
      this.status = this.pendingStatus;
      this.pendingStatus = null;
      if (this.status !== "playing" && this.status !== "paused" && this.status !== "perks") this.resetArena();
      this.emit();
    }
    if (this.trans.t >= this.trans.dur) {
      this.trans = null;
      this.emit();
    }
  }

  transitionFrozen() {
    return !!this.trans && coverage(this.trans.t / this.trans.dur) > 0.35;
  }

  // ---------- enemies factory ----------
  makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const d = this.difficulty;
    const s = 1 + d * 0.11;
    const base: Record<EnemyKind, { r: number; hp: number; speed: number; score: number }> = {
      blob: { r: 13, hp: 1.4, speed: 130, score: 10 },
      fly: { r: 9, hp: 0.7, speed: 175, score: 8 },
      spiky: { r: 17, hp: 3, speed: 95, score: 18 },
      brute: { r: 32, hp: 15, speed: 52, score: 70 },
      shooter: { r: 15, hp: 3, speed: 78, score: 30 },
      zipper: { r: 14, hp: 2.4, speed: 110, score: 25 },
      splitter: { r: 21, hp: 5, speed: 78, score: 35 },
      bomber: { r: 15, hp: 2, speed: 130, score: 25 },
      sniper: { r: 17, hp: 3.5, speed: 62, score: 40 },
      shield: { r: 20, hp: 7, speed: 70, score: 48 },
      ghost: { r: 15, hp: 2.2, speed: 115, score: 32 },
      boss: { r: 52, hp: 42, speed: 40, score: 500 },
    };
    const b = base[kind];
    const bossScale = kind === "boss" ? 1 + d * 0.16 : s;
    const hp = b.hp * bossScale;
    return {
      id: this.nextId++,
      kind,
      x,
      y,
      r: b.r,
      hp,
      maxHp: hp,
      speed: b.speed * (1 + d * 0.03),
      angle: Math.random() * TAU,
      flash: 0,
      fireCd: 1.2 + Math.random() * 1.2,
      phase: Math.random() * TAU,
      score: b.score,
      age: 0,
      burst: 0,
      dashT: 0,
      chargeT: 0,
      dashAngle: 0,
      dead: false,
    };
  }

  spawnEnemy(kind: EnemyKind, x?: number, y?: number) {
    if (x === undefined || y === undefined) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        x = Math.random() * this.limitX;
        y = -30;
      } else if (side === 1) {
        x = this.limitX + 30;
        y = Math.random() * H;
      } else if (side === 2) {
        x = Math.random() * this.limitX;
        y = H + 30;
      } else {
        x = -30;
        y = Math.random() * H;
      }
    }
    const e = this.makeEnemy(kind, x, y);
    const offscreen = x < 35 || x > this.limitX - 35 || y < 35 || y > H - 35;
    if (offscreen) {
      e.hp = Math.max(0.6, e.hp * 0.42);
      e.maxHp = e.hp;
      e.fireCd = Math.max(e.fireCd, 1.5);
    }
    this.enemies.push(e);
    this.shock(e.x, e.y, 10, 2, 0.4);
    this.warnings.push({
      x: Math.max(38, Math.min(this.limitX - 38, e.x)),
      y: Math.max(38, Math.min(H - 38, e.y)),
      t: 0.45,
      max: 0.45,
      seed: Math.random() * 1e6,
    });
    if (kind === "boss") {
      this.shake = 20;
      sfx.bossIntro();
      this.addText(W / 2, H / 2 - 110, "ЧУДИЩЕ!", 2, 2);
    }
  }

  /** overall difficulty used for enemy scaling: level base + wave inside it */
  get difficulty() {
    return this.level.diff + (this.wave - 1) * 0.6;
  }

  startWave() {
    this.wave++;
    const lv = this.level;
    const w = this.wave;
    const entries = (Object.entries(lv.pool) as [EnemyKind, number][]).filter(([, n]) => n > 0);
    const sum = entries.reduce((a, [, n]) => a + n, 0) || 1;
    const total = Math.max(4, Math.round((lv.base + (w - 1) * lv.perWave - 2) * (this.isCoop() ? 1.35 : 1)));
    const q: EnemyKind[] = [];
    for (let i = 0; i < total; i++) {
      let roll = Math.random() * sum;
      let picked: EnemyKind = entries[0]?.[0] ?? "blob";
      for (const [k, n] of entries) {
        roll -= n;
        if (roll <= 0) {
          picked = k;
          break;
        }
      }
      q.push(picked);
    }
    this.spawnQueue = q;
    if (this.endless) {
      if (w % 4 === 0) {
        this.bossPending = true;
        const ids = (Object.keys(BOSSES) as (keyof typeof BOSSES)[]).filter((k) => k !== "abyss");
        this.bossPick = ids[Math.floor(Math.random() * ids.length)];
      }
      if (w >= 5) this.unlockSticker("endless5");
      if (w >= 12) this.unlockSticker("endless12");
      this.meta.bestEndless = Math.max(this.meta.bestEndless, w - 1);
      saveMeta(this.meta);
    } else if (w >= lv.waves) this.bossPending = true;
    this.waveTotal = q.length;
    this.waveClock = 0;
    this.rage = false;
    this.spawnTimer = 0.25;
    this.waveBanner = 2;
    this.shake = Math.max(this.shake, 8);
  }

  /** weapons unlocked by beating earlier levels (ammo-limited extras) */
  unlockedExtras(): WeaponId[] {
    const extras: WeaponId[] = [];
    for (let i = 0; i < this.levelIndex; i++) {
      const w = LEVELS[i].weapon;
      if (w !== "pistol" && w !== this.level.weapon && !extras.includes(w)) extras.push(w);
    }
    return extras.filter((w) => this.ammo[w] < WEAPONS[w].maxAmmo);
  }

  pickDrop(): PickupKind {
    const p = this.player;
    if (p.hp < p.maxHp && Math.random() < (p.hp <= 3 ? 0.65 : 0.4)) return "heart";
    const extras = this.unlockedExtras().filter((w): w is Exclude<WeaponId, "pistol"> => w !== "pistol");
    if (extras.length === 0) return "heart";
    return extras[Math.floor(Math.random() * extras.length)];
  }

  // ---------- bosses ----------
  bossActive() {
    return this.boss && this.boss.state === "fight";
  }

  bossDef(id: string): BossDef {
    return (BOSSES as Record<string, BossDef>)[id] ?? BOSSES.king;
  }

  makeBoss(def: BossDef, hp: number): BossState {
    return {
      def,
      x: W / 2,
      y: 150,
      r: def.r,
      hp,
      maxHp: hp,
      phase: 0,
      angle: Math.PI / 2,
      t: 0,
      state: "intro",
      stateT: 2.7,
      attackCd: 1,
      attackIndex: 0,
      attack: null,
      telegraph: 0,
      telegraphTotal: 0,
      targetX: W / 2,
      targetY: H / 2,
      flash: 0,
      spin: 0,
      bob: 0,
      emit: null,
      laser: null,
      charging: 0,
      chargeAngle: Math.PI / 2,
      deathTick: 0,
      tents: [],
      lashes: [],
      sweep: null,
      lockAngle: Math.PI / 2,
      leap: null,
      hop: 0,
      queenDash: null,
      queenSlash: null,
    };
  }

  startBoss() {
    if (this.boss || this.status !== "playing") return;
    const def = BOSSES[this.endless && this.bossPick ? this.bossPick : this.level.boss];
    const scale = this.endless
      ? 1 + Math.floor(this.wave / 4) * 0.3
      : 1 + this.levelIndex * 0.1;
    const hp = Math.round(def.hp * scale * (this.isCoop() ? 1.5 : 1));
    this.boss = this.makeBoss(def, hp);
    this.initTentacles();
    this.bossBanner = 3;
    this.bossPending = false;
    this.ebullets = [];
    this.hazards = [];
    this.flash = 0.12;
    this.shake = 26;
    this.zoom = 0.05;
    this.slow = 0.55;
    this.addText(W / 2, H / 2 + 110, def.name, 2.6, 2.1);
    this.shock(W / 2, 150, 24, 900, 0.9);
    this.edgeSplat(3, 34);
    for (let i = 0; i < 50; i++) this.drop(W / 2, 130, 80 + Math.random() * 380);
    for (let i = 0; i < 8; i++) {
      this.stains.push({ x: W / 2 + (Math.random() - 0.5) * 260, y: 150 + (Math.random() - 0.5) * 150, size: 6 + Math.random() * 14, seed: Math.random() * 1e6, born: this.time });
    }
    sfx.bossIntro();
  }

  bossHittable() {
    const b = this.boss;
    return !!b && (b.state === "fight" || b.state === "transition");
  }

  damageBoss(dmg: number, x: number, y: number) {
    const b = this.boss;
    if (!b || b.state === "intro" || b.state === "transition" || b.state === "dying" || b.state === "finale") return;
    b.hp -= dmg;
    b.flash = 0.1;
    this.hitmarks.push({ x, y, life: 0.16 });
    if (dmg >= 3) sfx.crit();
    else sfx.hit();
    this.puffsAt(x, y, dmg >= 3 ? 10 : 4);
    for (let i = 0; i < (dmg >= 3 ? 10 : 3); i++) this.drop(x, y, 120 + Math.random() * 240);
    this.shake = Math.max(this.shake, dmg >= 3 ? 7 : 2);
    this.zoom = Math.max(this.zoom, dmg >= 3 ? 0.02 : 0);
    if (b.hp <= 0) {
      b.hp = 0;
      this.startBossDeath();
      return;
    }
    if (b.def.id === "queen") {
      if (b.phase === 0 && b.hp <= b.maxHp * 0.5) this.bossPhaseChange(2);
      return;
    }
    const phaseCount = b.def.phases.length;
    const threshold = b.maxHp * (1 - (b.phase + 1) / phaseCount);
    if (b.phase < phaseCount - 1 && b.hp <= threshold) this.bossPhaseChange(b.phase + 1);
  }

  bossPhaseChange(next: number) {
    const b = this.boss!;
    b.phase = next;
    clearSpecial(this);
    b.state = "transition";
    b.stateT = b.def.id === "queen" ? 2.6 : b.def.id === "mecha" && next === 1 ? 3.4 : 1.6;
    if (b.def.id === "mecha") { b.r = next === 0 ? 24 : 88; b.attackCd = 1.6; }
    b.attack = null;
    b.telegraph = 0;
    b.emit = null;
    b.laser = null;
    b.charging = 0;
    b.queenDash = null;
    b.queenSlash = null;
    if (b.def.id === "queen") {
      this.queenFlood = 1;
      this.queenCut = { key: ++this.queenCutKey, angle: -0.7, phase: true };
      this.emit();
      this.addText(W / 2, H / 2 - 36, "ЧЕРНИЛЬНОЕ ПЕРЕРОЖДЕНИЕ", 2.6, 1.6);
      this.edgeSplat(7, 42);
      this.enemies = [];
    }
    this.ebullets = [];
    this.hazards = [];
    this.slow = 0.9;
    this.flash = 0.13;
    this.shake = 30;
    this.zoom = 0.07;
    this.freeze = 0.06;
    this.shock(b.x, b.y, b.r * 0.6, 900, 0.8);
    this.damageRings.push({ x: b.x, y: b.y, r: b.r, vr: 560, life: 0.65, max: 0.65, hit: true, w: 4 });
    for (let i = 0; i < 40; i++) this.drop(b.x, b.y, 140 + Math.random() * 480);
    this.edgeSplat(2, 26);
    this.addText(b.x, b.y - b.r - 34, `ФАЗА ${b.def.id === "queen" ? 2 : next + 1} · ${b.def.phaseNames[next]}`, 2.4, 1.9);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    this.ult = Math.min(100, this.ult + 12);
    const pool = (Object.keys(this.level.pool) as EnemyKind[]).filter((k) => k !== "boss");
    for (let i = 0; i < (b.def.id === "queen" ? 0 : 4); i++) {
      const kind = pool[Math.floor(Math.random() * pool.length)] || "blob";
      const a = (i / 4) * TAU + Math.random();
      this.spawnEnemy(kind, Math.max(70, Math.min(this.limitX - 70, b.x + Math.cos(a) * (b.r + 60))), Math.max(70, Math.min(H - 70, b.y + Math.sin(a) * (b.r + 60))));
    }
    sfx.phase();
    sfx.summon();
  }

  startBossDeath() {
    const b = this.boss!;
    if (isFinaleLevel(this)) {
      startFinale(this);
      return;
    }
    b.state = "dying";
    b.stateT = 2.4;
    b.deathTick = 0;
    b.attack = null;
    b.telegraph = 0;
    b.emit = null;
    b.laser = null;
    b.charging = 0;
    b.queenDash = null;
    b.queenSlash = null;
    this.ebullets = [];
    this.hazards = [];
    this.damageRings = [];
    this.enemies = [];
    this.spawnQueue = [];
    this.player.invuln = 3;
    this.slow = 1;
    this.flash = 0.2;
    this.freeze = 0.16;
    this.shake = 36;
    this.zoom = 0.08;
    this.score += 600 + this.levelIndex * 300;
    this.ult = 100;
    this.addText(W / 2, 160, "ПОВЕРЖЕН!", 2.8, 2.8);
    this.addText(b.x, b.y - b.r - 20, "ХРЯСЬ!", 2, 1.8);
    sfx.bigBoom();
  }

  finishBossDeath() {
    const b = this.boss!;
    if (b.def.id === "abyss") releasePage(this);
    // Epic finale: halo rings, radial ink lines and a paper-shred storm.
    this.speedLines = 1.2;
    this.zoom = 0.09;
    this.flash = 0.16;
    for (let i = 0; i < 3; i++) {
      this.shock(b.x, b.y, 20 + i * 16, 900 - i * 160, 0.9 + i * 0.2);
    }
    for (let i = 0; i < 46; i++) {
      const a2 = Math.random() * TAU;
      const sp = 220 + Math.random() * 620;
      this.particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(a2) * sp,
        vy: Math.sin(a2) * sp - 220,
        life: 1 + Math.random() * 0.8,
        max: 1.8,
        size: 4 + Math.random() * 8,
        kind: "debris",
        rot: Math.random() * TAU,
      });
    }
    for (let i = 0; i < 30; i++) {
      const a2 = Math.random() * TAU;
      this.particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(a2) * 260,
        vy: Math.sin(a2) * 260 - 100,
        life: 0.9 + Math.random() * 0.6,
        max: 1.5,
        size: 16 + Math.random() * 18,
        kind: "smoke",
        rot: 0,
      });
    }
    this.stains.push({ x: b.x, y: b.y, size: b.r * 1.1, seed: Math.random() * 1e6 , born: this.time });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU;
      const d = b.r + Math.random() * 260;
      this.stains.push({
        x: Math.max(40, Math.min(W - 40, b.x + Math.cos(a) * d)),
        y: Math.max(40, Math.min(H - 40, b.y + Math.sin(a) * d)),
        size: 10 + Math.random() * 28,
        seed: Math.random() * 1e6,
      });
    }
    for (let i = 0; i < 90; i++) this.drop(b.x, b.y, 220 + Math.random() * 520);
    this.shock(b.x, b.y, 30, 1500, 1);
    // New 2.0 destruction signature: a hand-inked implosion followed by a paper-shard burst.
    for (let i = 0; i < 5; i++) {
      this.shock(b.x, b.y, b.r * (0.35 + i * 0.18), 1180 - i * 125, 0.75 + i * 0.08);
    }
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU + (Math.random() - 0.5) * 0.16;
      const speed = 260 + Math.random() * 560;
      this.particles.push({
        x: b.x + Math.cos(a) * b.r * 0.25,
        y: b.y + Math.sin(a) * b.r * 0.25,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 90,
        life: 0.7 + Math.random() * 0.85,
        max: 1.55,
        size: 3 + Math.random() * 9,
        kind: i % 3 === 0 ? "shard" : "debris",
        rot: Math.random() * TAU,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const d = b.r + 24 + Math.random() * 88;
      const x = Math.max(24, Math.min(W - 24, b.x + Math.cos(a) * d));
      const y = Math.max(24, Math.min(H - 24, b.y + Math.sin(a) * d));
      this.stains.push({ x, y, size: 5 + Math.random() * 13, seed: Math.random() * 1e6, born: this.time });
    }
    this.edgeSplat(4, 44);
    this.explode(b.x, b.y, 150, 0, 0, true, true);
    for (let i = 0; i < 3; i++) {
      this.pickups.push({ id: this.nextId++, x: W / 2 + (i - 1) * 46, y: H / 2, kind: i === 1 ? "heart" : this.pickDrop(), life: 20 });
    }
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    if (!this.meta.bossKills.includes(b.def.id)) this.meta.bossKills.push(b.def.id);
    this.unlockSticker("boss_first");
    if ((Object.keys(BOSSES) as (keyof typeof BOSSES)[]).filter((k) => k !== "abyss").every((k) => this.meta.bossKills.includes(k))) this.unlockSticker("boss_all");
    saveMeta(this.meta);
    this.addXp(this.endless ? 260 : 220 + this.levelIndex * 50);
    this.boss = null;
    clearSpecial(this);
    this.bossPending = false;
    this.bossPick = null;
    this.enemies = [];
    this.spawnQueue = [];
    this.bossBanner = 0;
    sfx.levelClear();
  }

  addHazard(kind: Hazard["kind"], x: number, y: number, r: number, fuse: number) {
    this.hazards.push({
      kind,
      x: Math.max(50, Math.min(this.limitX - 50, x)),
      y: Math.max(50, Math.min(H - 50, y)),
      t: fuse,
      max: fuse,
      r,
      seed: Math.random() * 1e6,
    });
  }

  triggerHazard(h: Hazard) {
    this.hazards = this.hazards.filter((x) => x !== h);
    this.stains.push({ x: h.x, y: h.y, size: h.r * 0.35, seed: h.seed , born: this.time });
    this.shock(h.x, h.y, h.r * 0.4, 420, 0.4);
    for (let i = 0; i < 10; i++) this.drop(h.x, h.y, 160 + Math.random() * 200);
    if (h.kind === "rain") {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + h.seed;
        this.ebullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 4, dmg: 1, r: 6 });
      }
      sfx.rain();
    } else {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        this.ebullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 4, dmg: 1, r: 6 });
      }
      sfx.boom();
    }
    this.hurtAt(h.x, h.y, h.r, 1, 24);
  }

  // ---------- the tentacle lord ----------
  initTentacles() {
    const b = this.boss;
    if (!b || !isTent(b)) return;
    b.tents = [];
    const n = b.def.id === "abyss" ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const base = (i / n) * TAU + 0.2;
      const L = b.r + 140;
      b.tents.push({
        base,
        phase: Math.random() * TAU,
        mode: "idle",
        arm: -1,
        tipX: b.x + Math.cos(base) * L,
        tipY: b.y + Math.sin(base) * L,
        bend: 0,
        glow: 0,
      });
    }
  }

  tentBase(b: BossState, t: Tent) {
    return { x: b.x + Math.cos(t.base) * b.r * 0.62, y: b.y + Math.sin(t.base) * b.r * 0.62 };
  }

  /** shared by drawing and hit-testing so what you see is what hurts */
  tentPoints(b: BossState, t: Tent, n = 18) {
    const o = this.tentBase(b, t);
    const dx = t.tipX - o.x;
    const dy = t.tipY - o.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const calm = t.mode === "idle" || t.mode === "recover";
    const bend = t.bend + Math.sin(this.time * 1.6 + t.phase) * 0.14 * L * (calm ? 1 : 0.35);
    const cx = (o.x + t.tipX) / 2 + nx * bend;
    const cy = (o.y + t.tipY) / 2 + ny * bend;
    const amp = (calm ? 7 : 3.5) + L * 0.012;
    const pts: { x: number; y: number; u: number }[] = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const q0 = (1 - u) * (1 - u);
      const q1 = 2 * (1 - u) * u;
      const q2 = u * u;
      const wave = Math.sin(u * 7.5 - this.time * 5 + t.phase) * amp * Math.sin(u * Math.PI);
      pts.push({
        x: q0 * o.x + q1 * cx + q2 * t.tipX + nx * wave,
        y: q0 * o.y + q1 * cy + q2 * t.tipY + ny * wave,
        u,
      });
    }
    return pts;
  }

  startTentacleAttack(kind: AttackKind) {
    const b = this.boss!;
    const p = this.nearestLive(b.x, b.y);
    if (!b.tents.length) this.initTentacles();
    const angTo = Math.atan2(p.y - b.y, p.x - b.x);
    const angDiff = (a: number, c: number) => {
      let d = Math.abs(a - c) % TAU;
      if (d > Math.PI) d = TAU - d;
      return d;
    };
    if (kind === "sweep") {
      const arms = b.phase >= 2 ? 3 : 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      // arms start BESIDE the player, leaving a wide gap where they stand
      const start = angTo + TAU / arms / 2;
      b.sweep = {
        t: 0,
        tele: 1.05,
        dur: 2.7 + b.phase * 0.2,
        angle: start,
        dir,
        speed: 0.6 + b.phase * 0.08,
        arms,
        len: b.r + 270 + b.phase * 16,
        active: false,
      };
      const used = new Set<number>();
      for (let k = 0; k < arms; k++) {
        const want = start + (k * TAU) / arms;
        let best = -1;
        let bd = 99;
        b.tents.forEach((t, i) => {
          if (used.has(i) || t.mode === "windup" || t.mode === "strike") return;
          const d = angDiff(t.base, want);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best >= 0) {
          used.add(best);
          b.tents[best].mode = "sweep";
          b.tents[best].arm = k;
        }
      }
      this.addText(b.x, b.y - b.r - 26, "ВИХРЬ!", 1.1, 1.6);
      sfx.laserCharge();
      return;
    }
    const count = kind === "lash3" ? 3 : 1;
    const used = new Set<number>(b.lashes.map((l) => l.tent));
    for (let i = 0; i < count; i++) {
      let best = -1;
      let bd = 99;
      b.tents.forEach((t, idx) => {
        if (used.has(idx) || t.mode === "sweep") return;
        const d = angDiff(t.base, angTo + (i - (count - 1) / 2) * 0.5);
        if (d < bd) {
          bd = d;
          best = idx;
        }
      });
      if (best < 0) break;
      used.add(best);
      b.lashes.push({
        tent: best,
        x: p.x,
        y: p.y,
        wait: i * 0.5,
        tele: Math.max(0.65, 0.9 - b.phase * 0.06),
        t: 0,
        state: "wait",
        timer: 0,
        hit: false,
      });
    }
    this.addText(b.x, b.y - b.r - 26, kind === "lash3" ? "ХЛЫСТЫ!" : "ХЛЫСТ!", 1, 1.5);
    sfx.mine();
  }

  updateTentacles(dt: number) {
    const b = this.boss;
    if (!b || !isTent(b) || !b.tents.length) return;
    const p = this.nearestLive(b.x, b.y);
    const reach = 120 + b.phase * 28;
    const sw = b.sweep;

    if (sw) {
      sw.t += dt;
      if (!sw.active && sw.t >= sw.tele) {
        sw.active = true;
        sfx.laserFire();
        this.shake = Math.max(this.shake, 10);
        this.flash = Math.max(this.flash, 0.03);
      }
      if (sw.active) {
        sw.angle += sw.dir * sw.speed * dt;
        if (sw.t >= sw.tele + sw.dur) {
          for (const t of b.tents) {
            if (t.mode === "sweep") {
              t.mode = "recover";
              t.arm = -1;
            }
          }
          b.sweep = null;
        }
      }
    }

    for (const l of b.lashes) {
      const t = b.tents[l.tent];
      if (l.state === "wait") {
        l.wait -= dt;
        if (l.wait <= 0) {
          l.state = "tele";
          l.t = l.tele;
          t.mode = "windup";
        }
      } else if (l.state === "tele") {
        l.t -= dt;
        // follows the player with lag, then LOCKS for the last 0.32s
        if (l.t > 0.32) {
          l.x += (p.x - l.x) * Math.min(1, dt * 6);
          l.y += (p.y - l.y) * Math.min(1, dt * 6);
        }
        l.x = Math.max(55, Math.min(this.limitX - 55, l.x));
        l.y = Math.max(55, Math.min(H - 55, l.y));
        if (l.t <= 0) {
          l.state = "strike";
          l.timer = 0.16;
          t.mode = "strike";
          sfx.dash();
        }
      } else if (l.state === "strike") {
        l.timer -= dt;
        if (!l.hit && l.timer <= 0.07) {
          l.hit = true;
          this.tentacleImpact(l.x, l.y, t);
        }
        if (l.timer <= 0) {
          l.state = "done";
          t.mode = "recover";
        }
      }
    }
    b.lashes = b.lashes.filter((l) => l.state !== "done");

    const dying = b.state === "dying";
    const trans = b.state === "transition";
    b.tents.forEach((t, i) => {
      const o = this.tentBase(b, t);
      let gx: number;
      let gy: number;
      let k = 5;
      let tb = 0;
      const lash = b.lashes.find((l) => l.tent === i);
      if (dying) {
        const a = t.base + Math.sin(b.t * 9 + t.phase) * 1.1;
        const L = b.r * 0.9 + 30 + Math.sin(b.t * 13 + t.phase) * 26;
        gx = b.x + Math.cos(a) * L;
        gy = b.y + Math.sin(a) * L;
        k = 7;
        if (Math.random() < dt * 8) this.drop(t.tipX, t.tipY, 160);
      } else if (trans) {
        const L = b.r + 36;
        gx = b.x + Math.cos(t.base + Math.sin(b.t * 14 + t.phase) * 0.5) * L;
        gy = b.y + Math.sin(t.base + Math.sin(b.t * 14 + t.phase) * 0.5) * L;
        k = 8;
        tb = 24;
      } else if (t.mode === "sweep" && sw) {
        const ang = sw.angle + (t.arm * TAU) / sw.arms;
        const rise = Math.min(1, sw.t / sw.tele);
        const e = 1 - Math.pow(1 - rise, 3);
        const L = sw.len * (0.42 + 0.58 * e);
        gx = b.x + Math.cos(ang) * L;
        gy = b.y + Math.sin(ang) * L;
        k = 14;
        tb = sw.active ? -sw.dir * 0.3 * L : 0;
      } else if (t.mode === "windup" && lash) {
        // coil back and up before the strike
        const ax = lash.x - b.x;
        const ay = lash.y - b.y;
        const dl = Math.hypot(ax, ay) || 1;
        gx = b.x + ax * 0.22 - (ay / dl) * 46;
        gy = b.y + ay * 0.22 + (ax / dl) * 46;
        k = 6;
        tb = 70 * (1 - lash.t / lash.tele);
      } else if (t.mode === "strike" && lash) {
        gx = lash.x;
        gy = lash.y;
        k = 34;
      } else {
        if (t.mode === "windup" || t.mode === "strike") t.mode = "recover";
        const a = t.base + Math.sin(b.t * 0.9 + t.phase) * 0.38;
        const L = b.r + reach * (0.72 + 0.28 * Math.sin(b.t * 1.3 + t.phase));
        gx = b.x + Math.cos(a) * L;
        gy = b.y + Math.sin(a) * L;
        k = t.mode === "recover" ? 7 : 5;
        if (t.mode === "recover" && Math.hypot(gx - t.tipX, gy - t.tipY) < 22) t.mode = "idle";
      }
      void o;
      const mv = Math.hypot(gx - t.tipX, gy - t.tipY);
      if (mv > 70 && Math.random() < dt * 14) this.drop(t.tipX, t.tipY, 110);
      t.tipX += (gx - t.tipX) * Math.min(1, k * dt);
      t.tipY += (gy - t.tipY) * Math.min(1, k * dt);
      t.bend += (tb - t.bend) * Math.min(1, dt * 8);
      t.glow = Math.max(0, t.glow - dt * 2.4);
    });

    // sweeping arms hurt along their whole visible length
    if (sw && sw.active && b.state === "fight" && p.invuln <= 0 && p.dashTime <= 0) {
      let hit = false;
      for (const t of b.tents) {
        if (t.mode !== "sweep") continue;
        const pts = this.tentPoints(b, t, 14);
        for (const pl of this.livePlayers()) {
          for (let j = 2; j < pts.length; j++) {
            const u = pts[j].u;
            const thr = 10 + (1 - u) * 14;
            if (this.distToSegment(pl.x, pl.y, pts[j - 1].x, pts[j - 1].y, pts[j].x, pts[j].y) < thr) {
              this.hurtPlayer(sw.angle + (sw.dir * Math.PI) / 2, 1, 34, pl);
              hit = true;
              break;
            }
          }
        }
        if (hit) break;
      }
    }

    // ambient: ink mist and orbiting motes feel alive
    if (b.state !== "intro" && Math.random() < dt * (6 + b.phase * 4)) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: b.x + Math.cos(a) * b.r * 1.1,
        y: b.y + Math.sin(a) * b.r * 1.1,
        vx: Math.cos(a) * 30,
        vy: Math.sin(a) * 30 - 24,
        life: 0.7,
        max: 0.7,
        size: 5 + Math.random() * 6,
        kind: "smoke",
        rot: 0,
      });
    }
  }

  tentacleImpact(x: number, y: number, t: Tent) {
    const b = this.boss!;
    t.glow = 1;
    if (b.phase >= 1) spawnPuddle(this, x, y);
    this.hurtAt(x, y, 52, 1, 28);
    this.petals.push({ x, y, life: 1, max: 1, seed: Math.random() * 1e6, n: 9 });
    this.shock(x, y, 10, 560, 0.55);
    this.shock(x, y, 6, 340, 0.8);
    this.shock(x, y, 4, 180, 1.05);
    this.stains.push({ x, y, size: 28, seed: Math.random() * 1e6 });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * TAU;
      this.stains.push({ x: x + Math.cos(a) * (28 + Math.random() * 38), y: y + Math.sin(a) * (28 + Math.random() * 38), size: 4 + Math.random() * 9, seed: Math.random() * 1e6, born: this.time });
    }
    for (let i = 0; i < 24; i++) this.drop(x, y, 170 + Math.random() * 400);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU;
      const sp = 160 + Math.random() * 380;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 140,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        size: 2 + Math.random() * 3,
        kind: "ember",
        rot: 0,
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: x + Math.cos(a) * 14,
        y: y + Math.sin(a) * 14,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70 - 30,
        life: 0.6 + Math.random() * 0.4,
        max: 1,
        size: 8 + Math.random() * 9,
        kind: "smoke",
        rot: 0,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.cracks.push({ x, y, ang: Math.random() * TAU, len: 70 + Math.random() * 130, life: 0.4, max: 0.4, seed: Math.floor(Math.random() * 1e6) });
    }
    if (b.phase >= 1) {
      const n = 6;
      const off = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        this.ebullets.push({ x, y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 3, dmg: 1, r: 6 });
      }
    }
    this.shake = Math.max(this.shake, 17);
    this.zoom = Math.max(this.zoom, 0.025);
    this.freeze = Math.max(this.freeze, 0.03);
    sfx.slam();
  }

  beginBossAttack(kind: AttackKind) {
    const b = this.boss!;
    const p = this.nearestLive(b.x, b.y);
    if (isSpecial(kind)) {
      beginSpecial(this, kind);
      return;
    }
    if (kind === "diagonal") {
      let sx = p.x >= b.x ? 1 : -1;
      let sy = p.y >= b.y ? 1 : -1;
      const reach = (signX: number, signY: number) => Math.min(
        signX > 0 ? W - 48 - b.x : b.x - 48,
        signY > 0 ? H - 48 - b.y : b.y - 48,
      );
      if (reach(sx, sy) < 210) { sx *= -1; sy *= -1; }
      const distance = Math.max(100, reach(sx, sy));
      b.targetX = b.x + sx * distance;
      b.targetY = b.y + sy * distance;
      b.lockAngle = Math.atan2(sy, sx);
      b.attack = kind;
      b.telegraph = 1.05;
      b.telegraphTotal = 1.05;
      sfx.laserCharge();
      return;
    }
    if (kind === "slash") {
      b.lockAngle = b.attackIndex % 2 ? Math.PI / 4 : -Math.PI / 4;
      b.targetX = p.x;
      b.targetY = p.y;
      b.attack = kind;
      b.telegraph = 1.05;
      b.telegraphTotal = 1.05;
      sfx.laserCharge();
      return;
    }
    if (kind === "lash" || kind === "lash3" || kind === "sweep") {
      this.startTentacleAttack(kind);
      return;
    }
    const times: Partial<Record<AttackKind, number>> = {
      ring: 0.6,
      spiral: 0.55,
      aimed: 0.6,
      rain: 0.7,
      summon: 0.6,
      slam: 1,
      laser: 1.2,
      charge: 0.95,
      mines: 0.6,
    };
    b.attack = kind;
    b.telegraph = times[kind] ?? 0.6;
    b.telegraphTotal = b.telegraph;
    b.targetX = p.x;
    b.targetY = p.y;
    b.lockAngle = Math.atan2(p.y - b.y, p.x - b.x);
    if (kind === "laser") sfx.laserCharge();
    if (kind === "mines") sfx.mine();
    if (kind === "charge") sfx.dash();
  }

  executeBossAttack(kind: AttackKind) {
    const b = this.boss!;
    const p = this.nearestLive(b.x, b.y);
    b.attack = null;
    b.telegraph = 0;
    if (isSpecial(kind)) {
      executeSpecial(this, kind);
      return;
    }
    const speed = 165 + b.phase * 20;
    if (b.def.id === "mecha") {
      if (kind === "laser") {
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        // Broad five-lane cone: warning is the boss' glowing cannon arm.
        for (let i = -3; i <= 3; i++) {
          const angle = base + i * (b.phase >= 3 ? 0.105 : 0.16);
          this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350, life: 3.2, dmg: 1, r: 7 });
        }
        this.shake = 15; sfx.laserFire(); return;
      }
      if (kind === "rain") {
        // Twin back racks launch a staggered homing-looking rocket fan.
        for (let i = -2; i <= 2; i++) {
          const angle = Math.atan2(p.y - b.y, p.x - b.x) + i * 0.19;
          this.ebullets.push({ x: b.x - 36, y: b.y - 42, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250, life: 4, dmg: 1, r: 11 });
          this.ebullets.push({ x: b.x + 36, y: b.y - 42, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250, life: 4, dmg: 1, r: 11 });
        }
        sfx.rain(); return;
      }
      if (kind === "ring") {
        // In its ball form the spikes retract and fire as a rotating radial burst.
        const n = b.phase === 0 ? 20 : 16;
        for (let i = 0; i < n; i++) {
          const angle = b.t * 0.8 + i / n * TAU;
          this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(angle) * (b.phase === 0 ? 220 : 285), vy: Math.sin(angle) * (b.phase === 0 ? 220 : 285), life: 3.6, dmg: 1, r: b.phase === 0 ? 8 : 6 });
        }
        sfx.enemyShot(); return;
      }
    }
    switch (kind) {
      case "diagonal":
        b.queenDash = { x1: b.x, y1: b.y, x2: b.targetX, y2: b.targetY, t: 0, duration: 0.58, hit: false };
        sfx.dash();
        break;
      case "slash":
        b.queenSlash = { angle: b.lockAngle, offset: b.targetX * -Math.sin(b.lockAngle) + b.targetY * Math.cos(b.lockAngle), t: 0, duration: 0.34, hit: false };
        this.queenCut = { key: ++this.queenCutKey, angle: b.lockAngle, phase: false };
        this.emit();
        this.shake = Math.max(this.shake, 13);
        sfx.laserFire();
        break;
      case "ring": {
        // ring with two guaranteed gaps — always a path through
        const n = 16 + b.phase * 2;
        const off = Math.random() * TAU;
        const g1 = Math.floor(Math.random() * n);
        const g2 = (g1 + Math.floor(n / 2)) % n;
        for (let i = 0; i < n; i++) {
          if (Math.abs(i - g1) <= 1 || Math.abs(i - g2) <= 1) continue;
          const a = off + (i / n) * TAU;
          this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 5, dmg: 1, r: 7 });
        }
        this.shock(b.x, b.y, b.r, 520, 0.45);
        sfx.enemyShot();
        break;
      }
      case "spiral":
        b.emit = { t: 0, duration: 1.7, acc: 0, angle: Math.random() * TAU };
        break;
      case "aimed": {
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        for (let i = -3; i <= 3; i++) {
          const a = base + i * 0.14;
          this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, life: 4, dmg: 1, r: 6 });
        }
        if (b.phase >= 1) {
          for (const i of [-3, 3]) {
            const a = base + i * 0.24;
            this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 225, vy: Math.sin(a) * 225, life: 4, dmg: 1, r: 8 });
          }
        }
        sfx.enemyShot();
        break;
      }
      case "rain": {
        const n = 6 + b.phase;
        for (let i = 0; i < n; i++) {
          this.addHazard("rain", 90 + Math.random() * (this.limitX - 180), 110 + Math.random() * (H - 200), 32, 1.05 + Math.random() * 0.5);
        }
        sfx.rain();
        break;
      }
      case "summon": {
        const pool = (Object.keys(this.level.pool) as EnemyKind[]).filter((k) => k !== "boss");
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * TAU;
          const kind = pool[Math.floor(Math.random() * pool.length)] || "blob";
          this.spawnEnemy(kind, Math.max(60, Math.min(this.limitX - 60, b.x + Math.cos(a) * (b.r + 40))), Math.max(60, Math.min(H - 60, b.y + Math.sin(a) * (b.r + 40))));
        }
        sfx.summon();
        break;
      }
      case "slam": {
        // the boss LEAPS onto the marked circle — damage only inside it, nothing else
        const tx = Math.max(90, Math.min(this.limitX - 90, b.targetX));
        const ty = Math.max(90, Math.min(H - 90, b.targetY));
        b.leap = { fx: b.x, fy: b.y, tx, ty, t: 0, dur: 0.24 };
        sfx.dash();
        break;
      }
      case "laser":
        // beam fires along the angle that was LOCKED 0.4s ago
        b.laser = { angle: b.lockAngle, charge: 0, active: 0.55 };
        sfx.laserFire();
        this.shake = 10;
        break;
      case "charge": {
        b.charging = 0.5;
        b.chargeAngle = b.lockAngle;
        break;
      }
      case "mines": {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.4;
          const d = 85 + (i % 2) * 55;
          this.addHazard("mine", p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 22, 1.5 + i * 0.1);
        }
        sfx.mine();
        break;
      }
    }
  }

  slamImpact(x: number, y: number) {
    const b = this.boss!;
    const R = 100;
    this.damageRings.push({ x, y, r: b.r * 0.6, vr: 560, life: 0.6, max: 0.6, hit: true, w: 6 });
    this.shock(x, y, b.r, 800, 0.5);
    this.shock(x, y, b.r * 0.6, 460, 0.7);
    this.petals.push({ x, y, life: 0.8, max: 0.8, seed: Math.random() * 1e6, n: 8 });
    for (let i = 0; i < 9; i++) {
      const aa = Math.random() * TAU;
      this.stains.push({ x: x + Math.cos(aa) * 72, y: y + Math.sin(aa) * 72, size: 6 + Math.random() * 12, seed: Math.random() * 1e6 , born: this.time });
    }
    for (let i = 0; i < 26; i++) this.drop(x, y, 160 + Math.random() * 380);
    this.shake = 24;
    this.zoom = Math.max(this.zoom, 0.04);
    sfx.slam();
    this.hurtAt(x, y, R, 1, 32);
  }

  updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    const p = this.nearestLive(b.x, b.y);
    b.t += dt;
    b.bob += dt;
    b.spin += dt * (b.state === "dying" ? 6 : 0.6);
    b.flash = Math.max(0, b.flash - dt);
    b.angle = Math.atan2(p.y - b.y, p.x - b.x);
    this.updateTentacles(dt);

    if (b.state === "intro") {
      b.y += (140 - b.y) * dt * 2;
      b.stateT -= dt;
      if (b.stateT <= 0) {
        b.state = "fight";
        b.attackCd = 0.8;
        this.bossBanner = 0;
      }
    } else if (b.state === "transition") {
      b.stateT -= dt;
      if (b.stateT <= 0) {
        b.state = "fight";
        b.attackCd = 0.85;
        if (b.def.id === "queen") {
          b.x = W / 2;
          b.y = 170;
          b.queenDash = null;
          b.queenSlash = null;
          this.queenFlood = 0;
          this.flash = Math.max(this.flash, 0.06);
          this.shock(b.x, b.y, 28, 780, 0.7);
        }
      }
    } else if (b.state === "finale") {
      // scripted by finale.ts
    } else if (b.state === "dying") {
      b.stateT -= dt;
      b.deathTick -= dt;
      if (b.deathTick <= 0) {
        b.deathTick = 0.11;
        const a = Math.random() * TAU;
        const d = Math.random() * b.r * 1.5;
        const ex = b.x + Math.cos(a) * d;
        const ey = b.y + Math.sin(a) * d;
        const deathBurst = [16, 10, 6][this.quality] ?? 10;
        for (let i = 0; i < deathBurst; i++) this.drop(ex, ey, 130 + Math.random() * 380);
        this.stains.push({ x: ex, y: ey, size: 8 + Math.random() * 16, seed: Math.random() * 1e6 , born: this.time });
        this.shock(ex, ey, 8, 420, 0.4);
        this.shake = Math.max(this.shake, 14);
        if (Math.random() < 0.4) sfx.boom();
      }
      if (b.stateT <= 0) this.finishBossDeath();
      return;
    } else {
      // fight movement
      if (b.queenDash) {
        const dash = b.queenDash;
        const beforeX = b.x;
        const beforeY = b.y;
        dash.t += dt;
        const k = Math.min(1, dash.t / dash.duration);
        b.x = dash.x1 + (dash.x2 - dash.x1) * k;
        b.y = dash.y1 + (dash.y2 - dash.y1) * k;
        this.puff(b.x, b.y, 2);
        for (const pl of this.livePlayers()) {
          if (dash.hit) break;
          if (this.distToSegment(pl.x, pl.y, beforeX, beforeY, b.x, b.y) < b.r * 0.67 + pl.r) {
            dash.hit = true;
            this.hurtPlayer(Math.atan2(dash.y2 - dash.y1, dash.x2 - dash.x1), 1, 26, pl);
          }
        }
        if (k >= 1) {
          this.borderScars.push({ side: b.x < 100 ? 3 : b.x > W - 100 ? 1 : b.y < 100 ? 0 : 2,
            at: b.x < 100 || b.x > W - 100 ? b.y / H : b.x / W, life: 9, seed: Math.random() * 1e6 });
          this.explode(b.x, b.y, 55, 0, 0, true);
          for (let i = 0; i < 7; i++) this.cracks.push({ x: b.x, y: b.y,
            ang: Math.random() * TAU, len: 50 + Math.random() * 125, life: 1.1, max: 1.1, seed: Math.random() * 1e6 });
          this.shake = Math.max(this.shake, 19);
          b.queenDash = null;
          sfx.slam();
        }
      } else if (b.leap) {
        const lp = b.leap;
        lp.t += dt;
        const k = Math.min(1, lp.t / lp.dur);
        const e = k * k * (3 - 2 * k);
        b.x = lp.fx + (lp.tx - lp.fx) * e;
        b.y = lp.fy + (lp.ty - lp.fy) * e;
        b.hop = Math.sin(k * Math.PI) * 46;
        if (k >= 1) {
          b.leap = null;
          b.hop = 0;
          this.slamImpact(b.x, b.y);
        }
      } else if (b.charging > 0) {
        b.charging -= dt;
        b.x += Math.cos(b.chargeAngle) * 540 * dt;
        b.y += Math.sin(b.chargeAngle) * 540 * dt;
        if (Math.random() < 0.7) {
          this.particles.push({
            x: b.x + (Math.random() - 0.5) * b.r,
            y: b.y + (Math.random() - 0.5) * b.r,
            vx: 0,
            vy: 0,
            life: 0.25,
            max: 0.25,
            size: 8,
            kind: "smoke",
            rot: 0,
          });
        }
        if (b.charging <= 0) {
          this.damageRings.push({ x: b.x, y: b.y, r: b.r * 0.8, vr: 520, life: 0.5, max: 0.5, hit: true, w: 4 });
          this.shake = 16;
          sfx.slam();
        }
      } else {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const want = 240;
        const dir = d > want + 50 ? 1 : d < want - 50 ? -1 : 0;
        const strafe = Math.sin(b.t * 0.7 + b.phase) * 0.8;
        const enrage = b.hp / b.maxHp <= 0.22 ? 1.16 : 1;
        const spd = (58 + b.phase * 20) * enrage * (b.def.id === "queen" && b.telegraph > 0 ? 0 : b.telegraph > 0 ? 0.25 : 1) * (b.sweep || b.lashes.length ? 0.3 : 1);
        b.x += ((dx / d) * dir - (dy / d) * strafe) * spd * dt;
        b.y += ((dy / d) * dir + (dx / d) * strafe) * spd * dt;
      }
      b.x = Math.max(70, Math.min(this.limitX - 70, b.x));
      b.y = Math.max(80, Math.min(H - 80, b.y));
      if (b.def.id !== "queen") this.pushOutObstacles(b);

      // attacks
      if (b.telegraph > 0) {
        b.telegraph -= dt;
        // aim follows the player until the last moments, then LOCKS so it can be dodged
        const lockAt = b.attack === "laser" ? 0.4 : b.attack === "charge" ? 0.38 : b.attack === "slam" ? 0.4 : b.attack === "slash" ? 0.4 : -1;
        if (lockAt >= 0 && b.telegraph > lockAt) {
          b.targetX = p.x;
          b.targetY = p.y;
          b.lockAngle = Math.atan2(p.y - b.y, p.x - b.x);
        }
        if (b.telegraph <= 0) this.executeBossAttack(b.attack!);
      } else {
        b.attackCd -= dt;
        const busy = !!b.sweep || b.lashes.length > 0 || !!b.emit || !!b.laser || !!b.leap || !!b.queenDash || !!b.queenSlash || b.charging > 0 || specialBusy(this);
        if (b.attackCd <= 0 && !busy) {
          const list = b.def.phases[b.phase] ?? b.def.phases[b.def.phases.length - 1];
          const kind = list[b.attackIndex % list.length];
          b.attackIndex++;
          this.beginBossAttack(kind);
          b.attackCd = Math.max(0.82, 1.7 - b.phase * 0.18) * (b.def.pace ?? 1) * (b.hp / b.maxHp <= 0.22 ? 0.84 : 1);
        }
      }

      // spiral emitter
      if (b.emit) {
        b.emit.t += dt;
        b.emit.acc += dt;
        while (b.emit.acc > 0.11) {
          b.emit.acc -= 0.11;
          b.emit.angle += 0.34;
          for (const sign of [1, -1]) {
            const a = b.emit.angle * sign;
            this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 5, dmg: 1, r: 6 });
          }
        }
        if (b.emit.t > b.emit.duration) b.emit = null;
      }

      // laser
      if (b.laser) {
        b.laser.charge += dt;
        if (b.laser.charge > 0.18) {
          b.laser.active -= dt;
          const len = 1200;
          const x2 = b.x + Math.cos(b.laser.angle) * len;
          const y2 = b.y + Math.sin(b.laser.angle) * len;
          for (const pl of this.livePlayers()) {
            if (this.distToSegment(pl.x, pl.y, b.x, b.y, x2, y2) < 15) this.hurtPlayer(b.laser.angle, 1, 26, pl);
          }
          if (b.laser.active <= 0) b.laser = null;
        }
      }
      if (b.queenSlash) {
        const cut = b.queenSlash;
        cut.t += dt;
        for (const pl of this.livePlayers()) {
          if (cut.hit) break;
          const nd = pl.x * -Math.sin(cut.angle) + pl.y * Math.cos(cut.angle);
          if (Math.abs(nd - cut.offset) < 23) {
            cut.hit = true;
            this.hurtPlayer(cut.angle + Math.PI / 2, 1, 26, pl);
          }
        }
        if (cut.t >= cut.duration) {
          this.borderScars.push({ side: cut.angle > 0 ? 2 : 0, at: 0.5, life: 9, seed: Math.random() * 1e6 });
          b.queenSlash = null;
        }
      }
    }

    // contact damage
    if (b.state === "fight") this.hurtAt(b.x, b.y, b.r * 0.78 + p.r, 1, 34);

    // hazards + damaging rings
    for (const h of [...this.hazards]) {
      h.t -= dt;
      if (h.t <= 0) this.triggerHazard(h);
    }
    for (const r of this.damageRings) {
      r.life -= dt;
      r.r += r.vr * dt;
      for (const pl of this.livePlayers()) {
        if (r.hit) break;
        if (Math.abs(Math.hypot(pl.x - r.x, pl.y - r.y) - r.r) < 18) {
          r.hit = true;
          this.hurtPlayer(Math.atan2(pl.y - r.y, pl.x - r.x), 1, 26, pl);
        }
      }
    }
    this.damageRings = this.damageRings.filter((r) => r.life > 0);
  }

  // ---------- update ----------
  update(dtRaw: number) {
    if (this.status !== "playing") return;
    const dt = dtRaw * (this.slow > 0 ? 0.38 : this.frenzyOn ? 1.09 : 1);
    this.slow = Math.max(0, this.slow - dtRaw);
    const p = this.player;

    // the torn page edge eases toward its target (the finale drives it by hand during the cut)
    if (!(this.fin && this.fin.cut)) this.limitX += (this.limitTarget - this.limitX) * Math.min(1, dtRaw * 7);
    updateFinale(this, dt);

    // waves
    this.levelTime += dt;
    if (this.waveCooldown > 0) {
      this.waveCooldown -= dt;
      if (this.waveCooldown <= 0) this.startWave();
    } else if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      const cap = (this.frenzyOn ? 44 : 34) + this.difficulty * 3 + (this.isCoop() ? 10 : 0);
      if (this.spawnTimer <= 0 && this.enemies.length < cap) {
        const kind = this.spawnQueue.shift()!;
        this.spawnEnemy(kind);
        this.spawnTimer = Math.max(0.06, 0.34 - this.difficulty * 0.02);
      }
    } else if (this.enemies.length === 0 && !this.boss) {
      if (this.bossPending) {
        this.startBoss();
        return;
      }
      if (this.wave >= this.level.waves) {
        this.completeLevel();
        return;
      }
      this.waveCooldown = 1.15;
      const bonus = this.wave * 40;
      this.score += bonus;
      this.addXp(this.endless ? 30 + this.wave * 6 : 20 + this.wave * 6);
      this.addText(W / 2, H / 2 - 30, `ВОЛНА ${this.wave} ОТБИТА! +${bonus}`, 2, 1.7);
      this.addText(W / 2, H / 2 + 10, `осталось волн: ${this.level.waves - this.wave}`, 1.4, 1);
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.addText(W / 2, H / 2 + 44, "+1 ♥ за волну", 1.4, 1);
      }
      if (!this.bossPending && this.offerPerks()) return;
    }
    this.waveBanner = Math.max(0, this.waveBanner - dtRaw);

    // aggro timer: no hiding forever
    if ((this.spawnQueue.length > 0 || this.enemies.length > 0) && !this.boss) {
      this.waveClock += dt;
      if (!this.rage && this.waveClock > 16) {
        this.rage = true;
        this.addText(W / 2, 170, "КЛЯКСЫ В ЯРОСТИ!", 2.2, 2);
        this.shake = Math.max(this.shake, 12);
        sfx.phase();
      }
    }

    // spawning the level boss once the wave has thinned out
    if (
      this.bossPending &&
      !this.boss &&
      this.spawnQueue.length === 0 &&
      this.enemies.length <= 2 &&
      this.status === "playing"
    ) {
      this.startBoss();
    }
    this.bossBanner = Math.max(0, this.bossBanner - dtRaw);
    updateSpecial(this, dt);
    updateFinaleFight(this, dt);
    this.updateBoss(dt);

    // movement (analog stick wins over WASD when the thumb is on it)
    let mx = 0;
    let my = 0;
    let mag = 1;
    const stickMag = Math.hypot(this.stick.x, this.stick.y);
    if (stickMag > 0.12) {
      mx = this.stick.x;
      my = this.stick.y;
      mag = Math.min(1, stickMag);
    } else {
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    }
    const ml = Math.hypot(mx, my) || 1;
    const px0 = p.x;
    const py0 = p.y;
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += Math.cos(p.dashAngle) * 900 * dt;
      p.y += Math.sin(p.dashAngle) * 900 * dt;
      this.ghosts.push({ x: p.x, y: p.y, angle: p.angle, life: 0.25, weapon: p.weapon });
      // A dash with the perk leaves an ink burst behind it.
      if (this.dashFlare) {
        this.dashFlare = false;
        const rank = this.perks.dash ?? 0;
        if (rank > 0) this.dashBlast(p.x, p.y, rank);
      }
    } else if ((mx || my) && !p.down) {
      const spd = p.speed * (1 + 0.1 * (this.perks.boots ?? 0)) * this.moveMul * mag;
      p.x += (mx / ml) * spd * dt;
      p.y += (my / ml) * spd * dt;
      p.moving += dt;
    } else p.moving = 0;
    p.x = Math.max(26 + p.r, Math.min(this.limitX - 26 - p.r, p.x));
    p.y = Math.max(26 + p.r, Math.min(H - 26 - p.r, p.y));
    this.pushOutObstacles(p);
    {
      const ivx = (p.x - px0) / Math.max(dt, 0.0001);
      const ivy = (p.y - py0) / Math.max(dt, 0.0001);
      const kk = Math.min(1, dt * 9);
      p.svx += (ivx - p.svx) * kk;
      p.svy += (ivy - p.svy) * kk;
      this.stepT -= dt;
      if (this.stepT <= 0 && Math.hypot(ivx, ivy) > 60) {
        this.stepT = 0.17;
        this.prints.push({ x: p.x - Math.cos(p.angle) * 4, y: p.y + 10, a: Math.atan2(ivy, ivx), life: 2.2 });
        if (this.prints.length > 50) this.prints.shift();
      }
    }
    p.angle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dtRaw);
    p.recoil = Math.max(0, p.recoil - dtRaw * 6);
    p.dashCd = Math.max(0, p.dashCd - dt * (1 + 0.25 * (this.perks.dashcd ?? 0)));
    p.muzzle = Math.max(0, p.muzzle - dtRaw);
    this.perkTick(dt);
    this.moveMate(dt);
    this.tickRevive(dt);
    this.muzzle = Math.max(0, this.muzzle - dtRaw);
    this.zoom = Math.max(0, this.zoom - dtRaw * 0.55);
    this.flash = Math.max(0, this.flash - dtRaw);
    this.shake = Math.max(0, this.shake - dtRaw * 34);
    this.comboPop = Math.max(0, this.comboPop - dtRaw * 2.6);
    if (this.comboTimer > 0) {
      this.comboTimer -= dtRaw;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // shooting
    p.fireCd -= dt;
    if (this.mouse.down && p.fireCd <= 0 && !this.fin && !p.down) this.fire();

    this.moveBullets(this.bullets, dt, true);
    this.moveEBullets(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) this.updateEnemy(this.enemies[i], dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // pickups
    for (const pk of this.pickups) {
      pk.life -= dtRaw;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = 130 + 80 * (this.perks.magnet ?? 0);
      if (d < pull) {
        pk.x += (dx / d) * 140 * dt;
        pk.y += (dy / d) * 140 * dt;
      }
      let taker = d < p.r + 15 ? p : undefined;
      if (!taker && this.mate.active && !this.mate.down && Math.hypot(this.mate.x - pk.x, this.mate.y - pk.y) < this.mate.r + 15) {
        taker = this.mate;
      }
      if (taker) {
        pk.life = 0;
        this.collect(pk, taker);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);

    // fx
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === "ember" || pt.kind === "debris") {
        pt.vy += 900 * dt;
        pt.vx *= 0.985;
        pt.rot += dt * (pt.kind === "debris" ? 9 : 3);
        // bounce off the page bottom and walls
        if (pt.y > H - 22) {
          pt.y = H - 22;
          pt.vy *= -0.42;
          pt.vx *= 0.7;
          if (Math.abs(pt.vy) < 40) pt.vy = 0;
        }
        if (pt.x < 20 || pt.x > W - 20) pt.vx *= -0.6;
      } else if (pt.kind === "smoke") {
        pt.vy -= 26 * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
      } else {
        pt.vx *= 0.92;
        pt.vy *= 0.92;
      }
    }
    const pcap = [520, 300, 150][this.quality] ?? 300;
    if (this.particles.length > pcap) this.particles.splice(0, this.particles.length - pcap);
    this.stainFadeT -= dtRaw;
    if (this.stainFadeT <= 0 && this.stainCtx) {
      // ink slowly dries and fades from the baked layer so the page never turns black
      this.stainFadeT = 3.2;
      this.stainCtx.globalCompositeOperation = "destination-out";
      this.stainCtx.fillStyle = "rgba(0,0,0,0.07)";
      this.stainCtx.fillRect(0, 0, W, H);
      this.stainCtx.globalCompositeOperation = "source-over";
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    if (this.stains.length > 120) this.stains.splice(0, this.stains.length - 120);
    for (const s of this.shocks) {
      s.life -= dt;
      s.r += s.vr * dt;
    }
    this.shocks = this.shocks.filter((s) => s.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const g of this.ghosts) g.life -= dtRaw;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    for (const h of this.hitmarks) h.life -= dtRaw;
    this.hitmarks = this.hitmarks.filter((h) => h.life > 0);
    for (const t of this.texts) {
      t.life -= dtRaw;
      t.y -= 22 * dtRaw;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const sp of this.edgeSplats) sp.life -= dtRaw;
    this.edgeSplats = this.edgeSplats.filter((sp) => sp.life > 0);
    for (const wn of this.warnings) wn.t -= dtRaw;
    this.warnings = this.warnings.filter((wn) => wn.t > 0);
    for (const c of this.cracks) c.life -= dtRaw;
    this.cracks = this.cracks.filter((c) => c.life > 0);
    for (const scar of this.borderScars) scar.life -= dtRaw;
    this.borderScars = this.borderScars.filter((scar) => scar.life > 0);
    this.metaSaveT -= dtRaw;
    if (this.metaSaveT <= 0) {
      this.metaSaveT = 2;
      if (this.metaDirty) {
        saveMeta(this.meta);
        this.metaDirty = false;
      }
    }
    for (const pe of this.petals) pe.life -= dtRaw;
    this.petals = this.petals.filter((pe) => pe.life > 0);
    for (const bu of this.bursts) bu.life -= dtRaw;
    this.bursts = this.bursts.filter((bu) => bu.life > 0);
    for (const pr of this.prints) pr.life -= dtRaw;
    this.prints = this.prints.filter((pr) => pr.life > 0);
    this.speedLines = Math.max(0, this.speedLines - dtRaw * 0.9);

    // ---- frenzy: hot streaks make the whole page bolder and faster ----
    if (this.combo >= 12) this.frenzy = Math.min(1, this.frenzy + dtRaw * 1.6);
    else this.frenzy = Math.max(0, this.frenzy - dtRaw * 0.8);
    const wantFrenzy = this.frenzy >= 1;
    if (wantFrenzy && !this.frenzyOn) {
      this.frenzyOn = true;
      this.addText(W / 2, H / 2 - 90, "ЯРОСТЬ ЧЕРНИЛ!", 1.8, 2.6);
      this.addText(W / 2, H / 2 - 50, "всё быстрее, всё жирнее", 1.4, 1.1);
      this.flash = Math.max(this.flash, 0.1);
      this.shake = Math.max(this.shake, 16);
      this.speedLines = 1;
      sfx.phase();
    } else if (!wantFrenzy && this.frenzyOn && this.frenzy <= 0) {
      this.frenzyOn = false;
    }

    // ---- ink rain: the page weeps on the harder sheets ----
    if (this.level.diff >= 3 && !this.boss) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.rainTimer = Math.max(0.5, 2.4 - this.level.diff * 0.14);
        const n = 1 + Math.floor(Math.random() * (this.frenzyOn ? 3 : 2));
        for (let i = 0; i < n; i++) {
          const x = 60 + Math.random() * (this.limitX - 120);
          this.inkDrops.push({ x, y: -20, vy: 210 + Math.random() * 140, r: 7 + Math.random() * 6, seed: Math.random() * 1e6 });
          this.warnings.push({ x, y: H - 40, t: 0.9, max: 0.9, seed: Math.random() * 1e6 });
        }
      }
    }
    for (const d of this.inkDrops) {
      d.y += d.vy * dt;
      d.vy += 260 * dt;
      if (Math.random() < 0.5) {
        this.particles.push({ x: d.x, y: d.y - 8, vx: (Math.random() - 0.5) * 20, vy: -30, life: 0.25, max: 0.25, size: 3, kind: "smoke", rot: 0 });
      }
      if (d.y > H - 26) {
        d.y = H + 999;
        this.explode(d.x, H - 26, 52, 3, 1);
      }
    }
    this.inkDrops = this.inkDrops.filter((d) => d.y < H);

    // ---- swarm events: the page throws extra ink at you ----
    if (!this.bossPending && !this.boss && this.spawnQueue.length === 0 && this.enemies.length > 0) {
      this.swarmTimer -= dt;
      if (this.swarmTimer <= 0) {
        this.swarmTimer = 13 + Math.random() * 6;
        const pool = (Object.keys(this.level.pool) as EnemyKind[]).filter((k) => k !== "boss");
        const n = 4 + Math.floor(Math.random() * 4) + (this.frenzyOn ? 3 : 0);
        const side = Math.floor(Math.random() * 4);
        this.addText(W / 2, H / 2 - 120, "РОЙ!", 1.4, 2.2);
        this.shake = Math.max(this.shake, 10);
        sfx.summon();
        for (let i = 0; i < n; i++) {
          const kind = pool[Math.floor(Math.random() * pool.length)] || "blob";
          const t = i / Math.max(1, n - 1);
          let x = 0;
          let y = 0;
          if (side === 0) {
            x = 60 + t * (this.limitX - 120);
            y = -30;
          } else if (side === 1) {
            x = this.limitX + 30;
            y = 60 + t * (H - 120);
          } else if (side === 2) {
            x = 60 + t * (this.limitX - 120);
            y = H + 30;
          } else {
            x = -30;
            y = 60 + t * (H - 120);
          }
          this.spawnEnemy(kind, x, y);
        }
      }
    }

    // ult ready subtle pull
    if (this.ult >= 100 && Math.random() < 0.3) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: p.x + Math.cos(a) * 26,
        y: p.y + Math.sin(a) * 26,
        vx: -Math.cos(a) * 40,
        vy: -Math.sin(a) * 40,
        life: 0.5,
        max: 0.5,
        size: 2,
        kind: "drop",
        rot: 0,
      });
    }
  }

  fire(p = this.player) {
    const def = WEAPONS[p.weapon];
    const dmgMul = 1 + 0.22 * (this.perks.bigshot ?? 0);
    if (!this.isInfinite(p.weapon) && this.ammo[p.weapon] <= 0) {
      p.weapon = this.level.weapon;
      this.addText(p.x, p.y - 30, "ПАТРОНЫ!", 0.9, 1);
      return;
    }
    if (p.down) return;
    p.fireCd = def.cd * Math.pow(0.82, this.perks.trigger ?? 0);
    this.usedWeapons.add(p.weapon);
    if (this.usedWeapons.size >= 5) this.unlockSticker("collector");
    p.recoil = 1;
    this.muzzle = 0.07;
    p.muzzle = 0.07;
    sfx.shot(p.weapon);
    {
      const mx = p.x + Math.cos(p.angle) * (p.r + 24);
      const my = p.y + Math.sin(p.angle) * (p.r + 24);
      const heavy = p.weapon === "shotgun" || p.weapon === "rocket" || p.weapon === "rail";
      for (let i = 0; i < (heavy ? 7 : 2); i++) {
        const a = p.angle + (Math.random() - 0.5) * (heavy ? 1.1 : 0.7);
        const sp = 220 + Math.random() * 360;
        this.particles.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.25 + Math.random() * 0.25, max: 0.5, size: 1.6 + Math.random() * 2, kind: "ember", rot: 0 });
      }
    }
    this.shake = Math.max(this.shake, p.weapon === "shotgun" || p.weapon === "rocket" ? 8 : 2.5);
    const tipX = Math.max(22, Math.min(this.limitX - 22, p.x + Math.cos(p.angle) * (p.r + 7)));
    const tipY = Math.max(22, Math.min(H - 22, p.y + Math.sin(p.angle) * (p.r + 7)));

    if (p.weapon === "rail") {
      this.railShot(tipX, tipY, p);
    } else if (p.weapon === "rocket") {
      this.bullets.push({
        x: tipX,
        y: tipY,
        vx: Math.cos(p.angle) * def.speed,
        vy: Math.sin(p.angle) * def.speed,
        life: 2,
        dmg: def.dmg * dmgMul,
        rocket: true,
      });
      for (let i = 0; i < 8; i++) this.puff(tipX, tipY, 3, this.shake);
    } else {
      const pellets = def.pellets + (this.perks.multishot ?? 0);
      for (let i = 0; i < pellets; i++) {
        const a =
          p.angle +
          (Math.random() - 0.5) * def.spread * 2 +
          (pellets > 1 ? (i - (pellets - 1) / 2) * (def.spread / pellets) : 0);
        this.bullets.push({
          x: tipX,
          y: tipY,
          vx: Math.cos(a) * def.speed,
          vy: Math.sin(a) * def.speed,
          life: 1.1,
          dmg: def.dmg * dmgMul,
          pierce: this.perks.pierce ?? 0,
          bounce: this.perks.ricochet ?? 0,
          home: this.perks.homing ?? 0,
        });
      }
      // shells
      for (let i = 0; i < 2; i++) {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(p.angle + 2) * 90,
          vy: Math.sin(p.angle + 2) * 90,
          life: 0.5,
          max: 0.5,
          size: 3,
          kind: "shard",
          rot: Math.random() * TAU,
        });
      }
    }
    if (!this.isInfinite(p.weapon)) this.ammo[p.weapon] = Math.max(0, this.ammo[p.weapon] - 1);
  }

  railShot(x: number, y: number, p = this.player) {
    const a = p.angle;
    let len = 1500;
    for (let t = 20; t < len; t += 14) {
      const px = x + Math.cos(a) * t;
      const py = y + Math.sin(a) * t;
      if (px < 24 || px > this.limitX - 24 || py < 24 || py > H - 24) {
        len = t;
        break;
      }
      if (this.obstacles.some((o) => Math.hypot(px - o.x, py - o.y) < o.r)) {
        len = t;
        break;
      }
    }
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    this.beams.push({ x1: x, y1: y, x2, y2, life: 0.22, max: 0.22 });
    this.shake = 16;
    this.freeze = 0.05;
    this.zoom = 0.04;
    const list = [...this.enemies];
    for (const e of list) {
      const dist = this.distToSegment(e.x, e.y, x, y, x2, y2);
      if (dist < e.r + 9) {
        this.hitEnemy(e, WEAPONS.rail.dmg, e.x, e.y, true);
        this.puffsAt(e.x, e.y, 12);
        this.meta.railKills++;
        if (this.meta.railKills >= 25) this.unlockSticker("rail_ace");
      }
    }
    const boss = this.boss;
    if (boss && this.distToSegment(boss.x, boss.y, x, y, x2, y2) < boss.r + 9) {
      this.damageBoss(WEAPONS.rail.dmg * 1.2, boss.x, boss.y);
      this.puffsAt(boss.x, boss.y, 16);
    }
    for (let i = 0; i < 5; i++) {
      const t = Math.random();
      this.stains.push({ x: x + Math.cos(a) * len * t, y: y + Math.sin(a) * len * t, size: 4 + Math.random() * 6, seed: Math.random() * 1e6 , born: this.time });
    }
    this.addText(x2 - 30, y2 - 10, "ВЖЖЖ!", 0.5, 1);
  }

  distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  moveBullets(list: Bullet[], dt: number, friendly: boolean) {
    for (const b of list) {
      if (friendly && (b.home ?? 0) > 0 && !b.rocket) {
        // living ink: gently curves toward the nearest enemy
        let best: { x: number; y: number } | null = null;
        let bd = 300;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (!best && this.boss && this.bossHittable()) best = this.boss;
        if (best) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const ang = Math.atan2(b.vy, b.vx);
          let da = Math.atan2(best.y - b.y, best.x - b.x) - ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          const rate = 2.1 * (b.home ?? 1) * dt;
          const na = ang + Math.max(-rate, Math.min(rate, da));
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.rocket && Math.random() < 0.7) {
        this.particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.3,
          max: 0.3,
          size: 3 + Math.random() * 3,
          kind: "smoke",
          rot: 0,
        });
      }
      if (b.x < 14 || b.x > this.limitX - 14 || b.y < 14 || b.y > H - 14) {
        if (friendly && (b.bounce ?? 0) > 0 && !b.rocket) {
          b.bounce = (b.bounce ?? 0) - 1;
          if (b.x < 14 || b.x > this.limitX - 14) b.vx *= -1;
          if (b.y < 14 || b.y > H - 14) b.vy *= -1;
          b.x = Math.max(15, Math.min(this.limitX - 15, b.x));
          b.y = Math.max(15, Math.min(H - 15, b.y));
          this.puffsAt(b.x, b.y, 3);
        } else {
          b.life = 0;
          if (b.rocket) this.explode(b.x, b.y, 96, 8, 0, false, true);
          else this.puffsAt(b.x, b.y, 3);
        }
      }
      for (const o of this.obstacles) {
        if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + 2) {
          b.life = 0;
          if (b.rocket) this.explode(b.x, b.y, 96, 8, 0, false, true);
          else this.puffsAt(b.x, b.y, friendly ? 4 : 2);
        }
      }
      if (!friendly) continue;
      const list2 = [...this.enemies];
      for (const e of list2) {
        if (e.hp <= 0) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 7) {
          if (b.rocket) {
            b.life = 0;
            this.explode(b.x, b.y, 95, 9);
            break;
          }
          const before = e.hp;
          this.hitEnemy(e, b.dmg, b.x, b.y);
          this.puff(b.x, b.y, 5, 280);
          if (e.hp >= before) {
            // blocked by a shield: the bullet stops, no pierce
            b.life = 0;
            break;
          }
          e.x += (b.vx / 900) * 7;
          e.y += (b.vy / 900) * 7;
          if ((b.pierce ?? 0) > 0) {
            b.pierce = (b.pierce ?? 0) - 1;
            continue;
          }
          b.life = 0;
          break;
        }
      }
      const boss = this.boss;
      if (b.life > 0 && boss && this.bossHittable()) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r * 0.9 + 7) {
          b.life = 0;
          if (b.rocket) this.explode(b.x, b.y, 98, 9, 0, false, true);
          else {
            this.damageBoss(b.dmg, b.x, b.y);
            this.puff(b.x, b.y, 5, 280);
          }
        }
      }
    }
    const kept = list.filter((b) => b.life > 0);
    list.length = 0;
    list.push(...kept);
  }

  moveEBullets(dt: number) {
    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x < 16 || b.x > this.limitX - 16 || b.y < 16 || b.y > H - 16) b.life = 0;
      for (const o of this.obstacles) {
        if (Math.hypot(b.x - o.x, b.y - o.y) < o.r) {
          b.life = 0;
          this.puffsAt(b.x, b.y, 3);
        }
      }
      const victim = b.life > 0 ? this.livePlayers().find((pl) => Math.hypot(b.x - pl.x, b.y - pl.y) < pl.r + b.r) : undefined;
      if (victim) {
        b.life = 0;
        if (victim.invuln <= 0 && victim.dashTime <= 0) this.hurtPlayer(Math.atan2(b.vy, b.vx), b.dmg, 22, victim);
        else {
          this.addText(victim.x, victim.y - 30, "ПРОМАХ!", 0.6, 0.9);
          this.puffsAt(b.x, b.y, 4);
        }
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
  }

  updateEnemy(e: Enemy, dt: number) {
    const p = this.nearestLive(e.x, e.y);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    e.angle = Math.atan2(dy, dx);
    e.flash = Math.max(0, e.flash - dt);
    e.age += dt;
    const visible = e.x >= 38 && e.x <= this.limitX - 38 && e.y >= 38 && e.y <= H - 38;
    let vx = 0;
    let vy = 0;
    let spd = e.speed * (1 - 0.08 * (this.perks.slowfield ?? 0));
    e.fireCd -= dt;

    switch (e.kind) {
      case "blob":
        vx = ux + Math.cos(this.time * 5 + e.phase) * 0.5;
        vy = uy + Math.sin(this.time * 5 + e.phase) * 0.5;
        break;
      case "fly":
        vx = ux * 1.15 + Math.cos(this.time * 10 + e.phase) * 0.9;
        vy = uy * 1.15 + Math.sin(this.time * 10 + e.phase) * 0.9;
        spd *= 1.25;
        break;
      case "spiky":
      case "splitter":
        vx = ux;
        vy = uy;
        break;
      case "brute":
        vx = ux;
        vy = uy;
        spd *= 0.85;
        break;
      case "shield":
        vx = ux * 0.9;
        vy = uy * 0.9;
        break;
      case "ghost":
        vx = ux * 1.1 + Math.cos(this.time * 4 + e.phase) * 0.35;
        vy = uy * 1.1 + Math.sin(this.time * 4 + e.phase) * 0.35;
        break;
      case "bomber":
        vx = ux * 1.3;
        vy = uy * 1.3;
        spd *= 1.1;
        if (visible && dist < e.r + p.r + 4) {
          this.killEnemy(e);
          this.enemies = this.enemies.filter((x) => x !== e);
          return;
        }
        break;
      case "zipper":
        if (e.dashT > 0) {
          e.dashT -= dt;
          vx = Math.cos(e.dashAngle);
          vy = Math.sin(e.dashAngle);
          spd = e.speed * 5.5;
          e.angle = e.dashAngle;
          if (Math.random() < 0.5) this.ghostDrop(e.x, e.y);
        } else if (e.chargeT > 0) {
          e.chargeT -= dt;
          vx = ux * 0.2;
          vy = uy * 0.2;
          if (e.chargeT <= 0) {
            e.dashT = 0.22;
            e.dashAngle = e.angle;
          }
        } else {
          e.chargeT = 1.4;
          vx = ux * 0.5;
          vy = uy * 0.5;
        }
        break;
      case "shooter": {
        const want = 265;
        const dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
        const strafe = Math.sin(this.time * 0.9 + e.phase) * 0.9;
        vx = ux * dir - uy * strafe;
        vy = uy * dir + ux * strafe;
        if (e.fireCd <= 0 && visible) {
          e.fireCd = Math.max(0.9, 2 - this.difficulty * 0.06);
          for (let i = -1; i <= 1; i++) {
            const a = e.angle + i * 0.18;
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 275, vy: Math.sin(a) * 275, life: 4, dmg: 1, r: 6 });
          }
          this.puffsAt(e.x, e.y, 4);
          sfx.enemyShot();
        }
        break;
      }
      case "sniper": {
        const want = 350;
        const dir = dist > want + 50 ? 1 : dist < want - 50 ? -1 : 0;
        vx = ux * dir - uy * Math.sin(this.time * 0.6 + e.phase) * 0.7;
        vy = uy * dir + ux * Math.sin(this.time * 0.6 + e.phase) * 0.7;
        if (e.fireCd <= 0 && visible) {
          e.fireCd = 2.5;
          this.ebullets.push({ x: e.x, y: e.y, vx: ux * 700, vy: uy * 700, life: 2.5, dmg: 1, r: 4, needle: true });
          this.shake = Math.max(this.shake, 2);
          sfx.enemyShot();
          this.puffsAt(e.x, e.y, 5);
        }
        break;
      }
      case "boss": {
        vx = ux * 0.85;
        vy = uy * 0.85;
        spd *= 0.8;
        if (e.fireCd <= 0 && visible) {
          e.fireCd = 2.3;
          e.burst++;
          const n = 14;
          const off = Math.random() * TAU;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * TAU;
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 5, dmg: 1, r: 7 });
          }
          this.shock(e.x, e.y, e.r, 340, 0.5);
          this.shake = Math.max(this.shake, 10);
          this.addText(e.x, e.y - e.r - 16, "БУМ!", 0.8, 1.6);
          if (e.burst % 2 === 0) {
            for (let i = 0; i < 3; i++) {
              this.spawnEnemy("fly", e.x + (Math.random() - 0.5) * 90, e.y + (Math.random() - 0.5) * 90);
            }
          }
        }
        break;
      }
    }

    if (this.rage) {
      spd *= 1.65;
      if ((e.kind === "shooter" || e.kind === "sniper") && dist > 90) {
        vx = ux;
        vy = uy;
      }
      if (e.kind === "sniper") e.fireCd -= dt * 0.8;
    }

    // obstacle avoidance: steer around rocks instead of grinding into them
    for (const ob of this.obstacles) {
      const ox = ob.x - e.x;
      const oy = ob.y - e.y;
      const od = Math.hypot(ox, oy) || 1;
      const clearance = ob.r + e.r + 26;
      if (od < clearance) {
        const towardRock = (ux * ox + uy * oy) / od;
        if (towardRock > 0.1) {
          const tx = -oy / od;
          const ty = ox / od;
          const sign = tx * ux + ty * uy >= 0 ? 1 : -1;
          const push = (1 - od / clearance) * 2.2;
          vx += tx * sign * push;
          vy += ty * sign * push;
        }
      }
    }

    // separation
    for (const o of this.enemies) {
      if (o === e) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = e.r + o.r + 3;
      if (od < min && od > 0) {
        vx += (ox / od) * ((min - od) / min) * 2;
        vy += (oy / od) * ((min - od) / min) * 2;
      }
    }
    if (vx === 0 && vy === 0) {
      vx = ux;
      vy = uy;
    }
    // Outside the camera they cannot attack and have much less health.
    // Slightly faster entry avoids a wave waiting on a hidden straggler.
    const step = spd * dt * (visible ? 1 : 1.15);
    e.x += vx * step;
    e.y += vy * step;
    if (e.kind !== "ghost") this.pushOutObstacles(e);

    if (visible && dist < e.r + p.r && p.invuln <= 0 && p.dashTime <= 0) {
      if (e.kind === "bomber") {
        this.hurtPlayer(e.angle, 1, 10);
        this.killEnemy(e);
        this.enemies = this.enemies.filter((x) => x !== e);
        return;
      }
      this.hurtPlayer(e.angle, e.kind === "brute" ? 2 : 1, e.kind === "brute" ? 30 : 18);
      const kick = e.kind === "brute" ? 14 : 34;
      e.x -= ux * kick;
      e.y -= uy * kick;
    }
  }

  hitEnemy(e: Enemy, dmg: number, x: number, y: number, bypass = false) {
    if (e.dead || e.hp <= 0) return;
    if (e.kind === "ghost" && !bypass && Math.sin(e.age * 2.6 + e.phase) > 0.1) {
      this.addText(e.x, e.y - 26, "ФИГУШКИ!", 0.6, 0.95);
      this.puffsAt(x, y, 3);
      return;
    }
    if (e.kind === "shield" && !bypass) {
      const ang = Math.atan2(y - e.y, x - e.x);
      let diff = Math.abs(ang - e.angle) % TAU;
      if (diff > Math.PI) diff = TAU - diff;
      if (diff < 1.2) {
        this.addText(e.x, e.y - e.r - 8, "ДЗИНЬ!", 0.5, 0.9);
        this.puffsAt(x, y, 4);
        sfx.hit();
        return;
      }
    }
    let real = dmg;
    const critStacks = this.perks.crit ?? 0;
    if (critStacks > 0 && Math.random() < 0.14 * critStacks) {
      real *= 2.5;
      this.addText(x, y - 14, "КРИТ!", 0.55, 1.1);
      sfx.crit();
    }
    e.hp -= real;
    e.flash = 0.09;
    if (this.quality < 2 && this.bursts.length < 40) this.bursts.push({ x, y, r: real >= 2 ? 10 : 6, life: 0.18, max: 0.18, seed: Math.floor(Math.random() * 1e6) });
    sfx.hit();
    this.hitmarks.push({ x, y, life: 0.14 });
    this.puffsAt(x, y, 3);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy, quiet = false) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    this.kills++;
    this.meta.totalKills++;
    this.addXp(Math.max(1, Math.round(e.score * 0.25)));
    if (!quiet && this.perks.explosive && !this.chainBlast && Math.random() < 0.1 * this.perks.explosive) {
      this.chainBlast = true;
      this.explode(e.x, e.y, 58, 1.7, 0, false, false);
      this.chainBlast = false;
    }
    if (this.meta.totalKills === 1) this.unlockSticker("first_blood");
    if (this.meta.totalKills >= 500) this.unlockSticker("veteran");
    if (this.perks.vampire && Math.random() < 0.12 * this.perks.vampire && this.player.hp < this.player.maxHp) {
      this.player.hp += 1;
      this.addText(this.player.x, this.player.y - 30, "+1 ♥", 0.8, 1);
      this.shock(this.player.x, this.player.y, 8, 240, 0.4);
    }
    this.combo++;
    if (this.combo >= 20) this.unlockSticker("combo20");
    this.comboTimer = 3.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboPop = 1;
    const mult = 1 + Math.min(2.5, Math.floor(this.combo / 5) * 0.5) + (this.frenzyOn ? 1 : 0);
    const gained = Math.round(e.score * mult * (1 + this.levelIndex * 0.25));
    this.score += gained;
    this.ult = Math.min(100, this.ult + (e.kind === "boss" ? 45 : 4.5) * (1 + 0.4 * (this.perks.inkwell ?? 0)));
    const streak = STREAKS.find(([n]) => n === this.combo);
    if (streak) {
      this.addText(W / 2, H / 2 - 80, streak[1], 1.6, 2.6);
      this.flash = Math.max(this.flash, 0.06);
      this.shake = Math.max(this.shake, 14);
      sfx.streak();
    this.confetti(this.player.x, this.player.y - 10, 26);
    }
    const big = e.kind === "brute" || e.kind === "boss";
    this.bursts.push({ x: e.x, y: e.y, r: e.r, life: big ? 0.45 : 0.3, max: big ? 0.45 : 0.3, seed: Math.floor(Math.random() * 1e6) });
    if (gained >= 25) this.addText(e.x + 16, e.y + e.r * 0.5, `+${gained}`, 0.75, 0.62);
    this.stains.push({ x: e.x, y: e.y, size: e.r * (big ? 1.2 : 0.85), seed: Math.random() * 1e6 , born: this.time });
    if (this.stains.length > 110) this.stains.shift();
    const n = e.kind === "boss" ? 90 : big ? 32 : e.kind === "fly" ? 5 : 13;
    for (let i = 0; i < n; i++) this.drop(e.x, e.y, 160 + Math.random() * (big ? 380 : 200));
    this.shock(e.x, e.y, e.r * 0.6, big ? 520 : 240, big ? 0.7 : 0.4);
    // Enemy-specific death signatures: a quick, readable visual cue for each archetype.
    // Extra particles are intentionally quality-gated to avoid making crowded waves lag.
    if (this.quality < 2 && e.kind !== "boss") {
      const fxCount = this.quality === 0 ? 8 : 4;
      if (e.kind === "fly") {
        for (let i = 0; i < fxCount; i++) {
          const a = (i / fxCount) * TAU;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 0.24, max: 0.24, size: 2.5, kind: "shard", rot: a });
        }
      } else if (e.kind === "bomber") {
        this.shocks.push({ x: e.x, y: e.y, r: 4, vr: 440, life: 0.32, max: 0.32, w: 2.5 });
        for (let i = 0; i < fxCount; i++) {
          const a = (i / fxCount) * TAU + Math.random() * 0.2;
          const sp = 130 + Math.random() * 100;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, max: 0.35, size: 3 + Math.random() * 2, kind: "ember", rot: a });
        }
      } else if (e.kind === "splitter") {
        for (let i = 0; i < fxCount; i++) {
          const a = (i / fxCount) * TAU;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, life: 0.42, max: 0.42, size: 4, kind: "debris", rot: a });
        }
      } else if (e.kind === "brute") {
        this.shocks.push({ x: e.x, y: e.y, r: e.r * 0.25, vr: 300, life: 0.4, max: 0.4, w: 3 });
      } else if (e.kind === "spiky") {
        // A thorn burst: short radial needles and a tight impact ring.
        this.shocks.push({ x: e.x, y: e.y, r: 3, vr: 360, life: 0.28, max: 0.28, w: 2 });
        for (let i = 0; i < fxCount; i++) {
          const a = (i / fxCount) * TAU;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.2, max: 0.2, size: 12, kind: "dash", rot: a });
        }
      } else if (e.kind === "zipper") {
        // Zippers snap apart in two crossing ink strokes.
        for (const a of [Math.PI * 0.25, Math.PI * 0.75]) {
          this.beams.push({ x1: e.x - Math.cos(a) * 28, y1: e.y - Math.sin(a) * 28, x2: e.x + Math.cos(a) * 28, y2: e.y + Math.sin(a) * 28, life: 0.22, max: 0.22 });
        }
      } else if (e.kind === "sniper" || e.kind === "shooter") {
        // A long, thin muzzle-like flash marks the ranged enemy's last shot.
        this.shocks.push({ x: e.x, y: e.y, r: e.r * 0.4, vr: 190, life: 0.5, max: 0.5, w: 1.4 });
        for (let i = 0; i < fxCount; i++) {
          const a = (i / fxCount) * TAU;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.3, max: 0.3, size: 2, kind: "shard", rot: a });
        }
      } else if (e.kind === "shield") {
        // Shield enemies leave a layered, cracked-paper collapse.
        this.shocks.push({ x: e.x, y: e.y, r: 6, vr: 250, life: 0.5, max: 0.5, w: 4 });
        this.shocks.push({ x: e.x, y: e.y, r: 18, vr: 170, life: 0.42, max: 0.42, w: 1.5 });
      } else if (e.kind === "ghost" || e.kind === "blob") {
        // Soft enemies melt into a little ink blossom instead of a generic pop.
        this.petals.push({ x: e.x, y: e.y, life: 0.62, max: 0.62, seed: Math.random() * 1e6, n: e.kind === "ghost" ? 6 : 8 });
      }
    }
    // Hard caps protect long runs from accumulated short-lived effects.
    if (this.shocks.length > 90) this.shocks.splice(0, this.shocks.length - 90);
    if (this.bursts.length > 55) this.bursts.splice(0, this.bursts.length - 55);
    if (this.shocks.length > 90) this.shocks.splice(0, this.shocks.length - 90);
    if (this.beams.length > 80) this.beams.splice(0, this.beams.length - 80);
    if (this.petals.length > 36) this.petals.splice(0, this.petals.length - 36);
    this.shake = Math.max(this.shake, big ? 18 : e.kind === "fly" ? 2 : 5);
    this.freeze = Math.max(this.freeze, big ? 0.08 : 0.028);
    this.addText(
      e.x,
      e.y - e.r - 6,
      HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)],
      0.75,
      big ? 1.8 : 1.1,
    );
    // behaviours on death
    if (!quiet) {
      if (e.kind === "splitter") {
        for (let i = 0; i < 3; i++) {
          const c = this.makeEnemy("blob", e.x + (Math.random() - 0.5) * 46, e.y + (Math.random() - 0.5) * 46);
          c.r = 10;
          c.hp = 1.1;
          c.maxHp = 1.1;
          c.score = 5;
          c.speed = 175;
          this.enemies.push(c);
        }
        this.addText(e.x, e.y - 26, "РАЗВАЛИЛСЯ!", 0.7, 1);
      }
      if (e.kind === "bomber") {
        this.explode(e.x, e.y, 96, 5, 1);
      }
      if (e.kind === "boss") {
        this.flash = 0.16;
        this.slow = 0.8;
        this.shake = 30;
        for (let i = 0; i < 5; i++) {
          this.explode(e.x + (Math.random() - 0.5) * 160, e.y + (Math.random() - 0.5) * 160, 92, 4, 0, true, true);
        }
        this.addText(W / 2, H / 2, "ЧУДИЩЕ ПОВЕРЖЕНО!", 2.4, 2.2);
        for (let i = 0; i < 3; i++) {
          this.pickups.push({ id: this.nextId++, x: e.x + (i - 1) * 42, y: e.y, kind: this.pickDrop(), life: 18 });
        }
      }
    }
    // drops
    const chance = (e.kind === "boss" ? 1 : e.kind === "brute" ? 0.6 : 0.1) + (e.kind === "boss" ? 0 : 0.08 * (this.perks.luck ?? 0));
    if (Math.random() < chance) {
      this.pickups.push({
        id: this.nextId++,
        x: Math.max(50, Math.min(this.limitX - 50, e.x)),
        y: Math.max(50, Math.min(H - 50, e.y)),
        kind: this.pickDrop(),
        life: 13,
      });
    }
  }

  ghostDrop(x: number, y: number) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.22,
      max: 0.22,
      size: 8,
      kind: "smoke",
      rot: 0,
    });
  }

  explode(x: number, y: number, radius: number, dmg: number, hurt = 0, quiet = false, big = false) {
    this.pushFx({ k: "boom", x: Math.round(x), y: Math.round(y), r: radius, big });
    sfx.boom();
    const R = big ? radius * 1.35 : radius;
    // layered shockwaves
    this.shocks.push({ x, y, r: R * 0.15, vr: R * 5.2, life: 0.3, max: 0.3, w: big ? 7 : 4 });
    this.shocks.push({ x, y, r: R * 0.3, vr: R * 3.1, life: 0.5, max: 0.5, w: big ? 4 : 2 });
    this.shocks.push({ x, y, r: R * 0.5, vr: R * 1.7, life: 0.75, max: 0.75, w: 1.6 });
    // scorch + splatter
    this.stains.push({ x, y, size: R * (big ? 0.45 : 0.3), seed: Math.random() * 1e6 });
    for (let i = 0; i < (big ? 7 : 3); i++) {
      const a = Math.random() * TAU;
      const d = R * (0.5 + Math.random() * 0.9);
      this.stains.push({
        x: Math.max(30, Math.min(this.limitX - 30, x + Math.cos(a) * d)),
        y: Math.max(30, Math.min(H - 30, y + Math.sin(a) * d)),
        size: 4 + Math.random() * (big ? 16 : 10),
        seed: Math.random() * 1e6,
      });
    }
    // ink droplets
    for (let i = 0; i < (big ? 46 : 26); i++) this.drop(x, y, 140 + Math.random() * (big ? 620 : 420));
    // smoke plumes
    for (let i = 0; i < (big ? 22 : 12); i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: x + Math.cos(a) * R * 0.4,
        y: y + Math.sin(a) * R * 0.4,
        vx: Math.cos(a) * 130,
        vy: Math.sin(a) * 130 - 40,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        size: (big ? 14 : 9) + Math.random() * 12,
        kind: "smoke",
        rot: 0,
      });
    }
    // burning embers (gravity)
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const a = Math.random() * TAU;
      const sp = 180 + Math.random() * (big ? 620 : 380);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 0.45 + Math.random() * 0.5,
        max: 0.95,
        size: 2 + Math.random() * 3.5,
        kind: "ember",
        rot: 0,
      });
    }
    // paper debris chunks
    for (let i = 0; i < (big ? 16 : 7); i++) {
      const a = Math.random() * TAU;
      const sp = 140 + Math.random() * (big ? 460 : 300);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 200,
        life: 0.9 + Math.random() * 0.7,
        max: 1.6,
        size: 4 + Math.random() * (big ? 9 : 6),
        kind: "debris",
        rot: Math.random() * TAU,
      });
    }
    // screen cracks for big blasts
    if (big) {
      for (let i = 0; i < 7; i++) {
        this.cracks.push({
          x,
          y,
          ang: (i / 7) * TAU + Math.random() * 0.5,
          len: 120 + Math.random() * 260,
          life: 0.5,
          max: 0.5,
          seed: Math.floor(Math.random() * 1e6),
        });
      }
      this.flash = Math.max(this.flash, 0.09);
      this.edgeSplat(2, 26);
      this.speedLines = Math.max(this.speedLines, 0.7);
      sfx.bigBoom();
    }
    this.shake = Math.max(this.shake, big ? 26 : 15);
    this.zoom = Math.max(this.zoom, big ? 0.06 : 0.03);
    this.freeze = Math.max(this.freeze, big ? 0.09 : 0.045);
    if (!quiet) {
      const list = [...this.enemies];
      for (const e of list) {
        if (Math.hypot(e.x - x, e.y - y) < R + e.r) this.hitEnemy(e, dmg, e.x, e.y, true);
      }
      const boss = this.boss;
      if (boss && this.bossHittable() && Math.hypot(boss.x - x, boss.y - y) < R + boss.r) {
        this.damageBoss(dmg, boss.x, y);
      }
      for (const b of this.ebullets) {
        if (Math.hypot(b.x - x, b.y - y) < R) b.life = 0;
      }
    }
    if (hurt > 0) this.hurtAt(x, y, R, hurt, 26);
  }

  useUlt() {
    const p = this.player;
    if (this.status !== "playing" || this.ult < 100) return;
    initAudio();
    sfx.ult();
    this.ult = 0;
    this.slow = 0.85;
    this.flash = 0.14;
    this.freeze = 0.1;
    this.zoom = 0.075;
    this.shake = 34;
    p.invuln = Math.max(p.invuln, 0.8);
    this.addText(p.x, p.y - 60, "ЧЕРНИЛЬНЫЙ ВЗРЫВ!", 2, 1.9);
    this.shocks.push({ x: p.x, y: p.y, r: 20, vr: 1400, life: 0.7, max: 0.7, w: 6 });
    this.shocks.push({ x: p.x, y: p.y, r: 10, vr: 900, life: 0.9, max: 0.9, w: 3 });
    this.explode(p.x, p.y, 90, 1, 0, true);
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * TAU;
      const s = 200 + Math.random() * 600;
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.7,
        max: 1.2,
        size: 2 + Math.random() * 8,
        kind: Math.random() < 0.5 ? "drop" : "smoke",
        rot: 0,
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const d = Math.random() * 420;
      this.stains.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, size: 6 + Math.random() * 18, seed: Math.random() * 1e6 , born: this.time });
    }
    this.ebullets = [];
    const list = [...this.enemies];
    for (const e of list) {
      if (Math.hypot(e.x - p.x, e.y - p.y) < 480) this.hitEnemy(e, 26, e.x, e.y);
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    const boss = this.boss;
    if (boss && this.bossHittable()) this.damageBoss(28, boss.x, boss.y);
    this.hazards = [];
    this.damageRings = [];
  }

  collect(pk: Pickup, who?: typeof this.player) {
    const p = who ?? this.player;
    sfx.pickup();
    if (pk.kind === "heart") {
      p.hp = Math.min(p.maxHp, p.hp + 1);
      this.addText(pk.x, pk.y - 24, "+1 \u2665", 1.2, 1.2);
    } else {
      const def = WEAPONS[pk.kind];
      this.ammo[pk.kind] = Math.min(def.maxAmmo, this.ammo[pk.kind] + def.pickup);
      // keep the level weapon in hand unless the current one is dry
      if (!this.isInfinite(p.weapon) && this.ammo[p.weapon] <= 0) p.weapon = pk.kind;
      this.addText(pk.x, pk.y - 24, `${def.short} +${def.pickup}`, 1.3, 1.2);
    }
    this.ring(pk.x, pk.y);
    for (let i = 0; i < 12; i++) this.drop(pk.x, pk.y, 160);
  }

  hurtPlayer(fromAngle: number, dmg = 1, knock = 22, who = this.player) {
    const p = who;
    if (p.down || !p.active) return;
    if (p.invuln > 0 || p.dashTime > 0) return;
    if (p.shield) {
      // the paper shield folds around the hit and unfolds again later
      p.shield = false;
      p.shieldT = Math.max(9, 25 - 5 * (this.perks.shield ?? 1));
      p.invuln = 0.9;
      this.shock(p.x, p.y, 12, 520, 0.5);
      this.shock(p.x, p.y, 8, 300, 0.7);
      this.addText(p.x, p.y - 38, "ЩИТ!", 0.9, 1.4);
      this.shake = Math.max(this.shake, 7);
      sfx.hit();
      return;
    }
    p.hp -= dmg;
    this.damageTaken += dmg;
    if (this.perks.nova) {
      const R = 110 + 45 * this.perks.nova;
      this.shock(p.x, p.y, 12, R * 4.4, 0.55);
      this.shock(p.x, p.y, 8, R * 2.6, 0.8);
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < R + e.r) {
          this.hitEnemy(e, 3 * this.perks.nova, e.x, e.y, true);
          e.x += ((e.x - p.x) / (d || 1)) * 50;
          e.y += ((e.y - p.y) / (d || 1)) * 50;
        }
      }
    }
    p.invuln = 1;
    p.flash = 0.12;
    sfx.hurt();
    this.shake = 16;
    this.flash = Math.max(this.flash, 0.05);
    this.combo = 0;
    this.comboTimer = 0;
    this.ult = Math.max(0, this.ult - 12);
    p.x += Math.cos(fromAngle) * knock;
    p.y += Math.sin(fromAngle) * knock;
    this.addText(p.x, p.y - 40, dmg > 1 ? "БОЛЬНО!" : "ОЙ!", 1, 1.4);
    this.edgeSplat(2, 34);
    for (let i = 0; i < 22; i++) this.drop(p.x, p.y, 160 + Math.random() * 300);
    this.shock(p.x, p.y, 10, 300, 0.4);
    if (p.hp <= 0 && this.isCoop() && this.allPlayers().some((o) => o !== p && !o.down)) {
      this.downPlayer(p);
      return;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      if (this.trans || this.pendingStatus) return;
      if (this.endless) {
        this.meta.bestEndless = Math.max(this.meta.bestEndless, Math.max(1, this.wave));
        saveMeta(this.meta);
      }
      this.goTo("gameover", "crack", 0.9, this.player.x / W, this.player.y / H);
      this.stains.push({ x: p.x, y: p.y, size: 34, seed: Math.random() * 1e6 , born: this.time });
      for (let i = 0; i < 40; i++) this.drop(p.x, p.y, 340);
      sfx.gameover();
      this.emit();
    }
  }

  pushOutObstacles(o: { x: number; y: number; r: number }) {
    for (const ob of this.obstacles) {
      const dx = o.x - ob.x;
      const dy = o.y - ob.y;
      const d = Math.hypot(dx, dy);
      const min = ob.r + o.r;
      if (d < min && d > 0) {
        o.x = ob.x + (dx / d) * min;
        o.y = ob.y + (dy / d) * min;
      }
    }
  }

  // ---------- fx ----------
  drop(x: number, y: number, angleOrSpeed: number, speed?: number) {
    let a: number;
    let s: number;
    if (speed === undefined) {
      a = Math.random() * TAU;
      s = angleOrSpeed * (0.3 + Math.random());
    } else {
      a = angleOrSpeed + (Math.random() - 0.5);
      s = speed * (0.3 + Math.random());
    }
    this.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      size: 1.5 + Math.random() * 3.5,
      kind: "drop",
      rot: 0,
    });
  }
  puff(x: number, y: number, n: number, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.17 + Math.random() * 0.18,
        max: 0.35,
        size: 6,
        kind: "dash",
        rot: 0,
      });
    }
  }
  puffsAt(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 90 + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.2 + Math.random() * 0.2,
        max: 0.4,
        size: 5 + Math.random() * 5,
        kind: "smoke",
        rot: 0,
      });
    }
  }
  ring(x: number, y: number) {
    this.shock(x, y, 8, 260, 0.4);
  }
  shock(x: number, y: number, r: number, vr: number, life: number) {
    this.shocks.push({ x, y, r, vr, life, max: life, w: 2.5 });
  }
  edgeSplat(n = 1, size = 30) {
    for (let i = 0; i < n; i++) {
      const side = Math.floor(Math.random() * 4);
      const at = Math.random();
      const x = side === 0 ? at * W : side === 1 ? W - 18 - Math.random() * 40 : at * W;
      const y = side === 2 ? at * H : side === 3 ? H - 18 - Math.random() * 40 : at * H;
      this.edgeSplats.push({
        x: side === 0 ? 8 + Math.random() * 26 : side === 1 ? W - 8 - Math.random() * 26 : x,
        y: side === 2 ? 8 + Math.random() * 26 : side === 3 ? H - 8 - Math.random() * 26 : y,
        size: size * (0.5 + Math.random()),
        seed: Math.random() * 1e6,
        life: 2.2,
        max: 2.2,
      });
    }
  }
  addText(x: number, y: number, text: string, life: number, scale: number) {
    this.texts.push({ x, y, text, life, max: life, rot: (Math.random() - 0.5) * 0.35, scale });
  }

  // ---------- render ----------
  render() {
    setLod(this.quality);
    const ctx = this.ctx;
    const boil = Math.floor(this.time * 9);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.paper, 0, 0);
    if (this.status !== "menu") this.drawArenaTheme();
    ctx.save();
    const zoomK = 1 + this.zoom;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoomK, zoomK);
    ctx.translate(-W / 2, -H / 2);
    if (this.shake > 0) {
      const sh = this.settings.shake ? this.shake : this.shake * 0.15;
      ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;

    this.bakeStains();
    if (this.stainLayer) ctx.drawImage(this.stainLayer, 0, 0);
    ctx.fillStyle = INK;
    for (const s of this._stains) {
      // only brand-new stains are drawn live (with a bloom); the rest live on the baked layer
      const age = this.time - (s.born ?? this.time);
      const fresh = Math.max(0, 1 - age / 0.7);
      ctx.globalAlpha = 0.66 * (1 - fresh * 0.35);
      splat(ctx, s.x, s.y, s.size * (1 + fresh * 0.5), mulberry32(s.seed), 6);
      if (fresh > 0.05 && this.quality < 2) {
        ctx.globalAlpha = fresh * 0.5;
        ctx.lineWidth = 2;
        wcircle(ctx, s.x, s.y, s.size * (1.6 - fresh * 0.6), mulberry32(s.seed + Math.floor(this.time * 10)), 3, 1);
      }
    }
    ctx.globalAlpha = 1;

    for (const pr of this.prints) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.28, (pr.life / 2.2) * 0.28);
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.a);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const wn of this.warnings) {
      const a = wn.t / wn.max;
      const rr = mulberry32(Math.floor(wn.seed) + boil);
      ctx.save();
      ctx.globalAlpha = 0.65 * a;
      ctx.lineWidth = 2;
      const size = 16 + (1 - a) * 10;
      wcircle(ctx, wn.x, wn.y, size, rr, 2.5, 2);
      burst(ctx, wn.x, wn.y, size + 4, size + 16, 8, rr);
      ctx.font = `bold 22px "Kelly Slab", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", wn.x, wn.y);
      ctx.restore();
    }
    // falling ink drops
    for (const d of this.inkDrops) {
      const rr = mulberry32(Math.floor(d.seed) + boil);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - d.r * 2.4);
      ctx.quadraticCurveTo(d.x + d.r, d.y - d.r * 0.4, d.x, d.y + d.r);
      ctx.quadraticCurveTo(d.x - d.r, d.y - d.r * 0.4, d.x, d.y - d.r * 2.4);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      wline(ctx, d.x, d.y - d.r * 2.6, d.x, d.y - d.r * 5, rr, 1.5);
      ctx.restore();
    }

    this.drawObstacles(boil);
    for (const pk of this.pickups) this.drawPickup(pk, boil);

    this.drawHazards(boil);
    this.drawBossTelegraph(boil);
    this.drawQueenTelegraph(boil);
    this.drawTentacleTelegraphs(boil);
    drawSpecialUnder(this, boil);

    // beams under enemies/player
    for (const b of this.beams) {
      const a = b.life / b.max;
      const r = mulberry32(boil * 7 + 3);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.lineWidth = 9;
      lightning(ctx, b.x1, b.y1, b.x2, b.y2, r, 12, 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = PAPER;
      lightning(ctx, b.x1, b.y1, b.x2, b.y2, r, 8, 3);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 1;
    }

    for (const e of this.enemies) this.drawEnemy(e, boil);
    drawFinaleUnder(this, boil);
    if (this.boss) this.drawBoss(boil);
    drawSpecialOver(this, boil);
    drawFinaleOver(this, boil);
    for (const r of this.damageRings) {
      const a = Math.max(0, r.life / r.max);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.lineWidth = r.w * (0.4 + a);
      wcircle(ctx, r.x, r.y, r.r, mulberry32(boil + Math.floor(r.x)), 5, 1);
      wcircle(ctx, r.x, r.y, r.r * 0.86, mulberry32(boil + 7), 3, 1);
      ctx.globalAlpha = 1;
    }
    if (this.inGame()) {
      for (const g of this.ghosts) this.drawGhost(g, boil);
      if (this.mate.active) this.drawPlayer(boil, this.mate);
      this.drawPlayer(boil, this.player);
      this.drawPerkFx(boil);
      if (this.isCoop()) this.drawNameplates(boil);
    }

    // bullets
    for (const b of this.bullets) {
      if (b.rocket) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.lineWidth = 2.5;
        wrect(ctx, -10, -5, 18, 10, mulberry32(boil + 5), 1.5);
        wpoly(
          ctx,
          [
            [8, -5],
            [15, 0],
            [8, 5],
          ],
          mulberry32(boil + 6),
          1,
        );
        ctx.beginPath();
        ctx.arc(-10, 0, 3, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1.5;
        spiral(ctx, b.x - Math.cos(a) * 16, b.y - Math.sin(a) * 16, 9, boil + b.x * 0.1, 1.4, mulberry32(boil + 9));
      } else {
        const n = Math.hypot(b.vx, b.vy) || 1;
        const tx = -(b.vx / n);
        const ty = -(b.vy / n);
        // tapered comet tail with a halftone edge
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        for (let k = 0; k < 4; k++) {
          const u = k / 4;
          ctx.globalAlpha = 0.5 - u * 0.42;
          ctx.lineWidth = 5 - u * 3.6;
          wline(ctx, -10 - u * 14, 0, -20 - u * 18, 0, mulberry32(boil + Math.floor(b.x) + k), 1.4);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        wline(ctx, b.x, b.y, b.x + tx * 14, b.y + ty * 14, mulberry32(boil + Math.floor(b.x)), 1);
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
      }
    }
    for (const b of this.ebullets) {
      const r = mulberry32(boil + Math.floor(b.x));
      ctx.lineWidth = 2;
      // soft danger halo so incoming shots read clearly
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(b.x, b.y, (b.r ?? 6) + 5 + Math.sin(this.time * 12 + b.x * 0.1) * 1.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (b.needle) {
        const n = Math.hypot(b.vx, b.vy) || 1;
        wline(ctx, b.x, b.y, b.x - (b.vx / n) * 18, b.y - (b.vy / n) * 18, r, 1);
      } else {
        wcircle(ctx, b.x, b.y, b.r, r, 1.5, 1);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU);
        ctx.fill();
      }
    }

    // particles
    for (const pt of this.particles) {
      const t = pt.life / pt.max;
      if (pt.kind === "drop") {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * Math.max(0.2, t), 0, TAU);
        ctx.fill();
      } else if (pt.kind === "dash") {
        ctx.lineWidth = 2;
        const n = Math.hypot(pt.vx, pt.vy) || 1;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - (pt.vx / n) * pt.size, pt.y - (pt.vy / n) * pt.size);
        ctx.stroke();
      } else if (pt.kind === "smoke") {
        if (this.quality === 2 && ((this.frameNo + (pt.x | 0)) & 1)) continue;
        ctx.globalAlpha = Math.min(1, t * 1.4) * 0.8;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1.2 - t * 0.4), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (pt.kind === "ember") {
        const flick = 0.55 + Math.sin(this.time * 40 + pt.x) * 0.45;
        ctx.globalAlpha = Math.min(1, t * 1.6) * flick;
        const n = Math.hypot(pt.vx, pt.vy) || 1;
        ctx.lineWidth = pt.size * 0.8;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - (pt.vx / n) * pt.size * 3.4, pt.y - (pt.vy / n) * pt.size * 3.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (pt.kind === "debris") {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.globalAlpha = Math.min(1, t * 1.8);
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.moveTo(-pt.size, -pt.size * 0.7);
        ctx.lineTo(pt.size * 0.9, -pt.size);
        ctx.lineTo(pt.size, pt.size * 0.8);
        ctx.lineTo(-pt.size * 0.7, pt.size);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.beginPath();
        ctx.moveTo(-pt.size, -pt.size * 0.5);
        ctx.lineTo(pt.size, 0);
        ctx.lineTo(-pt.size, pt.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // shockwaves
    for (const s of this.shocks) {
      const t = s.life / s.max;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.lineWidth = s.w * (0.5 + t);
      wcircle(ctx, s.x, s.y, s.r, mulberry32(boil * 5 + Math.floor(s.x)), 3, 1);
      if (s.r > 40 && this.quality === 0) wcircle(ctx, s.x, s.y, s.r * 0.8, mulberry32(boil * 3 + 8), 4, 1);
      ctx.globalAlpha = 1;
    }

    // ink flower blooms from tentacle slams
    for (const pe of this.petals) {
      const a = Math.max(0, pe.life / pe.max);
      const grow = 1 - Math.pow(a, 2.4);
      ctx.save();
      ctx.translate(pe.x, pe.y);
      ctx.rotate((pe.seed % TAU) + (1 - a) * 0.6);
      for (let layer = 0; layer < 2; layer++) {
        const L = (layer ? 52 : 92) * grow + 8;
        const n = layer ? pe.n : pe.n;
        for (let k = 0; k < n; k++) {
          ctx.save();
          ctx.rotate((k / n) * TAU + (layer ? Math.PI / n : 0));
          ctx.globalAlpha = Math.min(1, a * 1.7) * (layer ? 0.95 : 0.9);
          ctx.fillStyle = layer ? INK : PAPER;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.quadraticCurveTo(L * 0.42, -L * 0.3, L, 0);
          ctx.quadraticCurveTo(L * 0.42, L * 0.3, 7, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (!layer) {
            ctx.lineWidth = 1;
            ctx.globalAlpha *= 0.7;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(L * 0.82, 0);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, 9 * grow + 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // radial pop when something dies
    for (const bu of this.bursts) {
      const a = Math.max(0, bu.life / bu.max);
      const g = 1 - a;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5 + a * 2;
      burst(ctx, bu.x, bu.y, bu.r * (0.5 + g * 0.8), bu.r * (1.3 + g * 2.6), 10, mulberry32(bu.seed + Math.floor(this.time * 20)), bu.seed);
      ctx.restore();
    }

    // hitmarks
    for (const h of this.hitmarks) {
      const r = mulberry32(boil + 77);
      ctx.globalAlpha = Math.min(1, h.life * 8);
      ctx.lineWidth = 2;
      wline(ctx, h.x - 8, h.y - 8, h.x - 3, h.y - 3, r, 1);
      wline(ctx, h.x + 8, h.y - 8, h.x + 3, h.y - 3, r, 1);
      wline(ctx, h.x - 8, h.y + 8, h.x - 3, h.y + 3, r, 1);
      wline(ctx, h.x + 8, h.y + 8, h.x + 3, h.y + 3, r, 1);
      ctx.globalAlpha = 1;
    }

    // floating words
    for (const t of this.texts) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      ctx.font = `${Math.round(24 * t.scale)}px "Caveat", "Comic Sans MS", cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = PAPER;
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = INK;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    drawSpecialTop(this, boil);
    ctx.restore();

    if (this.boss?.def.id === "queen" && this.boss.state === "transition") {
      this.drawQueenFlood(boil);
    }
    if (this.flash > 0 && this.settings.flashes) {
      ctx.save();
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.edgeSplats.length) {
      ctx.save();
      for (const sp of this.edgeSplats) {
        ctx.globalAlpha = Math.min(0.8, (sp.life / sp.max) * 0.9);
        splat(ctx, sp.x, sp.y, sp.size, mulberry32(sp.seed), 5);
      }
      ctx.restore();
    }
    if (this.slow > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.14, this.slow * 0.2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const y = ((i * 53 + this.time * 20) % H);
        wline(ctx, 0, y, 26, y + 8, mulberry32(i), 2);
        wline(ctx, W, y + 20, W - 26, y + 28, mulberry32(i + 50), 2);
      }
      ctx.restore();
    }

    if (this.status === "playing" && this.player.hp <= 2 && this.player.hp > 0 && this.quality < 2) {
      const beat = Math.max(0, Math.sin(this.time * 6.2)) ** 3;
      const g = ctx.createRadialGradient(this.limitX / 2, H / 2, H * 0.34, this.limitX / 2, H / 2, H * 0.92);
      g.addColorStop(0, "rgba(20,20,20,0)");
      g.addColorStop(1, `rgba(20,20,20,${0.2 + beat * 0.32})`);
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.limitX, H);
      ctx.restore();
    }
    if (this.status === "playing" || this.status === "paused") {
      drawDecree(this, boil);
      this.drawHUDCached(boil);
      this.drawWaveBanner(boil);
    }
    if (this.status === "playing") this.drawCrosshair(boil);
    if (this.bossBanner > 0 && (this.status === "playing" || this.status === "paused")) this.drawBossBanner(boil);
    if (this.status === "briefing") this.drawBriefingArena(boil);
    this.drawFxOverlays(boil);
    if (this.darkT > 0.01) this.drawPerkDark(this.darkT);
  }

  /** the page dims and vignettes while the perk cards hang in the air */
  drawPerkDark(a: number) {
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.95);
    grad.addColorStop(0, `rgba(20,20,20,${0.3 * a})`);
    grad.addColorStop(1, `rgba(20,20,20,${0.8 * a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = INK;
    for (let i = 0; i < 34; i++) {
      const edge = i % 4;
      const p = (i * 0.618) % 1;
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = p * W;
        y = 6;
      } else if (edge === 1) {
        x = W - 6;
        y = p * H;
      } else if (edge === 2) {
        x = p * W;
        y = H - 6;
      } else {
        x = 6;
        y = p * H;
      }
      const d = Math.hypot(x - W / 2, y - H / 2) / (H * 0.95);
      const rr = Math.max(0.6, (1 - d) * 7 * a);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** screen-space action overlays: cracks, speed lines, frenzy border */
  drawFxOverlays(boil: number) {
    const ctx = this.ctx;
    for (const scar of this.borderScars) {
      const r = mulberry32(scar.seed + boil);
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, scar.life / 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      const x = scar.side === 1 ? W - 14 : scar.side === 3 ? 14 : scar.at * W;
      const y = scar.side === 0 ? 14 : scar.side === 2 ? H - 14 : scar.at * H;
      burst(ctx, x, y, 4, 34, 11, r);
      // Jagged missing-paper wedge makes a boundary collision read as a tear.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(scar.side * Math.PI / 2);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-52, -11);
      ctx.lineTo(-35, 12);
      ctx.lineTo(-16, 2);
      ctx.lineTo(0, 32);
      ctx.lineTo(14, 4);
      ctx.lineTo(37, 16);
      ctx.lineTo(55, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      for (let j = 0; j < 5; j++) {
        const dx = (r() - 0.5) * 100;
        const dy = (r() - 0.5) * 100;
        wline(ctx, x, y, x + dx, y + dy, r, 3);
      }
      ctx.restore();
    }
    // impact cracks
    for (const c of this.cracks) {
      const a = Math.max(0, c.life / c.max);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3 * a + 1;
      let x = c.x;
      let y = c.y;
      let ang = c.ang;
      const rr = mulberry32(c.seed + boil);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        ang += (rr() - 0.5) * 0.8;
        const step = (c.len / segs) * (0.6 + rr() * 0.8);
        x += Math.cos(ang) * step;
        y += Math.sin(ang) * step;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    // radial speed lines when the action is hot
    const hot = Math.max(this.speedLines, this.frenzyOn ? 0.55 : 0);
    if (hot > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, hot * 0.5);
      ctx.strokeStyle = INK;
      const rays = this.quality ? 12 : 26;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU + Math.sin(this.time * 2 + i) * 0.06;
        const inner = 200 + (i % 5) * 42;
        const outer = inner + 130 + (i % 3) * 90;
        ctx.lineWidth = 1.5 + (i % 3);
        wline(
          ctx,
          W / 2 + Math.cos(a) * inner,
          H / 2 + Math.sin(a) * inner,
          W / 2 + Math.cos(a) * outer,
          H / 2 + Math.sin(a) * outer,
          mulberry32(boil + i),
          3,
        );
      }
      ctx.restore();
    }
    // frenzy border scribbles
    if (this.frenzyOn && this.status === "playing") {
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 14) * 0.2;
      ctx.lineWidth = 2.5;
      const n = this.quality ? 16 : 34;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        let x: number;
        let y: number;
        if (t < 0.25) {
          x = (t / 0.25) * W;
          y = 12;
        } else if (t < 0.5) {
          x = W - 12;
          y = ((t - 0.25) / 0.25) * H;
        } else if (t < 0.75) {
          x = W - ((t - 0.5) / 0.25) * W;
          y = H - 12;
        } else {
          x = 12;
          y = H - ((t - 0.75) / 0.25) * H;
        }
        const wob = Math.sin(this.time * 20 + i * 2) * 7;
        wline(ctx, x + wob, y + wob * 0.6, x - wob, y - wob * 0.6, mulberry32(boil + i * 5), 3);
      }
      ctx.restore();
    }
  }

  inGame() {
    return (
      this.status === "playing" ||
      this.status === "coop" ||
      this.status === "paused" ||
      this.status === "gameover" ||
      this.status === "levelclear" ||
      this.status === "victory"
    );
  }

  /** arena preview drawn behind the briefing card */
  drawBriefingArena(boil: number) {
    const ctx = this.ctx;
    const r = mulberry32(boil + this.level.id * 17);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.font = `20px "Caveat", cursive`;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.fillText("план листа", W / 2, H - 42);
    wline(ctx, W / 2 - 60, H - 32, W / 2 + 60, H - 34, r, 2);
    ctx.restore();
  }

  drawWaveBanner(boil: number) {
    if (this.waveBanner <= 0) return;
    const W = this.limitX;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.waveBanner);
    ctx.translate(W / 2, H / 2 - 40);
    ctx.rotate(-0.05);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.font = `bold 76px "Kelly Slab", serif`;
    ctx.fillText(`ВОЛНА ${this.wave}`, 0, 0);
    ctx.lineWidth = 4;
    wline(ctx, -130, 44, 130, 38, mulberry32(boil), 4);
    if (this.bossPending) {
      ctx.font = `bold 30px "Kelly Slab", serif`;
      ctx.fillText("▲ БОСС ▲", 0, -66);
    }
    ctx.restore();
  }

  /**
   * Rocks never move, so each of four "boil" phases is rendered once into an offscreen layer
   * and then simply blitted (was ~380 canvas calls per frame).
   */
  drawObstacles(boil: number) {
    if (!this.obstacles.length) return;
    const phase = Math.floor(boil / 2) % 4;
    let layer = this.obstacleLayers[phase];
    if (!layer) {
      layer = document.createElement("canvas");
      layer.width = W;
      layer.height = H;
      const lc = layer.getContext("2d");
      if (lc) {
        const saved = this.ctx;
        this.ctx = lc;
        lc.lineCap = "round";
        lc.lineJoin = "round";
        lc.strokeStyle = INK;
        lc.fillStyle = INK;
        for (const o of this.obstacles) this.drawObstacle(o, phase * 2 + 1);
        this.ctx = saved;
      }
      this.obstacleLayers[phase] = layer;
    }
    this.ctx.drawImage(layer, 0, 0);
  }

  /** the HUD is redrawn into its own layer at a lower rate (~15-20 fps) and blitted every frame */
  drawHUDCached(boil: number) {
    const hc = this.hudCtx;
    if (!hc) {
      this.drawHUD(boil);
      return;
    }
    const every = this.quality === 0 ? 3 : 5;
    if (!this.hudValid || this.frameNo % every === 0) {
      hc.clearRect(0, 0, W, H);
      const saved = this.ctx;
      this.ctx = hc;
      this.drawHUD(boil);
      this.ctx = saved;
      this.hudValid = true;
    }
    this.ctx.drawImage(this.hudLayer, 0, 0);
  }

  /** moves settled stains onto an offscreen layer, so the main pass never redraws them */
  bakeStains() {
    const g = this.stainCtx;
    if (!g) return;
    let any = false;
    g.fillStyle = INK;
    for (const s of this._stains) {
      if (s.baked) continue;
      const age = this.time - (s.born ?? -99);
      if (age >= 0.7) {
        g.globalAlpha = 0.66;
        splat(g, s.x, s.y, s.size, mulberry32(s.seed), 6);
        s.baked = true;
        any = true;
      }
    }
    g.globalAlpha = 1;
    if (any) this._stains = this._stains.filter((st) => !st.baked);
  }

  /** per-level background doodles so every sheet feels different */
  drawArenaStatic(g: CanvasRenderingContext2D) {
    const ctx = g;
    const id = this.level.id;
    const r = mulberry32(id * 991 + 7);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.16;
    // paper watermark
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 210px "Kelly Slab", serif`;
    ctx.fillText(String(id), 0, 0);
    ctx.restore();
    if (id === 1) {
      // margin doodles: knots and stars
      for (const [x, y] of [[92, 92], [W - 92, 96], [96, H - 96], [W - 94, H - 92]]) {
        wstar(ctx, x, y, 16, 6, 5, r() * 2, r, 1.5);
        wcircle(ctx, x, y, 22, r, 2, 1);
      }
    } else if (id === 2) {
      // swarm of little wings
      for (let i = 0; i < 26; i++) {
        const x = 60 + r() * (W - 120);
        const y = 80 + r() * (H - 160);
        wline(ctx, x, y, x - 6, y - 6, r, 1);
        wline(ctx, x, y, x - 6, y + 6, r, 1);
        wcircle(ctx, x, y, 2.5, r, 1, 1);
      }
    } else if (id === 3) {
      // ruled sheet
      for (let y = 96; y < H - 50; y += 34) {
        ctx.globalAlpha = 0.1;
        wline(ctx, 34, y, W - 34, y, r, 1.4);
      }
      ctx.globalAlpha = 0.16;
      for (const [x, y] of [[86, 112], [W - 86, 112], [86, H - 96], [W - 86, H - 96]]) {
        wcircle(ctx, x, y, 18, r, 2, 2);
        wcircle(ctx, x, y, 7, r, 1.5, 1);
        wline(ctx, x - 24, y, x + 24, y, r, 1);
        wline(ctx, x, y - 24, x, y + 24, r, 1);
      }
    } else if (id === 4) {
      // watching eyes in the margins
      for (let i = 0; i < 7; i++) {
        const x = 70 + r() * (W - 140);
        const y = 80 + r() * (H - 160);
        const s = 8 + r() * 10;
        wcircle(ctx, x, y, s, r, 2, 1);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.35, 0, TAU);
        ctx.fill();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI;
          wline(ctx, x + Math.cos(a) * s, y - Math.sin(a) * s, x + Math.cos(a) * (s + 6), y - Math.sin(a) * (s + 6), r, 1);
        }
      }
    } else if (id === 5) {
      // scorch marks and bomb sketches
      for (let i = 0; i < 9; i++) {
        const x = 70 + r() * (W - 140);
        const y = 90 + r() * (H - 180);
        burst(ctx, x, y, 6, 16 + r() * 12, 7, r);
        wcircle(ctx, x, y, 5, r, 1, 1);
      }
      for (let i = 0; i < 4; i++) {
        const x = 100 + r() * (W - 200);
        const y = 110 + r() * (H - 220);
        wcircle(ctx, x, y, 14, r, 1.5, 1);
        wline(ctx, x + 10, y - 10, x + 18, y - 20, r, 1.5);
      }
    } else {
      // royal crown doodles and old ink blots
      for (let i = 0; i < 5; i++) {
        const x = 90 + r() * (W - 180);
        const y = 100 + r() * (H - 200);
        const s = 12 + r() * 8;
        wpoly(ctx, [[x - s, y + s], [x - s * 0.7, y - s], [x - s * 0.2, y], [x + s * 0.1, y - s * 1.3], [x + s * 0.5, y], [x + s * 0.8, y - s * 0.9], [x + s, y + s]], r, 1.5);
        wcircle(ctx, x, y + 2, s * 1.25, r, 2, 1);
      }
    }
    // boss warning stamp in a corner
    ctx.globalAlpha = 0.22;
    ctx.save();
    ctx.translate(W - 128, H - 30);
    ctx.rotate(-0.06);
    ctx.font = `bold 18px "Kelly Slab", serif`;
    ctx.textAlign = "center";
    ctx.fillText(this.endless ? "☠ БОСС КАЖДЫЕ 4 ВОЛНЫ" : `☠ БОСС: ${BOSSES[this.level.boss].name}`, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  drawArenaTheme() {
    const ctx = this.ctx;
    const boil = Math.floor(this.time * 9);
    const r = mulberry32(this.level.id * 991 + 7);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.16;
    // live margin doodles: combo flames, low-hp drips, boss skulls
    if (this.inGame()) {
      if (this.combo >= 10) {
        ctx.globalAlpha = 0.35;
        const flames = Math.min(6, Math.floor(this.combo / 10) + 1);
        for (let i = 0; i < flames; i++) {
          const x = 60 + i * 18;
          const y = H - 176;
          wline(ctx, x, y + 14, x + 4, y + 2, mulberry32(boil + i), 1.6);
          wline(ctx, x + 4, y + 2, x + 8, y + 14, mulberry32(boil + i + 9), 1.6);
          wline(ctx, x + 2, y + 9, x + 6, y + 5, mulberry32(boil + i + 3), 1);
        }
        ctx.font = `bold 15px "Kelly Slab", serif`;
        ctx.textAlign = "left";
        ctx.fillText(`серия x${this.combo}`, 60, H - 158);
      }
      if (this.player.hp <= 2) {
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 9; i++) {
          const x = 80 + r() * (W - 160);
          const len = 12 + r() * 34;
          ctx.lineWidth = 1.6 + r() * 2;
          wline(ctx, x, 18, x + 1, 18 + len, r, 2);
          wcircle(ctx, x + 1, 20 + len, 2 + r() * 2, r, 1, 1);
        }
        ctx.font = `bold 18px "Kelly Slab", serif`;
        ctx.textAlign = "center";
        ctx.fillText("держи-и-ись", W / 2 + 140, 70);
      }
      if (this.boss && this.boss.state === "fight") {
        ctx.globalAlpha = 0.28;
        for (let i = 0; i < 3; i++) {
          const x = 66 + i * 24;
          const y = 300;
          wcircle(ctx, x, y, 8, r, 1.6, 1);
          ctx.fillRect(x - 4, y - 3, 3, 3);
          ctx.fillRect(x + 1, y - 3, 3, 3);
          wline(ctx, x - 4, y + 5, x + 4, y + 5, r, 1);
        }
      }
    }
    // ambient paper dust
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < (this.quality ? 5 : 14); i++) {
      const x = (i * 137 + Math.sin(this.time * 0.4 + i) * 40) % W;
      const y = (i * 89 + this.time * (6 + (i % 4) * 4)) % H;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHazards(boil: number) {
    const ctx = this.ctx;
    for (const h of this.hazards) {
      const t = Math.max(0, h.t / h.max);
      const r = mulberry32(h.seed + boil);
      const pulse = 0.55 + Math.sin(this.time * 16 + h.seed) * 0.25;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.globalAlpha = 0.35 + t * 0.3;
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = 2;
      wcircle(ctx, 0, 0, h.r, r, 2, 1);
      const inner = h.r * (1 - t) * 0.9 + 3;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, h.r, 0, TAU);
      ctx.clip();
      ctx.globalAlpha = pulse;
      for (let d = -h.r; d < h.r; d += 5) {
        const half = Math.sqrt(Math.max(0, h.r * h.r - d * d));
        if (Math.abs(d) < inner) wline(ctx, -half, d, half, d, r, 1);
      }
      ctx.restore();
      ctx.globalAlpha = 0.85;
      if (h.kind === "mine") {
        wcircle(ctx, 0, 0, 8, r, 1.5, 1);
        wline(ctx, 0, -8, 5, -16, r, 1);
        burst(ctx, 5, -17, 2, 7, 5, r);
      } else {
        for (let i = -1; i <= 1; i++) {
          wline(ctx, i * 8, -h.r - 14, i * 8, -h.r - 4, r, 1);
          wpoly(ctx, [[i * 8 - 4, -h.r - 8], [i * 8, -h.r + 1], [i * 8 + 4, -h.r - 8]], r, 1, false);
        }
      }
      ctx.restore();
    }
  }

  drawTentacleTelegraphs(boil: number) {
    const ctx = this.ctx;
    const b = this.boss;
    if (!b || !isTent(b)) return;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    // lash reticles
    for (const l of b.lashes) {
      if (l.state !== "tele") continue;
      const prog = 1 - l.t / l.tele;
      const locked = l.t <= 0.32;
      const rr = mulberry32(Math.floor(l.x * 7 + l.y) + boil);
      ctx.globalAlpha = locked ? 0.95 : 0.55 + Math.sin(this.time * 18) * 0.15;
      // dotted tentacle path
      ctx.save();
      ctx.setLineDash([3, 9]);
      ctx.lineWidth = 1.6;
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.restore();
      // damage zone
      ctx.lineWidth = locked ? 4 : 2.2;
      if (!locked) ctx.setLineDash([7, 6]);
      wcircle(ctx, l.x, l.y, 46, rr, 2.5, locked ? 3 : 2);
      ctx.setLineDash([]);
      ctx.lineWidth = 1.2;
      hatchCircle(ctx, l.x, l.y, 46 * Math.min(1, prog * 1.1), this.time * 0.6, 6, rr, 0.8);
      // corner brackets that close in
      const br = 46 + (1 - Math.min(1, prog * 1.4)) * 34 + 10;
      ctx.lineWidth = 3;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        const cx = l.x + Math.cos(a) * br;
        const cy = l.y + Math.sin(a) * br;
        wline(ctx, cx, cy, cx - Math.cos(a + 0.9) * 10, cy - Math.sin(a + 0.9) * 10, rr, 0.6);
        wline(ctx, cx, cy, cx - Math.cos(a - 0.9) * 10, cy - Math.sin(a - 0.9) * 10, rr, 0.6);
      }
      ctx.font = `bold 22px "Kelly Slab", serif`;
      ctx.textAlign = "center";
      ctx.fillText(locked ? "СЕЙЧАС!" : "!", l.x, l.y - 62);
    }
    // sweep arm previews + swooshes
    const sw = b.sweep;
    if (sw) {
      const len = sw.len;
      for (let k = 0; k < sw.arms; k++) {
        const ang = sw.angle + (k * TAU) / sw.arms;
        const rr = mulberry32(boil * 3 + k * 11);
        if (!sw.active) {
          ctx.globalAlpha = 0.45 + Math.sin(this.time * 14) * 0.2;
          ctx.setLineDash([9, 8]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(ang) * b.r, b.y + Math.sin(ang) * b.r);
          ctx.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // direction arrow arc
        ctx.globalAlpha = sw.active ? 0.2 : 0.5;
        ctx.lineWidth = 2.4;
        const a0 = ang + sw.dir * 0.12;
        const a1 = ang + sw.dir * 0.85;
        ctx.beginPath();
        ctx.arc(b.x, b.y, len * 0.74, Math.min(a0, a1), Math.max(a0, a1));
        ctx.stroke();
        const ha = a1;
        const hx = b.x + Math.cos(ha) * len * 0.74;
        const hy = b.y + Math.sin(ha) * len * 0.74;
        const tx = -Math.sin(ha) * sw.dir;
        const ty = Math.cos(ha) * sw.dir;
        wline(ctx, hx, hy, hx - tx * 10 + Math.cos(ha) * 7, hy - ty * 10 + Math.sin(ha) * 7, rr, 0.5);
        wline(ctx, hx, hy, hx - tx * 10 - Math.cos(ha) * 7, hy - ty * 10 - Math.sin(ha) * 7, rr, 0.5);
        if (sw.active) {
          // trailing swoosh lines behind the arm
          ctx.globalAlpha = 0.16;
          ctx.lineWidth = 1.6;
          for (const f of [0.95, 0.78, 0.6]) {
            ctx.beginPath();
            const s0 = ang - sw.dir * 0.75;
            const s1 = ang - sw.dir * 0.12;
            ctx.arc(b.x, b.y, len * f, Math.min(s0, s1), Math.max(s0, s1));
            ctx.stroke();
          }
        }
      }
      if (!sw.active) {
        ctx.globalAlpha = 0.9;
        ctx.font = `bold 22px "Kelly Slab", serif`;
        ctx.textAlign = "center";
        ctx.fillText("ОБГОНИ ВИХРЬ ИЛИ РВАНИ РЫВКОМ", W / 2, H - 40);
      }
    }
    ctx.restore();
  }

  drawTentacleBoss(boil: number) {
    const ctx = this.ctx;
    const b = this.boss!;
    const t = this.time;
    const dying = b.state === "dying";
    const trans = b.state === "transition";
    const alpha = dying ? 0.55 + Math.sin(t * 28) * 0.4 : trans ? 0.8 + Math.sin(t * 18) * 0.2 : 1;
    const r = mulberry32(boil * 2 + 17);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;

    // ---- rune circle on the paper ----
    ctx.save();
    ctx.translate(b.x, b.y + 6);
    ctx.globalAlpha = 0.2 * alpha;
    ctx.lineWidth = 2;
    const rr0 = b.r + 74 + Math.sin(t * 1.6) * 3;
    wcircle(ctx, 0, 0, rr0, mulberry32(boil + 5), 2, 1);
    wcircle(ctx, 0, 0, rr0 - 14, mulberry32(boil + 6), 2, 1);
    ctx.rotate(t * 0.25);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const l = i % 3 === 0 ? 14 : 6;
      wline(ctx, Math.cos(a) * (rr0 - 14), Math.sin(a) * (rr0 - 14), Math.cos(a) * (rr0 - 14 + l), Math.sin(a) * (rr0 - 14 + l), r, 0.4);
    }
    ctx.rotate(-t * 0.5);
    if (b.phase >= 1) {
      const star = b.phase >= 2 ? 7 : 5;
      ctx.beginPath();
      for (let i = 0; i <= star; i++) {
        const a = ((i * 2) / star) * Math.PI + (star % 2 ? -Math.PI / 2 : 0);
        const x = Math.cos(a) * (rr0 - 18);
        const y = Math.sin(a) * (rr0 - 18);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // ---- tentacles (back to front by length) ----
    const order = b.tents.map((tt, i) => ({ tt, i })).sort((q, w) => Math.hypot(q.tt.tipX - b.x, q.tt.tipY - b.y) - Math.hypot(w.tt.tipX - b.x, w.tt.tipY - b.y));
    for (const { tt, i } of order) {
      const pts = this.tentPoints(b, tt, 20);
      const n = pts.length;
      const width = (u: number) => b.r * 0.33 * Math.pow(1 - u, 0.85) + 2;
      const normal = (j: number) => {
        const prev = pts[Math.max(0, j - 1)];
        const next = pts[Math.min(n - 1, j + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const l = Math.hypot(dx, dy) || 1;
        return { nx: -dy / l, ny: dx / l };
      };
      // ground shadow
      ctx.save();
      ctx.globalAlpha = 0.14 * alpha;
      ctx.lineWidth = 11;
      ctx.beginPath();
      pts.forEach((q, j) => (j === 0 ? ctx.moveTo(q.x + 5, q.y + 9) : ctx.lineTo(q.x + 5, q.y + 9)));
      ctx.stroke();
      ctx.restore();
      // halftone aura
      ctx.save();
      ctx.fillStyle = INK;
      for (let j = 2; j < (this.quality === 0 ? n - 1 : 0); j += 2) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u);
        const rr = mulberry32(boil * 7 + i * 31 + j);
        for (const sd of [-1, 1]) {
          if (rr() < 0.35) continue;
          const off = w + 5 + rr() * 9;
          ctx.globalAlpha = (0.14 + rr() * 0.28) * alpha;
          ctx.beginPath();
          ctx.arc(pts[j].x + nx * sd * off, pts[j].y + ny * sd * off, 0.8 + rr() * 1.7, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      // body ribbon
      ctx.globalAlpha = alpha;
      ctx.fillStyle = INK;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u);
        if (j === 0) ctx.moveTo(pts[j].x + nx * w, pts[j].y + ny * w);
        else ctx.lineTo(pts[j].x + nx * w, pts[j].y + ny * w);
      }
      const tip = pts[n - 1];
      ctx.lineTo(tip.x + (tip.x - pts[n - 2].x) * 0.8, tip.y + (tip.y - pts[n - 2].y) * 0.8);
      for (let j = n - 1; j >= 0; j--) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u);
        ctx.lineTo(pts[j].x - nx * w, pts[j].y - ny * w);
      }
      ctx.closePath();
      ctx.fill();
      // glossy highlight
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.5 * alpha;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let j = 1; j < n - 3; j++) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u) * 0.42;
        if (j === 1) ctx.moveTo(pts[j].x + nx * w, pts[j].y + ny * w);
        else ctx.lineTo(pts[j].x + nx * w, pts[j].y + ny * w);
      }
      ctx.stroke();
      // ribs
      ctx.globalAlpha = 0.2 * alpha;
      ctx.lineWidth = 1;
      for (let j = 2; j < n - 2; j += 2) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u) * 0.75;
        ctx.beginPath();
        ctx.moveTo(pts[j].x - nx * w, pts[j].y - ny * w);
        ctx.lineTo(pts[j].x + nx * w, pts[j].y + ny * w);
        ctx.stroke();
      }
      // suckers
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PAPER;
      for (let j = 3; j < n - 2; j += 2) {
        const { nx, ny } = normal(j);
        const w = width(pts[j].u);
        const sr = Math.max(1.1, w * 0.26);
        const sx = pts[j].x - nx * w * 0.2;
        const sy = pts[j].y - ny * w * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 0.45, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PAPER;
      }
      // impact flash along the whole arm
      if (tt.glow > 0.02) {
        ctx.strokeStyle = PAPER;
        ctx.globalAlpha = Math.min(0.9, tt.glow * (0.5 + Math.random() * 0.5));
        ctx.lineWidth = 5;
        ctx.beginPath();
        pts.forEach((q, j) => (j === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
      // tip droplet
      ctx.globalAlpha = alpha;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3 + tt.glow * 3, 0, TAU);
      ctx.fill();
    }

    // ---- orbiting ink motes ----
    ctx.save();
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    for (let i = 0; i < 12; i++) {
      const a = t * (0.6 + (i % 3) * 0.12) + (i / 12) * TAU;
      const rad = b.r * 1.5 + 24 + Math.sin(t * 1.7 + i) * 12 + (b.phase * 6);
      const x = b.x + Math.cos(a) * rad;
      const y = b.y + Math.sin(a) * rad * 0.82;
      const sz = 2 + ((i * 7) % 4);
      ctx.globalAlpha = 0.55 * alpha;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, TAU);
      ctx.fill();
      ctx.lineWidth = sz * 0.8;
      ctx.globalAlpha = 0.2 * alpha;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a + Math.PI / 2) * sz * 6, y - Math.sin(a + Math.PI / 2) * sz * 5);
      ctx.stroke();
    }
    ctx.restore();

    // ---- body: glossy ink mass ----
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(b.bob * 2) * 3 - b.hop);
    ctx.globalAlpha = alpha;
    const R = b.r * (1 + Math.sin(t * 2.2) * 0.03);
    const blob = (rad: number) => {
      ctx.beginPath();
      const steps = 44;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * TAU;
        const rr = rad * (1 + 0.07 * Math.sin(a * 3 + t * 1.5) + 0.05 * Math.sin(a * 5 - t * 2.1) + 0.03 * Math.sin(a * 9 + t * 3));
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // halftone halo
    ctx.fillStyle = INK;
    for (let i = 0; i < (this.quality === 0 ? 64 : 0); i++) {
      const a = (i / 64) * TAU + t * 0.1;
      const k = (i % 8) / 8;
      const rad = R * (1.12 + k * 0.5);
      ctx.globalAlpha = (0.32 - k * 0.27) * alpha;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, 1.4 + (1 - k) * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    // mass
    if (b.flash > 0) {
      ctx.fillStyle = PAPER;
      blob(R + 3);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      blob(R);
      ctx.fill();
      // gloss
      ctx.save();
      blob(R);
      ctx.clip();
      ctx.fillStyle = PAPER;
      for (let ring = 0; ring < (this.quality === 0 ? 6 : 2); ring++) {
        const rad = R * (0.2 + ring * 0.14);
        const cnt = 6 + ring * 5;
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * TAU + ring * 0.5;
          const x = -R * 0.28 + Math.cos(a) * rad * 0.9;
          const y = -R * 0.32 + Math.sin(a) * rad * 0.9;
          const d = Math.hypot(x + R * 0.28, y + R * 0.32) / (R * 0.9);
          ctx.globalAlpha = Math.max(0, (0.5 - d * 0.45)) * alpha;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.5, 1.9 - d * 1.2), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = alpha;
      // rim shine
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.9, Math.PI * 1.08, Math.PI * 1.45);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.9, Math.PI * 1.5, Math.PI * 1.58);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      blob(R);
      ctx.stroke();
    }

    // crown of feelers
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      const bx = Math.cos(a) * R * 0.92;
      const by = Math.sin(a) * R * 0.92;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      let cx = bx;
      let cy = by;
      const segs = 6;
      for (let j = 1; j <= segs; j++) {
        const k = j / segs;
        cx = bx + Math.cos(a) * 36 * k + Math.sin(t * 3 + i + k * 4) * 7 * k;
        cy = by + Math.sin(a) * 36 * k + Math.cos(t * 2.6 + i + k * 3) * 5 * k;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, TAU);
      ctx.fill();
    }

    // eye
    const pe = this.player;
    const toP = Math.atan2(pe.y - b.y, pe.x - b.x);
    const dP = Math.min(1, Math.hypot(pe.x - b.x, pe.y - b.y) / 300);
    const eyeR = R * 0.42;
    const active = !!b.sweep || b.lashes.length > 0 || !!b.attack;
    const blinkK = (b.t + 1.7) % 5 < 0.12 ? 0.12 : 1;
    ctx.save();
    ctx.translate(0, -R * 0.08);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeR, eyeR * blinkK * (b.phase >= 1 ? 0.88 : 1), 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    wcircle(ctx, 0, 0, eyeR, mulberry32(boil + 3), 1.1, 2);
    if (blinkK > 0.5) {
      const ix = Math.cos(toP) * eyeR * 0.34 * dP;
      const iy = Math.sin(toP) * eyeR * 0.34 * dP;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ix, iy, eyeR * 0.64, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        ctx.beginPath();
        ctx.moveTo(ix + Math.cos(a) * eyeR * 0.34, iy + Math.sin(a) * eyeR * 0.34);
        ctx.lineTo(ix + Math.cos(a) * eyeR * 0.6, iy + Math.sin(a) * eyeR * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      if (b.phase >= 2 || active) ctx.ellipse(ix, iy, eyeR * 0.1, eyeR * 0.3, 0, 0, TAU);
      else ctx.arc(ix, iy, eyeR * 0.24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      if (b.phase >= 2 || active) ctx.ellipse(ix, iy, eyeR * 0.05, eyeR * 0.22, 0, 0, TAU);
      else ctx.arc(ix, iy, eyeR * 0.13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(ix - eyeR * 0.28, iy - eyeR * 0.3, eyeR * 0.13, 0, TAU);
      ctx.fill();
    }
    // angry brow in paper over the ink
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 4;
    const brow = b.phase >= 1 || active ? 0.5 : 0.18;
    ctx.beginPath();
    ctx.moveTo(-eyeR * 1.15, -eyeR * (1.0 - brow));
    ctx.lineTo(eyeR * 0.1, -eyeR * 1.05);
    ctx.lineTo(eyeR * 1.15, -eyeR * (1.0 - brow) * 0.4);
    ctx.stroke();
    ctx.restore();

    // little eyes
    for (const [ex, ey, er] of [[-R * 0.62, R * 0.1, 5.4], [R * 0.64, R * 0.04, 5.8], [-R * 0.42, R * 0.38, 4], [R * 0.44, R * 0.4, 4.4]] as [number, number, number][]) {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, TAU);
      ctx.fill();
      const ang = Math.atan2(pe.y - (b.y + ey), pe.x - (b.x + ex));
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(ang) * er * 0.35, ey + Math.sin(ang) * er * 0.35, er * 0.5, 0, TAU);
      ctx.fill();
    }

    // zig-zag paper-white teeth
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2.6;
    const open = active ? 9 : 5;
    ctx.beginPath();
    const mw = R * 0.5;
    for (let i = 0; i <= 12; i++) {
      const x = -mw + (i / 12) * mw * 2;
      const y = R * 0.62 + Math.sin((i / 12) * Math.PI) * 4 + (i % 2 ? open : 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    if (b.def.id === "abyss") {
      ctx.save();
      ctx.translate(b.x, b.y - b.hop);
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineCap = "round";
      // crown of torn page edges
      ctx.lineWidth = 6;
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI * 0.5 + (i - 5) * 0.25;
        const L = 26 + (i % 2) * 16 + Math.sin(t * 3 + i) * 3 + b.phase * 5;
        wline(ctx, Math.cos(a) * b.r * 0.94, Math.sin(a) * b.r * 0.94, Math.cos(a) * (b.r * 0.94 + L), Math.sin(a) * (b.r * 0.94 + L), r, 2);
      }
      // broken halo of the last page, spinning
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([16, 12]);
      ctx.lineDashOffset = -t * 40;
      wcircle(ctx, 0, 0, b.r + 40 + Math.sin(t * 2) * 4, r, 3, 1);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // two watchful lesser eyes on the brow
      for (const side of [-1, 1]) {
        const ex = side * b.r * 0.68;
        const ey = -b.r * 0.42;
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(ex, ey, 9, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 2.4;
        wcircle(ctx, ex, ey, 9, r, 1, 1);
        const ang = Math.atan2(this.player.y - (b.y + ey), this.player.x - (b.x + ex));
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex + Math.cos(ang) * 3.4, ey + Math.sin(ang) * 3.4, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // transition / death sparkle
    if (trans || dying) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      burst(ctx, 0, 0, b.r + 8, b.r + 40 + Math.sin(t * 20) * 8, 20, r);
      ctx.restore();
    }
    // wind-up aura when an attack is charging
    if (b.attack && b.telegraph > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.5;
      wcircle(ctx, b.x, b.y, b.r + 14 + Math.sin(t * 24) * 4, r, 3, 2);
      ctx.restore();
    }
    ctx.restore();
  }

  drawBossTelegraph(boil: number) {
    const ctx = this.ctx;
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    ctx.save();
    if (b.telegraph > 0 && b.attack) {
      const prog = 1 - b.telegraph / b.telegraphTotal;
      const r = mulberry32(boil * 3 + 9);
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 26) * 0.25;
      if (b.attack === "laser") {
        const ang = b.lockAngle;
        const locked = b.telegraph < 0.4;
        const len = 1300;
        ctx.globalAlpha = locked ? 0.95 : 0.5;
        ctx.lineWidth = locked ? 4 : 2;
        wline(ctx, b.x, b.y, b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len, r, 3);
        ctx.lineWidth = 1;
        const steps = 30;
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const d = t * 900;
          wline(ctx, b.x + Math.cos(ang) * d - Math.cos(ang + Math.PI / 2) * (locked ? 16 : 10), b.y + Math.sin(ang) * d - Math.sin(ang + Math.PI / 2) * (locked ? 16 : 10),
            b.x + Math.cos(ang) * d + Math.cos(ang + Math.PI / 2) * (locked ? 16 : 10), b.y + Math.sin(ang) * d + Math.sin(ang + Math.PI / 2) * (locked ? 16 : 10), r, 1);
        }
        ctx.font = `bold 26px "Kelly Slab", serif`;
        ctx.textAlign = "center";
        ctx.fillText(locked ? "ЗАФИКСИРОВАНО!" : "ЛУЧ...", b.x + Math.cos(ang) * 130, b.y + Math.sin(ang) * 130 - 22);
      } else if (b.attack === "slam") {
        const locked = b.telegraph < 0.4;
        ctx.lineWidth = locked ? 4 : 2.5;
        ctx.globalAlpha = locked ? 0.95 : 0.55;
        wcircle(ctx, b.targetX, b.targetY, 100, r, 3, locked ? 3 : 2);
        hatchCircle(ctx, b.targetX, b.targetY, 100 * Math.min(1, prog * 1.15), 0.8, 7, r, 1);
        wline(ctx, b.targetX - 24, b.targetY, b.targetX + 24, b.targetY, r, 2);
        wline(ctx, b.targetX, b.targetY - 24, b.targetX, b.targetY + 24, r, 2);
        ctx.font = `bold 24px "Kelly Slab", serif`;
        ctx.textAlign = "center";
        ctx.fillText(locked ? "ПРИЗЕМЛЕНИЕ!" : "БУМ...", b.targetX, b.targetY - 116);
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.targetX, b.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (b.attack === "charge") {
        const ang = b.lockAngle;
        const locked = b.telegraph < 0.38;
        const laneLen = 540 * 0.5 + b.r;
        const half = b.r + 6;
        ctx.globalAlpha = locked ? 0.9 : 0.45;
        ctx.lineWidth = locked ? 3.4 : 2;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        for (const sd of [-1, 1]) {
          wline(ctx, b.x + nx * half * sd, b.y + ny * half * sd, b.x + Math.cos(ang) * laneLen + nx * half * sd, b.y + Math.sin(ang) * laneLen + ny * half * sd, r, 2);
        }
        ctx.lineWidth = 1.2;
        for (let i = 1; i <= 7; i++) {
          const d = (laneLen / 8) * i;
          wline(ctx, b.x + Math.cos(ang) * d - nx * half, b.y + Math.sin(ang) * d - ny * half, b.x + Math.cos(ang) * d + nx * half, b.y + Math.sin(ang) * d + ny * half, r, 1);
        }
        wcircle(ctx, b.x, b.y, b.r + 12 + prog * 8, r, 3, 1);
      } else if (b.attack === "mines") {
        ctx.lineWidth = 2;
        wcircle(ctx, p.x, p.y, 90 + prog * 30, r, 4, 1);
      } else {
        ctx.lineWidth = 2.5;
        wcircle(ctx, b.x, b.y, b.r + 16 + prog * 26, r, 4, 2);
        wcircle(ctx, b.x, b.y, b.r + 6 + prog * 12, r, 3, 1);
      }
    }
    ctx.globalAlpha = 1;
    // active laser beam
    if (b.laser && b.laser.charge > 0.18) {
      const ang = b.laser.angle;
      const len = 1300;
      const x2 = b.x + Math.cos(ang) * len;
      const y2 = b.y + Math.sin(ang) * len;
      const r = mulberry32(boil * 5 + 2);
      const flick = 0.7 + Math.random() * 0.3;
      ctx.globalAlpha = flick;
      ctx.lineWidth = 22;
      lightning(ctx, b.x, b.y, x2, y2, r, 10, 8);
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 10;
      lightning(ctx, b.x, b.y, x2, y2, r, 6, 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      wline(ctx, b.x, b.y, x2, y2, r, 2);
      ctx.globalAlpha = 1;
    }
    // charge squiggles
    if (b.charging > 0) {
      ctx.lineWidth = 2.5;
      const r = mulberry32(boil + 21);
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * TAU;
        const d = b.r + 14 + Math.random() * 26;
        wline(ctx, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, b.x + Math.cos(a) * (d + 20), b.y + Math.sin(a) * (d + 20), r, 3);
      }
    }
    ctx.restore();
  }

  drawQueenTelegraph(boil: number) {
    const b = this.boss;
    if (!b || b.def.id !== "queen") return;
    const ctx = this.ctx;
    const r = mulberry32(boil * 41 + 39);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    if (b.attack === "diagonal" && b.telegraph > 0) {
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const width = b.r * 0.78 + 11;
      const lock = b.telegraph < 0.42;
      ctx.globalAlpha = lock ? 0.78 : 0.4 + Math.sin(this.time * 15) * 0.14;
      ctx.lineWidth = lock ? 4 : 2;
      for (const sign of [-1, 1]) {
        wline(ctx, b.x + nx * width * sign, b.y + ny * width * sign,
          b.targetX + nx * width * sign, b.targetY + ny * width * sign, r, 2);
      }
      ctx.setLineDash([12, 10]);
      wline(ctx, b.x, b.y, b.targetX, b.targetY, r, 1);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 18px "Kelly Slab", serif';
      ctx.textAlign = "center";
      ctx.fillText(lock ? "РЫВОК СЕЙЧАС" : "ДИАГОНАЛЬНЫЙ РАЗГОН", (b.x + b.targetX) / 2, (b.y + b.targetY) / 2 - 38);
    }
    if (b.attack === "slash" && b.telegraph > 0) {
      const angle = b.lockAngle;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      const off = b.targetX * nx + b.targetY * ny;
      const centerX = nx * off;
      const centerY = ny * off;
      const dx = Math.cos(angle) * 1400;
      const dy = Math.sin(angle) * 1400;
      ctx.globalAlpha = b.telegraph < 0.42 ? 0.85 : 0.38 + Math.sin(this.time * 16) * 0.13;
      ctx.lineWidth = b.telegraph < 0.42 ? 4 : 2;
      for (const sign of [-1, 1]) {
        wline(ctx, centerX - dx + nx * 24 * sign, centerY - dy + ny * 24 * sign,
          centerX + dx + nx * 24 * sign, centerY + dy + ny * 24 * sign, r, 2);
      }
      ctx.setLineDash([8, 12]);
      wline(ctx, centerX - dx, centerY - dy, centerX + dx, centerY + dy, r, 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 22px "Kelly Slab", serif';
      ctx.textAlign = "center";
      ctx.fillText(b.telegraph < 0.42 ? "ОТОЙДИ ОТ ЛИНИИ" : "РАЗРЕЗ ГОТОВИТСЯ", W / 2, H - 46);
    }
    if (b.queenSlash) {
      const cut = b.queenSlash;
      const nx = -Math.sin(cut.angle);
      const ny = Math.cos(cut.angle);
      const cx = nx * cut.offset;
      const cy = ny * cut.offset;
      const dx = Math.cos(cut.angle) * 1400;
      const dy = Math.sin(cut.angle) * 1400;
      ctx.globalAlpha = Math.max(0, 1 - cut.t / cut.duration);
      ctx.lineWidth = 26;
      wline(ctx, cx - dx, cy - dy, cx + dx, cy + dy, r, 3);
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 12;
      wline(ctx, cx - dx, cy - dy, cx + dx, cy + dy, r, 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      wline(ctx, cx - dx, cy - dy, cx + dx, cy + dy, r, 2);
    }
    ctx.restore();
  }

  drawQueenFlood(boil: number) {
    const b = this.boss!;
    const ctx = this.ctx;
    const elapsed = 2.6 - b.stateT;
    // Ink floods the sheet, scribbles close around the player, then recedes.
    const alpha = Math.max(0, Math.min(0.93, elapsed < 1.1 ? elapsed * 0.85 : (2.6 - elapsed) * 0.62));
    ctx.save();
    ctx.fillStyle = INK;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2.2;
    const r = mulberry32(boil + 561);
    for (let i = 0; i < 25; i++) {
      const y = (i * 53 + this.time * 42) % H;
      const x = (i * 149) % W;
      wline(ctx, x - 90, y - 18, x + 100, y + 20, r, 8);
    }
    ctx.globalAlpha = Math.min(1, alpha * 1.4);
    ctx.fillStyle = PAPER;
    ctx.textAlign = "center";
    ctx.font = 'bold 35px "Kelly Slab", serif';
    ctx.fillText("ЧЕРНИЛА ОЖИВАЮТ", W / 2, H / 2 + 94);
    ctx.restore();
  }

  drawQueenBoss(boil: number) {
    const b = this.boss!;
    const ctx = this.ctx;
    const r = mulberry32(boil + 331);
    const t = this.time;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(t * 5) * 4);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    const dark = b.phase === 2;
    const flap = Math.sin(t * (dark ? 22 : 28)) * 0.24;
    // Paper wings become ink blades after the transformation.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(flap * side);
      ctx.fillStyle = dark ? INK : PAPER;
      ctx.lineWidth = dark ? 3 : 2.5;
      ctx.beginPath();
      ctx.moveTo(9, -14);
      ctx.lineTo(58, -52);
      ctx.lineTo(52, -15);
      ctx.lineTo(76, 1);
      ctx.lineTo(26, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = dark ? PAPER : INK;
      ctx.globalAlpha = dark ? 0.7 : 0.45;
      for (let i = 0; i < 4; i++) wline(ctx, 18, -9, 45 + i * 5, -40 + i * 12, r, 1);
      ctx.restore();
    }
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (dark) {
      // Ink monster: four long scissor arms, jagged scribble halo and orbiting shards.
      for (let i = 0; i < 4; i++) {
        const a = t * (i % 2 ? -0.9 : 0.9) + i * TAU / 4;
        const len = 56 + Math.sin(t * 3 + i) * 13;
        const x = Math.cos(a) * len;
        const y = Math.sin(a) * len;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 19, Math.sin(a) * 19);
        ctx.quadraticCurveTo(Math.cos(a + 0.35) * 42, Math.sin(a + 0.35) * 42, x, y);
        ctx.stroke();
        wpoly(ctx, [[x - 7, y - 3], [x + Math.cos(a) * 21, y + Math.sin(a) * 21], [x + 7, y + 3]], r, 2);
      }
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) wcircle(ctx, 0, 0, 50 + i * 9 + Math.sin(t * 5 + i) * 3, r, 3, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
      wcircle(ctx, 0, 0, 43, r, 3, 2);
      ctx.beginPath();
      ctx.arc(0, 0, 39, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 22; i++) {
        const a = i * 2.4 + t * 0.7;
        const rad = 10 + (i % 4) * 7;
        wline(ctx, Math.cos(a) * rad, Math.sin(a) * rad, Math.cos(a + 0.35) * (rad + 13), Math.sin(a + 0.35) * (rad + 13), r, 1.5);
      }
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, -6, 15, 19, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(Math.cos(b.angle) * 5, -6 + Math.sin(b.angle) * 5, 5, 13, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 3;
      wpoly(ctx, [[-17, 22], [-9, 30], [-4, 23], [2, 30], [8, 23], [16, 30], [21, 20]], r, 2, false);
    } else {
      // Phase one: striped, crowned bee, easy to read against the paper.
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, 3, 28, 37, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      wcircle(ctx, 0, 0, 30, r, 2, 2);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 3, 27, 35, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = INK;
      for (let y = 0; y < 36; y += 12) ctx.fillRect(-30, y, 60, 6);
      ctx.restore();
      ctx.fillStyle = INK;
      ctx.lineWidth = 3;
      wpoly(ctx, [[-17, -27], [-16, -52], [-7, -36], [0, -56], [7, -36], [16, -52], [17, -27]], r, 1.5, false);
      ctx.fillStyle = PAPER;
      for (const sx of [-10, 10]) {
        ctx.beginPath();
        ctx.ellipse(sx, -10, 5, 7, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(b.angle) * 2, -10 + Math.sin(b.angle) * 2, 2.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PAPER;
      }
      wpoly(ctx, [[-8, 37], [0, 54], [8, 37]], r, 1, false);
    }
    if (b.flash > 0) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 5;
      wcircle(ctx, 0, 0, b.r + 5, r, 2, 1);
    }
    ctx.restore();
  }

  drawMechaBoss(boil: number) {
    const b = this.boss!; const ctx = this.ctx; const t = this.time;
    const phase = b.phase; const giant = phase > 0;
    const palette = phase === 2 ? ["#00f5ff", "#ff35d3", "#ffe600"] : phase >= 3 ? ["#7cff54", "#ff4545", "#565cff"] : ["#27313d", "#b8c4ce", "#f4f1e8"];
    ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 3) * (giant ? 3 : 7)); ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (!giant) {
      ctx.rotate(t * 2.8); ctx.fillStyle = palette[0]; ctx.strokeStyle = palette[1]; ctx.lineWidth = 4;
      for (let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*16,Math.sin(a)*16);ctx.lineTo(Math.cos(a)*43,Math.sin(a)*43);ctx.lineTo(Math.cos(a+.16)*16,Math.sin(a+.16)*16);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.beginPath();ctx.arc(0,0,25,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,7,0,TAU);ctx.fill();
    } else {
      ctx.fillStyle=palette[0];ctx.strokeStyle=palette[1];ctx.lineWidth=5;
      for(const side of [-1,1]){ctx.save();ctx.translate(side*76,-5);ctx.fillRect(-26,-58,52,104);ctx.strokeRect(-26,-58,52,104);ctx.fillStyle=palette[2];for(let k=0;k<3;k++)ctx.fillRect(-18+k*13,-48,8,31);ctx.fillStyle=palette[0];ctx.fillRect(-17,44,34,74);ctx.strokeRect(-17,44,34,74);ctx.restore();}
      ctx.beginPath();ctx.moveTo(-65,-58);ctx.lineTo(-44,-104);ctx.lineTo(44,-104);ctx.lineTo(65,-58);ctx.lineTo(55,57);ctx.lineTo(-55,57);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=palette[1];ctx.fillRect(-38,-48,76,38);ctx.strokeRect(-38,-48,76,38);ctx.fillStyle="#fff";ctx.fillRect(-21,-37,13,9);ctx.fillRect(8,-37,13,9);
      ctx.fillStyle=palette[2];ctx.fillRect(-18,8,36,12);
      for(let k=0;k<4;k++){ctx.fillRect(-103+k*14,-91,9,30);ctx.fillRect(83+k*7,-30,6,30);}
      ctx.fillStyle=palette[1];ctx.fillRect(69,7,69,34);ctx.strokeRect(69,7,69,34);ctx.fillStyle="#10131a";ctx.fillRect(127,14,20,20);
      if(phase>=2){ctx.globalAlpha=.7;ctx.strokeStyle=palette[2];ctx.lineWidth=3;for(let k=0;k<5;k++){ctx.beginPath();ctx.arc(0,0,112+k*9+t*3%8,0,TAU);ctx.stroke();}}
    }
    if (phase === 4) {
      // Final phase: the arena becomes a floating desktop notebook window.
      ctx.save(); ctx.translate(0, 154); ctx.fillStyle="#f4f0e5";ctx.strokeStyle="#141414";ctx.lineWidth=4;
      ctx.fillRect(-150,-55,300,112);ctx.strokeRect(-150,-55,300,112);ctx.fillStyle="#27313d";ctx.fillRect(-150,-55,300,18);
      ctx.fillStyle="#fff";ctx.font='bold 10px monospace';ctx.fillText("NOTEPAD.EXE  —  FINAL BATTLE", -136, -43);
      ctx.fillStyle="#171717";ctx.font='12px monospace';ctx.fillText("> boss.exe is still running", -136, -16);ctx.fillText("> do not close this window_", -136, 4);
      ctx.restore();
    }

  }

    drawBoss(boil: number) {
    if (this.boss && isTent(this.boss)) {
      this.drawTentacleBoss(boil);
      return;
    }
    if (this.boss && this.boss.def.id === "queen") {
      this.drawQueenBoss(boil);
      return;
    }
    if (this.boss && this.boss.def.id === "mecha") {
      this.drawMechaBoss(boil);
      return;
    }
    const b = this.boss!;
    if (b.def.id === "eye" || b.def.id === "bombhead") {
      const o = { t: this.time, px: this.player.x, py: this.player.y, lod: this.quality, boil };
      if (b.def.id === "eye") drawEyeBoss(this.ctx, b, o, boil);
      else drawBombBoss(this.ctx, b, o, boil);
      return;
    }
    const fn = this.BOSS_ART[b.def.id];
    if (fn) fn.call(this, boil, b);
  }

  /** shared boss framing: shadow, aura rings, phase halo, damage flash */
  bossFrame(boil: number, b: BossState) {
    const ctx = this.ctx;
    const t = this.time;
    const r = mulberry32(boil * 2 + 17);
    const dying = b.state === "dying";
    const trans = b.state === "transition";
    const alpha = dying ? 0.6 + Math.sin(t * 28) * 0.35 : trans ? 0.8 + Math.sin(t * 18) * 0.2 : 1;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(b.bob * 2) * 3);
    if (b.squash) {
      ctx.translate(0, b.r * 0.62 * b.squash);
      ctx.scale(1 + b.squash * 0.6, 1 - b.squash * 0.92);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.globalAlpha = alpha * 0.22;
    ctx.beginPath();
    ctx.ellipse(4, b.r * 0.74, b.r * 0.96, b.r * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (b.phase >= 1) {
      ctx.save();
      ctx.globalAlpha = alpha * (0.22 + b.phase * 0.14);
      ctx.lineWidth = 2;
      for (let i = 0; i < b.phase + 1; i++) {
        wcircle(ctx, 0, 0, b.r + 16 + i * 10 + Math.sin(t * 3 + i) * 3, mulberry32(boil + i * 4), 3, 1);
      }
      ctx.restore();
    }
    return { ctx, b, t, r, alpha, dying, trans };
  }

  bossFinish(frame: ReturnType<Game["bossFrame"]>) {
    const { ctx, b, t, r, alpha, dying, trans } = frame;
    if (trans || dying) {
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = 3;
      burst(ctx, 0, 0, b.r + 6, b.r + 28 + Math.sin(t * 20) * 8, 18, r);
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) wcircle(ctx, 0, 0, b.r + 12 + i * 8, mulberry32(Math.floor(t * 20) + i), 4, 1);
      ctx.globalAlpha = alpha;
    }
    if (b.flash > 0) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 5;
      wcircle(ctx, 0, 0, b.r + 4, r, 2, 1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = INK;
    }
    ctx.restore();
  }

  /** glossy ink blob body used by several bosses */
  inkBody(ctx: CanvasRenderingContext2D, R: number, t: number, rings = 5) {
    if (this.quality > 0) rings = 2;
    ctx.fillStyle = INK;
    ctx.beginPath();
    const steps = 46;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const rr = R * (1 + 0.06 * Math.sin(a * 3 + t * 1.4) + 0.04 * Math.sin(a * 5 - t * 2) + 0.02 * Math.sin(a * 8 + t));
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    // halftone gloss in the upper-left, paper rim light at the bottom
    ctx.fillStyle = PAPER;
    for (let ring = 0; ring < rings; ring++) {
      const rad = R * (0.18 + ring * 0.15);
      const cnt = 8 + ring * 6;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.6;
        const x = -R * 0.3 + Math.cos(a) * rad * 0.85;
        const y = -R * 0.34 + Math.sin(a) * rad * 0.85;
        const d = Math.hypot(x + R * 0.3, y + R * 0.34) / (R * 0.92);
        ctx.globalAlpha = Math.max(0, 0.46 - d * 0.42);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.4, 1.8 - d * 1.1), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.88, Math.PI * 1.06, Math.PI * 1.42);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
  }

  /** slow orbiting ink motes, gives every boss a living aura */
  inkMotes(ctx: CanvasRenderingContext2D, t: number, R: number, count: number, alpha: number) {
    count = this.quality === 0 ? count : this.quality === 1 ? Math.ceil(count / 2) : 0;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    for (let i = 0; i < count; i++) {
      const a = t * (0.5 + (i % 3) * 0.14) + (i / count) * TAU;
      const rad = R * 1.35 + 20 + Math.sin(t * 1.6 + i) * 13;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad * 0.8;
      const sz = 1.8 + ((i * 5) % 4);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.18 * alpha;
      ctx.lineWidth = sz * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a + Math.PI / 2) * sz * 7, y - Math.sin(a + Math.PI / 2) * sz * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** pupil that tracks the player with a paper highlight */
  bossEye(ctx: CanvasRenderingContext2D, r: Rand, x: number, y: number, R: number, boil: number, angry = false) {
    const px = this.player.x;
    const py = this.player.y;
    const b = this.boss!;
    const a = Math.atan2(py - (b.y + y), px - (b.x + x));
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    wcircle(ctx, x, y, R, r, 1, 2);
    const ix = x + Math.cos(a) * R * 0.3;
    const iy = y + Math.sin(a) * R * 0.3;
    ctx.fillStyle = INK;
    ctx.beginPath();
    if (angry) ctx.ellipse(ix, iy, R * 0.34, R * 0.5, a, 0, TAU);
    else ctx.arc(ix, iy, R * 0.52, 0, TAU);
    ctx.fill();
    // iris spikes
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.2;
    const spikes = angry ? 20 : 12;
    for (let i = 0; i < spikes; i++) {
      const sa = (i / spikes) * TAU;
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(sa) * R * 0.34, iy + Math.sin(sa) * R * 0.34);
      ctx.lineTo(ix + Math.cos(sa) * R * 0.62, iy + Math.sin(sa) * R * 0.62);
      ctx.stroke();
    }
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(ix - R * 0.3, iy - R * 0.32, R * 0.15, 0, TAU);
    ctx.fill();
    void boil;
  }

  BOSS_ART: Record<string, (this: Game, boil: number, b: BossState) => void> = {
    matriarch: function (this: Game, boil: number, b: BossState) {
      const f = this.bossFrame(boil, b);
      const { ctx, t, r, alpha } = f;
      const R = b.r;
      // crown of dripping ink tendrils that sway
      ctx.strokeStyle = INK;
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const sway = Math.sin(t * 2 + i) * 0.16;
        const L = R * (0.6 + 0.5 * Math.abs(Math.sin(i * 1.7)));
        ctx.lineWidth = 7 - (i % 3) * 1.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
        ctx.quadraticCurveTo(
          Math.cos(a + sway) * (R + L * 0.6),
          Math.sin(a + sway) * (R + L * 0.6),
          Math.cos(a + sway * 1.8) * (R + L),
          Math.sin(a + sway * 1.8) * (R + L),
        );
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(Math.cos(a + sway * 1.8) * (R + L), Math.sin(a + sway * 1.8) * (R + L), 3.6, 0, TAU);
        ctx.fill();
      }
      this.inkMotes(ctx, t, R, 14, alpha);
      this.inkBody(ctx, R * 0.94, t, 4);
      // cracked porcelain mask with a weeping mouth
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.1, R * 0.5, R * 0.58, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.8;
      wcircle(ctx, 0, -R * 0.1, R * 0.5, r, 1.4, 2);
      // crack lines across the mask
      ctx.lineWidth = 1.5;
      for (const [sx, sy, ea] of [[-R * 0.3, -R * 0.42, 0.6], [R * 0.2, -R * 0.45, -0.9], [0, -R * 0.55, 0.1]] as [number, number, number][]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(ea + k * 0.5) * R * 0.3, sy + Math.sin(ea + k * 0.5) * R * 0.3);
          ctx.stroke();
        }
      }
      this.bossEye(ctx, r, -R * 0.18, -R * 0.2, R * 0.13, boil, b.phase >= 1);
      this.bossEye(ctx, r, R * 0.2, -R * 0.2, R * 0.11, boil, b.phase >= 1);
      // weeping mouth with ink dripping out
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.2, R * 0.2, R * 0.13 * (1 + Math.sin(t * 3) * 0.2), 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.6;
      for (let i = -2; i <= 2; i++) wline(ctx, i * R * 0.07, R * 0.12, i * R * 0.07, R * 0.3, r, 1);
      // drips falling
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * R * 0.16;
        const dy = R * 0.32 + ((t * 40 + i * 30) % 46);
        wline(ctx, dx, R * 0.3, dx, dy, r, 1);
        ctx.beginPath();
        ctx.arc(dx, dy + 3, 2.4, 0, TAU);
        ctx.fill();
      }
      this.bossFinish(f);
    },

    octopus: function (this: Game, boil: number, b: BossState) {
      // The original hand-drawn octopus: eight looping arms, big round head, two huge eyes.
      const f = this.bossFrame(boil, b);
      const { ctx, t, r } = f;
      const paintBody = (draw: () => void) => {
        if (b.flash > 0) {
          ctx.beginPath();
          ctx.arc(0, 0, b.r + 3, 0, TAU);
          ctx.fill();
          return;
        }
        ctx.fillStyle = PAPER;
        draw();
        ctx.fillStyle = INK;
      };
      ctx.lineWidth = 4;
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.sin(t * 1.6 + i) * 0.18;
        const rr = b.r * 0.85;
        const x1 = Math.cos(a) * rr;
        const y1 = Math.sin(a) * rr * 0.8;
        const mx = Math.cos(a) * (rr + 34) + Math.sin(t * 4 + i) * 12;
        const my = Math.sin(a) * (rr + 34) + Math.cos(t * 3 + i) * 12;
        const x2 = Math.cos(a) * (rr + 44);
        const y2 = Math.sin(a) * (rr + 62) + 14;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
        wcircle(ctx, x2, y2, 3.5, r, 1.2, 1);
        if (i % 2 === 0) {
          ctx.lineWidth = 1;
          for (let s2 = 1; s2 < 4; s2++) wcircle(ctx, x1 + (x2 - x1) * (s2 / 4), y1 + (y2 - y1) * (s2 / 4), 2, r, 1, 1);
          ctx.lineWidth = 4;
        }
      }
      paintBody(() => {
        ctx.beginPath();
        ctx.arc(0, -4, b.r * 0.88, 0, TAU);
        ctx.fill();
      });
      ctx.lineWidth = 4;
      wcircle(ctx, 0, -4, b.r * 0.88, r, 3, 3);
      ctx.lineWidth = 1.5;
      hatchCircle(ctx, 0, 8, b.r * 0.7, 1, 7, r, 1.2);
      // big eyes
      for (const side of [-1, 1]) {
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.ellipse(side * 20, -14, 13, 16, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.lineWidth = 2.5;
        wcircle(ctx, side * 20, -14, 13, r, 1.5, 2);
        ctx.fillRect(side * 20 - 4, -18, 8, 10);
      }
      ctx.lineWidth = 2;
      wpoly(ctx, [[-9, 12], [0, 22], [9, 12]], r, 1.2, false);
      this.bossFinish(f);
    },

    king: function (this: Game, boil: number, b: BossState) {
      const f = this.bossFrame(boil, b);
      const { ctx, t, r, alpha } = f;
      const R = b.r;
      // royal mantle: nine arms with barbed tips
      ctx.strokeStyle = INK;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + Math.sin(t * 1.1 + i) * 0.2;
        const L = R * (1.2 + 0.55 * Math.abs(Math.sin(i * 2.1 + t * 0.5)));
        const sway = Math.sin(t * 2 + i * 0.9) * 0.4;
        const bx = Math.cos(a) * R * 0.9;
        const by = Math.sin(a) * R * 0.9;
        const tipX = Math.cos(a + sway) * (R + L);
        const tipY = Math.sin(a + sway) * (R + L);
        ctx.lineCap = "round";
        for (const pass of [0, 1]) {
          ctx.lineWidth = pass ? 11 : 5;
          ctx.globalAlpha = pass ? alpha : alpha * 0.2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(Math.cos(a) * (R + L * 0.6) + Math.sin(t * 3 + i) * 16, Math.sin(a) * (R + L * 0.6), tipX, tipY);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        // barbs along the arm
        ctx.lineWidth = 2.4;
        for (let k = 1; k <= 3; k++) {
          const u = 0.35 + k * 0.2;
          const px = bx + (tipX - bx) * u;
          const py = by + (tipY - by) * u;
          const pa = Math.atan2(tipY - by, tipX - bx);
          for (const s of [-1, 1]) {
            wline(ctx, px, py, px + Math.cos(pa + s * 1.1) * 10, py + Math.sin(pa + s * 1.1) * 10, r, 1);
          }
        }
      }
      this.inkMotes(ctx, t, R, 22, alpha);
      this.inkBody(ctx, R * 0.96, t, 6);
      // crown with jewels that light up per phase
      ctx.strokeStyle = INK;
      ctx.fillStyle = PAPER;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-R * 0.62, -R * 0.78);
      ctx.lineTo(-R * 0.56, -R * 1.5);
      ctx.lineTo(-R * 0.24, -R * 1.0);
      ctx.lineTo(0, -R * 1.68);
      ctx.lineTo(R * 0.24, -R * 1.0);
      ctx.lineTo(R * 0.56, -R * 1.5);
      ctx.lineTo(R * 0.62, -R * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i <= b.phase; i++) {
        const jx = -R * 0.4 + i * R * 0.4;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(jx, -R * 0.92, 4.4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        burst(ctx, jx, -R * 0.92, 5, 12, 8, r, t * 3 + i);
      }
      // trio of eyes + maw
      this.bossEye(ctx, r, -R * 0.32, -R * 0.32, R * 0.14, boil, true);
      this.bossEye(ctx, r, R * 0.34, -R * 0.36, R * 0.13, boil, true);
      this.bossEye(ctx, r, 0, -R * 0.6, R * 0.1, boil, true);
      this.bossEye(ctx, r, -R * 0.62, R * 0.04, R * 0.08, boil, true);
      this.bossEye(ctx, r, R * 0.64, R * 0.08, R * 0.09, boil, true);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.3, R * 0.46, R * 0.24 * (1 + Math.sin(t * 4) * 0.15), 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      wcircle(ctx, 0, R * 0.3, R * 0.24, r, 2, 1);
      ctx.lineWidth = 2.4;
      for (let i = -3; i <= 3; i++) {
        const h = (i % 2 ? 1 : 0.7) * R * 0.14;
        wline(ctx, i * R * 0.11, R * 0.16, i * R * 0.11, R * 0.16 + h, r, 1);
        wline(ctx, i * R * 0.11, R * 0.44, i * R * 0.11, R * 0.44 - h * 0.8, r, 1);
      }
      this.bossFinish(f);
    },
  };

  drawBossBanner(boil: number) {
    const W = this.limitX;
    const ctx = this.ctx;
    const b = this.boss;
    const a = Math.min(1, this.bossBanner);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.6);
    // letterbox
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, 66);
    ctx.fillRect(0, H - 66, W, 66);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 3;
    wline(ctx, 0, 66, W, 64, mulberry32(boil), 3);
    wline(ctx, 0, H - 66, W, H - 64, mulberry32(boil + 1), 3);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 24px "Kelly Slab", serif`;
    ctx.fillText("◆ БОСС ◆", W / 2, 32);
    const scale = 1 + Math.max(0, 0.3 - (3 - this.bossBanner)) * 0.4;
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    ctx.rotate(-0.03);
    ctx.scale(scale, scale);
    ctx.font = `bold 70px "Kelly Slab", serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = PAPER;
    ctx.strokeText(b?.def.name || "", 0, 0);
    ctx.fillText(b?.def.name || "", 0, 0);
    ctx.restore();
    ctx.font = `26px "Caveat", cursive`;
    ctx.fillText(b ? `${b.def.title}` : "", W / 2, H / 2 + 32);
    if (b) {
      ctx.font = `22px "Caveat", cursive`;
      ctx.fillText(`фазы: ${(b.def.id === "queen" ? [b.def.phaseNames[0], b.def.phaseNames[2]] : b.def.phaseNames).join("  →  ")}`, W / 2, H / 2 + 66);
      ctx.font = `19px "Caveat", cursive`;
      ctx.fillText(`✎ ${b.def.tip}`, W / 2, H - 102);
      // small boss head preview
      ctx.font = `40px "Caveat", cursive`;
      ctx.fillText("☠", W / 2 - 280, H / 2 - 10);
      ctx.fillText("☠", W / 2 + 280, H / 2 - 10);
    }
    // radial speed lines
    const r = mulberry32(boil * 3 + 5);
    ctx.globalAlpha = 0.16 * a;
    ctx.lineWidth = 2;
    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * TAU + Math.sin(i) * 0.1;
      const inner = 180 + (i % 4) * 26;
      const outer = 470;
      wline(ctx, W / 2 + Math.cos(ang) * inner, H / 2 + Math.sin(ang) * inner, W / 2 + Math.cos(ang) * outer, H / 2 + Math.sin(ang) * outer, r, 3);
    }
    ctx.restore();
  }

  drawHUD(boil: number) {
    const W = this.limitX;
    const ctx = this.ctx;
    const p = this.player;
    const r = mulberry32(4242 + boil);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 2.2;

    // hearts
    for (let i = 0; i < p.maxHp; i++) wheart(ctx, 44 + i * 26, 44, 10, r, i < p.hp);
    // combo
    if (this.combo > 1) {
      const pop = 1 + this.comboPop * 0.5;
      ctx.save();
      ctx.translate(48, 88);
      ctx.rotate(-0.06);
      ctx.scale(pop, pop);
      ctx.font = `bold 32px "Kelly Slab", serif`;
      ctx.fillText(`x${this.combo}`, 0, 0);
      ctx.font = `20px "Caveat", cursive`;
      ctx.fillText("КОМБО", 58, 2);
      ctx.restore();
      ctx.lineWidth = 2;
      wrect(ctx, 38, 100, 130, 5, r, 1);
      ctx.fillRect(39, 101, 128 * Math.max(0, this.comboTimer / 2.6), 3);
    }
    // dash meter
    ctx.font = `18px "Caveat", cursive`;
    ctx.fillText("РЫВОК", 38, 132);
    ctx.lineWidth = 2;
    wrect(ctx, 100, 121, 78, 12, r, 1);
    const dashFill = 1 - p.dashCd / 0.8;
    ctx.fillRect(102, 123, 74 * Math.max(0, dashFill), 8);
    ctx.font = `14px "Caveat", cursive`;
    ctx.fillText("ПРОБЕЛ", 38, 150);

    // score + timer
    const rec = this.progress[this.levelIndex];
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `bold 34px "Kelly Slab", serif`;
    ctx.fillText(`${this.score}`, W - 38, 42);
    ctx.font = `20px "Caveat", cursive`;
    ctx.fillText("очки", W - 38, 66);
    ctx.font = `16px "Caveat", cursive`;
    const mm = Math.floor(this.levelTime / 60);
    const ss = Math.floor(this.levelTime % 60);
    ctx.fillText(`время ${mm}:${ss.toString().padStart(2, "0")}`, W - 38, 88);
    if (rec?.best) ctx.fillText(`рекорд ${rec.best}`, W - 38, 108);
    if (this.endless) {
      ctx.font = `bold 20px "Kelly Slab", serif`;
      ctx.fillText(`∞ лучшая волна ${this.meta.bestEndless}`, W - 38, 130);
    }
    // Rank is shown only in the level summary, so waves stay uncluttered.

    // level + wave pips
    const remaining = this.enemies.length + this.spawnQueue.length + (this.bossPending ? 1 : 0) + (this.boss ? 1 : 0);
    ctx.textAlign = "center";
    ctx.font = `bold 25px "Kelly Slab", serif`;
    ctx.fillText(this.endless ? `∞ ${this.level.name}` : `УРОВЕНЬ ${this.level.id} · ${this.level.name}`, W / 2, 38);
    const waves = this.endless ? 6 : this.level.waves;
    const pipW = 26;
    const startX = W / 2 - (waves * pipW) / 2;
    ctx.lineWidth = 2;
    for (let i = 0; i < waves; i++) {
      const x = startX + i * pipW;
      wrect(ctx, x, 52, 20, 10, mulberry32(boil + i * 3), 1.2);
      let full = false;
      let part = 0;
      if (this.endless) {
        const pos = Math.max(0, this.wave - 1) % 6;
        if (i < pos) full = true;
        else if (i === pos) {
          const total = Math.max(1, this.waveTotal);
          part = 1 - Math.min(1, remaining / total);
        }
      } else if (i < this.wave - 1) full = true;
      else if (i === this.wave - 1) {
        const total = Math.max(1, this.waveTotal);
        part = 1 - Math.min(1, remaining / total);
      }
      if (full) ctx.fillRect(x + 1, 53, 18, 8);
      else if (part > 0) ctx.fillRect(x + 1, 53, 18 * part, 8);
    }
    ctx.font = `19px "Caveat", cursive`;
    ctx.fillText(`волна ${Math.max(1, this.wave)}/${waves}  ·  кляксы: ${remaining}`, W / 2, 76);
    if (this.bossPending && !this.boss) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 8) * 0.35;
      ctx.font = `bold 24px "Kelly Slab", serif`;
      ctx.fillText(`☠ БОСС: ${BOSSES[this.level.boss].name} — ПРИБЛИЖАЕТСЯ`, W / 2, 150);
      ctx.restore();
    }

    // boss bar
    const boss = this.boss;
    if (boss && boss.state !== "finale") {
      const bx = W / 2 - 210;
      const by = 92;
      ctx.lineWidth = 2.5;
      wrect(ctx, bx, by, 420, 22, r, 2);
      // phase segmentation
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 2, by + 2, 416 * Math.max(0, boss.hp / boss.maxHp), 18);
      ctx.clip();
      for (let i = 0; i < 70; i++) {
        const h = 12 + Math.sin(i * 1.7 + boil) * 6;
        wline(ctx, bx + 2 + i * 6, by + 2 + 9 - h / 2, bx + 2 + i * 6, by + 2 + 9 + h / 2, mulberry32(i + boil), 1.4);
      }
      ctx.restore();
      ctx.lineWidth = 2;
      const phaseCount = boss.def.id === "queen" ? 2 : 3;
      for (let i = 1; i < phaseCount; i++) wline(ctx, bx + (420 * i) / phaseCount, by, bx + (420 * i) / phaseCount, by + 22, r, 1.5);
      ctx.font = `bold 25px "Kelly Slab", serif`;
      ctx.fillText(boss.def.name, W / 2, by - 12);
      ctx.font = `17px "Caveat", cursive`;
      ctx.fillText(boss.def.title + ` · ${boss.def.phaseNames[boss.phase]}`, W / 2, by + 38);
      for (let i = 0; i < phaseCount; i++) {
        const px = W / 2 - ((phaseCount - 1) * 26) / 2 + i * 26;
        ctx.lineWidth = 2;
        wcircle(ctx, px, by + 56, 5, mulberry32(boil + i), 1, 1);
        if (i <= (boss.def.id === "queen" ? (boss.phase === 2 ? 1 : 0) : boss.phase)) ctx.fillRect(px - 3, by + 53, 6, 6);
      }
      if (boss.attack) {
        const labels: Record<string, string> = {
          ring: "КРУГОВОЙ ЗАЛП!",
          spiral: "СПИРАЛЬ!",
          aimed: "ПРИЦЕЛ!",
          rain: "ЧЕРНИЛЬНЫЙ ДОЖДЬ!",
          summon: "ЗОВ СВИТЫ!",
          slam: "УДАР!",
          laser: "ЛУЧ!",
          charge: "РЫВОК!",
          mines: "МИНЫ!",
          diagonal: "ДИАГОНАЛЬНЫЙ ТАРАН!",
          slash: "РАЗРЕЗ ПОЛЯ!",
        };
        ctx.font = `bold 22px "Kelly Slab", serif`;
        const pulse = 0.65 + Math.sin(this.time * 22) * 0.35;
        ctx.globalAlpha = pulse;
        ctx.fillText(labels[boss.attack] || SPECIAL_LABELS[boss.attack] || "!", W / 2, by + 84);
        ctx.globalAlpha = 1;
      }
    }

    // weapon slots
    const owned = this.ownedWeapons();
    owned.forEach((w, i) => {
      const x = 48 + i * 70;
      const y = H - 64;
      const active = p.weapon === w;
      ctx.lineWidth = active ? 3 : 1.5;
      if (active) {
        ctx.save();
        ctx.fillStyle = "rgba(26,26,26,0.1)";
        wrect(ctx, x - 26, y - 24, 58, 44, r, 1.5);
        ctx.fill();
        ctx.restore();
      }
      wrect(ctx, x - 24, y - 22, 54, 40, mulberry32(boil + i), 1.5);
      ctx.font = `16px "Caveat", cursive`;
      ctx.textAlign = "center";
      ctx.fillText(`${WEAPON_ORDER.indexOf(w) + 1}`, x - 17, y - 12);
      ctx.font = `bold 22px "Kelly Slab", serif`;
      const def = WEAPONS[w];
      ctx.fillText(def.short, x + 2, y - 2);
      ctx.font = `16px "Caveat", cursive`;
      ctx.fillText(this.isInfinite(w) ? "∞" : `${this.ammo[w]}`, x + 2, y + 14);
      if (w === this.level.weapon) {
        ctx.font = `12px "Caveat", cursive`;
        ctx.fillText("уровень", x + 2, y + 28);
      }
    });

    // ult bar
    const bx = W / 2 - 130;
    const by = H - 52;
    ctx.lineWidth = 2.4;
    ctx.textAlign = "center";
    ctx.font = `20px "Caveat", cursive`;
    ctx.fillText(this.ult >= 100 ? "E — ЧЕРНИЛЬНЫЙ ВЗРЫВ!" : "ЧЕРНИЛЬНЫЙ ВЗРЫВ", W / 2, by - 10);
    wrect(ctx, bx, by, 260, 16, r, 2);
    if (this.ult >= 100) {
      const pulse = 0.75 + Math.sin(this.time * 10) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 2, by + 2, 256, 12);
      ctx.clip();
      for (let i = 0; i < 40; i++) wline(ctx, bx + i * 7, by + 2, bx + i * 7, by + 14, r, 1.4);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + 2, by + 2, 256 * (this.ult / 100), 12);
      ctx.clip();
      for (let i = 0; i < 40; i++) wline(ctx, bx + i * 7, by + 2, bx + i * 7, by + 14, r, 1);
      ctx.restore();
    }
    ctx.font = `15px "Caveat", cursive`;
    ctx.fillText(`${Math.floor(this.ult)}%`, W / 2, by + 34);

    // frenzy meter
    if (this.frenzy > 0.02) {
      ctx.textAlign = "left";
      ctx.font = `bold 17px "Kelly Slab", serif`;
      ctx.fillText(this.frenzyOn ? "ЯРОСТЬ ЧЕРНИЛ!" : "я-р-о-с-т-ь...", 38, 176);
      ctx.lineWidth = 2;
      wrect(ctx, 150, 164, 92, 13, r, 1.4);
      if (this.frenzyOn) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(152, 166, 88, 9);
        ctx.clip();
        for (let i = 0; i < 20; i++) wline(ctx, 152 + i * 5, 165, 152 + i * 5, 176, mulberry32(i + boil), 1.2);
        ctx.restore();
      } else {
        ctx.fillRect(152, 166, 88 * this.frenzy, 9);
      }
    }

    // collected perks (compact chips)
    {
      const short: Record<PerkId, string> = {
        trigger: "курок",
        multishot: "обводка",
        pierce: "промокашка",
        crit: "штрих",
        heart: "сердце",
        vampire: "слизь",
        dash: "рывок-бум",
        boots: "кеды",
        magnet: "липкость",
        inkwell: "чернильница",
        ricochet: "рикошет",
        homing: "живое чернило",
        shield: "щит",
        orbit: "спутники",
        explosive: "шипучка",
        regen: "подорожник",
        luck: "везение",
        slowfield: "вязкость",
        nova: "всплеск",
        bigshot: "толстое перо",
        dashcd: "лёгкие ноги",
      };
      const ids = Object.keys(this.perks) as PerkId[];
      ctx.textAlign = "left";
      ctx.font = `16px "Caveat", cursive`;
      ctx.globalAlpha = 0.85;
      ids.slice(0, 6).forEach((id, i) => {
        const y = 204 + i * 21;
        ctx.lineWidth = 1.6;
        wrect(ctx, 36, y - 14, 158, 19, r, 1.2);
        ctx.fillText(`${short[id]} ×${this.perks[id]}`, 42, y);
      });
      if (ids.length > 6) ctx.fillText(`…и ещё ${ids.length - 6}`, 42, 204 + 6 * 21);
      ctx.globalAlpha = 1;
    }

    // low health
    if (p.hp <= 2) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.time * 5) * 0.1;
      ctx.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        wline(ctx, 22 + i * 8, 26, 10 + i * 8, 92, r, 2);
        wline(ctx, W - 22 - i * 8, H - 26, W - 10 - i * 8, H - 92, r, 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.font = `bold 26px "Kelly Slab", serif`;
      ctx.fillStyle = INK;
      ctx.fillText("ДЕРЖИСЬ!", W / 2, H - 92);
    }
    if (this.slow > 0) {
      ctx.font = `bold 32px "Kelly Slab", serif`;
      ctx.fillText("ЧЕРНИЛЬНЫЙ ВЗРЫВ!", W / 2, 150);
    }
    ctx.restore();
  }

  drawCrosshair(boil: number) {
    const ctx = this.ctx;
    const r = mulberry32(boil * 3 + 1);
    const { x, y } = this.mouse;
    const spread = 11 + this.player.recoil * 9;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    wcircle(ctx, x, y, spread, r, 1.5, 1);
    wline(ctx, x - spread - 7, y, x - spread + 3, y, r, 1);
    wline(ctx, x + spread - 3, y, x + spread + 7, y, r, 1);
    wline(ctx, x, y - spread - 7, x, y - spread + 3, r, 1);
    wline(ctx, x, y + spread - 3, x, y + spread + 7, r, 1);
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, TAU);
    ctx.fill();
    if (this.ult >= 100) {
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 8) * 0.3;
      wcircle(ctx, x, y, spread + 7, r, 1, 1);
    }
    ctx.restore();
  }

  drawObstacle(o: Obstacle, boil: number) {
    const ctx = this.ctx;
    const r = mulberry32(o.seed * 100 + boil);
    ctx.lineWidth = 2.5;
    const pts: [number, number][] = [];
    const rr = mulberry32(o.seed);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rad = o.r * (0.85 + rr() * 0.25);
      pts.push([o.x + Math.cos(a) * rad, o.y + Math.sin(a) * rad]);
    }
    wpoly(ctx, pts, r, 2);
    ctx.lineWidth = 1.2;
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.closePath();
    ctx.clip();
    ctx.translate(o.x, o.y);
    ctx.rotate(0.7);
    for (let d = -o.r; d <= o.r; d += 7) {
      if (d < -o.r * 0.1) continue;
      wline(ctx, -o.r, d, o.r, d, r, 1);
    }
    ctx.restore();
    ctx.lineWidth = 1.5;
    wline(ctx, o.x - o.r * 0.3, o.y - o.r * 0.4, o.x + o.r * 0.1, o.y - o.r * 0.05, r, 2);
    wline(ctx, o.x + o.r * 0.1, o.y - o.r * 0.05, o.x + o.r * 0.35, o.y + o.r * 0.1, r, 2);
  }

  drawPickup(pk: Pickup, boil: number) {
    const ctx = this.ctx;
    const r = mulberry32(pk.id * 77 + boil);
    const bob = Math.sin(this.time * 4 + pk.id) * 3;
    const y = pk.y + bob;
    if (pk.life < 3 && Math.floor(this.time * 8) % 2 === 0) return;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(pk.x, pk.y + 17, 11, 3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    if (pk.kind === "heart") {
      ctx.lineWidth = 2.5;
      wheart(ctx, pk.x, y, 13, r, true);
      return;
    }
    wcircle(ctx, pk.x, y, 16, r, 1.5, 2);
    ctx.font = `bold 15px "Kelly Slab", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(WEAPONS[pk.kind].short, pk.x, y + 1);
    ctx.font = `bold 12px "Kelly Slab", serif`;
    ctx.fillText(`+${WEAPONS[pk.kind].pickup}`, pk.x, y + 25);
  }

  drawGhost(g: Ghost, boil: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = (g.life / 0.25) * 0.4;
    ctx.translate(g.x, g.y);
    ctx.strokeStyle = INK;
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.player.r, 0, TAU);
    ctx.fill();
    wcircle(ctx, 0, 0, this.player.r, mulberry32(boil), 1.5, 1);
    ctx.rotate(g.angle);
    wline(ctx, 10, 0, 30, 0, mulberry32(boil + 1), 1);
    ctx.restore();
  }

  drawPlayer(boil: number, p = this.player) {
    const ctx = this.ctx;
    if (!p.active) return;
    if (p.down) {
      this.drawDowned(boil, p);
      return;
    }
    const r = mulberry32(999 + boil);
    const t = this.time;
    const rank = this.rankIndex;
    const a = p.angle;
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const qx = -fy;
    const qy = fx;
    const speed = Math.hypot(p.svx, p.svy);
    const hurt = p.flash > 0;
    const worried = this.player.hp <= 2;
    const angry = this.frenzyOn || this.combo >= 15;
    const blinking = p.invuln > 0 && this.status === "playing" && Math.floor(t * 16) % 2 === 0;
    const alpha = blinking ? 0.4 : 1;
    const dashing = p.dashTime > 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // soft ground shadow
    ctx.globalAlpha = 0.22 * alpha;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(3, 8, p.r + 3, p.r - 3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // legendary glow + frenzy flames
    if (rank >= 11) {
      ctx.save();
      ctx.globalAlpha = 0.35 * alpha;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 6]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath();
      ctx.arc(0, 0, 25 + Math.sin(t * 3) * 1.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (this.frenzyOn) {
      ctx.save();
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      burst(ctx, 0, 0, 20, 31 + Math.sin(t * 20) * 4, 9, r, t * 2);
      ctx.restore();
    }

    // squash & stretch
    const breathe = 1 + Math.sin(t * 3.2) * 0.025;
    ctx.scale(breathe, 2 - breathe);
    if (dashing) {
      ctx.rotate(p.dashAngle);
      ctx.scale(1.38, 0.76);
      ctx.rotate(-p.dashAngle);
    } else if (speed > 40) {
      const ma = Math.atan2(p.svy, p.svx);
      const st = Math.min(0.12, speed / 2600);
      ctx.rotate(ma);
      ctx.scale(1 + st, 1 - st);
      ctx.rotate(-ma);
    }

    // ---- scarf: two ribbons streaming opposite to motion ----
    {
      const flow = speed > 25 ? Math.atan2(-p.svy, -p.svx) : a + Math.PI + Math.sin(t * 1.4) * 0.25;
      const len = 5 + Math.min(speed, 260) * 0.03 + (rank >= 5 ? 2 : 0);
      for (const side of [-1, 1]) {
        const pts: [number, number][] = [];
        const wid: number[] = [];
        const ox = -fx * 4 + qx * side * 5;
        const oy = -fy * 4 + qy * side * 5;
        for (let i = 0; i <= 8; i++) {
          const k = i / 8;
          const ang = flow + side * 0.28 * k;
          const dist = 5 + k * (len * 3.6);
          const wav = Math.sin(t * 10 - i * 0.95 + side) * (1.2 + i * 0.75);
          const pxx = ox + Math.cos(ang) * dist + Math.cos(ang + Math.PI / 2) * wav;
          const pyy = oy + Math.sin(ang) * dist + Math.sin(ang + Math.PI / 2) * wav;
          pts.push([pxx, pyy]);
          wid.push(4.2 * (1 - k * 0.85) + 0.6);
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(pts.length - 1, i + 1)];
          const tx = next[0] - prev[0];
          const ty = next[1] - prev[1];
          const tl = Math.hypot(tx, ty) || 1;
          const x = pts[i][0] - (ty / tl) * wid[i];
          const y = pts[i][1] + (tx / tl) * wid[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(pts.length - 1, i + 1)];
          const tx = next[0] - prev[0];
          const ty = next[1] - prev[1];
          const tl = Math.hypot(tx, ty) || 1;
          ctx.lineTo(pts[i][0] + (ty / tl) * wid[i], pts[i][1] - (tx / tl) * wid[i]);
        }
        ctx.closePath();
        ctx.fill();
        // paper stripes on the ribbon
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 1.2;
        for (let i = 2; i < pts.length - 1; i += 2) {
          ctx.beginPath();
          ctx.arc(pts[i][0], pts[i][1], 0.9, 0, TAU);
          ctx.stroke();
        }
      }
    }

    // ---- quill feather tail ----
    {
      const qa = a + Math.PI + 0.55 + Math.sin(t * 2.2) * 0.12 + Math.sin(t * 9) * Math.min(0.2, speed / 900);
      const qLen = 25;
      const sx0 = -fx * 8;
      const sy0 = -fy * 8;
      const ex = sx0 + Math.cos(qa) * qLen;
      const ey = sy0 + Math.sin(qa) * qLen;
      const nx = -Math.sin(qa);
      const ny = Math.cos(qa);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx0 + Math.cos(qa) * 5, sy0 + Math.sin(qa) * 5);
      ctx.quadraticCurveTo(sx0 + Math.cos(qa) * 13 + nx * 8, sy0 + Math.sin(qa) * 13 + ny * 8, ex, ey);
      ctx.quadraticCurveTo(sx0 + Math.cos(qa) * 12 - nx * 6, sy0 + Math.sin(qa) * 12 - ny * 6, sx0 + Math.cos(qa) * 5, sy0 + Math.sin(qa) * 5);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const k = 0.2 + i * 0.13;
        const cx = sx0 + Math.cos(qa) * qLen * k;
        const cy = sy0 + Math.sin(qa) * qLen * k;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + nx * 5 * (1 - k * 0.6) + Math.cos(qa) * 3, cy + ny * 5 * (1 - k * 0.6) + Math.sin(qa) * 3);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      wline(ctx, sx0, sy0, ex, ey, r, 0.6);
    }

    // ---- boots ----
    {
      const step = p.moving > 0 ? Math.sin(t * 17) * 5.5 : 0;
      ctx.fillStyle = INK;
      for (const side of [-1, 1]) {
        const bx = qx * side * 6.5 + fx * step * side;
        const by = qy * side * 6.5 + fy * step * side;
        ctx.save();
        ctx.translate(bx + fx * 3, by + fy * 3);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.2, 3.4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    // ---- body ----
    ctx.fillStyle = hurt ? INK : PAPER;
    ctx.beginPath();
    ctx.arc(0, 0, p.r - 1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    wcircle(ctx, 0, 0, p.r - 1, r, 1.2, 2);
    // crescent shading on the back side
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, p.r - 2, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = 0.16 * alpha;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-fx * 9, -fy * 9, p.r + 1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6 * alpha;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    for (let i = -3; i <= 3; i++) {
      wline(ctx, -fx * 3 + qx * i * 4.2 - fx * 10, -fy * 3 + qy * i * 4.2 - fy * 10, -fx * 3 + qx * i * 4.2 - fx * 2, -fy * 3 + qy * i * 4.2 - fy * 2, r, 0.5);
    }
    ctx.restore();
    ctx.globalAlpha = alpha;
    // belt + ink-drop emblem
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    wline(ctx, qx * -12 - fx * 3, qy * -12 - fy * 3, qx * 12 - fx * 3, qy * 12 - fy * 3, r, 0.8);
    ctx.fillStyle = hurt ? PAPER : INK;
    ctx.beginPath();
    ctx.arc(-fx * 6 + qx * 0, -fy * 6, 2.6, 0, TAU);
    ctx.fill();

    // ---- arms + gun (rotated frame) ----
    ctx.save();
    ctx.rotate(a);
    const rec = -p.recoil * 5;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    wline(ctx, 3, -10, 15 + rec, -4.5, r, 0.8);
    wline(ctx, 3, 10, 15 + rec, 4.5, r, 0.8);
    ctx.fillStyle = INK;
    const gl = p.weapon === "shotgun" ? 28 : p.weapon === "smg" ? 24 : p.weapon === "rail" ? 38 : p.weapon === "rocket" ? 30 : 18;
    ctx.beginPath();
    ctx.rect(12 + rec, -3, gl, 6);
    ctx.fill();
    if (p.weapon === "smg") ctx.fillRect(16 + rec, 3, 6, 9);
    if (p.weapon === "pistol") {
      ctx.fillStyle = PAPER;
      ctx.fillRect(15 + rec, -1, gl - 8, 1.4);
      ctx.fillStyle = INK;
      // pen nib tip
      ctx.beginPath();
      ctx.moveTo(12 + rec + gl, -3);
      ctx.lineTo(12 + rec + gl + 6, 0);
      ctx.lineTo(12 + rec + gl, 3);
      ctx.closePath();
      ctx.fill();
    }
    if (p.weapon === "shotgun") {
      ctx.fillStyle = PAPER;
      ctx.fillRect(14 + rec, -1, gl - 4, 1.5);
      ctx.fillStyle = INK;
    }
    if (p.weapon === "rail") {
      ctx.fillRect(20 + rec, -7, 10, 3);
      ctx.fillRect(36 + rec, -4, 5, 8);
    }
    if (p.weapon === "rocket") {
      ctx.save();
      ctx.translate(12 + rec + gl, 0);
      wpoly(ctx, [[0, -4], [8, 0], [0, 4]], r, 1);
      ctx.restore();
    }
    // hands
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    for (const sy of [-4.5, 4.5]) {
      ctx.beginPath();
      ctx.arc(15 + rec, sy, 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // ---- head ----
    const hx = fx * 2.8;
    const hy = fy * 2.8;
    ctx.fillStyle = hurt ? INK : PAPER;
    ctx.beginPath();
    ctx.arc(hx, hy, 10.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    wcircle(ctx, hx, hy, 10.6, r, 0.9, 2);

    // pen-nib cap over the back half of the head
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(hx, hy, 10.8, a + Math.PI / 2 + 0.15, a + (3 * Math.PI) / 2 - 0.15);
    ctx.quadraticCurveTo(hx - fx * 17, hy - fy * 17, hx + qx * 10.8 * -1, hy + qy * 10.8 * -1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx - fx * 8.5, hy - fy * 8.5, 2.2, 0, TAU);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // bandana (rank 3+)
    if (rank >= 2) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      wline(ctx, hx + qx * -10 + fx * 1.2, hy + qy * -10 + fy * 1.2, hx + qx * 10 + fx * 1.2, hy + qy * 10 + fy * 1.2, r, 0.5);
      ctx.lineWidth = 2.2;
      const kn = Math.sin(t * 9) * 3;
      wline(ctx, hx + qx * 9, hy + qy * 9, hx + qx * 15 - fx * 6 + kn, hy + qy * 15 - fy * 6, r, 0.5);
      wline(ctx, hx - qx * 9, hy - qy * 9, hx - qx * 15 - fx * 6 - kn, hy - qy * 15 - fy * 6, r, 0.5);
    }

    // face: eyes look where you aim
    const blinkPhase = (t * 0.9 + 0.3) % 4.2;
    const blink = blinkPhase < 0.1 ? 0.12 : 1;
    const ex = hx + fx * 4.4;
    const ey = hy + fy * 4.4;
    ctx.fillStyle = hurt ? PAPER : INK;
    ctx.strokeStyle = hurt ? PAPER : INK;
    for (const side of [-1, 1]) {
      const cx = ex + qx * side * 4.3;
      const cy = ey + qy * side * 4.3;
      if (hurt) {
        ctx.lineWidth = 1.8;
        wline(ctx, cx - 2, cy - 2, cx + 2, cy + 2, r, 0.3);
        wline(ctx, cx + 2, cy - 2, cx - 2, cy + 2, r, 0.3);
      } else {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.scale(1, blink);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.5, 3.1, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(0.9, -1, 0.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.restore();
      }
      if (!hurt && (angry || worried)) {
        ctx.lineWidth = 1.8;
        const tilt = angry ? -1 : 1;
        wline(ctx, cx - qx * 3 * side + fx * 0, cy - qy * 3 * side - 4.6 * (angry ? 0.6 : 1), cx + qx * 2.6 * side, cy + qy * 2.6 * side - 4.6 + tilt * 1.4, r, 0.3);
      }
    }
    // mouth
    {
      const mx = hx + fx * 8.2;
      const my = hy + fy * 8.2;
      ctx.strokeStyle = hurt ? PAPER : INK;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      if (hurt || worried) {
        ctx.ellipse(mx, my, 1.8, 2.2, a, 0, TAU);
      } else if (angry) {
        ctx.moveTo(mx + qx * -3, my + qy * -3);
        ctx.lineTo(mx + qx * 3, my + qy * 3);
        ctx.moveTo(mx + qx * -2, my + qy * -2 + 1);
        ctx.lineTo(mx + qx * 2, my + qy * 2 + 1);
      } else {
        ctx.arc(mx - fx * 2.4, my - fy * 2.4, 3.1, a - 0.9, a + 0.9);
      }
      ctx.stroke();
    }
    // cheeks
    if (!hurt) {
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.5 * alpha;
      ctx.lineWidth = 1;
      for (const side of [-1, 1]) {
        const cx = hx + fx * 5 + qx * side * 8;
        const cy = hy + fy * 5 + qy * side * 8;
        wline(ctx, cx - 1.5, cy - 1, cx + 0.5, cy + 1, r, 0.2);
        wline(ctx, cx, cy - 1, cx + 2, cy + 1, r, 0.2);
      }
      ctx.globalAlpha = alpha;
    }
    // sweat drop when hurt badly
    if (worried && !hurt) {
      ctx.fillStyle = INK;
      const dy = (t * 14) % 6;
      ctx.beginPath();
      ctx.moveTo(hx + 12, hy - 11 + dy);
      ctx.quadraticCurveTo(hx + 15, hy - 6 + dy, hx + 12, hy - 4 + dy);
      ctx.quadraticCurveTo(hx + 9, hy - 6 + dy, hx + 12, hy - 11 + dy);
      ctx.fill();
    }

    // crown (rank 9+)
    if (rank >= 8) {
      ctx.save();
      ctx.translate(hx, hy - 16 + Math.sin(t * 3) * 1.2);
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(-9, -5);
      ctx.lineTo(-4, -1);
      ctx.lineTo(0, -8);
      ctx.lineTo(4, -1);
      ctx.lineTo(9, -5);
      ctx.lineTo(8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      for (const sx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.arc(sx, 2, 1.1, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // dash: speed streaks
    if (dashing) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 5; i++) {
        const o = (i - 2) * 6;
        const dx = Math.cos(p.dashAngle);
        const dy = Math.sin(p.dashAngle);
        wline(ctx, -dx * 18 - dy * o, -dy * 18 + dx * o, -dx * (36 + i * 4) - dy * o, -dy * (36 + i * 4) + dx * o, r, 1);
      }
      ctx.globalAlpha = alpha;
    }

    // muzzle flash: starburst with ink drops
    if (p.muzzle > 0) {
      ctx.save();
      ctx.rotate(a);
      const gl2 = p.weapon === "shotgun" ? 28 : p.weapon === "smg" ? 24 : p.weapon === "rail" ? 38 : p.weapon === "rocket" ? 30 : 18;
      const big = p.weapon === "shotgun" || p.weapon === "rocket" || p.weapon === "rail";
      const mx = 14 + gl2 + 5 - p.recoil * 5;
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = 2.5;
      burst(ctx, mx, 0, 4, big ? 30 : 19, big ? 13 : 8, r);
      ctx.beginPath();
      ctx.arc(mx, 0, big ? 7 : 4.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(mx, 0, big ? 3 : 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawEnemy(e: Enemy, boil: number) {
    drawMonster(this.ctx, e, { t: this.time, px: this.player.x, py: this.player.y, lod: this.quality, boil });
  }
}


