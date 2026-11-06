import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EvidenceSpan {
  artifact_id: string;
  span: string;
  role: string;
}

interface Finding {
  id: string;
  kind: "contradiction" | "inflight" | "hidden_dependency" | "undocumented_decision";
  severity: number;
  confidence: number;
  title: string;
  summary: string;
  evidence: EvidenceSpan[];
  status: string;
  created_at: string;
}

type KindFilter = "all" | Finding["kind"];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const KIND_LABELS: Record<KindFilter, string> = {
  all: "All",
  contradiction: "Contradiction",
  inflight: "In-Flight",
  hidden_dependency: "Hidden Dep.",
  undocumented_decision: "Undocumented",
};

const KIND_DISPLAY: Record<Finding["kind"], string> = {
  contradiction: "Contradiction",
  inflight: "In-Flight",
  hidden_dependency: "Hidden Dependency",
  undocumented_decision: "Undocumented Decision",
};

const FILTER_KEYS: KindFilter[] = [
  "all",
  "contradiction",
  "inflight",
  "hidden_dependency",
  "undocumented_decision",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function severityBarColor(severity: number): string {
  if (severity >= 0.8) return "bg-ink-primary";
  if (severity >= 0.6) return "bg-ink-secondary";
  return "bg-ink-tertiary";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FilterPills({
  active,
  counts,
  onChange,
}: {
  active: KindFilter;
  counts: Record<KindFilter, number>;
  onChange: (k: KindFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_KEYS.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`
              rounded-pill px-4 py-1.5 text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2
              ${
                isActive
                  ? "bg-ink-primary text-white shadow-card"
                  : "border border-edge-strong text-ink-secondary hover:border-ink-tertiary hover:text-ink-primary"
              }
            `}
          >
            {KIND_LABELS[key]}
            <span
              className={`ml-1.5 text-xs ${
                isActive ? "text-white/70" : "text-ink-tertiary"
              }`}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EvidenceSection({ evidence }: { evidence: EvidenceSpan[] }) {
  const [open, setOpen] = useState(false);

  if (evidence.length === 0) return null;

  return (
    <div className="mt-4 border-t border-edge-subtle pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink-secondary hover:text-ink-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2 rounded-input px-1 -ml-1"
        aria-expanded={open}
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
        Evidence ({evidence.length})
      </button>

      {open && (
        <div className="mt-2 space-y-2 animate-fadeIn">
          {evidence.map((e, idx) => (
            <div
              key={idx}
              className="rounded-input bg-surface-elevated px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 text-ink-secondary">
                <span className="font-mono text-xs text-ink-tertiary">
                  {e.artifact_id}
                </span>
                <span className="text-ink-disabled">|</span>
                <span className="uppercase text-xs tracking-wider font-medium text-ink-tertiary">
                  {e.role}
                </span>
              </div>
              {e.span && (
                <p className="mt-1 text-ink-secondary leading-relaxed">
                  {e.span}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-edge-strong px-2 py-0.5 text-xs font-medium text-ink-secondary whitespace-nowrap">
      {status}
    </span>
  );
}

function FindingCard({
  finding,
  index,
}: {
  finding: Finding;
  index: number;
}) {
  return (
    <div
      className="bg-surface-card shadow-card rounded-card p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-float animate-fadeIn"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Top row: kind label + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase text-xs tracking-wider font-medium text-ink-tertiary">
          {KIND_DISPLAY[finding.kind]}
        </span>
        <StatusPill status={finding.status} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-ink-primary leading-snug">
        {finding.title}
      </h3>

      {/* Summary */}
      <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
        {finding.summary}
      </p>

      {/* Severity bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${severityBarColor(
              finding.severity
            )}`}
            style={{ width: pct(finding.severity) }}
          />
        </div>
      </div>

      {/* Severity / Confidence text */}
      <div className="mt-2 flex items-center gap-4 text-sm">
        <span className="text-ink-secondary">
          Severity:{" "}
          <span className="font-medium text-ink-primary">
            {pct(finding.severity)}
          </span>
        </span>
        <span className="text-ink-secondary">
          Confidence:{" "}
          <span className="font-medium text-ink-primary">
            {pct(finding.confidence)}
          </span>
        </span>
      </div>

      {/* Evidence */}
      <EvidenceSection evidence={finding.evidence} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 rounded bg-surface-elevated" />
        <div className="h-5 w-12 rounded-pill bg-surface-elevated" />
      </div>
      <div className="h-5 w-3/4 rounded bg-surface-elevated" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-surface-elevated" />
        <div className="h-3 w-5/6 rounded bg-surface-elevated" />
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-surface-elevated" />
      <div className="mt-2 flex gap-4">
        <div className="h-3 w-20 rounded bg-surface-elevated" />
        <div className="h-3 w-24 rounded bg-surface-elevated" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function Findings() {
  const { caseId } = useParams<{ caseId: string }>();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<KindFilter>("all");

  /* Fetch findings */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cases/${caseId}/findings`);
        if (!res.ok) throw new Error(`Failed to load findings (${res.status})`);
        const data: Finding[] = await res.json();
        if (!cancelled) setFindings(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  /* Derived: counts per kind */
  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = {
      all: findings.length,
      contradiction: 0,
      inflight: 0,
      hidden_dependency: 0,
      undocumented_decision: 0,
    };
    for (const f of findings) {
      c[f.kind] = (c[f.kind] || 0) + 1;
    }
    return c;
  }, [findings]);

  /* Derived: filtered + sorted */
  const visible = useMemo(() => {
    const filtered =
      activeFilter === "all"
        ? findings
        : findings.filter((f) => f.kind === activeFilter);
    return [...filtered].sort((a, b) => b.severity - a.severity);
  }, [findings, activeFilter]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-fadeIn">
          <h1 className="text-2xl font-semibold text-ink-primary">Findings</h1>
          {!loading && (
            <span className="rounded-pill bg-surface-elevated px-3 py-0.5 text-sm font-medium text-ink-secondary">
              {findings.length} finding{findings.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filter pills */}
        {!loading && !error && (
          <div className="mb-6 animate-fadeIn" style={{ animationDelay: "60ms" }}>
            <FilterPills
              active={activeFilter}
              counts={counts}
              onChange={setActiveFilter}
            />
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-card border border-edge-strong bg-surface-card p-6 text-center animate-fadeIn">
            <p className="text-ink-secondary text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-btn bg-ink-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-px hover:shadow-float focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visible.length === 0 && (
          <div className="rounded-card border border-edge-default bg-surface-card p-10 text-center animate-fadeIn">
            <p className="text-ink-tertiary text-sm">
              {activeFilter === "all"
                ? "No findings have been detected yet."
                : `No ${KIND_LABELS[activeFilter].toLowerCase()} findings found.`}
            </p>
          </div>
        )}

        {/* Finding cards */}
        {!loading && !error && visible.length > 0 && (
          <div className="space-y-4">
            {visible.map((finding, idx) => (
              <FindingCard key={finding.id} finding={finding} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
