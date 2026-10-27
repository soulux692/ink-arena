// Hand-drawn SVG doodles for perks and stickers (monochrome ink).
import type { PerkId } from "../game/perks";
import type { StickerId } from "../game/stickers";
import type { BossId, EnemyKind } from "../game/levels";

const S = { stroke: "#1a1a1a", strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-12 sm:w-12" aria-hidden>
      <g {...S}>{children}</g>
    </svg>
  );
}

const PERK_PATHS: Record<PerkId, React.ReactNode> = {
  trigger: <path d="M27 5 14 26h10l-3 17 14-23H25z" fill="#1a1a1a" />,
  multishot: (
    <>
      <path d="M8 30 34 18M8 24 36 10M8 36l26 4" />
      <path d="M34 18l-4-5M34 18l-5 4M36 10l-2-6M10 36l-2 5M10 36l5 3" />
    </>
  ),
  pierce: (
    <>
      <path d="M5 24h38M34 15l9 9-9 9" />
      <circle cx="22" cy="24" r="8" strokeDasharray="4 4" />
      <circle cx="22" cy="24" r="3" fill="#1a1a1a" />
    </>
  ),
  crit: (
    <>
      <path d="M24 4v10M24 34v10M4 24h10M34 24h10M10 10l7 7M31 31l7 7M38 10l-7 7M17 31l-7 7" />
      <circle cx="24" cy="24" r="6" fill="#1a1a1a" stroke="none" />
    </>
  ),
  heart: (
    <path
      d="M24 41C14 33 6 27 6 18c0-6 4-10 9-10 4 0 7 2 9 5 2-3 5-5 9-5 5 0 9 4 9 10 0 9-8 15-18 23z"
      fill="#1a1a1a"
    />
  ),
  vampire: (
    <>
      <path d="M24 4C18 14 12 20 12 28a12 12 0 0 0 24 0c0-8-6-14-12-24z" fill="#1a1a1a" />
      <path d="M19 26l3 7 2-5 2 5 3-7" stroke="#f3efe4" strokeWidth={2.2} />
    </>
  ),
  dash: (
    <>
      <path d="M8 12h18M4 20h22M8 28h18M12 36h16" />
      <path d="M34 6l9 18-9 18" />
    </>
  ),
  boots: (
    <>
      <path d="M14 6v18c0 4-2 6-6 6v8h24c6 0 8-4 8-9 0-6-6-7-12-11l-4-12z" fill="#f3efe4" />
      <path d="M14 6v18c0 4-2 6-6 6v8h24c6 0 8-4 8-9 0-6-6-7-12-11l-4-12z" />
      <path d="M14 22h14M10 32h26" />
    </>
  ),
  magnet: (
    <>
      <path d="M12 8v16a12 12 0 0 0 24 0V8h-8v16a4 4 0 0 1-8 0V8z" />
      <path d="M8 8h8M32 8h8" strokeWidth={5} />
      <path d="M31 34l3 8M37 34l3 8" />
    </>
  ),
  ricochet: (
    <>
      <path d="M6 40 22 12l14 22 6-10" />
      <path d="M36 34l6-4-8-2" />
      <circle cx="22" cy="12" r="3.4" fill="#1a1a1a" />
    </>
  ),
  homing: (
    <>
      <path d="M6 38c10 0 8-22 20-22s8 18 16 18" strokeDasharray="4 4" />
      <circle cx="8" cy="38" r="3.4" fill="#1a1a1a" />
      <circle cx="40" cy="30" r="6" />
      <circle cx="40" cy="30" r="2" fill="#1a1a1a" />
    </>
  ),
  shield: (
    <>
      <path d="M24 5l15 6v12c0 10-6 16-15 20-9-4-15-10-15-20V11z" fill="#f3efe4" />
      <path d="M24 5l15 6v12c0 10-6 16-15 20-9-4-15-10-15-20V11z" />
      <path d="M24 5v38M9 16l15 4 15-4" />
    </>
  ),
  orbit: (
    <>
      <ellipse cx="24" cy="24" rx="19" ry="9" transform="rotate(-24 24 24)" strokeDasharray="3 4" />
      <circle cx="24" cy="24" r="6" fill="#1a1a1a" />
      <circle cx="40" cy="15" r="4.2" fill="#1a1a1a" />
      <circle cx="9" cy="33" r="3.4" fill="#1a1a1a" />
    </>
  ),
  explosive: (
    <>
      <circle cx="24" cy="26" r="10" fill="#1a1a1a" />
      <path d="M24 16c0-5 4-7 7-6M33 6l2-3M37 9l4-1M35 13l4 2" />
      <path d="M6 24h6M36 24h6M10 10l5 5M38 38l-5-5M10 38l5-5" />
    </>
  ),
  regen: (
    <>
      <path d="M24 42V20" />
      <path d="M24 28c-8 0-12-6-12-12 8 0 12 5 12 12zM24 22c8 0 12-6 12-12-8 0-12 5-12 12z" fill="#f3efe4" />
      <path d="M14 42h20" />
    </>
  ),
  luck: (
    <>
      <path d="M24 8c4 0 6 3 6 6 3-1 7 1 7 5 0 4-4 6-7 5 1 3-1 7-6 7s-7-4-6-7c-3 1-7-1-7-5 0-4 4-6 7-5 0-3 2-6 6-6z" fill="#1a1a1a" />
      <path d="M24 30c0 5-2 9-6 12" />
    </>
  ),
  slowfield: (
    <>
      <path d="M8 36c4-6 8-6 12 0s8 6 12 0 8-6 12 0" />
      <path d="M8 26c4-6 8-6 12 0s8 6 12 0 8-6 12 0" />
      <path d="M8 16c4-6 8-6 12 0s8 6 12 0 8-6 12 0" opacity="0.5" />
    </>
  ),
  nova: (
    <>
      <circle cx="24" cy="24" r="7" fill="#1a1a1a" />
      <circle cx="24" cy="24" r="14" strokeDasharray="5 4" />
      <circle cx="24" cy="24" r="20" strokeDasharray="2 6" />
    </>
  ),
  bigshot: (
    <>
      <path d="M8 38 34 12l5 5L13 43z" fill="#f3efe4" />
      <path d="M8 38 34 12l5 5L13 43z" />
      <path d="M8 38l-2 6 6-2z" fill="#1a1a1a" />
      <path d="M32 14l5 5M39 6l4 4" />
    </>
  ),
  dashcd: (
    <>
      <path d="M6 14h18M2 24h22M8 34h16" />
      <path d="M30 8l12 16-12 16" />
      <path d="M26 24h10" />
    </>
  ),
  inkwell: (
    <>
      <path d="M14 16h20l4 24H10z" fill="#f3efe4" />
      <path d="M14 16h20l4 24H10z" />
      <path d="M18 16V8h12v8M14 30c6 3 14 3 20 0" />
      <path d="M24 4c-3 4-5 6-5 9a5 5 0 0 0 10 0c0-3-2-5-5-9z" fill="#1a1a1a" />
    </>
  ),
};

export function PerkDoodle({ id }: { id: PerkId }) {
  return <Wrap>{PERK_PATHS[id]}</Wrap>;
}

const STICKER_PATHS: Record<StickerId, React.ReactNode> = {
  first_blood: (
    <>
      <path d="M24 10c8 8 14 12 14 19a14 14 0 0 1-28 0c0-7 6-11 14-19z" fill="#1a1a1a" />
      <path d="M12 38l-5 5M38 38l6 4M8 28l-5 2M42 26l5-1" />
    </>
  ),
  combo20: (
    <>
      <path d="M10 8v32M20 8v32M30 8v20M40 8v32" />
      <path d="M6 12l22 18" />
    </>
  ),
  boss_first: (
    <>
      <path d="M16 10h16v10c0 8-4 12-8 12s-8-4-8-12z" fill="#f3efe4" />
      <path d="M16 10h16v10c0 8-4 12-8 12s-8-4-8-12z" />
      <path d="M16 14H9a7 7 0 0 0 7 9M32 14h7a7 7 0 0 1-7 9M24 32v6M16 42h16" />
      <path d="M20 17l3 3M28 17l-3 3M21 25c2-1 4-1 6 0" />
    </>
  ),
  boss_all: (
    <>
      <path d="M8 36l2-22 9 8 5-13 5 13 9-8 2 22z" fill="#f3efe4" />
      <path d="M8 36l2-22 9 8 5-13 5 13 9-8 2 22z" />
      <path d="M8 40h32M22 40h4" />
      <circle cx="24" cy="8" r="4" fill="#1a1a1a" />
    </>
  ),
  no_damage: (
    <>
      <path d="M24 5l16 6v12c0 11-7 17-16 21-9-4-16-10-16-21V11z" fill="#f3efe4" />
      <path d="M24 5l16 6v12c0 11-7 17-16 21-9-4-16-10-16-21V11z" />
      <path d="M14 32l20-20" />
    </>
  ),
  perfection: (
    <>
      <path d="M24 4l5 13 14 1-11 9 4 14-12-8-12 8 4-14L5 18l14-1z" fill="#1a1a1a" strokeLinejoin="round" />
    </>
  ),
  collector: (
    <>
      <path d="M5 26h18v6H5z" fill="#1a1a1a" />
      <path d="M23 22h10v10H23zM8 32v8M20 32v6" />
      <path d="M31 38l10-20M36 16l5 2M38 28l5 2" />
    </>
  ),
  rail_ace: <path d="M25 3 12 27h9l-3 18 16-27H24z" fill="#1a1a1a" />,
  endless5: (
    <path d="M24 10c6 0 10 4 10 9s-4 8-10 8-10-3-10-8 4-9 10-9zm0 17c6 0 10 4 10 9s-4 8-10 8-10-3-10-8 4-9 10-9z" />
  ),
  endless12: (
    <>
      <path d="M24 9a15 15 0 1 0 15 15" />
      <path d="M36 8l5 7-8 2" />
      <path d="M17 24h14M24 17v14" />
    </>
  ),
  veteran: (
    <>
      <circle cx="24" cy="18" r="10" fill="#f3efe4" />
      <circle cx="24" cy="18" r="10" />
      <path d="M16 26l-4 16 12-6 12 6-4-16" />
      <path d="M24 12v6M21 18h6" />
    </>
  ),
  victory: (
    <>
      <path d="M8 40c4-10 10-16 16-16s12 6 16 16z" fill="#1a1a1a" />
      <path d="M24 20V6M17 12l7-6 7 6M6 40h36" />
    </>
  ),
};

export function StickerDoodle({ id, locked = false }: { id: StickerId; locked?: boolean }) {
  if (locked) {
    return (
      <div className="flex h-11 w-11 items-center justify-center text-3xl opacity-25 sm:h-12 sm:w-12">?</div>
    );
  }
  return <Wrap>{STICKER_PATHS[id]}</Wrap>;
}

export function PencilPal({ mood }: { mood: "happy" | "worried" | "scared" | "proud" }) {
  const eye = mood === "scared" ? 3.6 : mood === "worried" ? 2.6 : 2.2;
  return (
    <svg viewBox="0 0 64 72" className="h-20 w-auto" aria-hidden>
      <g stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* pencil body */}
        <path d="M20 16l22-10 6 12-22 10z" fill="#f3efe4" />
        <path d="M20 16l22-10 6 12-22 10z" />
        <path d="M14 26l6-10 6 12-6 10z" fill="#1a1a1a" />
        <path d="M14 26l6-10 6 12-6 10z" />
        {/* face */}
        <circle cx="27" cy="41" r="12" fill="#f3efe4" />
        <circle cx="27" cy="41" r="12" />
        <ellipse className="pal-eye" cx="22.5" cy="39" rx={eye} ry={eye + 0.8} fill="#1a1a1a" stroke="none" />
        <ellipse className="pal-eye" cx="32" cy="39" rx={eye} ry={eye + 0.8} fill="#1a1a1a" stroke="none" />
        {mood === "happy" || mood === "proud" ? (
          <path d="M22 46c3 3 7 3 10 0" />
        ) : mood === "scared" ? (
          <ellipse cx="27" cy="47" rx="3.4" ry="4" />
        ) : (
          <path d="M22 48c3-2 7-2 10 0" />
        )}
        {/* little hands */}
        <path d="M15 50l-6 6M39 50l6 5" />
        <path d="M12 44l-5 2M42 44l5 1" />
        {/* feet */}
        <path d="M23 56l-2 6M31 56l2 6" />
        {/* sparkle */}
        <path d="M48 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#1a1a1a" stroke="none" opacity={mood === "proud" ? 1 : 0.5} />
      </g>
    </svg>
  );
}

export function PencilProp() {
  return (
    <svg viewBox="0 0 260 40" className="h-10 w-auto" aria-hidden>
      <g stroke="#1a1a1a" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 12h190v16H30z" fill="#f3efe4" />
        <path d="M30 12h190v16H30z" />
        <path d="M220 12l24 8-24 8z" fill="#1a1a1a" />
        <path d="M220 12l24 8-24 8z" />
        <path d="M30 20h190" strokeDasharray="6 5" opacity={0.4} />
        <path d="M12 12v16M18 12v16" />
        <path d="M44 12v16M60 12v16M76 12v16M92 12v16M108 12v16M124 12v16M140 12v16M156 12v16M172 12v16M188 12v16M204 12v16" opacity={0.15} />
        <path d="M4 8l4 4-4 4" opacity={0.5} />
      </g>
    </svg>
  );
}


// ---- bestiary doodles -----------------------------------------------------
const ENEMY_DRAW: Record<EnemyKind, React.ReactNode> = {
  blob: (
    <>
      <path d="M24 10c7 8 15 13 15 21a15 15 0 0 1-30 0c0-8 8-13 15-21z" fill="#1a1a1a" />
      <circle cx="18" cy="30" r="2" fill="#f3efe4" />
      <circle cx="30" cy="30" r="2" fill="#f3efe4" />
      <path d="M20 36c2 2 6 2 8 0" stroke="#f3efe4" />
    </>
  ),
  fly: (
    <>
      <ellipse cx="24" cy="26" rx="9" ry="7" fill="#1a1a1a" />
      <path d="M18 20 10 12M30 20l8-8M17 28l-12 4M31 28l12 4" />
      <circle cx="21" cy="24" r="1.6" fill="#f3efe4" />
      <circle cx="27" cy="24" r="1.6" fill="#f3efe4" />
    </>
  ),
  spiky: (
    <>
      <path d="M24 6l5 10 11-2-5 10 7 8-11 2-2 8-7-6-9 5 3-11L4 21l10-4z" fill="#f3efe4" />
      <path d="M24 6l5 10 11-2-5 10 7 8-11 2-2 8-7-6-9 5 3-11L4 21l10-4z" />
      <circle cx="24" cy="24" r="7" fill="#1a1a1a" />
      <circle cx="26" cy="23" r="2.2" fill="#f3efe4" />
    </>
  ),
  brute: (
    <>
      <circle cx="24" cy="24" r="18" fill="#f3efe4" strokeWidth={3} />
      <circle cx="24" cy="24" r="18" strokeWidth={3} />
      <path d="M8 18h32M10 30h28" opacity={0.3} />
      <circle cx="18" cy="22" r="3.2" fill="#1a1a1a" />
      <circle cx="30" cy="22" r="3.2" fill="#1a1a1a" />
      <path d="M15 32c3 3 6 3 9 3s6 0 9-3M16 14l6 3M32 14l-6 3" />
    </>
  ),
  shooter: (
    <>
      <rect x="10" y="16" width="24" height="22" fill="#f3efe4" strokeWidth={2.4} />
      <rect x="10" y="16" width="24" height="22" strokeWidth={2.4} />
      <circle cx="22" cy="26" r="5" />
      <circle cx="24" cy="26" r="1.8" fill="#1a1a1a" />
      <path d="M34 24h10M12 20l6 6M12 34l6-6" />
    </>
  ),
  zipper: (
    <>
      <path d="M38 24 20 12l5 12-5 12z" fill="#f3efe4" />
      <path d="M38 24 20 12l5 12-5 12z" strokeWidth={2.4} />
      <path d="M16 24h-8M12 18 6 24M12 30 6 24" />
      <circle cx="18" cy="24" r="1.8" fill="#1a1a1a" />
    </>
  ),
  splitter: (
    <>
      <path d="M24 8c8 7 16 12 16 20a16 16 0 0 1-32 0c0-8 8-13 16-20z" fill="#f3efe4" />
      <path d="M24 8c8 7 16 12 16 20a16 16 0 0 1-32 0c0-8 8-13 16-20z" />
      <path d="M24 16v20M16 26h16" />
      <circle cx="18" cy="22" r="1.8" fill="#1a1a1a" />
      <circle cx="30" cy="22" r="1.8" fill="#1a1a1a" />
    </>
  ),
  bomber: (
    <>
      <circle cx="24" cy="27" r="14" fill="#f3efe4" strokeWidth={2.6} />
      <circle cx="24" cy="27" r="14" strokeWidth={2.6} />
      <path d="M22 13c0-4 5-6 8-4s6 6 3 5" />
      <path d="M33 9l2-5M36 10l5-2M35 5l2 3" />
      <circle cx="19" cy="25" r="2.2" fill="#1a1a1a" />
      <circle cx="29" cy="25" r="2.2" fill="#1a1a1a" />
      <path d="M17 33c4 3 10 3 14 0" />
    </>
  ),
  sniper: (
    <>
      <path d="M38 24 16 10l4 14-4 14z" fill="#f3efe4" />
      <path d="M38 24 16 10l4 14-4 14z" strokeWidth={2.4} />
      <circle cx="22" cy="24" r="4" />
      <circle cx="23" cy="24" r="1.4" fill="#1a1a1a" />
      <path d="M30 24h14M6 24h6" strokeDasharray="3 3" />
    </>
  ),
  shield: (
    <>
      <circle cx="20" cy="24" r="13" fill="#f3efe4" strokeWidth={2.4} />
      <circle cx="20" cy="24" r="13" strokeWidth={2.4} />
      <path d="M18 18h4M18 24h4M18 30h4" />
      <path d="M28 10c6 2 9 7 9 14s-3 12-9 14z" fill="#1a1a1a" />
      <path d="M32 16v16M35 19v10" stroke="#f3efe4" strokeWidth={1.2} />
    </>
  ),
  ghost: (
    <>
      <path d="M7 38Q5 9 24 7Q43 9 41 38l-6-6-6 10-5-7-6 9-6-9z" fill="#1a1a1a" strokeWidth={2.4} />
      <ellipse cx="24" cy="23" rx="12" ry="13" fill="#f3efe4" strokeWidth={2} />
      <path d="M12 19l4-7h16l4 7-12-3z" fill="#1a1a1a" />
      <ellipse cx="19" cy="22" rx="2.8" ry="4.3" fill="#1a1a1a" />
      <ellipse cx="29" cy="22" rx="2.8" ry="4.3" fill="#1a1a1a" />
      <path d="M20 31q4 3 8-1M7 26 2 34m39-8 5 8" />
    </>
  ),
  boss: (
    <>
      <circle cx="24" cy="24" r="16" strokeWidth={3} />
      <circle cx="17" cy="20" r="3.4" fill="#1a1a1a" />
      <circle cx="31" cy="18" r="2.6" fill="#1a1a1a" />
      <circle cx="24" cy="29" r="4" fill="#1a1a1a" />
      <path d="M8 36l4 6M40 36l-4 6M24 40v5M12 8l4 4M36 8l-4 4" />
    </>
  ),
};

export function EnemyDoodle({ kind, className = "h-14 w-14" }: { kind: EnemyKind; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <g {...S}>{ENEMY_DRAW[kind]}</g>
    </svg>
  );
}

const BOSS_FACES: Record<BossId, React.ReactNode> = {
  abyss: (
    <>
      <path d="M24 9c9 0 14 5 14 12s-5 12-14 12S10 28 10 21 15 9 24 9z" fill="#1a1a1a" />
      <path d="M11 30C5 35 6 41 1 46M17 33c-2 6-1 10-5 14M31 33c2 6 1 10 5 14M37 30c6 5 5 11 10 16M24 34v12" />
      <path d="M12 12 9 4l7 5 4-7 4 7 4-7 4 7 7-5-3 8" />
      <circle cx="24" cy="21" r="7" fill="#f3efe4" stroke="none" />
      <ellipse cx="24" cy="21" rx="2.2" ry="5" fill="#1a1a1a" stroke="none" />
    </>
  ),
  tentacle: (
    <>
      <path d="M24 10c8 0 13 5 13 11s-5 10-13 10S11 27 11 21s5-11 13-11z" fill="#1a1a1a" />
      <path d="M13 28C8 33 9 40 3 44M19 31c-2 6-1 10-6 15M29 31c2 6 1 10 6 15M35 28c5 5 4 12 10 16" />
      <circle cx="24" cy="20" r="6" fill="#f3efe4" stroke="none" />
      <circle cx="25" cy="21" r="3" fill="#1a1a1a" stroke="none" />
      <path d="M15 12l-3-6M24 9V3M33 12l3-6" />
    </>
  ),
  matriarch: (
    <>
      <circle cx="24" cy="24" r="15" fill="#f3efe4" strokeWidth={2.8} />
      <circle cx="24" cy="24" r="15" strokeWidth={2.8} />
      <circle cx="19" cy="21" r="3.4" fill="#1a1a1a" />
      <circle cx="29" cy="19" r="3" fill="#1a1a1a" />
      <path d="M20 30c3-2 5-2 8 0M10 36l-4 8M38 36l4 8M8 24l-6-2M40 24l6-2" />
    </>
  ),
  queen: (
    <>
      <path d="M18 18 3 5l5 24 10 4M30 18 45 5l-5 24-10 4" fill="#f3efe4" />
      <path d="M9 12 15 23M39 12 33 23" />
      <path d="M24 5 13 23l11 20 11-20z" fill="#1a1a1a" />
      <path d="M19 15h10M16 21h16M19 30h10" stroke="#f3efe4" strokeWidth={1.5} />
      <path d="M15 8 12 2l8 4 4-6 4 6 8-4-3 6" />
      <circle cx="20" cy="21" r="2.6" fill="#f3efe4" stroke="none" />
      <circle cx="28" cy="21" r="2.6" fill="#f3efe4" stroke="none" />
      <path d="M20 37 24 46l4-9" />
    </>
  ),
  octopus: (
    <>
      <circle cx="24" cy="20" r="12" fill="#f3efe4" strokeWidth={2.8} />
      <circle cx="24" cy="20" r="12" strokeWidth={2.8} />
      <path d="M14 30c-2 6-8 8-10 14M20 32c-1 6-4 9-4 14M28 32c1 6 4 9 4 14M34 30c2 6 8 8 10 14" />
      <ellipse cx="20" cy="19" rx="3.4" ry="4.4" fill="#1a1a1a" />
      <ellipse cx="28" cy="19" rx="3.4" ry="4.4" fill="#1a1a1a" />
    </>
  ),
  eye: (
    <>
      <circle cx="24" cy="24" r="15" fill="#f3efe4" strokeWidth={2.8} />
      <circle cx="24" cy="24" r="9" strokeWidth={2} />
      <circle cx="24" cy="24" r="4" fill="#1a1a1a" />
      <path d="M24 9v-5M24 44v-5M9 24H4M44 24h-5M13 13 9 9M35 13l4-4M13 35l-4 4M35 35l4 4" />
    </>
  ),
  bombhead: (
    <>
      <circle cx="24" cy="26" r="15" fill="#f3efe4" strokeWidth={2.8} />
      <circle cx="24" cy="26" r="15" strokeWidth={2.8} />
      <path d="M30 13c3-5 8-6 8-11M38 2l-2 5M42 4l-3 4" />
      <circle cx="19" cy="23" r="3" fill="#1a1a1a" />
      <circle cx="29" cy="23" r="3" fill="#1a1a1a" />
      <path d="M16 32h16M18 32l1 5M24 32v5M30 32l-1 5" />
      <path d="M12 22 4 26M36 22l8 4" />
    </>
  ),
  king: (
    <>
      <circle cx="24" cy="28" r="15" fill="#f3efe4" strokeWidth={2.8} />
      <circle cx="24" cy="28" r="15" strokeWidth={2.8} />
      <path d="M12 14l-2-10 8 5 6-7 6 7 8-5-2 10" fill="#f3efe4" />
      <circle cx="18" cy="25" r="3" fill="#1a1a1a" />
      <circle cx="30" cy="23" r="2.6" fill="#1a1a1a" />
      <circle cx="24" cy="32" r="3" fill="#1a1a1a" />
      <path d="M17 37h14M10 42l-3 4M38 42l3 4" />
    </>
  ),
};

export function BossDoodle({ id, className = "h-14 w-14" }: { id: BossId; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <g {...S}>{BOSS_FACES[id]}</g>
    </svg>
  );
}
