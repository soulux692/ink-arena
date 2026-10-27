import { useMemo, type CSSProperties } from "react";
import { usePresence } from "./ui";

/**
 * The finale rips the page: everything to the right of the cut line becomes black void,
 * for the *whole browser window*, not just the game canvas. The void panel is pinned to the
 * same --edge the stage slides to, so the canvas and the DOM tear line up.
 */
export function VoidPanel({ open }: { open: boolean }) {
  const { mounted, closing } = usePresence(open, 760);
  if (!mounted) return null;
  return (
    <div className={`void-panel ${closing ? "void-out" : ""}`} aria-hidden>
      <i className="void-dots" />
      <span className="void-eye void-eye-a" />
      <span className="void-eye void-eye-b" />
      <span className="void-eye void-eye-c" />
      <b className="void-text">ТУТ БОЛЬШЕ НИЧЕГО НЕТ</b>
    </div>
  );
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** one-shot slash + flash + falling paper shards, replayed whenever the cut key changes */
export function CutFx({ id, tearing }: { id: number; tearing: boolean }) {
  const shards = useMemo(() => {
    const r = rng(id * 17 + 5);
    return Array.from({ length: 16 }, (_, i) => ({
      i,
      x: r() * 36,
      y: r() * 100,
      s: 1.6 + r() * 3.2,
      rot: (r() - 0.5) * 720,
      dx: 10 + r() * 38,
      d: r() * 0.22,
    }));
  }, [id]);
  return (
    <div className={`cutfx ${tearing ? "cutfx-tear" : "cutfx-heal"}`} aria-hidden>
      <div className="cutfx-flash" />
      <div className="cutfx-line" />
      {tearing &&
        shards.map((s) => (
          <i
            key={s.i}
            className="cutfx-shard"
            style={
              {
                left: `calc(var(--edge) + ${s.x}vw)`,
                top: `${s.y}%`,
                width: `${s.s}vw`,
                height: `${s.s * 0.72}vw`,
                ["--rot" as string]: `${s.rot}deg`,
                ["--dx" as string]: `${s.dx}vw`,
                ["--d" as string]: `${s.d}s`,
              } as CSSProperties
            }
          />
        ))}
      <b className="cutfx-text">{tearing ? "СТРАНИЦА ОБОРВАНА" : "ЛИСТ СКЛЕЕН"}</b>
    </div>
  );
}
