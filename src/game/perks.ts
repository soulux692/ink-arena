// Wave-to-wave upgrade cards. Each is offered after a cleared wave.
export type PerkId =
  | "trigger"
  | "multishot"
  | "pierce"
  | "crit"
  | "heart"
  | "vampire"
  | "dash"
  | "boots"
  | "magnet"
  | "inkwell"
  | "ricochet"
  | "homing"
  | "shield"
  | "orbit"
  | "explosive"
  | "regen"
  | "luck"
  | "slowfield"
  | "nova"
  | "bigshot"
  | "dashcd";

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
  max: number;
  /** short flavour line shown in small handwriting */
  note: string;
}

export const PERKS: PerkDef[] = [
  { id: "trigger", name: "БЫСТРЫЙ КУРОК", desc: "−18% перезарядки", max: 4, note: "палец уже устал" },
  { id: "multishot", name: "ДВОЙНАЯ ОБВОДКА", desc: "+1 пуля в выстреле", max: 3, note: "рисуй жирнее" },
  { id: "pierce", name: "ПРОМОКАШКА", desc: "пули пробивают +1 врага", max: 3, note: "насквозь!" },
  { id: "crit", name: "ЖИРНЫЙ ШТРИХ", desc: "+14% шанс крита (×2.5)", max: 3, note: "прямо в кляксу" },
  { id: "heart", name: "ЗАПАСНОЕ СЕРДЦЕ", desc: "+1 сердце и лечение", max: 4, note: "на всякий случай" },
  { id: "vampire", name: "СЛИЗЬ НА ПАЛЬЦЕ", desc: "12% шанс лечиться за убийство", max: 3, note: "фу, но работает" },
  { id: "dash", name: "РЕЗКИЙ РЫВОК", desc: "Рывок взрывается кляксой", max: 2, note: "хлоп — и никого" },
  { id: "boots", name: "БЫСТРЫЕ КЕДЫ", desc: "+10% скорости бега", max: 3, note: "нарисованные, но быстрые" },
  { id: "magnet", name: "ЛИПКАЯ СТРАНИЦА", desc: "Подбираешь дроп издалека", max: 2, note: "само прилипнет" },
  { id: "ricochet", name: "РИКОШЕТ", desc: "пули отскакивают от краёв листа", max: 3, note: "бумага упругая" },
  { id: "homing", name: "ЖИВОЕ ЧЕРНИЛО", desc: "пули чуть наводятся на врагов", max: 3, note: "само найдёт" },
  { id: "shield", name: "БУМАЖНЫЙ ЩИТ", desc: "гасит один удар, потом складывается заново", max: 3, note: "сложено вчетверо" },
  { id: "orbit", name: "ЧЕРНИЛЬНЫЕ СПУТНИКИ", desc: "+1 капля кружит рядом и бьёт врагов", max: 3, note: "сами крутятся" },
  { id: "explosive", name: "ШИПУЧЕЕ ЧЕРНИЛО", desc: "10% шанс: убитый враг взрывается", max: 3, note: "бум на закуску" },
  { id: "regen", name: "ПОДОРОЖНИК", desc: "+1 сердце за 25 с (быстрее с уровнем)", max: 3, note: "заживает само" },
  { id: "luck", name: "СЧАСТЛИВАЯ КЛЯКСА", desc: "+8% к дропу сердец и патронов", max: 3, note: "повезёт" },
  { id: "slowfield", name: "ВЯЗКАЯ БУМАГА", desc: "враги медленнее на 8%", max: 3, note: "липнет к ногам" },
  { id: "nova", name: "ОТВЕТНЫЙ ВСПЛЕСК", desc: "когда тебя бьют — волна сбивает врагов", max: 2, note: "ай! а теперь вы" },
  { id: "bigshot", name: "ТОЛСТОЕ ПЕРО", desc: "+22% урона", max: 4, note: "жирнее линия — больнее" },
  { id: "dashcd", name: "ЛЁГКИЕ НОГИ", desc: "рывок восстанавливается на 25% быстрее", max: 3, note: "не касаясь страницы" },
  { id: "inkwell", name: "ПОЛНАЯ ЧЕРНИЛЬНИЦА", desc: "+40% заряда ульты", max: 3, note: "хлюп-хлюп" },
];

export const PERK_BY_ID: Record<PerkId, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p])) as Record<
  PerkId,
  PerkDef
>;

export function rollPerks(owned: Partial<Record<PerkId, number>>, count = 3): PerkId[] {
  const pool = PERKS.filter((p) => (owned[p.id] ?? 0) < p.max).map((p) => p.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
