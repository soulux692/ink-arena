declare global {
  interface Window {
    inkDesktop?: {
      setDesktopTear?: (active: boolean) => Promise<boolean>;
      checkForUpdates?: () => Promise<{ status: string; message?: string }>;
      importUpdateArchive?: () => Promise<{ ok: boolean; canceled?: boolean; message?: string }>;
      onUpdateProgress?: (callback: (data: { stage: string; message: string }) => void) => void;
      onUpdateStatus?: (callback: (data: { stage: string; version?: string; percent?: number; message?: string }) => void) => void;
    };
  }
}

import { useEffect, useRef, useState } from "react";
import { Game, type PublicState, W, H } from "./game/engine";
import { LEVELS } from "./game/levels";
import { DEFAULT_SETTINGS } from "./game/settings";
import { isMuted, toggleMuted } from "./game/sfx";
import Curtain from "./components/Curtain";
import { IconBtn, Modal } from "./components/ui";
import { Briefing, GameOver, LevelClear, LevelMap, MainMenu, PauseCard, Victory } from "./components/Screens";
import { Album, PerkPick, SettingsPanel } from "./components/Overlays";
import { CoopSetup, CoopLobby, CoopJoin, VoteBar, type NetView } from "./components/Coop";
import { net, inviteLink, readInvite, clearInvite } from "./net/net";
import { packInput } from "./game/coop";
import { CutFx, VoidPanel } from "./components/Cut";
import TouchControls, { RotatePrompt } from "./components/TouchControls";
import { useCoarsePointer, usePortrait, enterFullscreenLandscape, buzz } from "./utils/device";
import { initAudio } from "./game/sfx";

const initial: PublicState = {
  status: "menu",
  score: 0,
  wave: 0,
  waves: LEVELS[0].waves,
  kills: 0,
  maxCombo: 0,
  levelIndex: 0,
  levelName: LEVELS[0].name,
  levelSubtitle: LEVELS[0].subtitle,
  levelTip: LEVELS[0].tip,
  levelWeapon: LEVELS[0].weapon,
  levelWeaponNote: LEVELS[0].weaponNote,
  stars: 0,
  levelTime: 0,
  noDamage: true,
  progress: LEVELS.map(() => ({ cleared: false, stars: 0, best: 0 })),
  totalStars: 0,
  isLast: false,
  perks: {},
  perkChoices: [],
  perkArm: 0,
  pageCut: false,
  bossId: null,
  bossPhase: 0,
  finale: null,
  coop: { on: false, role: "off", mateHere: false, p1Ready: false, p2Ready: false, levelIndex: 0, mode: "levels", started: false },
  mate: null,
  vote: null,
  endless: false,
  bestEndless: 0,
  stickers: [],
  totalKills: 0,
  recentSticker: null,
  hp: 8,
  maxHp: 8,
  combo: 0,
  bossHp: -1,
  ult: 0,
  weapon: "pistol",
  dashCd: 0,
  frenzy: 0,
  frenzyOn: false,
  transitioning: false,
  xp: 0,
  rankIndex: 0,
  rankName: "ЧИСТЫЙ ЛИСТ",
  rankNote: "ещё ни одного штриха",
  rankProgress: 0,
  rankNext: 120,
  rankNextName: "ПЯТНЫШКО",
  levelXp: 0,
  recentRank: null,
  rankAtStart: 0,
  rankUpDuringLevel: false,
  heartsFromRank: 0,
  queenCut: null,
  trans: null,
  settings: { ...DEFAULT_SETTINGS },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(() => readInvite());
  const joinCodeRef = useRef<string | null>(joinCode);
  joinCodeRef.current = joinCode;

  const [state, setState] = useState<PublicState>(() =>
    joinCode
      ? {
          ...initial,
          status: "coop",
          coop: { ...initial.coop, on: true, role: "guest" },
        }
      : initial,
  );
  const [muted, setMuted] = useState(isMuted());
  const [showAlbum, setShowAlbum] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"game" | "free">("game");
  const [showCoop, setShowCoop] = useState(false);
  const [netView, setNetView] = useState<NetView>({ role: "off", state: "idle", code: "", error: "", ping: 0, link: "", via: "", note: "" });
  const [cutFx, setCutFx] = useState<{ id: number; tearing: boolean } | null>(null);
  const lastPageCut = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  const checkForUpdates = async () => {
    if (!window.inkDesktop?.checkForUpdates) {
      setToast("Проверка обновлений доступна только в установленной desktop-версии.");
      return;
    }
    setUpdateBusy(true);
    setToast("Проверяем наличие обновлений...");
    try {
      const result = await window.inkDesktop.checkForUpdates();
      if (result.status === "dev") setToast("В режиме разработки обновления не проверяются.");
      else if (result.status === "unavailable") setToast("Не удалось проверить обновления: " + (result.message || "ошибка соединения"));
      else setToast("Проверяем GitHub Releases...");
    } catch (error) {
      setToast("Не удалось проверить обновления: " + String(error));
    } finally {
      setUpdateBusy(false);
    }
  };

  useEffect(() => {
    // Never leave the "checking GitHub" toast stuck on screen.
    if (toast && /проверяем.*(обновлен|github)/i.test(toast)) {
      const timeout = window.setTimeout(() => setToast((current) => current === toast ? null : current), 20000);
      return () => window.clearTimeout(timeout);
    }
  }, [toast]);

  useEffect(() => {
    window.inkDesktop?.onUpdateStatus?.((data) => {
      if (!data) return;
      if (data.stage === "checking") setToast("Проверяем наличие обновлений...");
      else if (data.stage === "not-available") setToast("Установлена последняя версия игры.");
      else if (data.stage === "available") setToast("Найдена версия " + data.version + ". Начинаем загрузку...");
      else if (data.stage === "downloading") setToast("Загрузка обновления: " + (data.percent || 0) + "%");
      else if (data.stage === "installing") setToast("Обновление загружено. Перезапускаем игру...");
      else if (data.stage === "error") setToast("Ошибка обновления: " + (data.message || "неизвестная ошибка"));
    });
  }, []);
  const [queenFx, setQueenFx] = useState<PublicState["queenCut"]>(null);
  const [isFull, setIsFull] = useState(false);
  const modalOpen = useRef(false);
  const closeModals = useRef<() => void>(() => {});
  const touchMode = useCoarsePointer();
  const portrait = usePortrait();
  const [rotateDismissed, setRotateDismissed] = useState(false);

  useEffect(() => {
    modalOpen.current = showAlbum || showSettings || showCoop;
    closeModals.current = () => {
      setShowAlbum(false);
      setShowSettings(false);
      setShowCoop(false);
    };
  }, [showAlbum, showSettings, showCoop]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new Game(canvas);
    gameRef.current = game;
    game.listener = (s) => setState(s);

    // If opened via an invite link, immediately place the new Game instance into the guest room
    // instead of emitting the default main menu state.
    const initialCode = joinCodeRef.current ?? readInvite();
    if (initialCode) {
      game.coopOpen("guest", 0);
      game.netSend = (msg) => net.send(msg as never);
    } else {
      game.emit();
    }
    game.start();

    const toLocal = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H];
    };
    const onMove = (e: MouseEvent) => {
      const [x, y] = toLocal(e);
      game.setMouse(x, y);
    };
    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      const [x, y] = toLocal(e);
      game.setMouse(x, y);
      if (e.button === 0) game.setMouseDown(true);
      if (e.button === 2) game.pressAlt();
    };
    const onUp = () => game.setMouseDown(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && game.status === "playing") e.preventDefault();
      if (modalOpen.current) {
        if (e.code === "Escape") closeModals.current();
        return;
      }
      // the perk picker handles its own number keys so the cards can animate
      if (game.status === "perks" && game.netRole !== "guest") return;
      game.keyDown(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => game.keyUp(e.code);
    const onBlur = () => {
      game.keys.clear();
      game.stick.x = 0;
      game.stick.y = 0;
      game.setMouseDown(false);
      if (game.status === "playing" && !game.coop.on) game.togglePause();
    };
    const onCtx = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      game.cycleWeapon();
    };

    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("contextmenu", onCtx);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      game.destroy();
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("contextmenu", onCtx);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    if (!state.recentSticker) return;
    setToast(state.recentSticker.name);
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [state.recentSticker?.key]);

  useEffect(() => {
    if (!state.queenCut) return;
    setQueenFx(state.queenCut);
    const t = setTimeout(() => setQueenFx(null), state.queenCut.phase ? 1600 : 850);
    return () => clearTimeout(t);
  }, [state.queenCut?.key]);

  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // mobile: unlock audio on the very first touch (iOS requires a user gesture)
  useEffect(() => {
    if (!touchMode) return;
    const unlock = () => initAudio();
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [touchMode]);

  // mobile: entering portrait mid-game pauses and asks to rotate
  useEffect(() => {
    if (!portrait) setRotateDismissed(false);
  }, [portrait]);
  useEffect(() => {
    if (touchMode && portrait && state.status === "playing" && !rotateDismissed && !state.coop.on) {
      gameRef.current?.togglePause();
      buzz(30);
    }
  }, [touchMode, portrait, state.status, rotateDismissed, state.coop.on]);

  // haptic feedback for damage / death on touch devices
  const hpRef = useRef(state.hp);
  useEffect(() => {
    if (!touchMode) {
      hpRef.current = state.hp;
      return;
    }
    if (state.hp < hpRef.current) buzz(state.hp <= 0 ? [70, 50, 70] : 35);
    hpRef.current = state.hp;
  }, [state.hp, touchMode]);

  // In the desktop build, the final boss physically narrows the native window.
  // The renderer keeps its original 16:10 canvas width, so the clipped right half
  // reveals the real Windows desktop instead of rendering a blank panel.
  useEffect(() => {
    const desktop = window.inkDesktop;
    if (!desktop?.setDesktopTear) return;
    const desktopBattle = state.bossId === "mecha" && state.bossPhase >= 4;
    const active = state.pageCut || desktopBattle;
    void desktop.setDesktopTear(active);
    if (!active) document.documentElement.classList.remove("desktop-tear");
    else document.documentElement.classList.add("desktop-tear");
  }, [state.pageCut, state.bossId, state.bossPhase]);

  useEffect(() => () => {
    document.documentElement.classList.remove("desktop-tear");
    void window.inkDesktop?.setDesktopTear?.(false);
  }, []);

  // the finale tears the whole browser window; replay the slash each time the page is cut or healed
  useEffect(() => {
    const key = state.finale?.cutKey ?? 0;
    if (state.pageCut === lastPageCut.current && !(state.pageCut && key)) return;
    if (state.pageCut !== lastPageCut.current) {
      lastPageCut.current = state.pageCut;
      setCutFx({ id: key + (state.pageCut ? 0 : 5000), tearing: state.pageCut });
      const t = setTimeout(() => setCutFx(null), 1900);
      return () => clearTimeout(t);
    }
  }, [state.pageCut, state.finale?.cutKey]);

  // ---- co-op plumbing: the host streams the world, the guest streams its input ----
  useEffect(() => {
    const sync = () =>
      setNetView({
        role: net.role,
        state: net.state,
        code: net.code,
        error: net.error,
        ping: net.ping,
        link: net.code ? inviteLink(net.code) : "",
        via: net.via,
        note: net.note,
      });
    const offChange = net.onChange(sync);
    sync();

    const offMsg = net.onMessage((msg) => {
      const game = gameRef.current;
      if (!game) return;
      const m = msg as Record<string, unknown>;
      const broadcastLobby = () =>
        net.send({
          t: "lobby",
          levelIndex: game.coop.levelIndex,
          endless: game.coop.mode === "endless",
          p1Ready: game.coop.p1Ready,
          p2Ready: game.coop.p2Ready,
        });

      const maybeAutoStart = () => {
        if (net.role === "host" && game.coopCanStart() && !game.coop.started) {
          setTimeout(() => {
            const gNow = gameRef.current;
            if (!gNow || gNow.coop.started || !gNow.coopCanStart()) return;
            net.send({ t: "start", endless: gNow.coop.mode === "endless" });
            gNow.coopBegin();
          }, 420);
        }
      };

      switch (m.t) {
        // ---- host side ----
        case "hello":
          game.coopMateJoined(true);
          net.send({ t: "welcome", levelIndex: game.coop.levelIndex, endless: game.coop.mode === "endless" });
          broadcastLobby();
          break;
        case "ready":
          game.coopReady(2, !!m.v);
          broadcastLobby();
          maybeAutoStart();
          break;
        case "input":
          game.setRemoteInput(m.i as never);
          break;
        case "vote":
          if (net.role === "host") game.castVote(2, m.id as never);
          break;
        // ---- guest side ----
        case "welcome":
          if (game.status !== "coop" && !game.coop.started) game.coopOpen("guest", Number(m.levelIndex) || 0);
          game.coopSetLevel(Number(m.levelIndex) || 0);
          game.coopSetMode(m.endless ? "endless" : "levels");
          game.coopMateJoined(true);
          break;
        case "lobby":
          if (game.status !== "coop" && !game.coop.started) game.coopOpen("guest", Number(m.levelIndex) || 0);
          game.coopSetLevel(Number(m.levelIndex) || 0);
          game.coopSetMode(m.endless ? "endless" : "levels");
          game.coopReady(1, !!m.p1Ready);
          game.coopReady(2, !!m.p2Ready);
          game.coopMateJoined(true);
          break;
        case "start":
          if (typeof m.endless === "boolean") game.coopSetMode(m.endless ? "endless" : "levels");
          game.coop.started = true;
          game.mate.active = true;
          game.status = "playing";
          game.emit();
          break;
        case "snap":
          game.onSnapshot(m.s as never);
          break;
        case "fx":
          game.onRemoteFx((m.list as Record<string, unknown>[]) ?? []);
          break;
        case "bye":
          if (net.role === "host") {
            game.coopMateJoined(false);
            game.coopReady(2, false);
            if (game.coop.started) game.addText(game.player.x, game.player.y - 50, "ДРУГ ОТКЛЮЧИЛСЯ", 2.2, 1.4);
          } else {
            // the host is gone: there is nothing left to render, so bail out to the menu
            game.coopMateJoined(false);
            net.leave();
            setJoinCode(null);
            clearInvite();
            game.coopLeave();
          }
          break;
        default:
          break;
      }
    });
    return () => {
      offChange();
      offMsg();
    };
  }, []);

  // guest: push input to the host 20 times a second
  useEffect(() => {
    if (netView.role !== "guest" || !netView.state.startsWith("live")) return;
    const id = setInterval(() => {
      const game = gameRef.current;
      if (!game || !game.coop.started) return;
      const inp = packInput(game, game.keys, game.mouse, game.edge.dash, game.edge.ult);
      game.edge.dash = false;
      game.edge.ult = false;
      net.send({ t: "input", i: inp as never });
    }, 50);
    return () => clearInterval(id);
  }, [netView.role, netView.state]);

  // Listen for URL hash/popstate changes in case the user pastes an invite URL into an already-open tab
  useEffect(() => {
    const checkUrl = () => {
      const code = readInvite();
      if (code && code !== joinCodeRef.current) {
        setShowCoop(false);
        setJoinCode(code);
      }
    };
    checkUrl();
    window.addEventListener("hashchange", checkUrl);
    window.addEventListener("popstate", checkUrl);
    return () => {
      window.removeEventListener("hashchange", checkUrl);
      window.removeEventListener("popstate", checkUrl);
    };
  }, []);

  useEffect(() => {
    if (!joinCode) return;
    const game = gameRef.current;
    if (!game) return;
    let dead = false;
    setShowCoop(false);
    game.coopOpen("guest", 0);
    game.netSend = (msg) => net.send(msg as never);
    net
      .join(joinCode)
      .then(() => {
        if (dead) return;
        net.send({ t: "hello" });
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [joinCode]);

  const startHost = async (levelIndex: number, endless = false) => {
    const game = gameRef.current;
    if (!game) return;
    setShowCoop(false);
    setJoinCode(null);
    clearInvite();
    game.coopOpen("host", levelIndex);
    game.coopSetMode(endless ? "endless" : "levels");
    game.netSend = (msg) => net.send(msg as never);
    try {
      await net.host();
    } catch {
      /* the lobby shows the error state */
    }
  };

  const startGuestJoin = (code: string) => {
    setShowCoop(false);
    setJoinCode(null);
    setTimeout(() => setJoinCode(code.trim().toUpperCase()), 10);
  };

  const leaveCoop = () => {
    net.leave();
    setJoinCode(null);
    clearInvite();
    gameRef.current?.coopLeave();
  };

  const g = () => gameRef.current;
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  // on phones every run starts with a landscape-lock attempt (needs the tap gesture)
  const goLandscape = () => {
    if (touchMode && portrait) void enterFullscreenLandscape();
  };
  const openSettings = (tab: "game" | "free" = "game") => {
    if (state.status === "playing") g()?.togglePause();
    setSettingsTab(tab);
    setShowSettings(true);
  };
  const st = state.status;
  const playing = st === "playing";
  const resumeIdx = () => {
    const i = state.progress.findIndex((r) => !r.cleared);
    return i === -1 ? LEVELS.length - 1 : i;
  };

  return (
    <div className={`app ${state.pageCut ? "is-cut" : ""} ${state.bossId === "mecha" && state.bossPhase === 2 ? "mecha-cyber" : ""} ${state.bossId === "mecha" && state.bossPhase === 3 ? "mecha-pixel" : ""} ${state.bossId === "mecha" && state.bossPhase === 4 ? "mecha-notepad" : ""}`}>
      <div className="stage">
        <canvas ref={canvasRef} className={playing ? "cur-none" : ""} />
        {playing && state.bossId === "mecha" && state.bossPhase === 4 && <div className="mecha-notepad-window" aria-hidden><header>● ● ● <b>Блокнот — FINAL_BATTLE.txt</b></header><p>МЕХА-НУЛЬ подключился к рабочему столу.</p><p>Последняя фаза запущена...</p><p className="cursor">_</p></div>}

        <div className="ui">
          {st === "menu" && (
            <MainMenu
              s={state}
              onPlay={() => g()?.openBriefing(resumeIdx())}
              onLevels={() => g()?.goLevels()}
              onAlbum={() => setShowAlbum(true)}
              onEndless={() => { goLandscape(); g()?.startEndless(); }}
              onSettings={() => setShowSettings(true)}
              onCoop={() => setShowCoop(true)}
              onUpdate={checkForUpdates}
            />
          )}
          {st === "levels" && (
            <LevelMap
              s={state}
              onPlay={(i) => { goLandscape(); g()?.startLevel(i); }}
              onEndless={() => g()?.startEndless()}
              onBack={() => g()?.goMenu()}
              onAlbum={() => setShowAlbum(true)}
            />
          )}
          {st === "briefing" && <Briefing s={state} onStart={() => { goLandscape(); g()?.startLevel(); }} onBack={() => g()?.goLevels()} />}
          {st === "levelclear" && (
            <LevelClear s={state} onNext={() => g()?.nextLevel()} onRetry={() => g()?.retryLevel()} onLevels={() => g()?.goLevels()} />
          )}
          {st === "gameover" && <GameOver s={state} onRetry={() => { goLandscape(); g()?.retryLevel(); }} onLevels={() => g()?.goLevels()} />}
          {st === "victory" && (
            <Victory s={state} onLevels={() => g()?.goLevels()} onMenu={() => g()?.goMenu()} onEndless={() => g()?.startEndless()} onAlbum={() => setShowAlbum(true)} />
          )}
          {st === "coop" && (
            <CoopLobby
              s={state}
              net={netView}
              onReady={(v) => {
                const game = g();
                if (!game) return;
                if (game.netRole === "host") {
                  game.coopReady(1, v);
                  net.send({ t: "lobby", levelIndex: game.coop.levelIndex, endless: game.coop.mode === "endless", p1Ready: game.coop.p1Ready, p2Ready: game.coop.p2Ready });
                  if (game.coopCanStart() && !game.coop.started) {
                    setTimeout(() => {
                      const gNow = gameRef.current;
                      if (!gNow || gNow.coop.started || !gNow.coopCanStart()) return;
                      net.send({ t: "start", endless: gNow.coop.mode === "endless" });
                      gNow.coopBegin();
                    }, 420);
                  }
                } else {
                  game.coopReady(2, v);
                  net.send({ t: "ready", v });
                }
              }}
              onStart={() => {
                const game = g();
                if (!game) return;
                goLandscape();
                net.send({ t: "start", endless: game.coop.mode === "endless" });
                game.coopBegin();
              }}
              onLeave={leaveCoop}
              onPickLevel={(i) => {
                const game = g();
                if (!game || game.netRole !== "host") return;
                game.coopSetLevel(i);
                game.coopReady(1, false);
                game.coopReady(2, false);
                net.send({ t: "lobby", levelIndex: i, endless: false, p1Ready: false, p2Ready: false });
              }}
            />
          )}
          {st === "perks" && (
            <>
              <PerkPick
                s={state}
                role={state.coop.on ? state.coop.role : "off"}
                onPick={(id) => {
                  const game = g();
                  if (!game) return;
                  if (game.netRole === "guest") net.send({ t: "vote", id });
                  else game.choosePerk(id);
                }}
                onSkip={() => g()?.skipPerk()}
              />
              <VoteBar s={state} role={state.coop.role} />
            </>
          )}

          <Modal open={st === "paused"} onClose={() => g()?.togglePause()}>
            <PauseCard
              s={state}
              onResume={() => g()?.togglePause()}
              onRetry={() => { goLandscape(); g()?.retryLevel(); }}
              onLevels={() => g()?.goLevels()}
              onSettings={() => setShowSettings(true)}
            />
          </Modal>
          <Modal open={showAlbum} wide onClose={() => setShowAlbum(false)}>
            <Album s={state} onClose={() => setShowAlbum(false)} />
          </Modal>
          <Modal open={showCoop} onClose={() => setShowCoop(false)}>
            <CoopSetup
              s={state}
              onLevels={(i) => void startHost(i)}
              onEndless={() => void startHost(0, true)}
              onJoin={(code) => startGuestJoin(code)}
              onClose={() => setShowCoop(false)}
            />
          </Modal>
          <Modal open={!!joinCode && netView.state !== "live"} dismiss={false} onClose={() => undefined}>
            <CoopJoin
              code={joinCode ?? ""}
              state={netView.state}
              error={netView.error}
              note={netView.note}
              onCancel={leaveCoop}
              onJoin={(code) => startGuestJoin(code)}
              onRetry={() => {
                const c = joinCode;
                setJoinCode(null);
                setTimeout(() => setJoinCode(c), 60);
              }}
            />
          </Modal>
          <Modal open={showSettings} onClose={() => setShowSettings(false)}>
            <SettingsPanel
              s={state}
              onChange={(p) => g()?.updateSettings(p)}
              onClose={() => setShowSettings(false)}
              onFull={toggleFull}
              isFull={isFull}
              initialTab={settingsTab}
              onLevels={() => {
                setShowSettings(false);
                g()?.goLevels();
              }}
            />
          </Modal>

          {state.coop.on && state.coop.started && state.mate && (
            <div className="mateband">
              <span className="mateband-tag">P2</span>
              <span className="mateband-hp">
                {Array.from({ length: state.mate.maxHp }, (_, i) => (
                  <i key={i} className={i < state.mate!.hp ? "on" : ""} />
                ))}
              </span>
              {state.mate.down && <b className="mateband-down">упал — подойди и подними!</b>}
              {netView.ping > 0 && <span className="mateband-ping">{netView.ping} мс</span>}
            </div>
          )}
          {toast && (
            <div className="toast">
              <span>★</span> наклейка: <b>{toast}</b>
            </div>
          )}

          <div className={`dock ${playing ? "dock-play" : ""}`}>
            {(playing || st === "paused") && <IconBtn icon={st === "paused" ? "play" : "pause"} title="Пауза (Esc)" onClick={() => g()?.togglePause()} />}
            <IconBtn icon={muted ? "mute" : "sound"} title="Звук" onClick={() => setMuted(toggleMuted())} />
            <IconBtn icon="gear" title="Настройки" onClick={() => openSettings()} />
            <IconBtn icon="full" title="Полный экран" active={isFull} onClick={toggleFull} />
          </div>

          {touchMode && playing && (
            <TouchControls game={g} state={state} canvasRef={canvasRef} />
          )}
          {touchMode && portrait && !rotateDismissed && (playing || st === "paused") && (
            <RotatePrompt onDismiss={() => setRotateDismissed(true)} />
          )}
        </div>

        {state.trans && <Curtain key={state.trans.id} {...state.trans} />}
      </div>

      <VoidPanel open={state.pageCut && !window.inkDesktop?.setDesktopTear} />
      {cutFx && <CutFx key={cutFx.id} id={cutFx.id} tearing={cutFx.tearing} />}

      {queenFx && (
        <div key={queenFx.key} className={`queen-fx ${queenFx.phase ? "queen-fx-flood" : "queen-fx-slash"}`} aria-hidden>
          <div className="queen-line" style={{ transform: `translate(-50%, -50%) rotate(${queenFx.angle}rad)` }} />
          <div className="queen-text">{queenFx.phase ? "ЧЕРНИЛА ПЕРЕПИСЫВАЮТ ЛИСТ" : "РАЗРЕЗ!"}</div>
        </div>
      )}
    </div>
  );
}
