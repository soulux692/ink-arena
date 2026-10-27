// Player ranks: XP is earned by kills, bosses and clearing sheets.
export interface RankDef {
  name: string;
  xp: number;
  /** short flavour line */
  note: string;
  /** what this rank gives */
  reward: string;
}

export const RANKS: RankDef[] = [
  { name: "ЧИСТЫЙ ЛИСТ", xp: 0, note: "ещё ни одного штриха", reward: "—" },
  { name: "ПЯТНЫШКО", xp: 120, note: "первая капля", reward: "—" },
  { name: "ПОМАРКА", xp: 320, note: "кляксы начали уважать", reward: "бандана на герое" },
  { name: "ШТРИХ", xp: 650, note: "уверенная линия", reward: "+1 сердце" },
  { name: "РОСЧЕРК", xp: 1200, note: "рука не дрожит", reward: "—" },
  { name: "НАБРОСОК", xp: 2000, note: "уже видно силуэт", reward: "шарф длиннее" },
  { name: "ЭСКИЗ", xp: 3200, note: "почти шедевр", reward: "—" },
  { name: "РИСОВАЛЬЩИК", xp: 4800, note: "тетрадь знает твоё имя", reward: "+1 сердце" },
  { name: "ХУДОЖНИК", xp: 7000, note: "чернила слушаются", reward: "корона над головой" },
  { name: "МАСТЕР ПЕРА", xp: 10000, note: "перо поёт", reward: "—" },
  { name: "ЧЕРНИЛЬНЫЙ РЫЦАРЬ", xp: 14000, note: "щит из страниц", reward: "+1 сердце" },
  { name: "ЛЕГЕНДА ТЕТРАДИ", xp: 20000, note: "о тебе пишут на полях", reward: "сияние вокруг героя" },
];

export function rankIndexFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) idx = i;
  return idx;
}

export function rankInfo(xp: number) {
  const index = rankIndexFor(xp);
  const cur = RANKS[index];
  const next = RANKS[index + 1];
  const into = xp - cur.xp;
  const span = next ? next.xp - cur.xp : 1;
  return {
    index,
    name: cur.name,
    note: cur.note,
    next: next ? next.xp : null,
    nextName: next ? next.name : null,
    progress: next ? Math.min(1, into / span) : 1,
    into,
    span: next ? span : 0,
  };
}

/** bonus hearts earned by rank */
export function rankHearts(index: number) {
  let n = 0;
  if (index >= 3) n++;
  if (index >= 7) n++;
  if (index >= 10) n++;
  return n;
}
