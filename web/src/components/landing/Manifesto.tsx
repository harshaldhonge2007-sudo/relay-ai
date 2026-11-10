import { useCallback } from "react";
import { useLocation } from "react-router-dom";

/** NOW DARK (bg-ink-primary) — alternates with light Hero above it. */
export default function Manifesto() {
  const location = useLocation();
  const scrollToMethod = useCallback(() => {
    document.getElementById("method")?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", `${location.pathname}#method`);
  }, [location.pathname]);

  return (
    <section
      id="manifesto"
      className="bg-ink-primary"
      aria-labelledby="manifesto-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-[560px] mx-auto text-center sm:text-left">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-tertiary mb-3">
            Manifesto
          </p>
          <h2
            id="manifesto-heading"
            className="font-display font-semibold text-white tracking-tight leading-[0.95] mb-8 sm:mb-12"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Handovers are written in a hurry. They can&apos;t be traced. They
            expose what the reader shouldn&apos;t see. And nobody tests whether
            they actually work.
          </h2>
          <p className="text-sm text-ink-disabled leading-relaxed max-w-[500px] mx-auto sm:mx-0">
            RELAY treats a handover as evidence, not a summary. Every claim
            links to its source, uncertainty and conflicts are shown instead of
            being invented away, and people only see what their role is
            authorised to see. A blind-onboarding simulation proves the
            handover works before it is released — and a human reviews, edits,
            rejects or approves every claim first.
          </p>
          <button
            type="button"
            onClick={scrollToMethod}
            className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-ink-disabled transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-btn"
          >
            See how it works<span className="text-ink-tertiary" aria-hidden="true"> →</span>
          </button>
        </div>
      </div>
    </section>
  );
}
