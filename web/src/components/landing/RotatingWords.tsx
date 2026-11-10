import { useState, useEffect } from "react";

const WORDS = ["Decisions", "Dependencies", "Risks", "Contacts", "Context", "Next steps"];

/**
 * RotatingWords — cycles through project-knowledge words every 2.5 s.
 *
 * Accessibility:
 *  - The animated container is aria-hidden; a sr-only sentence lists all words.
 *  - A visible pause/play button stops the cycle.
 *  - Automatically pauses when the browser tab is hidden.
 *  - Under prefers-reduced-motion the last word is shown statically.
 *
 * Layout:
 *  - min-w keeps the container stable so the h1 does not shift when words change.
 *  - Words are inline (not absolute) to avoid escape from the stacking context.
 */
interface RotatingWordsProps {
  paused?: boolean;
  onTogglePause?: () => void;
}

export default function RotatingWords({
  paused = false,
  onTogglePause,
}: RotatingWordsProps) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const [index, setIndex] = useState(0);
  const [internalPaused, setInternalPaused] = useState(false);

  const isPaused = paused || internalPaused;

  // Advance word on interval; clear when paused or reduced-motion
  useEffect(() => {
    if (reduced || isPaused) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [reduced, isPaused]);

  // Auto-pause while tab is hidden
  useEffect(() => {
    const handler = () => setInternalPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const handleToggle = onTogglePause ?? (() => setInternalPaused((p) => !p));
  const displayPaused = onTogglePause ? paused : internalPaused;

  if (reduced) {
    return (
      <>
        {/* sr-only: enumerate all words so screen readers understand the concept */}
        <span className="sr-only">
          {"Knowledge shouldn't " + WORDS.join(", ") + " leave with people."}
        </span>
        <span className="inline-block font-mono text-ink-secondary tracking-widest uppercase">
          {WORDS[WORDS.length - 1]}
        </span>
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {/* sr-only sentence enumerating all words */}
      <span className="sr-only">
        {"Knowledge shouldn't " + WORDS.join(", ") + " leave with people."}
      </span>

      {/* Animated word — aria-hidden; min-w prevents layout shift */}
      <span
        aria-hidden="true"
        className="inline-block min-w-[7.5rem] overflow-hidden"
      >
        <span
          key={index}
          className="inline-block font-mono text-ink-secondary tracking-widest uppercase animate-fadeIn"
          style={{ animationDuration: "0.35s" }}
        >
          {WORDS[index]}
        </span>
      </span>

      {/* Visible pause / play button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={displayPaused ? "Play rotating words" : "Pause rotating words"}
        className="inline-flex items-center justify-center w-5 h-5 rounded text-ink-disabled hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200"
      >
        {displayPaused ? (
          /* Play icon */
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" fill="currentColor">
            <path d="M1 1l8 5-8 5V1z" />
          </svg>
        ) : (
          /* Pause icon */
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" fill="currentColor">
            <rect x="1" y="1" width="3" height="10" />
            <rect x="6" y="1" width="3" height="10" />
          </svg>
        )}
      </button>
    </span>
  );
}
