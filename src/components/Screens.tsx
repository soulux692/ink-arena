import { useState } from "react";
import type { PublicState } from "../game/engine";
import { LEVELS, BOSSES, ENDLESS, isUnlocked } from "../game/levels";
import { BossDoodle, EnemyDoodle, PencilPal } from "./Doodles";
import { Bar, Btn, Cap, Card, Chip, Disp, Icon, Num, Rule, Stamp, Stars, ix, useCountUp } from "./ui";
import { useCoarsePointer } from "../utils/device";

const WEAPON: Record<string, { short: string; name: string }> = {
  pistol: { short: "ПМ", name: "ручка-пистолет" },
  shotgun: { short: "ДРБ", name: "дробовик" },
  smg: { short: "АВТ", name: "автомат" },
  rail: { short: "РЕЛ", name: "рельса" },
  rocket: { short: "РПГ", name: "ракетница" },
};

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <Cap>{label}</Cap>
    </div>
  );
}

/* ------------------------------------------------------------------ rank */
export function RankCard({ s, delay = 0 }: { s: PublicState; delay?: number }) {
  const gained = s.rankIndex - s.rankAtStart;
  return (
    <Card className="rank rise" rot={-0.7} style={ix(delay)}>
      <div className="rank-top">
        <Num n={s.rankIndex + 1} className="rank-num" />
        <div className="rank-txt">
          <Cap>твой ранг</Cap>
          <div className="disp rank-name">{s.rankName}</div>
          <div className="hand rank-note">{s.rankNote}</div>
        </div>
        {gained > 0 && <Stamp rot={-8}>♛ +{gained}</Stamp>}
      </div>
      <Bar value={s.rankProgress} />
      <div className="rank-foot">
        <span>{s.xp} xp</span>
        {s.levelXp > 0 && <span>+{s.levelXp} за лист</span>}
        {s.heartsFromRank > 0 && <span>♥ +{s.heartsFromRank}</span>}
        <span>{s.rankNext ? `до «${s.rankNextName}» ${s.rankNext - s.xp}` : "максимум"}</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ menu */
export function MainMenu({ s, onPlay, onLevels, onAlbum, onEndless, onSettings, onCoop, onUpdate }: {
  s: PublicState; onPlay: () => void; onLevels: () => void; onAlbum: () => void; onEndless: () => void; onSettings: () => void; onCoop: () => void; onUpdate: () => void;
}) {
  const cleared = s.progress.filter((r) => r.cleared).length;
  const firstOpen = s.progress.findIndex((r) => !r.cleared);
  const resume = firstOpen === -1 ? LEVELS.length - 1 : firstOpen;
  const lv = LEVELS[resume];
  const touchMode = useCoarsePointer();
  return (
    <div className="screen menu">
      <div className="menu-left">
        <Cap className="rise" style={ix(0)}>тетрадь №13 · рисованный шутер</Cap>
        <h1 className="disp menu-title">
          <span className="rise" style={ix(1)}>чернильная</span>
          <span className="rise mk" style={ix(2)}>арена</span>
        </h1>
        <svg className="menu-drips rise" style={ix(3)} viewBox="0 0 300 40" aria-hidden>
          <g fill="currentColor"><path d="M20 0v14c0 6-3 10-3 14a5 5 0 0 0 10 0c0-4-3-8-3-14V0z" /><path d="M96 0v8c0 4-2 6-2 9a4 4 0 0 0 8 0c0-3-2-5-2-9V0z" /><path d="M188 0v18c0 8-4 12-4 18a6 6 0 0 0 12 0c0-6-4-10-4-18V0z" /><path d="M262 0v6c0 3-2 5-2 7a3.5 3.5 0 0 0 7 0c0-2-2-4-2-7V0z" /></g>
        </svg>
        <p className="hand menu-tag rise" style={ix(3)}>
          Кляксы вылезли из чернильницы. У тебя — {WEAPON[lv.weapon].name} и злость.
        </p>
        {touchMode ? (
          <p className="hand menu-ctl rise" style={ix(3)}>
            👈 палец слева — движение · 🔥 кнопка — огонь по ближайшим · держи телефон горизонтально 📱
          </p>
        ) : (
          <p className="hand menu-ctl rise" style={ix(3)}>
            WASD — движение · мышь — прицел · ЛКМ — огонь · Q / 1–5 — оружие · Space — рывок · E — ульта
          </p>
        )}
        <nav className="menu-nav">
          <Btn tab size="lg" variant="solid" icon="play" onClick={onPlay} style={ix(4)} className="rise">
            {cleared === 0 ? "начать кампанию" : `продолжить · лист ${resume + 1}`}
          </Btn>
          <Btn tab icon="arrow" onClick={onLevels} style={ix(5)} className="rise">листы тетради</Btn>
          <Btn tab icon="book" onClick={onAlbum} style={ix(6)} className="rise">
            альбом <Chip tone="ghost">{s.stickers.length}/12</Chip>
          </Btn>
          {(cleared >= 3 || s.settings.freePlay) && <Btn tab icon="inf" onClick={onEndless} style={ix(7)} className="rise">бесконечный лист</Btn>}
          <Btn tab icon="users" onClick={onCoop} style={ix(8)} className="rise">
            совместно <Chip tone="solid">онлайн · P2P</Chip>
          </Btn>
          <Btn tab icon="gear" onClick={onSettings} style={ix(9)} className="rise">настройки</Btn>
          <Btn tab icon="refresh" onClick={onUpdate} style={ix(10)} className="rise">UPDATE · обновить игру</Btn>
        </nav>
      </div>
      <aside className="menu-right">
        <RankCard s={s} delay={3} />
        <Card className="prog rise" rot={0.8} style={ix(5)}>
          <div className="rank-top"><Cap>прогресс</Cap><Chip tone="solid">★ {s.totalStars}/{LEVELS.length * 3}</Chip></div>
          <div className="prog-bars">
            {LEVELS.map((l, i) => {
              const done = s.progress[i]?.cleared;
              const open = isUnlocked(s.progress, i, s.settings.freePlay);
              return (
                <div key={l.id} className="prog-col">
                  <div className={`prog-bar ${done ? "done" : open ? "open" : ""}`} style={{ height: `${2.2 + i * 0.7}em` }} />
                  <Cap>{l.id}</Cap>
                </div>
              );
            })}
          </div>
          <div className="hand prog-txt">убито клякс: {s.totalKills}{s.bestEndless > 0 ? ` · ∞ ${s.bestEndless}` : ""}</div>
        </Card>
        <Card className="pal rise" rot={-1.6} style={ix(7)}>
          <div className="pal-fig"><PencilPal mood="happy" /></div>
          <p className="hand">Я нарисую тебе перк после каждой волны. И наклейку — за хорошую серию.</p>
        </Card>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ level detail (map + dossier) */
function LevelDetail({ s, index, big = false, onPlay, onBack }: { s: PublicState; index: number; big?: boolean; onPlay: () => void; onBack?: () => void }) {
  const endless = index >= LEVELS.length;
  const lv = endless ? ENDLESS : LEVELS[index];
  const boss = endless ? null : BOSSES[LEVELS[index].boss];
  const rec = endless ? null : s.progress[index];
  const cleared = s.progress.filter((r) => r.cleared).length;
  const open = endless ? cleared >= 3 || s.settings.freePlay : isUnlocked(s.progress, index, s.settings.freePlay);
  const roster = Object.entries(lv.pool).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, big ? 9 : 6).map(([k]) => k);
  const phases = boss ? (boss.id === "queen" ? [0, 2] : [0, 1, 2]) : [];
  return (
    <div className={`detail ${big ? "detail-big" : ""}`} key={index}>
      <Card ink className="detail-boss rise">
        <div className="portrait"><span className="portrait-ring" />{boss ? <BossDoodle id={boss.id} className="portrait-svg doodle" /> : <Icon name="inf" className="portrait-svg" />}</div>
        <div className="boss-info">
          <Cap className="cap-inv">{boss ? "в финале листа" : "особый режим"}</Cap>
          <Disp className="boss-name">{boss ? boss.name : "без конца"}</Disp>
          <div className="hand boss-title">{boss ? boss.title : "босс — каждые 4 волны"}</div>
          {boss && (
            <div className="phase-row">
              {phases.map((pi, n) => (<span className="phase" key={pi}><b>{n + 1}</b>{boss.phaseNames[pi]}</span>))}
            </div>
          )}
        </div>
      </Card>
      <div className="detail-main rise" style={ix(1)}>
        <Cap>{endless ? "после кампании" : `лист ${lv.id}`}</Cap>
        <Disp className="detail-title">{open ? lv.name : "заперто"}</Disp>
        <div className="hand detail-sub">{open ? lv.subtitle : "пройди предыдущий лист"}</div>
        <div className="detail-stats">
          <Stat label="волн" value={endless ? "∞" : lv.waves} />
          <Stat label="оружие" value={WEAPON[lv.weapon].short} />
          {!endless && <Stat label="норма" value={fmtTime(lv.parTime)} />}
          <Stat label="рекорд" value={endless ? s.bestEndless : rec?.best ?? 0} />
        </div>
        <div className="hand detail-tip">✎ {boss ? boss.tip : lv.tip}</div>
        <div className="roster">
          {roster.map((k) => (<span key={k} className="roster-i"><EnemyDoodle kind={k as never} className="roster-svg" /></span>))}
        </div>
      </div>
      <div className="detail-act rise" style={ix(2)}>
        {!endless && <Stars n={rec?.stars ?? 0} big />}
        <Btn variant="solid" size="lg" icon={open ? "play" : "lock"} disabled={!open} onClick={onPlay}>{open ? "в бой" : "закрыто"}</Btn>
        {onBack && <Btn size="sm" icon="back" onClick={onBack}>к листам</Btn>}
        <Cap>enter</Cap>
      </div>
    </div>
  );
}

const POS: [number, number][] = [[8, 64], [22, 30], [36, 68], [50, 30], [64, 68], [78, 30], [92, 60]];
function trailPath() {
  let d = `M ${POS[0][0]} ${POS[0][1]}`;
  for (let i = 0; i < POS.length - 1; i++) {
    const p0 = POS[Math.max(0, i - 1)];
    const p1 = POS[i];
    const p2 = POS[i + 1];
    const p3 = POS[Math.min(POS.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const TRAIL = trailPath();

export function LevelMap({ s, onPlay, onEndless, onBack, onAlbum }: {
  s: PublicState; onPlay: (i: number) => void; onEndless: () => void; onBack: () => void; onAlbum: () => void;
}) {
  const cleared = s.progress.filter((r) => r.cleared).length;
  const firstOpen = s.progress.findIndex((r) => !r.cleared);
  const [sel, setSel] = useState(firstOpen === -1 ? LEVELS.length - 1 : firstOpen);
  const unlockedAt = (i: number) =>
    s.settings.freePlay || (i < LEVELS.length ? isUnlocked(s.progress, i) : cleared >= 3);
  let reach = 0;
  for (let i = 0; i < POS.length; i++) if (unlockedAt(i)) reach = i;
  const play = (i: number) => (i < LEVELS.length ? onPlay(i) : onEndless());
  return (
    <div className="screen levels">
      <header className="screen-head">
        <div className="rise">
          <Cap>оглавление</Cap>
          <Disp className="screen-title">листы тетради</Disp>
        </div>
        <div className="head-act rise" style={ix(1)}>
          {s.settings.freePlay && <Chip tone="solid">free to play</Chip>}
          <Btn size="sm" icon="book" onClick={onAlbum}>альбом {s.stickers.length}/12</Btn>
          <Btn size="sm" variant="solid" icon="back" onClick={onBack}>меню</Btn>
        </div>
      </header>
      <div className="map">
        <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={TRAIL} className="trail-base" pathLength={100} vectorEffect="non-scaling-stroke" />
          <path d={TRAIL} className="trail-done" pathLength={100} vectorEffect="non-scaling-stroke" style={{ strokeDasharray: `${(reach / (POS.length - 1)) * 100} 200` }} />
        </svg>
        {POS.map(([x, y], i) => {
          const open = unlockedAt(i);
          const rec = i < LEVELS.length ? s.progress[i] : null;
          return (
            <button
              type="button"
              key={i}
              className={`node ${sel === i ? "node-sel" : ""} ${rec?.cleared ? "node-done" : ""} ${!open ? "node-lock" : ""}`}
              style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 70}ms` }}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => { setSel(i); if (open) play(i); }}
            >
              <span className="node-disc">
                {i >= LEVELS.length ? <Icon name="inf" className="node-ic" /> : open ? <BossDoodle id={LEVELS[i].boss} className="node-ic doodle" /> : <Icon name="lock" className="node-ic" />}
              </span>
              <span className="node-num">{i >= LEVELS.length ? "∞" : i + 1}</span>
              {rec && <Stars n={rec.stars} />}
            </button>
          );
        })}
      </div>
      <LevelDetail s={s} index={sel} onPlay={() => play(sel)} />
    </div>
  );
}

export function Briefing({ s, onStart, onBack }: { s: PublicState; onStart: () => void; onBack: () => void }) {
  return (
    <div className="screen briefing">
      <header className="screen-head">
        <div className="rise">
          <Cap>досье · перед боем</Cap>
          <Disp className="screen-title">лист {s.levelIndex + 1} из {LEVELS.length}</Disp>
        </div>
        <div className="head-act rise" style={ix(1)}>
          <Btn size="sm" icon="back" onClick={onBack}>к листам</Btn>
        </div>
      </header>
      <LevelDetail s={s} index={s.levelIndex} big onPlay={onStart} />
    </div>
  );
}

/* ------------------------------------------------------------------ pause */
export function PauseCard({ s, onResume, onRetry, onLevels, onSettings }: {
  s: PublicState; onResume: () => void; onRetry: () => void; onLevels: () => void; onSettings: () => void;
}) {
  return (
    <Card className="pause" rot={1}>
      <div className="pause-top">
        <Disp className="pause-title">пауза</Disp>
        <Stamp rot={7}>чернила сохнут</Stamp>
      </div>
      <Rule />
      <div className="detail-stats">
        <Stat label="волна" value={s.endless ? `${Math.max(1, s.wave)} ∞` : `${Math.max(1, s.wave)}/${s.waves}`} />
        <Stat label="очки" value={s.score} />
        <Stat label="клякс" value={s.kills} />
        <Stat label="серия" value={`x${s.combo}`} />
      </div>
      <div className="hand pause-sub">{s.endless ? "∞ бесконечный лист" : s.levelName}</div>
      <div className="pause-btns">
        <Btn variant="solid" size="lg" icon="play" onClick={onResume}>продолжить</Btn>
        <Btn icon="gear" onClick={onSettings}>настройки</Btn>
        <Btn onClick={onRetry}>заново</Btn>
        <Btn icon="back" onClick={onLevels}>листы</Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ results */
function CountRow({ label, value, delay, suffix = "", text }: { label: string; value?: number; delay: number; suffix?: string; text?: string }) {
  const v = useCountUp(value ?? 0, 850, delay);
  return (
    <div className="row rise" style={ix(0, 0)}>
      <span>{label}</span>
      <i />
      <b>{text ?? `${v}${suffix}`}</b>
    </div>
  );
}

export function LevelClear({ s, onNext, onRetry, onLevels }: { s: PublicState; onNext: () => void; onRetry: () => void; onLevels: () => void }) {
  const next = Math.min(LEVELS.length - 1, s.levelIndex + 1);
  return (
    <div className="screen result">
      <div className="result-left">
        <Cap className="rise">{s.endless ? "∞ бесконечный лист" : `лист ${s.levelIndex + 1}`} дорисован</Cap>
        <Disp as="h1" className="result-title rise" style={ix(1)}>чисто!</Disp>
        <Stars n={s.stars} big animate />
        {s.noDamage && <Stamp rot={-6} className="result-stamp">ни царапины</Stamp>}
        {!s.isLast && !s.endless && (
          <Card className="next rise" rot={1} style={ix(8)}>
            <Cap>дальше · лист {next + 1}</Cap>
            <div className="disp next-name">{LEVELS[next].name}</div>
            <div className="hand">{WEAPON[LEVELS[next].weapon].name} · ☠ {BOSSES[LEVELS[next].boss].name}</div>
          </Card>
        )}
      </div>
      <div className="result-right">
        <Card className="rows" rot={0.5}>
          <CountRow label="очки" value={s.score} delay={300} />
          <CountRow label="клякс" value={s.kills} delay={450} />
          <CountRow label="лучшая серия" value={s.maxCombo} delay={600} suffix="×" />
          <CountRow label="время" delay={0} text={fmtTime(s.levelTime)} />
          <CountRow label="опыт" value={s.levelXp} delay={900} suffix=" xp" />
        </Card>
        <RankCard s={s} delay={6} />
        <div className="actions rise" style={ix(9)}>
          <Btn variant="solid" size="lg" icon="arrow" onClick={onNext}>{s.isLast ? "итог" : "дальше"}</Btn>
          <Btn onClick={onRetry}>переиграть</Btn>
          <Btn size="sm" icon="back" onClick={onLevels}>листы</Btn>
        </div>
      </div>
    </div>
  );
}

export function GameOver({ s, onRetry, onLevels }: { s: PublicState; onRetry: () => void; onLevels: () => void }) {
  return (
    <div className="screen result over">
      <div className="result-left">
        <Cap className="rise">{s.endless ? `∞ волна ${Math.max(1, s.wave)}` : `${s.levelName} · волна ${Math.max(1, s.wave)} из ${s.waves}`}</Cap>
        <div className="strike-wrap">
          <Disp as="h1" className="result-title rise" style={ix(1)}>тебя смыло</Disp>
          <span className="strike" />
        </div>
        <p className="hand over-sub rise" style={ix(3)}>Ничего. Сотрём и нарисуем заново — главное, не стой в луже чернил.</p>
        <div className="pal-big rise" style={ix(4)}><PencilPal mood="scared" /></div>
      </div>
      <div className="result-right">
        <Card className="rows" rot={-0.6}>
          <CountRow label="очки" value={s.score} delay={200} />
          <CountRow label="клякс" value={s.kills} delay={350} />
          <CountRow label="лучшая серия" value={s.maxCombo} delay={500} suffix="×" />
          <CountRow label="опыт" value={s.levelXp} delay={650} suffix=" xp" />
        </Card>
        <div className="actions rise" style={ix(6)}>
          <Btn variant="solid" size="lg" icon="play" onClick={onRetry}>ещё раз</Btn>
          <Btn size="sm" icon="back" onClick={onLevels}>к листам</Btn>
          <Cap>R</Cap>
        </div>
      </div>
    </div>
  );
}

export function Victory({ s, onLevels, onMenu, onEndless, onAlbum }: { s: PublicState; onLevels: () => void; onMenu: () => void; onEndless: () => void; onAlbum: () => void }) {
  return (
    <div className="screen result victory">
      <div className="result-left">
        <Cap className="rise">финал кампании</Cap>
        <Disp as="h1" className="result-title rise" style={ix(1)}>тетрадь<br />закрыта</Disp>
        <Stars n={3} big animate />
        <p className="hand over-sub rise" style={ix(3)}>Все {LEVELS.length} листов отмыты. Чернильница пуста — но бесконечный лист ещё ждёт.</p>
        <Stamp rot={8} className="result-stamp">★ выпуск ★</Stamp>
      </div>
      <div className="result-right">
        <Card className="rows" rot={0.6}>
          <CountRow label="звёзд" value={s.totalStars} delay={300} suffix={`/${LEVELS.length * 3}`} />
          <CountRow label="наклеек" value={s.stickers.length} delay={450} suffix="/12" />
          <CountRow label="клякс за всё время" value={s.totalKills} delay={600} />
          <CountRow label="лучшая ∞ волна" value={s.bestEndless} delay={750} />
        </Card>
        <RankCard s={s} delay={5} />
        <div className="actions rise" style={ix(8)}>
          <Btn variant="solid" size="lg" icon="inf" onClick={onEndless}>бесконечный лист</Btn>
          <Btn icon="book" onClick={onAlbum}>альбом</Btn>
          <Btn size="sm" onClick={onLevels}>листы</Btn>
          <Btn size="sm" icon="back" onClick={onMenu}>меню</Btn>
        </div>
      </div>
    </div>
  );
}
