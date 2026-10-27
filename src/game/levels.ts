export type WeaponId = "pistol" | "shotgun" | "smg" | "rail" | "rocket";

export type EnemyKind =
  | "blob"
  | "fly"
  | "spiky"
  | "brute"
  | "shooter"
  | "zipper"
  | "splitter"
  | "bomber"
  | "sniper"
  | "shield"
  | "ghost"
  | "boss";

export type BossId = "abyss" | "tentacle" | "matriarch" | "queen" | "octopus" | "eye" | "bombhead" | "king";

export type AttackKind =
  | "lash" | "lash3" | "sweep" | "diagonal" | "slash" | "ring" | "spiral" | "aimed" | "rain" | "summon"
  | "slam" | "laser" | "charge" | "mines"
  | "garden" | "hive" | "xslash" | "octoray" | "darkness" | "gaze" | "blink"
  | "chain" | "overheat" | "lanes" | "decree" | "crown" | "eggs" | "vortex" | "bomblets"
  | "tidal" | "squeeze" | "meteor";

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  hp: number;
  r: number;
  /** attack sets for the three phases */
  phases: [AttackKind[], AttackKind[], AttackKind[]];
  phaseNames: [string, string, string];
  intro: string;
  tip: string;
  /** attack tempo multiplier (lower = faster) */
  pace?: number;
}

export const BOSSES: Record<BossId, BossDef> = {
  abyss: {
    id: "abyss",
    name: "ИСТИННЫЙ ВЛАДЫКА",
    title: "то, что ждало за последней страницей",
    hp: 980,
    r: 54,
    pace: 0.8,
    phases: [
      ["lash", "garden", "aimed", "sweep", "vortex", "ring"],
      ["lash3", "octoray", "xslash", "chain", "bomblets", "tidal", "summon", "laser"],
      ["garden", "decree", "gaze", "lanes", "squeeze", "meteor", "darkness", "blink", "lash3", "sweep", "spiral"],
    ],
    phaseNames: ["ОБОРВАННАЯ СТРАНИЦА", "ЧЁРНАЯ ПУСТОТА", "КОНЕЦ ТЕТРАДИ"],
    intro: "Страница оборвана. Осталась только левая половина.",
    tip: "Весь лист — арена, а справа пустота. «Стена» сдвигает край, «волна» всегда оставляет проход. Подкрепление лезет из пустоты.",
  },
  tentacle: {
    id: "tentacle",
    name: "ВЛАДЫКА ЩУПАЛЕЦ",
    title: "чернильная бездна тянется к тебе",
    hp: 90,
    r: 44,
    phases: [
      ["lash", "aimed", "sweep"],
      ["lash3", "garden", "sweep", "summon"],
      ["garden", "lash3", "sweep", "garden", "ring"],
    ],
    phaseNames: ["ПРОБУЖДЕНИЕ", "САД ЩУПАЛЕЦ", "БЕСКОНЕЧНЫЕ ЩУПАЛЬЦА"],
    intro: "Из кляксы выросло что-то очень длинное...",
    tip: "Хлыст бьёт туда, где ты стоял. «Сад» — щупальца вырастают кольцом: ищи просвет. Лужи чернил замедляют.",
  },
  matriarch: {
    id: "matriarch",
    name: "КЛЯКСА-МАТЬ",
    title: "родоначальница всех помарок",
    hp: 100,
    r: 46,
    phases: [
      ["slam", "eggs", "aimed"],
      ["vortex", "slam", "eggs", "ring"],
      ["vortex", "eggs", "rain", "slam", "summon"],
    ],
    phaseNames: ["РАСПОЛЗАЕТСЯ", "КЛАДКА И ВОРОНКА", "МАТЬ В ЯРОСТИ"],
    intro: "Из-под страницы что-то лезет...",
    tip: "Яйца лопаются от пуль — не дай им вылупиться. Воронка тянет к боссу: беги от неё, а не к ней.",
  },
  queen: {
    id: "queen",
    name: "КОРОЛЕВА РОЯ",
    title: "жужжащий кошмар промокашки",
    hp: 130,
    r: 42,
    phases: [
      ["diagonal", "hive", "aimed", "diagonal"],
      ["slash", "xslash", "hive"],
      ["slash", "xslash", "hive", "diagonal", "slash"],
    ],
    phaseNames: ["РАЗГОН", "ЧЕРНИЛЬНОЕ ПЕРЕРОЖДЕНИЕ", "РАЗРЕЗЫ ПОЛЯ"],
    intro: "Диагональный разгон ломает края листа. Смотри на линию предупреждения.",
    tip: "Рывок идёт по очерченной диагонали. В улье встань в белую соту с галочкой. Крест-накрест режет лист на четыре сектора.",
  },
  octopus: {
    id: "octopus",
    name: "ЧЕРНИЛЬНЫЙ СПРУТ",
    title: "восемь щупалец, ноль жалости",
    hp: 175,
    r: 44,
    phases: [
      ["laser", "aimed", "slam"],
      ["octoray", "laser", "darkness", "summon"],
      ["darkness", "octoray", "rain", "laser", "ring"],
    ],
    phaseNames: ["ПРОБУЖДАЕТСЯ", "ВЕЕР ЛУЧЕЙ", "ГЛУБИННАЯ ТЬМА"],
    intro: "Из кляксы вылезли щупальца...",
    tip: "Лучи вращаются веером: двигайся по кругу вслед за ними. Во тьме виден лишь круг света, но опасные зоны подсвечены.",
  },
  eye: {
    id: "eye",
    name: "ВСЕВИДЯЩЕЕ ОКО",
    title: "оно видит твои ошибки",
    hp: 220,
    r: 46,
    phases: [
      ["gaze", "ring", "mines"],
      ["blink", "gaze", "laser", "aimed"],
      ["gaze", "blink", "ring", "laser", "rain"],
    ],
    phaseNames: ["ОТКРЫЛОСЬ", "МОРГАЕТ", "ПРОЗРЕЛО"],
    intro: "На тебя смотрит весь лист.",
    tip: "Конус взгляда жжёт, пока ты в нём. Камни отбрасывают тень — прячься. Моргнув, глаз перепрыгивает и стреляет веером.",
  },
  bombhead: {
    id: "bombhead",
    name: "ГОЛОВА-БОМБА",
    title: "фитиль уже тлеет",
    hp: 260,
    r: 50,
    phases: [
      ["chain", "bomblets", "slam"],
      ["lanes", "bomblets", "chain", "overheat"],
      ["overheat", "lanes", "bomblets", "chain", "charge", "rain"],
    ],
    phaseNames: ["ФИТИЛЬ ТЛЕЕТ", "ПОДЖОГ", "ВЗРЫВНОЙ ФИНАЛ"],
    intro: "Слышишь шипение? Беги.",
    tip: "Бомбы рвутся по цепочке — беги против хода. Прилетевшая бомба всегда падает в размеченный круг: уходи до вспышки. При перегреве выбеги за круг.",
  },
  king: {
    id: "king",
    name: "КОЛЬ КЛЯКС",
    title: "король всех помарок",
    hp: 420,
    r: 58,
    phases: [
      ["decree", "crown", "summon", "ring"],
      ["crown", "decree", "laser", "charge"],
      ["decree", "crown", "lanes", "laser", "rain", "mines"],
    ],
    phaseNames: ["КОРОНА ПРОСНУЛАСЬ", "ГНЕВ КОРОЛЯ", "ПОСЛЕДНЯЯ КЛЯКСА"],
    intro: "Он правил этой тетрадью. Пока.",
    tip: "«СТОЙ!» — отпусти клавиши, «ДВИГАЙСЯ!» — не стой. Корона летит и возвращается: сойди с её пути.",
  },
};

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  /** weapon handed out for this level — unlimited ammo while you play it */
  weapon: WeaponId;
  weaponNote: string;
  waves: number;
  /** base difficulty offset, affects enemy hp/speed */
  diff: number;
  /** enemies per wave (grows a bit each wave) */
  base: number;
  perWave: number;
  pool: Partial<Record<EnemyKind, number>>;
  /** unique boss that closes the level after the last wave */
  boss: BossId;
  obstacles: [number, number, number][];
  tip: string;
  parTime: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "ПЕРВЫЙ ЛИСТ",
    subtitle: "Клякса расползлась по тетради",
    weapon: "pistol",
    weaponNote: "Ручка-пистолет · бесконечные чернила",
    waves: 3,
    diff: 0,
    base: 8,
    perWave: 4,
    pool: { blob: 10, spiky: 4 },
    boss: "tentacle",
    obstacles: [
      [168, 150, 27],
      [792, 448, 27],
      [800, 146, 20],
    ],
    tip: "WASD — бег, ЛКМ — стрелять. ПРОБЕЛ — рывок сквозь врагов.",
    parTime: 70,
  },
  {
    id: 2,
    name: "РОЙ ПОМАРОК",
    subtitle: "Мелюзга лезет отовсюду",
    weapon: "shotgun",
    weaponNote: "Дробовик · 8 дробин одним росчерком",
    waves: 4,
    diff: 1,
    base: 12,
    perWave: 6,
    pool: { blob: 7, fly: 9, spiky: 6, ghost: 2 },
    boss: "queen",
    obstacles: [
      [170, 140, 24],
      [790, 140, 24],
      [170, 462, 24],
      [790, 462, 24],
    ],
    tip: "Дробовик рвёт толпу в упор — подпускай мошкару ближе.",
    parTime: 95,
  },
  {
    id: 3,
    name: "ЛИНОВАННЫЙ ТИР",
    subtitle: "Кляксы научились стрелять",
    weapon: "smg",
    weaponNote: "Автомат · шквал мелких капель",
    waves: 4,
    diff: 2,
    base: 14,
    perWave: 7,
    pool: { blob: 5, fly: 6, spiky: 5, shooter: 7, zipper: 5, ghost: 3 },
    boss: "octopus",
    obstacles: [
      [182, 294, 22],
      [354, 112, 23],
      [354, 488, 23],
      [606, 112, 23],
      [606, 488, 23],
      [778, 294, 22],
    ],
    tip: "Щитоносцев обходи с фланга — в лоб щит звенит. Призраки мигают: лови момент.",
    parTime: 110,
  },
  {
    id: 4,
    name: "ОХОТА НА СТРЕЛКОВ",
    subtitle: "Снайперы-карандаши держат тебя на мушке",
    weapon: "rail",
    weaponNote: "Рельса · луч прошивает всех насквозь",
    waves: 5,
    diff: 3,
    base: 14,
    perWave: 6,
    pool: { fly: 5, spiky: 5, shooter: 6, sniper: 6, splitter: 5, zipper: 5, shield: 5, ghost: 5 },
    boss: "eye",
    obstacles: [
      [200, 134, 25],
      [760, 466, 25],
      [480, 86, 20],
      [480, 514, 20],
    ],
    tip: "Рельса игнорирует щиты и призраков. Выстраивай врагов в линию.",
    parTime: 140,
  },
  {
    id: 5,
    name: "ТЯЖЁЛЫЕ ПЯТНА",
    subtitle: "Громилы и бомберы идут напролом",
    weapon: "rocket",
    weaponNote: "РПГ · взрыв на пол-листа",
    waves: 5,
    diff: 4,
    base: 15,
    perWave: 7,
    pool: { blob: 4, brute: 7, bomber: 7, splitter: 6, shooter: 5, zipper: 5, shield: 5, ghost: 4 },
    boss: "bombhead",
    obstacles: [
      [188, 152, 28],
      [772, 448, 28],
      [188, 448, 28],
      [772, 152, 28],
    ],
    tip: "Ракеты бьют по площади — но не стреляй себе под ноги.",
    parTime: 160,
  },
  {
    id: 6,
    name: "ЧЕРНИЛЬНЫЙ ФИНАЛ",
    subtitle: "Вся тетрадь против тебя",
    weapon: "smg",
    weaponNote: "Весь арсенал в руках · 1–5 для смены",
    waves: 5,
    diff: 5,
    base: 15,
    perWave: 6,
    pool: {
      blob: 4,
      fly: 6,
      spiky: 5,
      brute: 5,
      shooter: 6,
      zipper: 6,
      splitter: 5,
      bomber: 6,
      sniper: 5,
      shield: 5,
      ghost: 5,
    },
    boss: "king",
    obstacles: [
      [160, 136, 23],
      [800, 464, 23],
      [800, 136, 23],
      [160, 464, 23],
      [480, 90, 20],
    ],
    tip: "Финал: все стволы разом. Копи «Чернильный взрыв» на боссов.",
    parTime: 230,
  },
];

/** The sheet that never ends — unlocked by clearing the campaign. */
export const ENDLESS: LevelDef = {
  id: 7,
  name: "БЕСКОНЕЧНЫЙ ЛИСТ",
  subtitle: "Кляксы не кончаются. Ты — тоже.",
  weapon: "smg",
  weaponNote: "Весь арсенал · босс каждые 4 волны",
  waves: 999,
  diff: 9,
  base: 16,
  perWave: 8,
  pool: {
    blob: 4,
    fly: 6,
    spiky: 5,
    brute: 4,
    shooter: 5,
    zipper: 5,
    splitter: 5,
    bomber: 5,
    sniper: 4,
    shield: 5,
    ghost: 5,
  },
  boss: "king",
  obstacles: [
    [200, 160, 34],
    [760, 440, 34],
    [760, 160, 34],
    [200, 440, 34],
    [480, 94, 20],
    [480, 506, 20],
  ],
  tip: "После каждой волны — новая карточка-перк. Боссы приходят каждые 4 волны.",
  parTime: 0,
};

export interface LevelRecord {
  cleared: boolean;
  stars: number;
  best: number;
}

const KEY = "ink-arena-campaign-v1";

export function loadProgress(): LevelRecord[] {
  const empty = LEVELS.map(() => ({ cleared: false, stars: 0, best: 0 }));
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as LevelRecord[];
    return empty.map((d, i) => ({ ...d, ...(parsed[i] || {}) }));
  } catch {
    return empty;
  }
}

export function saveProgress(p: LevelRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function isUnlocked(progress: LevelRecord[], index: number, freePlay = false) {
  if (freePlay) return true;
  return index === 0 || !!progress[index - 1]?.cleared;
}
