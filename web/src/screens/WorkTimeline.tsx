import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { useRole } from "../contexts/CaseContext";
import { Artifact } from "../types";

type FilterSource = "All" | "GitHub" | "Slack" | "Jira" | "Docs" | "Meetings";

const FILTER_OPTIONS: FilterSource[] = ["All", "GitHub", "Slack", "Jira", "Docs", "Meetings"];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function normalizeSource(source: string): string {
  if (!source) return "Docs";
  const s = source.toLowerCase();
  if (s === "github") return "GitHub";
  if (s === "slack") return "Slack";
  if (s === "jira") return "Jira";
  if (s === "docs") return "Docs";
  if (s === "meetings") return "Meetings";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TimelineCardProps {
  artifact: Artifact;
  index: number;
  onInspect: (art: Artifact) => void;
}

function TimelineCard({ artifact, index, onInspect }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = Boolean(artifact.body && artifact.body.trim().length > 0);

  return (
    <div className="relative flex items-start gap-4 pl-6">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-5 w-2.5 h-2.5 rounded-full bg-ink-tertiary border-2 border-surface-base z-10"
        style={{ transform: "translateX(-50%)" }}
      />

      {/* Card */}
      <div
        className="flex-1 bg-surface-card border border-edge-default shadow-card rounded-card p-4 transition-transform hover:-translate-y-px animate-fadeIn"
        style={{
          animationDelay: `${index * 40}ms`,
          animationFillMode: "both",
        }}
      >
        {/* Top row: source label + timestamp */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="uppercase text-xs tracking-wider font-semibold text-ink-tertiary">
              {artifact.source.toUpperCase()}
            </span>
            {artifact.source_mode && (
              <span className="text-[11px] text-ink-disabled font-mono">
                ({artifact.source_mode})
              </span>
            )}
            {artifact.type && (
              <span className="text-[11px] text-ink-tertiary">
                · {artifact.type.replace("_", " ")}
              </span>
            )}
          </div>
          <span className="text-xs text-ink-tertiary whitespace-nowrap font-mono">
            {formatTimestamp(artifact.occurred_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-medium text-ink-primary text-sm leading-snug mb-1">
          {artifact.title || artifact.external_id || "Untitled artifact"}
        </h3>

        {/* Body snippet */}
        {hasBody && (
          <div className="mt-2 text-xs text-ink-secondary bg-surface-elevated p-2.5 rounded-input border border-edge-subtle">
            <p
              className={`leading-relaxed whitespace-pre-wrap ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {artifact.body}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-[11px] font-medium text-ink-tertiary mt-1.5 hover:text-ink-primary transition-colors underline"
            >
              {expanded ? "Show less" : "Show full snippet"}
            </button>
          </div>
        )}

        {/* Action row */}
        <div className="mt-3 pt-2 border-t border-edge-subtle flex items-center justify-between">
          <button
            type="button"
            onClick={() => onInspect(artifact)}
            className="text-xs font-medium text-ink-primary underline hover:text-ink-secondary"
          >
            Inspect in Drawer →
          </button>

          {artifact.url && (
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-tertiary hover:text-ink-primary transition-colors"
            >
              External link ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkTimeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const { openDrawer } = useEvidenceDrawer();

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [withheldNotice, setWithheldNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterSource>("All");

  const fetchArtifacts = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/cases/${caseId}/artifacts`);
      if (!res.ok) {
        throw new Error(`Failed to load artifacts (${res.status})`);
      }
      const data = await res.json();
      const items: Artifact[] = Array.isArray(data) ? data : data.items || [];
      const notice: string | null = data.withheld_notice ?? null;

      // Sort newest first
      items.sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
      setArtifacts(items);
      setWithheldNotice(notice);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, role]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const handleInspect = (art: Artifact) => {
    openDrawer(
      [
        {
          artifact_id: art.id,
          title: art.title,
          source: art.source,
          source_mode: art.source_mode,
          type: art.type,
          external_id: art.external_id,
          occurred_at: art.occurred_at,
          url: art.url,
          body: art.body,
        },
      ],
      art.title
    );
  };

  const filtered =
    activeFilter === "All"
      ? artifacts
      : artifacts.filter((a) => normalizeSource(a.source) === activeFilter);

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl font-semibold text-ink-primary">
              Work Timeline
            </h1>
            <p className="text-xs text-ink-secondary mt-0.5">
              Chronological cross-platform activity unified from GitHub, Slack, Jira, and documentation.
            </p>
          </div>
          <span className="text-xs font-mono text-ink-tertiary">
            {artifacts.length} visible events
          </span>
        </div>

        {/* Access Restriction Notice */}
        {withheldNotice && (
          <div className="mb-6 p-3 rounded-input bg-surface-elevated border border-edge-strong flex items-center justify-between text-xs animate-fadeIn">
            <span className="font-medium text-ink-primary">
              {withheldNotice}
            </span>
            <span className="text-ink-tertiary">
              Role: <strong className="uppercase font-mono">{role.replace("_", " ")}</strong>
            </span>
          </div>
        )}

        {/* Filter pills */}
        <div
          className="flex flex-wrap gap-2 mb-8 animate-fadeIn"
          role="group"
          aria-label="Filter by source"
        >
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActiveFilter(option)}
              className={`px-3.5 py-1 text-xs font-medium rounded-pill transition-all duration-200 focus:outline-none ${
                activeFilter === option
                  ? "bg-ink-primary text-white shadow-card"
                  : "bg-surface-elevated text-ink-secondary border border-edge-default hover:border-ink-tertiary"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="space-y-4 pl-6 animate-pulse">
            <div className="h-24 bg-surface-elevated rounded-card" />
            <div className="h-24 bg-surface-elevated rounded-card" />
            <div className="h-24 bg-surface-elevated rounded-card" />
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center bg-surface-card rounded-card border border-edge-strong">
            <p className="text-sm text-ink-primary font-medium mb-1">Error</p>
            <p className="text-xs text-ink-tertiary mb-4">{error}</p>
            <button
              type="button"
              onClick={fetchArtifacts}
              className="px-4 py-2 text-xs font-medium rounded-btn bg-ink-primary text-white"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-16 text-center bg-surface-card rounded-card border border-edge-default">
            <p className="text-sm text-ink-tertiary">
              No artifacts found for source "{activeFilter}".
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-edge-default"
              aria-hidden="true"
            />

            {/* Cards */}
            <div className="space-y-5">
              {filtered.map((artifact, index) => (
                <TimelineCard
                  key={artifact.id}
                  artifact={artifact}
                  index={index}
                  onInspect={handleInspect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
