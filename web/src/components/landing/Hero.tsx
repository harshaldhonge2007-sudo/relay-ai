import { useCallback } from "react";
import RotatingWords from "./RotatingWords";
import HeroVignette from "./HeroVignette";
import LiveRepoIngestion from "./LiveRepoIngestion";

interface HeroProps {
  onTryDemo: () => void;
  seeding: boolean;
  hasImportRoute?: boolean;
}

const CLARITY_LINE =
  "RELAY AI reconstructs architecture state, bus-factor risks, and key decisions from code and communication — compiling a verifiable handover package before critical engineers leave.";

const DEMO_LINE = "Synthetic demo data · Offline fallback available · Role-scoped views";

export default function Hero({ onTryDemo, seeding, hasImportRoute = false }: HeroProps) {
  const tryDemo = useCallback(() => onTryDemo(), [onTryDemo]);

  const scrollToMethod = useCallback(() => {
    document.getElementById("method")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <section
      className="relative flex flex-col justify-between bg-transparent border-b border-edge-default"
      aria-labelledby="hero-heading"
      style={{ overflowX: "clip" }}
    >
      <div className="max-w-shell mx-auto w-full px-6 lg:px-12 pt-20 pb-12 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: 8 of 12 columns */}
          <div className="lg:col-span-8 flex flex-col justify-center">
            <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-ink-secondary mb-3">
              Knowledge handover
            </p>

            <h1
              id="hero-heading"
              className="font-display font-semibold text-ink-primary tracking-tight leading-[1.0] mb-5"
              style={{ fontSize: "clamp(2.75rem, 6.4vw, 6.5rem)" }}
            >
              <span className="block">Knowledge shouldn&apos;t</span>
              <span className="block my-1.5 lg:my-2">
                <RotatingWords />
              </span>
              <span className="block">leave with people.</span>
            </h1>

            {/* Hero clarity line */}
            <p className="text-sm font-normal text-ink-secondary leading-relaxed mb-6 max-w-2xl">
              {CLARITY_LINE}
            </p>

            {/* Live GitHub Repo Ingestion */}
            <div className="mb-6 max-w-xl">
              <LiveRepoIngestion />
            </div>

            {/* Offline / Demo CTA row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <button
                type="button"
                onClick={tryDemo}
                disabled={seeding}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {seeding ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Seeding demo case…</span>
                  </>
                ) : (
                  "Try the sample case"
                )}
              </button>

              <button
                type="button"
                onClick={scrollToMethod}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-btn border border-edge-strong text-ink-primary bg-surface-card hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all"
              >
                See how it works ↓
              </button>

              {hasImportRoute && (
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-btn border border-edge-strong text-ink-secondary bg-transparent hover:bg-surface-elevated hover:text-ink-primary transition-all"
                >
                  Import your own data
                </a>
              )}
            </div>

            <p className="text-[10px] text-ink-secondary font-mono tracking-wider uppercase font-medium">
              {DEMO_LINE}
            </p>
          </div>

          {/* Right Column: 4 of 12 columns (Hero Vignette Claim Card Stack) */}
          <div className="lg:col-span-4 flex flex-col justify-center pt-2 lg:pt-8">
            <HeroVignette />
          </div>
        </div>

        {/* "See the product" Interactive Screenshot / Preview Strip */}
        <div className="mt-12 pt-8 border-t border-edge-default">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-mono uppercase tracking-widest text-ink-secondary font-semibold">
              Platform Workflow Preview
            </span>
            <span className="text-[10px] font-mono text-ink-tertiary">
              5-Step Knowledge Continuity Engine
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { step: "01", name: "Connect Sources", desc: "GitHub, Slack, Jira, Drive", path: "assets" },
              { step: "02", name: "Reconstruct State", desc: "Bus-Factor & Blame Survival", path: "busfactor" },
              { step: "03", name: "Interview Leaver", desc: "Dynamic question queue", path: "interview" },
              { step: "04", name: "Review Handover", desc: "Provenance & PDF Release", path: "handover" },
              { step: "05", name: "Verify Readiness", desc: "Blind Onboarding Sim", path: "completeness" },
            ].map((st) => (
              <div
                key={st.step}
                onClick={tryDemo}
                className="p-3.5 rounded-card border border-edge-default bg-surface-base hover:border-edge-dark hover:bg-surface-card transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary mb-1">
                  <span>STEP {st.step}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
                <h4 className="text-xs font-semibold text-ink-primary group-hover:underline">
                  {st.name}
                </h4>
                <p className="text-[11px] text-ink-secondary mt-0.5 truncate">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
