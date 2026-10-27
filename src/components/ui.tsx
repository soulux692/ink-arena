import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** staggered entrance helper: spread on any element with the `rise` class */
export const ix = (i: number, base = 70): CSSProperties => ({ animationDelay: `${i * base}ms` });

export type IconName =
  | "sound" | "mute" | "full" | "gear" | "pause" | "play" | "back" | "close"
  | "lock" | "skull" | "crown" | "inf" | "book" | "arrow" | "users" | "refresh";

const ICONS: Record<IconName, ReactNode> = {
  sound: (<><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></>),
  mute: (<><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M17 9l5 6M22 9l-5 6" /></>),
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>),
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3.2" />,
  play: <path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" />,
  back: <path d="M14 5l-7 7 7 7M7 12h13" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  skull: (<><path d="M12 3C7 3 4 6.5 4 10.5c0 2.5 1.2 4 2.8 5V19h10.4v-3.5C18.8 14.5 20 13 20 10.5 20 6.5 17 3 12 3z" /><circle cx="9" cy="11" r="1.6" fill="currentColor" /><circle cx="15" cy="11" r="1.6" fill="currentColor" /><path d="M10 19v-2.5M14 19v-2.5" /></>),
  crown: <path d="M4 18l1.5-10 4.5 4L12 5l2 7 4.5-4L20 18z" />,
  inf: <path d="M12 12c-1.8-2.6-3.4-4-5.3-4a4 4 0 1 0 0 8c1.9 0 3.5-1.4 5.3-4s3.4-4 5.3-4a4 4 0 1 1 0 8c-1.9 0-3.5-1.4-5.3-4z" />,
  book: <path d="M4 5.5C7 4 9.5 4.3 12 6c2.5-1.7 5-2 8-.5V19c-3-1.5-5.5-1.2-8 .5-2.5-1.7-5-2-8-.5zM12 6v13.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  users: (<><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-4 3-6.4 6.5-6.4s6.5 2.4 6.5 6.4" /><circle cx="17.5" cy="9" r="2.6" /><path d="M16.5 14c3.4 0 5.4 2 5.4 5.2" /></>),
  refresh: <><path d="M20 7v5h-5" /><path d="M4.5 16a8 8 0 0 0 13.2 2.1L20 15" /><path d="M4 17v-5h5" /><path d="M19.5 8A8 8 0 0 0 6.3 5.9L4 9" /></>,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`icon ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function Btn({
  children, onClick, variant = "plain", size = "md", tab = false, icon, disabled, title, className = "", style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "plain" | "solid";
  size?: "sm" | "md" | "lg" | "xl";
  tab?: boolean;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`btn btn-${size} ${variant === "solid" ? "btn-solid" : ""} ${tab ? "btn-tab" : ""} ${className}`}
    >
      <span className="btn-in">
        {icon && <Icon name={icon} className="btn-ic" />}
        {children}
      </span>
    </button>
  );
}

export function IconBtn({ icon, onClick, title, active = false }: { icon: IconName; onClick?: () => void; title: string; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={`btn btn-icon ${active ? "btn-solid" : ""}`}>
      <span className="btn-in"><Icon name={icon} className="btn-ic" /></span>
    </button>
  );
}

export function Card({ children, className = "", rot = 0, ink = false, style }: { children: ReactNode; className?: string; rot?: number; ink?: boolean; style?: CSSProperties }) {
  return (
    <div className={`card ${ink ? "card-ink" : ""} ${className}`} style={{ transform: rot ? `rotate(${rot}deg)` : undefined, ...style }}>
      {children}
    </div>
  );
}

export function Cap({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`cap ${className}`} style={style}>{children}</div>;
}

export function Disp({ children, className = "", as: Tag = "h2", style }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "h3" | "div"; style?: CSSProperties }) {
  return <Tag className={`disp ${className}`} style={style}>{children}</Tag>;
}

export function Chip({ children, tone = "plain", className = "" }: { children: ReactNode; tone?: "plain" | "solid" | "ghost"; className?: string }) {
  return <span className={`chip chip-${tone} ${className}`}>{children}</span>;
}

export function Stamp({ children, rot = -7, className = "" }: { children: ReactNode; rot?: number; className?: string }) {
  return <span className={`stamp ${className}`} style={{ ["--rot" as string]: `${rot}deg` }}>{children}</span>;
}

export function Rule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 10" preserveAspectRatio="none" className={`rule ${className}`} aria-hidden>
      <path d="M2 6C40 2 70 9 110 5s60-4 98 2 60 1 90-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Num({ n, className = "" }: { n: number | string; className?: string }) {
  return (
    <span className={`num ${className}`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <path d="M32 5c14 0 26 10 27 24 1 13-11 25-26 26C18 56 5 45 5 31 5 17 17 5 32 5z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <b>{n}</b>
    </span>
  );
}

const STAR = "M12 2.6l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.8z";
export function Stars({ n, big = false, animate = false }: { n: number; big?: boolean; animate?: boolean }) {
  return (
    <span className={`stars ${big ? "stars-big" : ""}`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={`star ${i < n ? "on" : ""} ${animate && i < n ? "star-pop" : ""}`} style={animate ? { animationDelay: `${450 + i * 330}ms` } : undefined}>
          <path d={STAR} strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

/** progress bar that fills in on mount */
export function Bar({ value, className = "" }: { value: number; className?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 90);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={`bar ${className}`}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, w)) * 100)}%` }} />
    </div>
  );
}

export function useCountUp(target: number, ms = 900, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/** keeps an element mounted while its exit animation plays */
export function usePresence(open: boolean, ms = 260) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => clearTimeout(t);
  }, [open, ms, mounted]);
  return { mounted, closing };
}

export function Modal({ open, onClose, children, wide = false, dismiss = true }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; dismiss?: boolean }) {
  const { mounted, closing } = usePresence(open, 280);
  if (!mounted) return null;
  return (
    <div className={`modal ${closing ? "modal-out" : ""}`} onMouseDown={(e) => { if (dismiss && e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-card ${wide ? "modal-wide" : ""}`}>{children}</div>
    </div>
  );
}
