interface ComparisonRow {
  feature: string;
  generic: string;
  relay: string;
  status: "Implemented" | "Roadmap";
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Links every claim to a source",
    generic: "Typically outputs narrative text without verifiable citations; references may be missing or ungrounded.",
    relay: "Offline lexical and entity grounding verifier tags claims VERIFIED, STATED or INFERRED, linked to commits, tickets or notes.",
    status: "Implemented",
  },
  {
    feature: "Flags conflicts instead of resolving them",
    generic: "Typically smooths over contradictions or picks one version silently.",
    relay: "Contradictions surfaced side-by-side (e.g. ticket marked Done while incident chat remains active).",
    status: "Implemented",
  },
  {
    feature: "Shows different content per role",
    generic: "Typically generates a single document shared with all recipients without access boundary awareness.",
    relay: "Server-side enforcement with per-role views (Engineering Lead, Successor, Contractor) and withheld notices.",
    status: "Implemented",
  },
  {
    feature: "Requires human approval before release",
    generic: "Typically produced and shared without a structured review workflow.",
    relay: "Mandatory lead sign-off with reject reason requirement; release is gated until review is completed.",
    status: "Implemented",
  },
  {
    feature: "Tests whether the handover works",
    generic: "Typically untested; gaps are discovered during live incidents after departure.",
    relay: "Blind-onboarding simulation measures required fact coverage score and triggers targeted follow-up interview questions.",
    status: "Implemented",
  },
];

/** Light section (bg-surface-base) — sits between dark RoleDemo and dark ProofGrid. */
export default function Comparison() {
  return (
    <section
      id="comparison"
      className="bg-surface-base"
      aria-labelledby="comparison-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
            Comparison
          </p>
          <h2
            id="comparison-heading"
            className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-4"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Not just a summariser
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-12 max-w-[560px]">
            A handover is an operational asset, not an article. We compare against generic AI summarisation.
          </p>

          {/* Desktop comparison table */}
          <div className="relative z-10 hidden md:block overflow-x-auto rounded-card border border-edge-default bg-surface-card shadow-card">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-edge-default bg-surface-elevated">
                  <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-ink-primary w-1/4">
                    Capability
                  </th>
                  <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-ink-secondary w-3/8">
                    A generic summariser
                  </th>
                  <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-ink-primary w-3/8">
                    RELAY
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-default text-sm">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-surface-elevated/50 transition-colors">
                    <th scope="row" className="py-5 px-6 font-semibold text-ink-primary align-top">
                      {row.feature}
                    </th>
                    <td className="py-5 px-6 text-ink-secondary align-top leading-relaxed">
                      {row.generic}
                    </td>
                    <td className="py-5 px-6 text-ink-primary align-top leading-relaxed">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-pill border border-edge-strong text-[9px] font-mono uppercase tracking-widest font-semibold text-ink-primary bg-surface-base">
                          {row.status}
                        </span>
                      </div>
                      <p>{row.relay}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {COMPARISON_ROWS.map((row) => (
              <div key={row.feature} className="relative z-10 p-6 rounded-card border border-edge-default bg-surface-card shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-ink-primary">{row.feature}</h3>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill border border-edge-strong text-[9px] font-mono uppercase tracking-widest font-semibold text-ink-primary bg-surface-base">
                    {row.status}
                  </span>
                </div>
                <div className="text-xs text-ink-secondary leading-relaxed pt-1 border-t border-edge-subtle">
                  <p className="font-semibold uppercase tracking-wider text-[10px] text-ink-secondary mb-1">A generic summariser:</p>
                  <p>{row.generic}</p>
                </div>
                <div className="text-xs text-ink-primary leading-relaxed pt-2 border-t border-edge-subtle">
                  <p className="font-semibold uppercase tracking-wider text-[10px] text-ink-primary mb-1">RELAY:</p>
                  <p>{row.relay}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

