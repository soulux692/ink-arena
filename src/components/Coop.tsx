import { useEffect, useState } from "react";
import type { PublicState } from "../game/engine";
import { LEVELS, BOSSES, ENDLESS } from "../game/levels";
import { parseInviteCode, type LinkState, type Role, type Via } from "../net/net";
import { BossDoodle, PencilPal } from "./Doodles";
import { Btn, Cap, Card, Chip, Disp, Icon, Rule, Stamp, ix } from "./ui";

export interface NetView {
  role: Role;
  state: LinkState;
  code: string;
  error: string;
  ping: number;
  link: string;
  via: Via;
  note: string;
}

/* ------------------------------------------------------------------ setup */
export function CoopSetup({
  s,
  onLevels,
  onEndless,
  onJoin,
  onClose,
}: {
  s: PublicState;
  onLevels: (index: number) => void;
  onEndless: () => void;
  onJoin: (code: string) => void;
  onClose: () => void;
}) {
  const open = (i: number) => s.settings.freePlay || i === 0 || s.progress[i - 1]?.cleared;
  const [sheet, setSheet] = useState(0);
  const endlessUnlocked = s.settings.freePlay || s.progress.filter((p) => p.cleared).length >= 3;
  const [inviteInput, setInviteInput] = useState("");
  const [joinErr, setJoinErr] = useState("");

  const tryJoinFromText = (raw: string) => {
    const code = parseInviteCode(raw);
    if (!code) {
      setJoinErr("Вставь ссылку друга (с #coop=...) или 5-значный код комнаты.");
      return;
    }
    setJoinErr("");
    onJoin(code);
  };

  const pasteAndJoin = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) {
        setInviteInput(txt);
        const code = parseInviteCode(txt);
        if (code) {
          setJoinErr("");
          onJoin(code);
          return;
        }
      }
      setJoinErr("В буфере не найдена ссылка с кодом комнаты — вставь её вручную ниже.");
    } catch {
      setJoinErr("Браузер не дал прочитать буфер — вставь ссылку в поле вручную (Ctrl+V).");
    }
  };

  return (
    <Card className="cosetup" rot={-0.6}>
      <header className="album-head">
        <div>
          <Cap>режим для двоих</Cap>
          <Disp className="screen-title">совместная игра</Disp>
        </div>
        <Btn size="sm" icon="close" onClick={onClose}>закрыть</Btn>
      </header>
      <Rule />

      {/* Join friend block — works even if platform/iframe strips URL hash */}
      <div className="coinvite" style={{ marginBottom: "0.4em" }}>
        <div className="coinvite-row">
          <Cap>есть ссылка или код от друга? (войти как игрок 2)</Cap>
          <Btn size="sm" onClick={pasteAndJoin}>вставить из буфера</Btn>
        </div>
        <div className="coinvite-box">
          <input
            value={inviteInput}
            onChange={(e) => {
              setInviteInput(e.target.value);
              if (joinErr) setJoinErr("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") tryJoinFromText(inviteInput);
            }}
            placeholder="Вставь ссылку друга или код комнаты (например KT4PZ)…"
            spellCheck={false}
          />
          <Btn
            size="sm"
            variant="solid"
            icon="arrow"
            onClick={() => tryJoinFromText(inviteInput)}
            disabled={!inviteInput.trim()}
          >
            войти к другу
          </Btn>
        </div>
        {joinErr && <p className="hand" style={{ color: "#141414", fontWeight: 700 }}>{joinErr}</p>}
      </div>

      <p className="hand cosetup-lead">Создай комнату и отправь другу ссылку или 5-значный код. Игроки делят арену, помогают друг другу и могут поднять напарника после падения.</p>

      <div className="cosetup-modes">
        <button type="button" className="comode rise" style={ix(1)} onClick={() => onLevels(sheet)}>
          <span className="comode-ic"><Icon name="book" /></span>
          <b>По уровням</b>
          <span className="hand">проходим кампанию вдвоём, лист за листом</span>
          <Chip tone="solid">онлайн · до 2 игроков</Chip>
        </button>
        <button type="button" className={`comode rise ${!endlessUnlocked ? "comode-off" : ""}`} style={ix(2)} onClick={onEndless} disabled={!endlessUnlocked}>
          <span className="comode-ic"><Icon name="inf" /></span>
          <b>Бесконечный лист</b>
          <span className="hand">совместные бесконечные волны, боссы каждые 4 волны и общий рекорд</span>
          <Chip tone="solid">{endlessUnlocked ? "∞ · кооператив онлайн" : "откроется после 3 уровней"}</Chip>
        </button>
      </div>

      <Cap className="cosetup-cap">стартовый лист</Cap>
      <div className="cosheets">
        {LEVELS.map((lv, i) => {
          const can = open(i);
          return (
            <button
              type="button"
              key={lv.id}
              disabled={!can}
              className={`cosheet ${sheet === i ? "on" : ""} ${can ? "" : "off"}`}
              onClick={() => setSheet(i)}
              title={can ? lv.name : "сначала пройди предыдущий лист"}
            >
              <b>{i + 1}</b>
              <span>{can ? lv.name : "заперто"}</span>
            </button>
          );
        })}
      </div>
      <p className="hand cosetup-note">
        ☠ босс листа: <b>{BOSSES[LEVELS[sheet].boss].name}</b>. Второй игрок подключится по ссылке или коду, и дальше идём вместе.
      </p>
      <div className="cosetup-foot">
        <Btn variant="solid" size="lg" icon="users" onClick={() => onLevels(sheet)}>создать комнату</Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ lobby */
function Slot({ n, here, ready, you, name }: { n: 1 | 2; here: boolean; ready: boolean; you: boolean; name: string }) {
  return (
    <div className={`slot ${here ? "slot-here" : "slot-wait"} ${ready ? "slot-ready" : ""}`}>
      <div className="slot-fig">
        {here ? <PencilPal mood={ready ? "proud" : "happy"} /> : <span className="slot-q">?</span>}
      </div>
      <div className="slot-txt">
        <Cap>игрок {n}{you ? " · ты" : ""}</Cap>
        <b>{here ? name : "ждём…"}</b>
        <span className="hand">{here ? (ready ? "готов!" : "ещё не готов") : "подключается по ссылке"}</span>
      </div>
      <span className={`slot-tick ${ready ? "on" : ""}`}>{ready ? "✓" : "…"}</span>
    </div>
  );
}

export function CoopLobby({
  s,
  net,
  onReady,
  onStart,
  onLeave,
  onPickLevel,
}: {
  s: PublicState;
  net: NetView;
  onReady: (v: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onPickLevel: (i: number) => void;
}) {
  const host = s.coop.role === "host";
  const me = host ? s.coop.p1Ready : s.coop.p2Ready;
  const mate = host ? s.coop.p2Ready : s.coop.p1Ready;
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const endless = s.coop.mode === "endless";
  const lv = endless ? ENDLESS : LEVELS[s.coop.levelIndex] ?? LEVELS[0];

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!copiedCode) return;
    const t = setTimeout(() => setCopiedCode(false), 1800);
    return () => clearTimeout(t);
  }, [copiedCode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(net.link);
      setCopied(true);
    } catch {
      const el = document.getElementById("coop-link") as HTMLInputElement | null;
      el?.select();
      setCopied(true);
    }
  };

  const copyCode = async () => {
    if (!net.code) return;
    try {
      await navigator.clipboard.writeText(net.code);
      setCopiedCode(true);
    } catch {
      setCopiedCode(true);
    }
  };

  const statusLine =
    net.state === "error"
      ? net.error
      : net.state === "opening"
        ? net.note || "открываем комнату…"
        : net.state === "connecting"
          ? net.note || "подключаемся к хосту…"
          : s.coop.mateHere
            ? `связь есть${net.via === "local" ? " · локально" : net.via === "p2p" ? " · напрямую" : ""}${net.ping ? ` · ${net.ping} мс` : ""}`
            : "ждём второго игрока";

  return (
    <div className="screen colobby">
      <header className="screen-head">
        <div className="rise">
          <Cap>комната · {host ? "ты игрок 1 (хост)" : "ты игрок 2 (гость)"}</Cap>
          <Disp className="screen-title">совместная игра</Disp>
        </div>
        <div className="head-act rise" style={ix(1)}>
          <Chip tone={s.coop.mateHere ? "solid" : "ghost"}>{statusLine}</Chip>
          <Btn size="sm" icon="back" onClick={onLeave}>выйти</Btn>
        </div>
      </header>

      <div className="colobby-body">
        <div className="slots">
          <Slot n={1} here={host || s.coop.mateHere} ready={s.coop.p1Ready} you={host} name="Игрок 1" />
          <span className="slots-amp">&</span>
          <Slot n={2} here={host ? s.coop.mateHere : true} ready={s.coop.p2Ready} you={!host} name="Игрок 2" />
        </div>

        <Card className="colevel" rot={0.6}>
          <div className="colevel-top">
            <BossDoodle id={lv.boss} className="colevel-boss" />
            <div>
              <Cap>{endless ? "режим · бесконечный лист" : `старт с листа ${s.coop.levelIndex + 1}`}</Cap>
              <b className="disp colevel-name">{lv.name}</b>
              <span className="hand">☠ {BOSSES[lv.boss].name} · {endless ? "боссы каждые 4 волны" : `${lv.waves} волн`}</span>
            </div>
          </div>
          {host && !endless ? (
            <div className="colevel-pick">
              {LEVELS.map((l, i) => (
                <button
                  type="button"
                  key={l.id}
                  className={i === s.coop.levelIndex ? "on" : ""}
                  disabled={!(s.settings.freePlay || i === 0 || s.progress[i - 1]?.cleared)}
                  onClick={() => onPickLevel(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          ) : (
            <p className="hand colevel-note">{endless ? "Волны не заканчиваются. Сколько продержитесь вместе?" : "лист выбирает хост"}</p>
          )}
        </Card>
      </div>

      <div className="coinvite">
        <div className="coinvite-row">
          <Cap>ссылка-приглашение для второго игрока</Cap>
          {net.code && (
            <button
              type="button"
              onClick={copyCode}
              className="chip chip-solid"
              style={{ cursor: "pointer" }}
              title="Нажми, чтобы скопировать код комнаты"
            >
              {copiedCode ? `код ${net.code} скопирован!` : `код комнаты: ${net.code}`}
            </button>
          )}
        </div>
        <div className="coinvite-box">
          <input id="coop-link" readOnly value={net.link} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
          <Btn size="sm" variant={copied ? "solid" : "plain"} onClick={copy} disabled={!net.link}>
            {copied ? "скопировано!" : "копировать"}
          </Btn>
        </div>
        <p className="hand coinvite-hint">
          Отправь эту ссылку другу — он попадёт прямо сюда как <b>Игрок 2</b>. Если браузер открыл меню, друг может нажать «Совместно» и вставить эту ссылку или код <b>{net.code || "…"}</b>.
        </p>
      </div>

      <div className="coready">
        <Btn
          size="lg"
          variant={me ? "plain" : "solid"}
          icon={me ? "close" : "play"}
          onClick={() => onReady(!me)}
          disabled={!s.coop.mateHere}
        >
          {me ? "отменить готовность" : "готово"}
        </Btn>
        <span className={`coready-dot ${me ? "on" : ""}`}>ты</span>
        <span className={`coready-dot ${mate ? "on" : ""}`}>друг</span>
        {host && (
          <Btn size="lg" variant="solid" icon="arrow" onClick={onStart} disabled={!(s.coop.p1Ready && s.coop.p2Ready && s.coop.mateHere)}>
            начать
          </Btn>
        )}
        {!host && <span className="hand coready-hint">когда оба нажмут «Готово», игра запустится</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ join gate */
export function CoopJoin({ code, state, error, note, onCancel, onRetry, onJoin }: {
  code: string;
  state: LinkState;
  error: string;
  note: string;
  onCancel: () => void;
  onRetry: () => void;
  onJoin: (code: string) => void;
}) {
  const failed = state === "error" || state === "closed";
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const submit = () => {
    const parsed = parseInviteCode(text);
    if (!parsed) {
      setHint("Вставь ссылку друга целиком или 5-значный код комнаты.");
      return;
    }
    onJoin(parsed);
  };
  return (
    <Card className="cojoin" rot={-1}>
      <Cap>приглашение</Cap>
      <Disp className="screen-title">{failed ? "не вышло" : "подключаемся"}</Disp>
      <Rule />
      <div className="cojoin-body">
        <div className={`cojoin-spin ${failed ? "off" : ""}`} aria-hidden>
          <svg viewBox="0 0 48 48">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="24" cy="24" r="17" strokeDasharray="18 12" />
              <circle cx="24" cy="24" r="7" />
            </g>
          </svg>
        </div>
        <div>
          <p className="hand cojoin-lead">
            {failed ? error || "Комната не отвечает." : note || `Заходим в комнату ${code} к первому игроку…`}
          </p>
          <p className="hand cojoin-sub">
            {failed
              ? "Проверь код и что комната друга открыта. Можно попробовать ещё раз или ввести код вручную."
              : "Пробуем прямое соединение, потом запасной канал. Это занимает пару секунд."}
          </p>
        </div>
      </div>
      {manual && (
        <div className="coinvite-box" style={{ marginTop: "0.6em" }}>
          <input
            value={text}
            autoFocus
            onChange={(e) => {
              setText(e.target.value);
              if (hint) setHint("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Ссылка или код, например KT4PZ…"
            spellCheck={false}
          />
          <Btn size="sm" variant="solid" onClick={submit} disabled={!text.trim()}>
            войти
          </Btn>
        </div>
      )}
      {manual && hint && (
        <p className="hand" style={{ fontWeight: 700 }}>
          {hint}
        </p>
      )}
      <div className="cojoin-foot">
        {failed && <Btn variant="solid" icon="play" onClick={onRetry}>ещё раз</Btn>}
        {failed && !manual && <Btn onClick={() => setManual(true)}>ввести код руками</Btn>}
        <Btn size="sm" icon="back" onClick={onCancel}>в меню</Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ vote bar */
export function VoteBar({ s, role }: { s: PublicState; role: Role }) {
  const v = s.vote;
  if (!v) return null;
  const mins = Math.floor(v.left / 60);
  const secs = Math.floor(v.left % 60);
  const mine = role === "guest" ? v.p2 : v.p1;
  const theirs = role === "guest" ? v.p1 : v.p2;
  return (
    <div className="votebar">
      <span className="votebar-timer">
        <Icon name="users" /> голосование · {mins}:{String(secs).padStart(2, "0")}
      </span>
      <span className={`votebar-dot ${mine ? "on" : ""}`}>ты {mine ? "✓" : "…"}</span>
      <span className={`votebar-dot ${theirs ? "on" : ""}`}>друг {theirs ? "✓" : "…"}</span>
      {v.tie && <span className="votebar-tie">не сошлись — бросаем монетку!</span>}
      {!v.tie && v.locked && <span className="votebar-ok">выбор принят!</span>}
    </div>
  );
}
