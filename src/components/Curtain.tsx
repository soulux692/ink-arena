import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { TransitionKind } from "../game/transition";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ragged paper/ink edge as a clip-path polygon */
function jag(r: () => number, side: "left" | "right", n: number, amp: number) {
  const base = side === "right" ? 100 - amp : 0;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${(base + r() * amp).toFixed(1)}% ${((i / n) * 100).toFixed(1)}%`);
  return pts;
}

function build(kind: TransitionKind, id: number, ox: number, oy: number): ReactNode {
  const r = rng(id * 7919 + 13);
  switch (kind) {
    case "blot": {
      const blobs = Array.from({ length: 16 }, (_, i) => {
        const x = Math.max(-5, Math.min(105, ox * 100 + (r() - 0.5) * 120));
        const y = Math.max(-5, Math.min(105, oy * 100 + (r() - 0.5) * 120));
        return { i, x, y, s: 26 + r() * 30, d: r() * 0.12, rot: Math.floor(r() * 90) };
      });
      return (
        <>
          <div className="cur-fill" />
          {blobs.map((b) => (
            <div key={b.i} className="cur-blob" style={{ ["--x" as string]: `${b.x}%`, ["--y" as string]: `${b.y}%`, ["--s" as string]: `${b.s}cqw`, ["--d" as string]: `${b.d}s`, ["--rot" as string]: `${b.rot}deg` } as CSSProperties} />
          ))}
        </>
      );
    }
    case "brush": {
      const poly = [...jag(r, "right", 14, 5), ...jag(r, "left", 14, 5).reverse()].join(",");
      return (
        <>
          <div className="cur-brush" style={{ clipPath: `polygon(${poly})` }} />
          <div className="cur-brush cur-brush-2" style={{ clipPath: `polygon(${poly})` }} />
        </>
      );
    }
    case "tear": {
      const left = [`0% 0%`, ...jag(r, "right", 12, 4), `0% 100%`].join(",");
      const right = [`100% 0%`, ...jag(r, "left", 12, 4), `100% 100%`].join(",");
      return (
        <>
          <div className="cur-half cur-half-l" style={{ clipPath: `polygon(${left})` }} />
          <div className="cur-half cur-half-r" style={{ clipPath: `polygon(${right})` }} />
          <div className="cur-seam" />
        </>
      );
    }
    case "scribble":
      return Array.from({ length: 11 }, (_, i) => (
        <div key={i} className="cur-bar" style={{ ["--i" as string]: i, ["--d" as string]: `${(i % 4) * 0.03 + r() * 0.04}s` } as CSSProperties} />
      ));
    case "pages":
      return Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`cur-page ${i === 5 ? "cur-page-ink" : ""}`}
          style={{ ["--i" as string]: i, ["--r" as string]: `${(r() - 0.5) * 7}deg`, ["--d" as string]: `${i * 0.028}s` } as CSSProperties}
        />
      ));
    case "drip":
      return Array.from({ length: 15 }, (_, i) => (
        <div
          key={i}
          className="cur-drip"
          style={{ ["--i" as string]: i, ["--d" as string]: `${(r() * 0.16).toFixed(3)}s`, ["--h" as string]: `${88 + r() * 24}%` } as CSSProperties}
        />
      ));
    case "shutter":
      return Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="cur-slat" style={{ ["--i" as string]: i, ["--d" as string]: `${Math.abs(i - 4.5) * 0.026}s` } as CSSProperties} />
      ));
    case "halftone":
      return (
        <>
          <div className="cur-halftone" />
          <div className="cur-fill" />
        </>
      );
    case "iris":
      return <div className="cur-iris-fill" />;
    case "flood":
      return <div className="cur-flood" />;
    case "crack": {
      const arms = Array.from({ length: 13 }, (_, i) => {
        let x = ox * 100;
        let y = oy * 100;
        let a = (i / 13) * Math.PI * 2 + r() * 0.3;
        const pts = [`${x.toFixed(1)},${y.toFixed(1)}`];
        for (let k = 0; k < 8; k++) {
          a += (r() - 0.5) * 0.8;
          const step = 8 + r() * 11;
          x += Math.cos(a) * step;
          y += Math.sin(a) * step * 0.62;
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        return pts.join(" ");
      });
      return (
        <>
          <svg className="cur-crack-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {arms.map((p, i) => (
              <polyline key={i} points={p} pathLength={1} style={{ animationDelay: `${i * 0.012}s` }} />
            ))}
          </svg>
          <div className="cur-fill cur-fill-late" />
          <div className="cur-flash" />
        </>
      );
    }
  }
}

/** DOM ink curtain. Peaks (fully opaque) around 40–60% of its duration — exactly when the engine swaps screens. */
export default function Curtain({ id, kind, dur, ox, oy }: { id: number; kind: TransitionKind; dur: number; ox: number; oy: number }) {
  const parts = useMemo(() => build(kind, id, ox, oy), [kind, id, ox, oy]);
  const style = { ["--dur" as string]: `${dur}s`, ["--ox" as string]: `${ox * 100}%`, ["--oy" as string]: `${oy * 100}%` } as CSSProperties;
  return (
    <div className={`curtain cur-${kind}`} style={style} aria-hidden>
      {parts}
    </div>
  );
}
