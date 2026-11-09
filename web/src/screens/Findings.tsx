import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { useRole } from "../contexts/CaseContext";
import { Finding } from "../types";

type KindFilter = "all" | "contradiction" | "inflight" | "hidden_dependency" | "undocumented_decision";

const KIND_LABELS: Record<KindFilter, string> = {
  all: "All",
  contradiction: "Contradiction",
  inflight: "In-Flight",
  hidden_dependency: "Hidden Dep.",
  undocumented_decision: "Undocumented",
};

const KIND_DISPLAY: Record<string, string> = {
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

function severityBarColor(severity: number): string {
  if (severity >= 0.8) return "bg-ink-primary";
  if (severity >= 0.6) return "bg-ink-secondary";
  return "bg-ink-tertiary";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function FindingCard({
  finding,
  index,
  onInspectEvidence,
}: {
  finding: Finding;
  index: number;
  onInspectEvidence: (artifactId: string, span?: string) => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div
      className="bg-surface-card border border-edge-default shadow-card rounded-card p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-float animate-fadeIn"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
    >
      {/* Top row: kind label + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase text-xs tracking-wider font-semibold text-ink-tertiary">
          {KIND_DISPLAY[finding.kind] || finding.kind}
        </span>
        <span className="inline-flex items-center rounded-pill border border-edge-strong px-2 py-0.5 text-[11px] font-medium text-ink-secondary whitespace-nowrap uppercase">
          {finding.status}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-ink-primary leading-snug">
        {finding.title}
      </h3>

      {/* Summary */}
      <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
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
      <div className="mt-2 flex items-center justify-between text-xs text-ink-tertiary">
        <div className="flex items-center gap-4">
          <span>
            Severity: <strong className="text-ink-primary">{pct(finding.severity)}</strong>
          </span>
          <span>
            Confidence: <strong className="text-ink-primary">{pct(finding.confidence)}</strong>
          </span>
        </div>

        {finding.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEvidence((e) => !e)}
            className="font-medium text-ink-primary underline hover:text-ink-secondary"
          >
            {showEvidence ? "Hide Evidence" : `Evidence (${finding.evidence.length})`}
          </button>
        )}
      </div>

      {/* Evidence list */}
      {showEvidence && finding.evidence.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge-subtle space-y-2 animate-fadeIn">
          {finding.evidence.map((e, idx) => (
            <div
              key={idx}
              className="rounded-input bg-surface-elevated p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-edge-subtle"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-tertiary font-semibold">
                    {e.artifact_id}
                  </span>
                  {e.role && (
                    <span className="uppercase text-[10px] tracking-wider text-ink-tertiary font-semibold">
                      · {e.role}
                    </span>
                  )}
                  {e.withheld && (
                    <span className="rounded-pill border border-edge-strong px-2 py-0.2 text-[10px] font-semibold text-ink-disabled">
                      Access Restricted
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary font-mono italic">
                  "{e.span || "Evidence cited"}"
                </p>
              </div>

              {!e.withheld ? (
                <button
                  type="button"
                  onClick={() => onInspectEvidence(e.artifact_id, e.span)}
                  className="text-xs font-semibold text-ink-primary underline hover:text-ink-secondary shrink-0 self-end sm:self-auto"
                >
                  View Source →
                </button>
              ) : (
                <span className="text-[11px] text-ink-disabled shrink-0 italic">
                  Withheld
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Findings() {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const { openDrawer } = useEvidenceDrawer();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<KindFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/cases/${caseId}/findings`);
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
  }, [caseId, role]);

  const handleInspect = async (artifactId: string, span?: string) => {
    try {
      const res = await apiFetch(`/artifacts/${artifactId}`);
      if (res.ok) {
        const art = await res.json();
        openDrawer([{ ...art, highlight: span }], art.title);
      } else {
        openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
      }
    } catch {
      openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
    }
  };

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = {
      all: findings.length,
      contradiction: 0,
      inflight: 0,
      hidden_dependency: 0,
      undocumented_decision: 0,
    };
    for (const f of findings) {
      if (f.kind in c) {
        c[f.kind as KindFilter] = (c[f.kind as KindFilter] || 0) + 1;
      }
    }
    return c;
  }, [findings]);

  const visible = useMemo(() => {
    const filtered =
      activeFilter === "all"
        ? findings
        : findings.filter((f) => f.kind === activeFilter);
    return [...filtered].sort((a, b) => b.severity - a.severity);
  }, [findings, activeFilter]);

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl font-semibold text-ink-primary">Findings</h1>
            <p className="text-xs text-ink-secondary mt-0.5">
              Deterministic gap and contradiction detection linking disparate data sources.
            </p>
          </div>
          {!loading && (
            <span className="rounded-pill bg-surface-elevated border border-edge-default px-3 py-1 text-xs font-semibold text-ink-secondary">
              {findings.length} finding{findings.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filter pills */}
        {!loading && !error && (
          <div className="flex flex-wrap gap-2 mb-6 animate-fadeIn">
            {FILTER_KEYS.map((key) => {
              const isActive = activeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`rounded-pill px-3.5 py-1 text-xs font-medium transition-all duration-200 focus:outline-none ${
                    isActive
                      ? "bg-ink-primary text-white shadow-card"
                      : "border border-edge-strong text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {KIND_LABELS[key]}
                  <span className={`ml-1.5 text-[10px] ${isActive ? "text-white/70" : "text-ink-tertiary"}`}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 bg-surface-elevated rounded-card" />
            <div className="h-28 bg-surface-elevated rounded-card" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-card border border-edge-strong bg-surface-card p-6 text-center">
            <p className="text-xs text-ink-secondary mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-btn bg-ink-primary px-4 py-1.5 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visible.length === 0 && (
          <div className="rounded-card border border-edge-default bg-surface-card p-12 text-center">
            <p className="text-xs text-ink-tertiary">
              No findings found for this category.
            </p>
          </div>
        )}

        {/* Findings List */}
        {!loading && !error && visible.length > 0 && (
          <div className="space-y-4">
            {visible.map((f, idx) => (
              <FindingCard
                key={f.id}
                finding={f}
                index={idx}
                onInspectEvidence={handleInspect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
