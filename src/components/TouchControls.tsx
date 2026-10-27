import { useEffect, useRef, useState } from "react";
import { Game, type PublicState } from "../game/engine";
import type { WeaponId } from "../game/levels";
import { buzz, enterFullscreenLandscape } from "../utils/device";

const MOVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD"] as const;
const WEAPON_SHORT: Record<WeaponId, string> = {
  pistol: "ПМ",
  shotgun: "ДРБ",
  smg: "АВТ",
  rail: "РЕЛ",
  rocket: "РПГ",
};
const WEAPON_NAME: Record<WeaponId, string> = {
  pistol: "ПИСТОЛЕТ",
  shotgun: "ДРОБОВИК",
  smg: "АВТОМАТ",
  rail: "РЕЛЬСА",
  rocket: "РПГ",
};
const AUTO_KEY = "ink-arena-autofire";
const HINT_KEY = "ink-arena-touch-hint-v2";

interface Joy {
  id: number;
  cx: number;
  cy: number;
  /** travel radius in px, measured from the zone size */
  R: number;
  /** smoothed analog vector */
  sx: number;
  sy: number;
}

interface JoyBase {
  cx: number;
  cy: number;
  R: number;
}

export default function TouchControls({
  game,
  state,
}: {
  game: () => Game | null;
  state: PublicState;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const joyRef = useRef<Joy | null>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const attackRef = useRef(false);
  const autoRef = useRef(true);
  const gameRef = useRef(game);
  gameRef.current = game;
  const [joyBase, setJoyBase] = useState<JoyBase | null>(null);
  const [autoFire, setAutoFire] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [showHint, setShowHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });
  autoRef.current = autoFire;
  const prevHp = useRef(state.hp);

  // haptic kick when we take damage
  useEffect(() => {
    if (state.hp < prevHp.current) buzz(45);
    prevHp.current = state.hp;
  }, [state.hp]);

  // kill synthetic mouse events + scroll/zoom inside the touch layer.
  // (React touch handlers are passive, so this needs a native listener.)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (e: TouchEvent) => {
      e.preventDefault();
    };
    root.addEventListener("touchstart", stop, { passive: false });
    root.addEventListener("touchmove", stop, { passive: false });
    root.addEventListener("touchend", stop, { passive: false });
    return () => {
      root.removeEventListener("touchstart", stop);
      root.removeEventListener("touchmove", stop);
      root.removeEventListener("touchend", stop);
    };
  }, []);

  // release everything exactly once, when the layer unmounts
  // (pause, perks, death...). Empty deps on purpose: uses refs only.
  useEffect(
    () => () => {
      const g = gameRef.current();
      if (!g) return;
      for (const k of MOVE_KEYS) if (g.keys.has(k)) g.keyUp(k);
      g.stick.x = 0;
      g.stick.y = 0;
      g.setMouseDown(false);
      joyRef.current = null;
      attackRef.current = false;
    },
    [],
  );

  // hide the first-run hint after a while
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 9000);
    return () => clearTimeout(t);
  }, [showHint]);

  const writeStick = (nx: number, ny: number) => {
    const g = game();
    if (!g) return;
    // small deadzone, then a quick ramp to full speed
    const mag = Math.hypot(nx, ny);
    let ox = 0;
    let oy = 0;
    if (mag > 0.14) {
      const m = Math.min(1, (mag - 0.14) / 0.78);
      ox = (nx / mag) * m;
      oy = (ny / mag) * m;
    }
    g.stick.x = ox;
    g.stick.y = oy;
    // mirror to WASD for legacy readers (coop packInput prefers the stick)
    const want = new Set<string>();
    if (ox < -0.3) want.add("KeyA");
    else if (ox > 0.3) want.add("KeyD");
    if (oy < -0.3) want.add("KeyW");
    else if (oy > 0.3) want.add("KeyS");
    for (const k of MOVE_KEYS) {
      const has = g.keys.has(k);
      if (want.has(k) && !has) g.keyDown(k);
      else if (!want.has(k) && has) g.keyUp(k);
    }
  };

  // one attack tick: aim at the nearest enemy and hold the trigger
  const fireTick = () => {
    const g = gameRef.current();
    if (!g || g.status !== "playing") return;
    const wantFire = attackRef.current || autoRef.current;
    const me = g.netRole === "guest" ? g.mate : g.player;
    if (!wantFire || !me.active || me.down) {
      g.setMouseDown(false);
      return;
    }
    let bx = 0;
    let by = 0;
    let bd = Infinity;
    for (const en of g.enemies) {
      if (en.dead || en.hp <= 0) continue;
      const d = Math.hypot(en.x - me.x, en.y - me.y);
      if (d < bd) {
        bd = d;
        bx = en.x;
        by = en.y;
      }
    }
    const boss = g.boss;
    if (boss && boss.hp > 0) {
      const d = Math.hypot(boss.x - me.x, boss.y - me.y);
      if (d < bd) {
        bd = d;
        bx = boss.x;
        by = boss.y;
      }
    }
    if (bd < Infinity) {
      g.setMouse(bx, by);
      g.setMouseDown(true);
    } else {
      g.setMouseDown(false);
    }
  };
  const fireTickRef = useRef(fireTick);
  fireTickRef.current = fireTick;

  // steady auto-fire loop; stable deps so re-renders never reset it
  useEffect(() => {
    const id = setInterval(() => fireTickRef.current(), 100);
    return () => clearInterval(id);
  }, []);

  // ---- left stick: movement (floating joystick, fully analog) ----
  const joyStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t || joyRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const R = Math.max(44, Math.min(72, Math.min(rect.width, rect.height) * 0.17));
    const j: Joy = {
      id: t.identifier,
      cx: t.clientX - rect.left,
      cy: t.clientY - rect.top,
      R,
      sx: 0,
      sy: 0,
    };
    joyRef.current = j;
    setJoyBase({ cx: j.cx, cy: j.cy, R });
    writeStick(0, 0);
    buzz(6);
  };
  const joyMove = (e: React.TouchEvent) => {
    const j = joyRef.current;
    if (!j) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== j.id) continue;
      const rect = e.currentTarget.getBoundingClientRect();
      let dx = t.clientX - rect.left - j.cx;
      let dy = t.clientY - rect.top - j.cy;
      const len = Math.hypot(dx, dy);
      if (len > j.R) {
        dx = (dx / len) * j.R;
        dy = (dy / len) * j.R;
      }
      // knob follows the finger exactly (direct DOM write: no re-render, no lag)
      const knob = joyKnobRef.current;
      if (knob) knob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
      // lightly smoothed analog vector for buttery movement
      j.sx += (dx / j.R - j.sx) * 0.6;
      j.sy += (dy / j.R - j.sy) * 0.6;
      writeStick(j.sx, j.sy);
    }
  };
  const joyEnd = (e: React.TouchEvent) => {
    const j = joyRef.current;
    if (!j) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === j.id) {
        joyRef.current = null;
        setJoyBase(null);
        writeStick(0, 0);
      }
    }
  };

  const press = (fn: (g: Game) => void, haptic: number | number[]) => (e: React.TouchEvent) => {
    e.stopPropagation();
    const g = game();
    if (!g || g.status !== "playing") return;
    fn(g);
    buzz(haptic);
  };

  const attackStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    attackRef.current = true;
    fireTickRef.current();
    buzz(10);
  };
  const attackEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    attackRef.current = false;
  };

  const toggleAuto = () => {
    const next = !autoRef.current;
    setAutoFire(next);
    autoRef.current = next;
    buzz(8);
    try {
      localStorage.setItem(AUTO_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!next) game()?.setMouseDown(false);
  };

  const ultReady = state.ult >= 100;
  const dashReady = state.dashCd <= 0;

  return (
    <div className="touch-ui" ref={rootRef} onContextMenu={(e) => e.preventDefault()}>
      {/* left: movement stick */}
      <div
        className="touch-zone touch-zone-left"
        onTouchStart={joyStart}
        onTouchMove={joyMove}
        onTouchEnd={joyEnd}
        onTouchCancel={joyEnd}
      >
        {joyBase ? (
          <div
            className="joy-base"
            style={{ left: joyBase.cx, top: joyBase.cy, width: joyBase.R * 2.6, height: joyBase.R * 2.6 }}
          >
            <div
              ref={joyKnobRef}
              className="joy-knob"
              style={{ width: joyBase.R * 0.95, height: joyBase.R * 0.95 }}
            />
          </div>
        ) : (
          <div className="joy-hint">◀ ▲<br />ДВИЖЕНИЕ<br />▼ ▶</div>
        )}
      </div>

      {/* dash lives next to the movement thumb */}
      <button
        type="button"
        aria-label="Рывок"
        className={`touch-btn touch-dash touch-dash-left ${dashReady ? "" : "is-cool"}`}
        onTouchStart={press((g) => g.keyDown("Space"), 15)}
      >
        <span className="touch-ico">≫</span>
        <span className="touch-label">рывок</span>
      </button>

      {/* right cluster: attack, weapon row, current weapon name */}
      <div className="touch-btns">
        <button
          type="button"
          aria-label="Атака"
          className="touch-btn touch-attack"
          onTouchStart={attackStart}
          onTouchEnd={attackEnd}
          onTouchCancel={attackEnd}
        >
          <span className="touch-ico attack-ico">✸</span>
          <span className="touch-label">огонь</span>
        </button>
        <div className="touch-row">
          <button
            type="button"
            aria-label="Чернильный взрыв"
            className={`touch-btn touch-btn-sm touch-ult ${ultReady ? "is-ready" : ""}`}
            style={{ ["--fill" as string]: `${Math.min(100, state.ult)}%` }}
            onTouchStart={press((g) => g.keyDown("KeyE"), ultReady ? [25, 40, 25] : 10)}
          >
            <span className="touch-ult-drop" />
            <span className="touch-label">{ultReady ? "БУМ!" : `${Math.floor(state.ult)}%`}</span>
          </button>
          <button
            type="button"
            aria-label="Сменить оружие"
            className="touch-btn touch-btn-sm touch-weapon"
            onTouchStart={press((g) => g.keyDown("KeyQ"), 8)}
          >
            <span className="touch-ico weapon-ico">{WEAPON_SHORT[state.weapon] ?? "ПМ"}</span>
            <span className="touch-label">ствол</span>
          </button>
        </div>
        <div className="weapon-name">{WEAPON_NAME[state.weapon] ?? "ПИСТОЛЕТ"}</div>
      </div>

      <button
        type="button"
        aria-label="Автонаведение"
        className={`touch-auto ${autoFire ? "is-on" : ""}`}
        onTouchStart={(e) => {
          e.stopPropagation();
          toggleAuto();
        }}
      >
        ◎ {autoFire ? "авто" : "ручн"}
      </button>

      {showHint && (
        <div className="touch-hint">
          <span>👈 левый палец — движение</span>
          <span>🔥 кнопка — огонь по ближайшим</span>
        </div>
      )}
    </div>
  );
}

/** Full-stage veil shown in portrait on phones: asks to rotate, offers fullscreen. */
export function RotatePrompt({ onDismiss }: { onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const goFull = async () => {
    setBusy(true);
    buzz(12);
    await enterFullscreenLandscape();
    setBusy(false);
  };
  return (
    <div className="rotate-veil">
      <div className="rotate-card">
        <svg className="rotate-phone" viewBox="0 0 64 96" aria-hidden>
          <rect x="14" y="6" width="36" height="84" rx="8" className="rotate-phone-body" />
          <rect x="21" y="16" width="22" height="52" rx="2" className="rotate-phone-screen" />
          <circle cx="32" cy="79" r="3.4" className="rotate-phone-btn" />
          <path d="M52 88 A 26 26 0 0 1 58 62" className="rotate-arrow" />
          <path d="M54 60 l6 1 -2 6" className="rotate-arrow" />
        </svg>
        <div className="disp rotate-title">поверни телефон</div>
        <p className="hand rotate-sub">
          Арена нарисована горизонтально — в альбомном режиме играть удобнее и видно всё поле.
        </p>
        <div className="rotate-btns">
          <button type="button" className="btn btn-solid btn-md" onClick={goFull} disabled={busy}>
            <span className="btn-in">⛶ {busy ? "открываю…" : "во весь экран"}</span>
          </button>
          <button type="button" className="btn btn-md" onClick={onDismiss}>
            <span className="btn-in">играть так</span>
          </button>
        </div>
        <p className="hand rotate-note">звук и вибрация уже включены ✎</p>
      </div>
    </div>
  );
}
