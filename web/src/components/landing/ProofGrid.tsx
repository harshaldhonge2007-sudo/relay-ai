import { useCallback } from "react";
import { PROOF_CARDS } from "../../fixtures/sampleCase";

interface ProofGridProps {
  onTryDemo: (screen?: string) => void;
}

/** Dark section (bg-ink-primary) — sits between light Comparison and light WhoItIsFor. */
export default function ProofGrid({ onTryDemo }: ProofGridProps) {
  const tryDemo = useCallback(
    (screen: string) => () => onTryDemo(screen),
    [onTryDemo],
  );

  return (
    <section
      id="proof-grid"
      className="bg-ink-primary text-white"
      aria-labelledby="proof-grid-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-14">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-tertiary mb-2">
                Proof grid
              </p>
              <h2
                id="proof-grid-heading"
                className="font-display font-semibold text-white tracking-tight leading-[0.95]"
                style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
              >
                Everything traces back to a source
              </h2>
            </div>
          </div>

          <p className="text-sm text-ink-disabled leading-relaxed mb-14 max-w-[560px]">
            No customer logos, no testimonials, no invented metrics. These cards
            are evidence from the synthetic sample case; each opens its screen
            in the demo.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROOF_CARDS.map((card) => (
              <article
                key={card.id}
                className="relative z-10 bg-[#181818] border border-white/10 rounded-card p-6 hover:bg-[#202020] hover:border-white/30 hover:-translate-y-1 transition-all duration-300 group focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white shadow-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-pill border border-white/20 text-[9px] font-medium text-white uppercase tracking-wider whitespace-nowrap font-mono"
                  >
                    {card.source}
                  </span>
                  <span
                    className="text-[9px] font-bold text-ink-tertiary uppercase tracking-widest font-mono"
                  >
                    Synthetic sample
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2 leading-snug">
                  {card.title}
                </h3>
                <p className="text-xs text-ink-disabled leading-relaxed mb-4 font-mono">
                  {card.body}
                </p>
                <button
                  type="button"
                  onClick={tryDemo(card.screen)}
                  className="text-xs font-semibold text-white hover:text-ink-disabled transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm inline-flex items-center"
                >
                  Open in demo<span className="ml-1 text-ink-tertiary" aria-hidden="true"> →</span>
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
