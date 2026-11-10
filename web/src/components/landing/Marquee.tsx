import { useState, useEffect } from "react";

const MARQUEE_TEXT = "Connect · Reconstruct · Verify · Review · Handover";

/**
 * Marquee — slow horizontal divider between sections.
 *
 * Accessibility:
 *  - Visible pause/play button stops the animation.
 *  - Automatically pauses while the tab is hidden.
 *  - Under prefers-reduced-motion, renders a static single line without scroll.
 *
 * Overflow:
 *  - The container uses overflow:hidden in all cases (never overflow:visible).
 */
interface MarqueeProps {
  reducedMotion?: boolean;
  dark?: boolean;
}

export default function Marquee({ reducedMotion = false, dark = false }: MarqueeProps) {
  const reduced =
    reducedMotion ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return (
    <div
      className={`relative h-[26px] border-t border-b overflow-hidden select-none ${
        dark
          ? "bg-ink-primary border-white/10 text-ink-tertiary"
          : "bg-surface-base border-edge-default text-ink-disabled"
      }`}
      aria-label="Process steps: Connect, Reconstruct, Verify, Review, Handover"
    >
      <div
        className={`flex items-center h-full gap-16 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest font-mono ${
          reduced || paused ? "" : "animate-marquee"
        }`}
        aria-hidden="true"
        style={paused ? { animationPlayState: "paused" } : undefined}
      >
        <span>{MARQUEE_TEXT}</span>
        {!reduced && <span>{MARQUEE_TEXT}</span>}
        {!reduced && <span>{MARQUEE_TEXT}</span>}
      </div>

      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play marquee" : "Pause marquee"}
          className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${
            dark
              ? "bg-ink-primary text-ink-disabled hover:text-white focus-visible:outline-white"
              : "bg-surface-base text-ink-disabled hover:text-ink-secondary focus-visible:outline-ink-primary"
          }`}
        >
          {paused ? (
            <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" fill="currentColor">
              <path d="M1 1l6 4-6 4V1z" />
            </svg>
          ) : (
            <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" fill="currentColor">
              <rect x="0" y="0" width="2.5" height="10" />
              <rect x="5" y="0" width="2.5" height="10" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
