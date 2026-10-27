// Sticker album — collectible hand-drawn achievements.
export type StickerId =
  | "first_blood"
  | "combo20"
  | "boss_first"
  | "boss_all"
  | "no_damage"
  | "perfection"
  | "collector"
  | "rail_ace"
  | "endless5"
  | "endless12"
  | "veteran"
  | "victory";

export interface StickerDef {
  id: StickerId;
  name: string;
  hint: string;
}

export const STICKERS: StickerDef[] = [
  { id: "first_blood", name: "ПЕРВАЯ КЛЯКСА", hint: "Прихлопни первого врага" },
  { id: "combo20", name: "СЕРИЯ X20", hint: "Собери комбо из 20 клякс" },
  { id: "boss_first", name: "ТУШИТЕЛЬ", hint: "Победи любого босса" },
  { id: "boss_all", name: "КОРОЛЕВСКИЙ ЛАСТИК", hint: "Победи всех семерых боссов (Кляксу-Мать ищи в бесконечном)" },
  { id: "no_damage", name: "НИ ЦАРАПИНЫ", hint: "Пройди лист без урона" },
  { id: "perfection", name: "ОТЛИЧНИК", hint: "Получи 3 звезды за уровень" },
  { id: "collector", name: "АРСЕНАЛ", hint: "Постреляй из всех 5 стволов за один лист" },
  { id: "rail_ace", name: "РЕЛЬСОВЫЙ АС", hint: "Сожги 25 клякс рельсой (всего)" },
  { id: "endless5", name: "ДУРНАЯ БЕСКОНЕЧНОСТЬ", hint: "Дойди до 5 волны бесконечного листа" },
  { id: "endless12", name: "ЛИСТ НЕ КОНЧАЕТСЯ", hint: "Дойди до 12 волны бесконечного листа" },
  { id: "veteran", name: "ВЕТЕРАН ТЕТРАДИ", hint: "Уничтожь 500 клякс за всё время" },
  { id: "victory", name: "ЧЕРНИЛЬНИК ПУСТ", hint: "Пройди всю кампанию" },
];

export interface Meta {
  stickers: StickerId[];
  totalKills: number;
  bossKills: string[];
  railKills: number;
  bestEndless: number;
  runs: number;
  xp: number;
}

const META_KEY = "ink-arena-meta-v1";

export function defaultMeta(): Meta {
  return { stickers: [], totalKills: 0, bossKills: [], railKills: 0, bestEndless: 0, runs: 0, xp: 0 };
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return { ...defaultMeta(), ...parsed, stickers: parsed.stickers ?? [] };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable */
  }
}
