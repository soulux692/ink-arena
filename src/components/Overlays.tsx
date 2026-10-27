import { useEffect, useState } from "react";
import type { PublicState } from "../game/engine";
import { PERK_BY_ID, type PerkId } from "../game/perks";
import { STICKERS } from "../game/stickers";
import { RANKS } from "../game/ranks";
import { BOSSES, LEVELS, isUnlocked, type BossId, type EnemyKind } from "../game/levels";
import type { Settings } from "../game/settings";
import { BossDoodle, EnemyDoodle, PerkDoodle, StickerDoodle } from "./Doodles";
import { Btn, Cap, Card, Chip, Disp, Icon, Rule, Stamp, ix } from "./ui";

/* ------------------------------------------------------------------ perks */
export function PerkPick({ s, onPick, onSkip, role = "off" }: { s: PublicState; onPick: (id: PerkId) => void; onSkip: () => void; role?: "off" | "host" | "guest" }) {
  const vote = s.vote;
  const mineId = role === "guest" ? vote?.p2 : vote?.p1;
  const theirId = role === "guest" ? vote?.p1 : vote?.p2;
  const [picked, setPicked] = useState<PerkId | null>(null);
  // the engine keeps perkArm counting down: cards drift and spin until it reaches 0,
  // so a twitchy click can never eat the pick
  const armed = (s.perkArm ?? 0) <= 0 && (!picked || !!vote);
  const choose = (id: PerkId) => {
    if (!armed) return;
    if (vote) {
      // a click is a vote, not a decision: the card only lights up
      onPick(id);
      return;
    }
    if (picked) return;
    setPicked(id);
    setTimeout(() => onPick(id), 420);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const i = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
      if (i >= 0 && s.perkChoices[i]) choose(s.perkChoices[i]);
      else if (e.code === "Escape" && !picked && armed && role !== "guest" && !vote) onSkip();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  const rots = [-3.2, 1, 3.4];
  return (
    <div className="perk">
      <svg className="perk-spatter" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="currentColor"><circle cx="40" cy="36" r="17" /><circle cx="64" cy="56" r="7" /><circle cx="360" cy="196" r="22" /><circle cx="326" cy="172" r="8" /><circle cx="200" cy="14" r="11" /><circle cx="18" cy="210" r="13" /><circle cx="384" cy="40" r="12" /></g>
      </svg>
      <div className="perk-wrap">
        <header className="perk-head rise">
          <Cap>{vote ? `волна ${s.wave} отбита · решайте вдвоём` : `волна ${s.wave} отбита`}</Cap>
          <Disp className="perk-title">{vote ? "голосуем за каракулю" : "выбери каракулю"}</Disp>
          <div className="hand">
            {vote ? "нажмите на карту — это голос. совпали, значит берём" : "один перк за волну · копится до конца листа"}
          </div>
        </header>
        <div className={`perk-cards ${armed ? "is-armed" : "is-locked"}`}>
          <div className="perk-timer"><i style={{ transform: `scaleX(${1 - Math.min(1, (s.perkArm ?? 0) / 1.25)})` }} /></div>
          {s.perkChoices.map((id, i) => {
            const p = PERK_BY_ID[id];
            const have = s.perks[id] ?? 0;
            return (
              <button
                type="button"
                key={id}
                onClick={() => choose(id)}
                disabled={!armed && !picked}
                className={`pcard ${armed ? "" : "pcard-spin"} ${
                  vote
                    ? `${mineId === id ? "pcard-mine" : ""} ${vote.locked === id ? "pcard-picked" : vote.locked ? "pcard-gone" : ""}`
                    : picked === id
                      ? "pcard-picked"
                      : picked
                        ? "pcard-gone"
                        : ""
                }`}
                style={{ ["--r" as string]: `${rots[i] ?? 0}deg`, animationDelay: `${120 + i * 120}ms` }}
              >
                <span className="pcard-key">{i + 1}</span>
                {vote && (mineId === id || theirId === id) && (
                  <span className="pcard-votes">
                    {mineId === id && <b className="pv pv-me">ты</b>}
                    {theirId === id && <b className="pv pv-mate">друг</b>}
                  </span>
                )}
                {vote?.locked === id && <span className="pcard-locked">принято!</span>}
                <span className="pcard-art"><PerkDoodle id={id} /></span>
                <Disp as="h3" className="pcard-name">{p.name}</Disp>
                <span className="hand pcard-desc">{p.desc}</span>
                <span className="hand pcard-note">✎ {p.note}</span>
                <span className="pips">
                  {Array.from({ length: p.max }, (_, k) => (<i key={k} className={k < have ? "on" : k === have ? "next" : ""} />))}
                  <em>{have}/{p.max}</em>
                </span>
              </button>
            );
          })}
        </div>
        <div className="perk-foot rise" style={ix(5)}>
          <Chip tone="ghost">перков: {Object.keys(s.perks).length}</Chip>
          <button type="button" className="link" disabled={role === "guest" || !!vote} onClick={() => armed && !vote && onSkip()}>
            {vote ? "решает голосование" : armed ? "пропустить · Esc" : "карты ещё крутятся…"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ album */
const BESTIARY: { kind: EnemyKind; name: string; desc: string }[] = [
  { kind: "blob", name: "КАПЛЯ", desc: "Ползёт медленно, лопается с брызгами." },
  { kind: "fly", name: "МОШКА", desc: "Мелкая и стремительная. Любит рой." },
  { kind: "spiky", name: "КОЛЮЧКА", desc: "Крутится и цепляет всё вокруг." },
  { kind: "brute", name: "ГРОМИЛА", desc: "Толстый, бьёт на два сердца." },
  { kind: "shooter", name: "СТРЕЛОК", desc: "Держит дистанцию, плюётся тройным залпом." },
  { kind: "zipper", name: "ЗИППЕР", desc: "Дрожит — потом бросается. Рывок вбок спасает." },
  { kind: "splitter", name: "ДЕЛЯГА", desc: "Лопается на три капли. Хорош под РПГ." },
  { kind: "bomber", name: "БОМБЕР", desc: "Подбегает и рвётся веером чернил." },
  { kind: "sniper", name: "СНАЙПЕР", desc: "Рисует прицельную линию, потом бьёт насквозь." },
  { kind: "shield", name: "ЩИТОНОСЕЦ", desc: "Спереди звенит щит. Обходи или бей рельсой." },
  { kind: "ghost", name: "ПРИЗРАК", desc: "Мигает: то твёрдый, то «фигушки»." },
];
const BOSS_ORDER: BossId[] = ["tentacle", "matriarch", "queen", "octopus", "eye", "bombhead", "king"];

export function Album({ s, onClose }: { s: PublicState; onClose: () => void }) {
  const [tab, setTab] = useState<"stickers" | "bestiary" | "ranks">("stickers");
  const titles = { stickers: "альбом наклеек", bestiary: "кляксопедия", ranks: "ранги пера" };
  return (
    <Card className="album">
      <header className="album-head">
        <div>
          <Cap>разворот тетради</Cap>
          <Disp className="screen-title">{titles[tab]}</Disp>
        </div>
        <div className="head-act">
          {(["stickers", "bestiary", "ranks"] as const).map((t) => (
            <Btn key={t} size="sm" variant={tab === t ? "solid" : "plain"} onClick={() => setTab(t)}>
              {t === "stickers" ? `★ ${s.stickers.length}/12` : t === "bestiary" ? "кляксы" : "♛ ранги"}
            </Btn>
          ))}
          <Btn size="sm" icon="close" onClick={onClose}>закрыть</Btn>
        </div>
      </header>
      <Rule />
      <div className="album-body" key={tab}>
        {tab === "stickers" && (
          <div className="grid g4">
            {STICKERS.map((st, i) => {
              const got = s.stickers.includes(st.id);
              return (
                <div key={st.id} className={`tile rise ${got ? "" : "tile-off"}`} style={ix(i, 35)}>
                  <span className="tile-art"><StickerDoodle id={st.id} locked={!got} /></span>
                  <div>
                    <b className="tile-name">{got ? st.name : "???"}</b>
                    <div className="hand tile-desc">{st.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "bestiary" && (
          <>
            <div className="grid g4">
              {BESTIARY.map((b, i) => (
                <div key={b.kind} className="tile rise" style={ix(i, 30)}>
                  <span className="tile-art"><EnemyDoodle kind={b.kind} className="tile-svg" /></span>
                  <div><b className="tile-name">{b.name}</b><div className="hand tile-desc">{b.desc}</div></div>
                </div>
              ))}
            </div>
            <div className="album-sub"><Stamp rot={-3}>чудища тетради</Stamp><span /></div>
            <div className="grid g3">
              {BOSS_ORDER.map((id, i) => {
                const b = BOSSES[id];
                const lv = LEVELS.findIndex((l) => l.boss === id);
                return (
                  <div key={id} className="tile tile-ink rise" style={ix(i, 50)}>
                    <span className="tile-art"><BossDoodle id={id} className="tile-svg" /></span>
                    <div>
                      <b className="tile-name">{b.name}</b>
                      <Cap className="cap-inv">{lv >= 0 ? `лист ${lv + 1}` : "бесконечный"} · {s.stickers.length >= 0 ? b.title : ""}</Cap>
                      <div className="hand tile-desc">✎ {b.tip}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === "ranks" && (
          <div className="grid g2">
            {RANKS.map((rk, i) => {
              const reached = s.xp >= rk.xp;
              const cur = s.rankIndex === i;
              return (
                <div key={rk.name} className={`tile rise ${cur ? "tile-ink" : ""} ${reached ? "" : "tile-off"}`} style={ix(i, 30)}>
                  <span className="tile-rank">{i + 1}</span>
                  <div className="tile-grow">
                    <b className="tile-name">{reached ? rk.name : "???"}</b>
                    <div className="hand tile-desc">{reached ? rk.note : `нужно ${rk.xp} xp`}</div>
                  </div>
                  <div className="tile-side"><Cap>{rk.xp} xp</Cap>{rk.reward !== "—" && <span className="hand">★ {rk.reward}</span>}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ settings */
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" className="set-row set-toggle" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span><b>{label}</b><span className="hand">{hint}</span></span>
      <span className={`switch ${on ? "on" : ""}`}><i /></span>
    </button>
  );
}

export function SettingsPanel({ s, onChange, onClose, onFull, isFull, initialTab = "game", onLevels }: {
  s: PublicState;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
  onFull: () => void;
  isFull: boolean;
  initialTab?: "game" | "free";
  onLevels?: () => void;
}) {
  const st = s.settings;
  const [tab, setTab] = useState<"game" | "free">(initialTab);
  return (
    <Card className="settings" rot={-0.5}>
      <header className="album-head">
        <div><Cap>настройки</Cap><Disp className="screen-title">{tab === "game" ? "под себя" : "free to play"}</Disp></div>
        <Btn size="sm" icon="close" onClick={onClose}>готово</Btn>
      </header>
      <div className="set-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "game"} className={`set-tab ${tab === "game" ? "on" : ""}`} onClick={() => setTab("game")}>
          <Icon name="gear" className="set-tab-ic" /> игра
        </button>
        <button type="button" role="tab" aria-selected={tab === "free"} className={`set-tab ${tab === "free" ? "on" : ""}`} onClick={() => setTab("free")}>
          <Icon name="inf" className="set-tab-ic" /> Free to play
          <Chip tone={st.freePlay ? "solid" : "ghost"}>{st.freePlay ? "вкл" : "выкл"}</Chip>
        </button>
      </div>
      <Rule />
      {tab === "game" ? (
        <>
          <div className="set-row">
            <span><b>Громкость</b><span className="hand">{Math.round(st.volume * 100)}%</span></span>
            <input className="range" type="range" min={0} max={1} step={0.05} value={st.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} />
          </div>
          <p className="hand set-note">
            Графику крутить не нужно: игра сама следит за весом кадра и убирает лишние частицы,
            дым и штриховку, когда становится тяжело.
          </p>
          <Toggle on={st.shake} onChange={(v) => onChange({ shake: v })} label="Тряска экрана" hint="выключи, если укачивает" />
          <Toggle on={st.flashes} onChange={(v) => onChange({ flashes: v })} label="Яркие вспышки" hint="инверсия экрана при ударах" />
          <div className="set-row">
            <span><b>Полный экран</b><span className="hand">игра займёт весь монитор</span></span>
            <Btn size="sm" icon="full" onClick={onFull}>{isFull ? "свернуть" : "развернуть"}</Btn>
          </div>
          <div className="set-foot"><Icon name="gear" className="set-ic" /><span className="hand">настройки сохраняются в браузере</span></div>
        </>
      ) : (
        <div className="free">
          <div className="free-head">
            <div className="free-intro">
              <Cap>открытая кампания</Cap>
              <Disp className="free-title">все листы открыты</Disp>
              <p className="hand free-lead">
                Режим для тех, кто хочет сразу посмотреть любой лист и финал.
                Прогресс, звёзды и наклейки остаются как были — выключатель можно вернуть в любой момент.
              </p>
            </div>
            {st.freePlay && <Stamp rot={-8} className="free-stamp">free</Stamp>}
          </div>

          <button
            type="button"
            className={`set-row set-toggle free-switch-row ${st.freePlay ? "is-on" : ""}`}
            onClick={() => onChange({ freePlay: !st.freePlay })}
            role="switch"
            aria-checked={st.freePlay}
          >
            <span>
              <b>Free to play</b>
              <span className="hand">{st.freePlay ? "включено · все уровни доступны" : "выключено · уровни открываются по порядку"}</span>
            </span>
            <span className={`switch ${st.freePlay ? "on" : ""}`}><i /></span>
          </button>

          <div className="free-list">
            {LEVELS.map((lv, i) => {
              const rec = s.progress[i];
              const open = st.freePlay || isUnlocked(s.progress, i);
              return (
                <div key={lv.id} className={`free-row ${open ? "free-open" : "free-lock"} ${rec?.cleared ? "free-cleared" : ""}`}>
                  <span className="free-num">{i + 1}</span>
                  <span className="free-name">
                    <b>{lv.name}</b>
                    <span className="hand">☠ {BOSSES[lv.boss].name} · {lv.waves} волн</span>
                  </span>
                  <span className={`free-state ${open ? "on" : ""}`}>
                    {rec?.cleared ? "пройден" : open ? "открыт" : "закрыт"}
                  </span>
                </div>
              );
            })}
            <div className={`free-row ${st.freePlay ? "free-open" : "free-lock"}`}>
              <span className="free-num">∞</span>
              <span className="free-name">
                <b>БЕСКОНЕЧНЫЙ ЛИСТ</b>
                <span className="hand">босс каждые 4 волны · рекорд {s.bestEndless}</span>
              </span>
              <span className={`free-state ${st.freePlay ? "on" : ""}`}>{st.freePlay ? "открыт" : "закрыт"}</span>
            </div>
          </div>

          <div className="free-actions">
            <Btn size="sm" variant={st.freePlay ? "plain" : "solid"} icon="inf" onClick={() => onChange({ freePlay: !st.freePlay })}>
              {st.freePlay ? "вернуть обычный режим" : "включить free to play"}
            </Btn>
            <Btn size="sm" icon="arrow" onClick={onLevels ?? onClose}>к листам</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

