/**
 * CoveragePanel component (Prompt 2).
 * Displays:
 * 1. Sources status breakdown: included, failed, withheld (ACL), not connected.
 * 2. Claim counts by provenance level with WCAG-AA border styles and text labels.
 * 3. "What this handover cannot tell you" honest limitation disclosures.
 *
 * Strictly adheres to Invariant 7: Monochrome WCAG-AA, zero emojis, provenance by border style.
 */

export interface CoverageData {
  sources_included?: string[];
  sources_failed?: string[];
  sources_withheld?: string[];
  sources_not_connected?: string[];
  claims_by_provenance?: {
    verified?: number;
    stated?: number;
    inferred?: number;
    unknown?: number;
  };
  what_this_handover_cannot_tell_you?: string[];
}

export interface CoveragePanelProps {
  coverage?: CoverageData | null;
  className?: string;
}

const DEFAULT_LIMITATIONS = [
  "Uncommitted local changes, unpushed branches, or git stashes on the leaver's machine",
  "Private 1:1 direct messages or off-the-record verbal hallway discussions",
  "Third-party external SaaS credentials not tracked in repository configurations",
  "Ad-hoc emergency production fixes that bypassed GitHub pull request workflows",
];

export function CoveragePanel({ coverage, className = "" }: CoveragePanelProps) {
  const sourcesIncluded = coverage?.sources_included || ["github", "slack", "jira", "docs", "meetings"];
  const sourcesFailed = coverage?.sources_failed || [];
  const sourcesWithheld = coverage?.sources_withheld || [];
  const sourcesNotConnected = coverage?.sources_not_connected || ["pagerduty", "confluence", "linear"];

  const prov = coverage?.claims_by_provenance || {
    verified: 0,
    stated: 0,
    inferred: 0,
    unknown: 0,
  };

  const limitations = coverage?.what_this_handover_cannot_tell_you || DEFAULT_LIMITATIONS;

  return (
    <section
      aria-label="Handover Evidence Coverage"
      className={`p-5 rounded-card border-2 border-edge-strong bg-surface-card shadow-card space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge-default pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary">
              System Boundary Audit
            </span>
            <h2 className="text-sm font-bold text-ink-primary tracking-wide">
              Handover Coverage & Ingestion Status
            </h2>
          </div>
          <p className="text-xs text-ink-secondary mt-1 max-w-2xl">
            Multi-source provenance accounting across connected repositories, communication channels, and boundary limits.
          </p>
        </div>
        <div className="text-[11px] font-mono text-ink-tertiary">
          Rule: Failed sources force UNKNOWN
        </div>
      </div>

      {/* 1. Sources Status Matrix */}
      <div>
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary mb-3">
          1. Source Connection & Availability
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sources Included */}
          <div className="p-3 border border-edge-strong bg-surface-elevated rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-primary">
                Included ({sourcesIncluded.length})
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-ink-primary text-white font-bold rounded">
                ACTIVE
              </span>
            </div>
            <ul className="space-y-1 text-xs text-ink-secondary font-mono">
              {sourcesIncluded.map((s) => (
                <li key={s} className="truncate">
                  + {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Sources Failed */}
          <div
            className={`p-3 border rounded ${
              sourcesFailed.length > 0
                ? "border-2 border-ink-primary bg-neutral-100"
                : "border border-edge-subtle bg-surface-card opacity-80"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-primary">
                Failed ({sourcesFailed.length})
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 font-bold rounded ${
                  sourcesFailed.length > 0 ? "bg-black text-white" : "border border-edge-subtle text-ink-tertiary"
                }`}
              >
                {sourcesFailed.length > 0 ? "UNAVAILABLE" : "NONE"}
              </span>
            </div>
            {sourcesFailed.length > 0 ? (
              <ul className="space-y-1 text-xs text-ink-primary font-mono font-semibold">
                {sourcesFailed.map((s) => (
                  <li key={s} className="truncate">
                    ! {s} (claims downgraded)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-tertiary italic">0 sources failed</p>
            )}
          </div>

          {/* Sources Withheld */}
          <div className="p-3 border border-edge-default bg-surface-card rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-primary">
                Withheld ({sourcesWithheld.length})
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 border border-edge-strong text-ink-secondary font-bold rounded">
                ACL POLICY
              </span>
            </div>
            {sourcesWithheld.length > 0 ? (
              <ul className="space-y-1 text-xs text-ink-secondary font-mono">
                {sourcesWithheld.map((s) => (
                  <li key={s} className="truncate">
                    # {s} (restricted)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-tertiary italic">No withheld sources</p>
            )}
          </div>

          {/* Sources Not Connected */}
          <div className="p-3 border border-edge-subtle bg-surface-card rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-secondary">
                Not Connected ({sourcesNotConnected.length})
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-surface-elevated text-ink-tertiary font-bold rounded">
                PLANNED
              </span>
            </div>
            <ul className="space-y-1 text-xs text-ink-tertiary font-mono">
              {sourcesNotConnected.map((s) => (
                <li key={s} className="truncate">
                  - {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Claim Counts by Provenance */}
      <div>
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary mb-3">
          2. Handover Claims by Provenance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Verified */}
          <div className="p-3 border-2 border-ink-primary bg-surface-elevated rounded">
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-primary mb-1">
              [VERIFIED]
            </div>
            <div className="text-xl font-mono font-bold text-ink-primary">
              {prov.verified ?? 0}
            </div>
            <div className="text-[10px] text-ink-secondary mt-1">
              Grounded in exact evidence
            </div>
          </div>

          {/* Stated */}
          <div className="p-3 border border-ink-primary bg-surface-card rounded">
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-primary mb-1">
              [STATED]
            </div>
            <div className="text-xl font-mono font-bold text-ink-primary">
              {prov.stated ?? 0}
            </div>
            <div className="text-[10px] text-ink-secondary mt-1">
              Direct quote from interview
            </div>
          </div>

          {/* Inferred */}
          <div className="p-3 border border-dashed border-ink-primary bg-surface-card rounded">
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-secondary mb-1">
              [INFERRED]
            </div>
            <div className="text-xl font-mono font-bold text-ink-primary">
              {prov.inferred ?? 0}
            </div>
            <div className="text-[10px] text-ink-secondary mt-1">
              Derived pattern / model estimate
            </div>
          </div>

          {/* Unknown */}
          <div className="p-3 border border-dotted border-edge-strong bg-neutral-50 rounded">
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-tertiary mb-1">
              [UNKNOWN]
            </div>
            <div className="text-xl font-mono font-bold text-ink-primary">
              {prov.unknown ?? 0}
            </div>
            <div className="text-[10px] text-ink-secondary mt-1">
              Missing evidence / source down
            </div>
          </div>
        </div>
      </div>

      {/* 3. What this handover cannot tell you */}
      <div className="border-t border-edge-default pt-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary">
            3. What this handover cannot tell you
          </h3>
          <span className="text-[10px] font-mono text-ink-tertiary">
            (Honest Boundary Disclosures)
          </span>
        </div>
        <div className="p-3 bg-surface-elevated border border-edge-subtle rounded">
          <ul className="space-y-1.5 text-xs text-ink-secondary list-disc list-inside">
            {limitations.map((lim, idx) => (
              <li key={idx} className="leading-relaxed">
                {lim}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CoveragePanel;
