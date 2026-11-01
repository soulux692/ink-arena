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
  const touchMode = useCoarsePointer();
  return (
    <div className="screen menu menu-revision menu-concept">
      <section className="menu-concept-left">
        <div className="concept-masthead">
          <span>FIELD NOTES / NO. 13</span>
          <b>INK STUDIES · 02 / 13</b>
        </div>
        <div className="concept-logo-wrap">
          <h1 className="disp concept-logo"><span>INK ARENA</span><small>REMASTERED</small></h1>
          <svg className="concept-logo-scratch" viewBox="0 0 440 24" aria-hidden="true">
            <path d="M4 17 L104 12 L192 15 L260 5 L437 11" />
            <path d="M112 19 L190 17 M280 17 L350 13" />
          </svg>
        </div>
        <p className="concept-subtitle">THE INK IS ALIVE. THE PAGE IS YOUR ARENA.</p>
        <div className="concept-menu-caption"><span>CHOOSE YOUR NEXT PAGE</span><i /></div>
        <nav className="menu-nav concept-menu-nav">
          <Btn tab size="lg" variant="solid" icon="play" onClick={onPlay} className="rise">
            {cleared === 0 ? "PLAY" : "CONTINUE · PAGE " + (resume + 1)}
          </Btn>
          <Btn tab icon="arrow" onClick={onLevels} className="rise">NOTEBOOK / LEVELS</Btn>
          <Btn tab icon="book" onClick={onAlbum} className="rise">ARCHIVE <Chip tone="ghost">{s.stickers.length}/12</Chip></Btn>
          {(cleared >= 3 || s.settings.freePlay) && <Btn tab icon="inf" onClick={onEndless} className="rise">ENDLESS PAGE</Btn>}
          <Btn tab icon="users" onClick={onCoop} className="rise">CO-OP / P2P</Btn>
          <Btn tab icon="gear" onClick={onSettings} className="rise">SETTINGS</Btn>
          <Btn tab icon="refresh" onClick={onUpdate} className="rise">CHECK FOR UPDATES</Btn>
        </nav>
        <div className="concept-menu-footer">
          <div><b>{cleared.toString().padStart(2, "0")}</b><span>PAGES CLEARED</span></div>
          <div><b>{s.totalStars.toString().padStart(2, "0")}</b><span>STARS FOUND</span></div>
          <div><b>{s.totalKills.toString().padStart(4, "0")}</b><span>INK CREATURES</span></div>
        </div>
        <div className="concept-version">INK ARENA REMASTERED <span>·</span> v2.3.2</div>
      </section>

      <section className="menu-concept-art" aria-label="Mecha boss artwork">
        <div className="concept-bossbar">
          <div className="concept-bossbar-title"><span>BOSS</span><b>MECHA-NULL</b></div>
          <div className="concept-bossbar-track"><i /></div>
          <svg className="concept-boss-emblem" viewBox="0 0 72 72" aria-hidden="true">
            <path d="M36 3 L45 20 L65 13 L56 33 L69 45 L47 48 L36 68 L26 49 L5 55 L16 35 L5 20 L27 22 Z" />
            <path d="M25 30 L34 27 L43 30 L48 39 L43 48 L30 49 L23 41 Z" />
            <circle cx="32" cy="38" r="2.5" /><circle cx="42" cy="38" r="2.5" />
          </svg>
        </div>
        <div className="concept-hero-scene">
          <div className="concept-scene-stamp">FINAL SHEET / 05</div>
          <svg className="concept-mecha-svg" viewBox="0 0 560 510" role="img" aria-label="Large angular ink-drawn Mecha boss">
            <defs>
              <filter id="conceptInkRough">
                <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
              </filter>
              <linearGradient id="conceptInkShade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#383838"/><stop offset=".35" stopColor="#101010"/><stop offset="1" stopColor="#030303"/>
              </linearGradient>
            </defs>
            <g className="concept-mecha-aura" fill="none" stroke="#e8e4dc" opacity=".45">
              <path d="M68 444 Q28 220 145 104 Q274 -2 428 104 Q545 220 490 430" strokeWidth="2" strokeDasharray="4 12"/>
              <path d="M95 432 Q49 245 164 130 M466 423 Q509 242 393 124" strokeWidth="5"/>
              <path d="M130 450 L84 492 M437 441 L479 485 M160 78 L125 36 M413 77 L452 31" strokeWidth="3"/>
            </g>
            <g filter="url(#conceptInkRough)" stroke="#f1ede3" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
              <path fill="#080808" d="M203 305 L164 346 L148 424 L118 471 L123 491 L215 488 L232 463 L215 414 L248 353 Z"/>
              <path fill="#151515" d="M326 310 L369 346 L391 423 L421 470 L413 492 L322 489 L303 462 L320 410 L287 354 Z"/>
              <path fill="none" strokeWidth="7" d="M176 365 L207 389 L185 438 M359 366 L331 394 L354 438"/>
              <path fill="#090909" d="M115 466 L207 462 L223 490 L106 499 Z M320 464 L415 464 L438 495 L308 500 Z"/>
              <path fill="#111" d="M142 126 L111 101 L100 173 L142 192 L174 169 Z"/>
              <path fill="#111" d="M384 123 L428 93 L447 167 L408 193 L374 163 Z"/>
              <path fill="none" strokeWidth="5" d="M119 119 L131 166 L149 176 M413 117 L409 163 L393 177"/>
              <path fill="#050505" d="M155 166 L111 187 L77 271 L106 312 L159 285 L189 211 Z"/>
              <path fill="#171717" d="M404 164 L451 187 L486 265 L455 312 L401 280 L379 212 Z"/>
              <path fill="none" strokeWidth="8" d="M125 207 L102 272 L139 290 M434 205 L465 271 L428 292"/>
              <path fill="#090909" d="M78 275 L42 306 L34 353 L57 364 L96 322 L112 299 Z"/>
              <path fill="#090909" d="M486 267 L523 299 L527 347 L502 362 L465 321 L452 297 Z"/>
              <path fill="none" strokeWidth="5" d="M49 344 L25 382 L53 371 M516 344 L540 379 L510 369"/>
              <path fill="url(#conceptInkShade)" d="M188 129 L225 89 L335 89 L378 132 L400 286 L365 344 L195 345 L161 286 Z"/>
              <path fill="#1b1b1b" d="M207 151 L235 115 L326 115 L354 154 L353 275 L328 308 L229 308 L203 274 Z"/>
              <path fill="none" strokeWidth="5" d="M204 161 L228 136 L260 145 M351 164 L330 138 L302 146 M190 268 L220 290 L249 291 M369 268 L341 290 L310 291"/>
              <path fill="#080808" d="M152 128 L190 105 L221 153 L194 211 L142 194 Z"/>
              <path fill="#080808" d="M376 128 L409 103 L451 130 L458 195 L405 213 L378 161 Z"/>
              <path fill="#050505" d="M221 75 L238 43 L315 42 L341 76 L326 126 L237 126 Z"/>
              <path fill="#0d0d0d" d="M235 67 L326 67 L320 104 L242 104 Z"/>
              <path fill="#f4f0e8" stroke="#fff" strokeWidth="2" d="M245 76 L315 76 L312 94 L247 94 Z"/>
              <path fill="none" strokeWidth="3" d="M238 56 L225 31 L215 15 M324 55 L342 28 L355 13 M279 42 L279 9"/>
              <path fill="#f3eee4" d="M211 13 L216 4 L222 15 Z M350 13 L358 3 L360 16 Z"/>
              <path fill="#050505" d="M248 172 L278 153 L309 172 L307 230 L278 247 L250 229 Z"/>
              <path fill="none" stroke="#f3eee4" strokeWidth="4" d="M278 169 L294 180 L294 216 L278 231 L262 216 L262 180 Z"/>
              <path fill="#f3eee4" stroke="none" d="M277 180 L287 187 L287 208 L278 216 L269 208 L269 188 Z"/>
              <path fill="#050505" d="M399 236 L447 217 L488 246 L475 285 L425 300 L391 275 Z"/>
              <path fill="#f3eee4" d="M466 243 L500 250 L513 275 L474 281 Z"/>
              <path fill="none" strokeWidth="4" d="M415 246 L452 238 L469 253 M423 280 L455 272"/>
              <path fill="none" strokeWidth="2" opacity=".8" d="M180 226 L194 238 L180 245 M365 205 L378 215 L366 228 M225 310 L216 325 L230 330 M336 309 L348 325 L333 332"/>
            </g>
            <g fill="#f3eee4" opacity=".88">
              <path d="M80 143 L99 131 L91 156 Z M472 103 L493 91 L482 117 Z M150 330 L162 321 L157 341 Z M407 330 L420 319 L415 341 Z M65 416 L80 405 L77 427 Z M473 409 L490 398 L484 422 Z"/>
            </g>
            <g fill="none" stroke="#f3eee4" strokeWidth="2" opacity=".65">
              <path d="M111 51 l-7 20 20 -7 M452 56 l7 19 -19 -7 M47 211 l21 5 -15 14 M508 201 l-21 8 15 14"/>
            </g>
          </svg>
          <div className="concept-phase-caption"><b>MECHA-NULL</b><span>THE LAST MACHINE / INK MADE FLESH</span></div>
        </div>
        <div className="concept-phase-strip">
          <div className="concept-phase-card">
            <div className="concept-orb-thumb">
              <svg viewBox="0 0 160 100" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M80 50 L80 5 M80 50 L38 17 M80 50 L122 18 M80 50 L130 74 M80 50 L28 78"/>
                  <circle cx="80" cy="52" r="34" fill="#090909"/>
                  <circle cx="80" cy="52" r="14" fill="#eee9df"/>
                  <path d="M77 18 L84 5 L91 21 M52 27 L43 13 L64 23 M106 27 L121 12 L117 34"/>
                </g>
              </svg>
            </div>
            <div><b>01 / THE CORE</b><span>ROLLING SPIKE UNIT</span></div>
          </div>
          <div className="concept-phase-card">
            <div className="concept-pixel-thumb">
              <svg viewBox="0 0 160 100" aria-hidden="true">
                <g fill="#080808" stroke="#eee9df" strokeWidth="3" strokeLinejoin="miter">
                  <path d="M54 31 L65 15 H96 L108 31 L103 70 H57 Z"/>
                  <path d="M55 36 L30 29 L18 55 L43 64 L59 53 M107 36 L132 27 L145 54 L119 64 L104 52"/>
                  <path d="M62 69 L52 89 H72 L81 70 M99 69 L108 89 H88 L80 70"/>
                  <path d="M67 24 H94 V39 H67 Z" fill="#eee9df"/>
                </g>
              </svg>
            </div>
            <div><b>02 / THE MACHINE</b><span>AWAKENED MECHA</span></div>
          </div>
          <div className="concept-phase-card concept-phase-card-pixel">
            <div><b>03 / CORRUPTION</b><span>PIXEL BREACH</span></div>
            <strong>GLITCH</strong>
          </div>
        </div>
        <div className="concept-art-foot"><span>INK ARENA / ENEMY DOSSIER</span><span>FIG. 07 — MECHA-NULL</span></div>
      </section>
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
  const phases = boss ? (boss.id === "queen" ? [0, 2] : boss.phaseNames.map((_, i) => i)) : [];
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
