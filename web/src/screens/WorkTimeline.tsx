import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { useRole } from "../contexts/CaseContext";
import { Artifact } from "../types";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

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
        className="absolute left-0 top-5 w-2.5 h-2.5 rounded-full bg-ink-primary border-2 border-surface-card z-10"
        style={{ transform: "translateX(-50%)" }}
      />

      {/* Card */}
      <div
        className="flex-1 bg-surface-card border border-edge-default rounded-card p-4 transition-shadow hover:shadow-card animate-fadeIn"
        style={{
          animationDelay: `${index * 30}ms`,
          animationFillMode: "both",
        }}
      >
        {/* Top row: source label + timestamp */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="uppercase text-[11px] font-mono tracking-wider font-semibold text-ink-primary">
              {artifact.source.toUpperCase()}
            </span>
            {artifact.source_mode && (
              <span className="text-[10px] text-ink-secondary font-mono">
                ({artifact.source_mode})
              </span>
            )}
            {artifact.type && (
              <span className="text-[11px] text-ink-secondary">
                · {artifact.type.replace("_", " ")}
              </span>
            )}
          </div>
          <span className="text-xs text-ink-secondary whitespace-nowrap font-mono">
            {formatTimestamp(artifact.occurred_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-ink-primary text-sm leading-snug mb-1">
          {artifact.title || artifact.external_id || "Untitled artifact"}
        </h3>

        {/* Body snippet */}
        {hasBody && (
          <div className="mt-2 text-xs text-ink-primary bg-surface-base p-2.5 rounded-input border border-edge-default">
            <p
              className={`leading-relaxed whitespace-pre-wrap font-mono ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {artifact.body}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-[11px] font-medium text-ink-secondary mt-1.5 hover:text-ink-primary transition-colors underline"
            >
              {expanded ? "Show less" : "Show full snippet"}
            </button>
          </div>
        )}

        {/* Action row */}
        <div className="mt-3 pt-2 border-t border-edge-default flex items-center justify-between">
          <button
            type="button"
            onClick={() => onInspect(artifact)}
            className="text-xs font-semibold text-ink-primary underline hover:text-ink-secondary"
          >
            Inspect in Drawer →
          </button>

          {artifact.url && (
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-secondary hover:text-ink-primary transition-colors"
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
    <PageContainer width="standard">
      <PageHeader
        stepNumber={1}
        stepEyebrow="Connect & Ingest"
        title="Work Timeline"
        description="Chronological cross-platform activity unified from GitHub commits, PRs, Slack conversations, Jira tickets, and documentation."
        metaChips={[
          { label: "Visible Events", value: artifacts.length },
          { label: "Source Filter", value: activeFilter },
        ]}
      />

      {/* Access Restriction Notice */}
      {withheldNotice && (
        <div className="mb-6 p-3 rounded-input bg-surface-base border border-edge-default flex items-center justify-between text-xs animate-fadeIn">
          <span className="font-medium text-ink-primary">
            {withheldNotice}
          </span>
          <span className="text-ink-secondary">
            Role: <strong className="uppercase font-mono text-ink-primary">{role.replace("_", " ")}</strong>
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
            className={`px-3.5 py-1 text-xs font-mono font-medium rounded-pill transition-all duration-200 focus:outline-none ${
              activeFilter === option
                ? "bg-ink-primary text-white shadow-sm font-semibold"
                : "bg-surface-card text-ink-secondary border border-edge-strong hover:border-edge-dark hover:text-ink-primary"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="space-y-4 pl-6 animate-pulse">
          <div className="h-24 bg-surface-card border border-edge-default rounded-card" />
          <div className="h-24 bg-surface-card border border-edge-default rounded-card" />
          <div className="h-24 bg-surface-card border border-edge-default rounded-card" />
        </div>
      )}

      {!loading && error && (
        <div className="p-8 text-center bg-surface-card rounded-card border border-edge-strong">
          <p className="text-sm text-ink-primary font-semibold mb-1">Error</p>
          <p className="text-xs text-ink-secondary mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchArtifacts}
            className="px-4 py-2 text-xs font-semibold rounded-btn bg-ink-primary text-white"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 text-center bg-surface-card rounded-card border border-edge-default">
          <p className="text-sm text-ink-secondary">
            No artifacts found for source &quot;{activeFilter}&quot;.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="relative mb-8">
          {/* Vertical timeline line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-edge-strong"
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

      <NextStepFooter
        nextLabel="Reconstruct Knowledge Distribution"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/knowledge`}
        currentStep={1}
        totalSteps={5}
      />
    </PageContainer>
  );
}
