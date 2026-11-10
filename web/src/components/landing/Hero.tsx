import { useCallback } from "react";
import RotatingWords from "./RotatingWords";
import HeroVignette from "./HeroVignette";

interface HeroProps {
  onTryDemo: () => void;
  seeding: boolean;
  hasImportRoute?: boolean;
}

const CLARITY_LINE =
  "RELAY turns Slack, Jira, GitHub and meeting notes into an evidence-linked handover, reviewed by a person and shared by role.";

const DEMO_LINE = "Synthetic demo data. Demo authentication.";

export default function Hero({ onTryDemo, seeding, hasImportRoute = false }: HeroProps) {
  const tryDemo = useCallback(() => onTryDemo(), [onTryDemo]);

  const scrollToMethod = useCallback(() => {
    document.getElementById("method")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <section
      className="relative min-h-screen flex flex-col lg:flex-row items-center justify-between bg-surface-base"
      aria-labelledby="hero-heading"
      style={{ overflowX: "clip" }}
    >
      <div className="lg:max-w-[560px] lg:pr-12 z-10 flex-1 flex flex-col justify-center px-4 lg:px-6 pt-24 pb-12 lg:pb-24">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
          Product
        </p>

        <h1
          id="hero-heading"
          className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-4 sm:mb-6"
          style={{ fontSize: "clamp(3rem, 9vw, 9rem)" }}
        >
          <span className="block">Knowledge shouldn&apos;t</span>
          <span className="block mt-2 lg:mt-4">
            <RotatingWords />
          </span>
          <span className="block mt-2 lg:mt-4">leave with people.</span>
        </h1>

        {/* Hero clarity line */}
        <p className="text-sm font-semibold text-ink-primary leading-relaxed mb-3 max-w-[460px]">
          {CLARITY_LINE}
        </p>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <button
            type="button"
            onClick={tryDemo}
            disabled={seeding}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-btn border border-edge-strong text-ink-primary bg-transparent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seeding ? (
              <>
                <svg
                  className="animate-spin h-3 w-3 text-ink-tertiary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Seeding demo…
              </>
            ) : (
              "Try the sample case"
            )}
          </button>

          <button
            type="button"
            onClick={scrollToMethod}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-btn border border-edge-default text-ink-secondary bg-transparent hover:bg-surface-elevated hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all duration-200"
          >
            See how it works
          </button>

          {hasImportRoute && (
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-btn border border-edge-default text-ink-secondary bg-transparent hover:bg-surface-elevated hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all duration-200"
            >
              Import your own data
            </a>
          )}
        </div>

        <p className="text-[10px] text-ink-secondary tracking-widest uppercase font-semibold">
          {DEMO_LINE}
        </p>
      </div>

      {/* Vignette — right column on desktop, below headline on mobile */}
      <div className="w-full lg:w-[420px] flex flex-col items-center lg:items-end px-4 lg:px-6 pb-12 lg:py-24 relative z-10">
        <HeroVignette />
      </div>
    </section>
  );
}
