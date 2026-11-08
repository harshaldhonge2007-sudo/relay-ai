import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { API_PREFIX } from "../apiConfig";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Artifact {
  id: string;
  source: string;
  source_mode: string;
  type: string;
  external_id: string;
  author_id: string;
  occurred_at: string;
  url: string;
  title: string;
  body: string;
  raw: Record<string, unknown>;
  acl_tag: string;
}

type FilterSource = "All" | "GitHub" | "Slack" | "Jira" | "Docs";

const FILTER_OPTIONS: FilterSource[] = ["All", "GitHub", "Slack", "Jira", "Docs"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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
  return source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  TimelineCard                                                      */
/* ------------------------------------------------------------------ */

interface TimelineCardProps {
  artifact: Artifact;
  index: number;
}

function TimelineCard({ artifact, index }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasBody = artifact.body && artifact.body.trim().length > 0;

  return (
    <div className="relative flex items-start gap-4 pl-6">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-5 w-2.5 h-2.5 rounded-full bg-ink-tertiary border-2 border-surface-base z-10"
        style={{ transform: "translateX(-50%)" }}
      />

      {/* Card */}
      <div
        className="flex-1 bg-surface-card shadow-card rounded-card p-4 animate-fadeIn opacity-0"
        style={{
          animationDelay: `${index * 50}ms`,
          animationFillMode: "forwards",
        }}
      >
        {/* Top row: source label + timestamp */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="uppercase text-xs tracking-wider font-medium text-ink-tertiary">
              {artifact.source.toUpperCase()}
            </span>
            {artifact.source_mode && (
              <span className="text-xs text-ink-disabled">
                ({artifact.source_mode})
              </span>
            )}
          </div>
          <span className="text-sm text-ink-tertiary whitespace-nowrap">
            {formatTimestamp(artifact.occurred_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-medium text-ink-primary leading-snug mb-1">
          {artifact.title || "Untitled artifact"}
        </h3>

        {/* Body */}
        {hasBody && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full text-left mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-tertiary rounded-sm"
          >
            <p
              className={`text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap break-words transition-all duration-200 ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {artifact.body}
            </p>
            <span className="text-xs text-ink-tertiary mt-1 inline-block hover:text-ink-secondary transition-colors duration-200">
              {expanded ? "Show less" : "Show more"}
            </span>
          </button>
        )}

        {/* External link */}
        {artifact.url && (
          <a
            href={artifact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-sm text-ink-secondary hover:text-ink-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-tertiary rounded-sm"
          >
            View source
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <path
                d="M6 3h7v7M13 3L5 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FilterPill                                                        */
/* ------------------------------------------------------------------ */

interface FilterPillProps {
  label: FilterSource;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-1.5 text-sm font-medium rounded-pill transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-tertiary focus-visible:ring-offset-2
        ${
          active
            ? "bg-ink-primary text-white shadow-sm"
            : "bg-surface-elevated text-ink-secondary border border-edge-default hover:bg-edge-default"
        }
      `}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({ filter }: { filter: FilterSource }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="#888888"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-ink-secondary text-sm">
        {filter === "All"
          ? "No artifacts found for this case."
          : `No ${filter} artifacts found.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LoadingSkeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pl-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-4">
          <div className="flex-1 bg-surface-card shadow-card rounded-card p-4 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-16 bg-surface-elevated rounded" />
              <div className="h-3 w-12 bg-surface-elevated rounded" />
            </div>
            <div className="h-4 w-3/4 bg-surface-elevated rounded mb-2" />
            <div className="h-3 w-full bg-surface-elevated rounded mb-1" />
            <div className="h-3 w-2/3 bg-surface-elevated rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ErrorBanner                                                       */
/* ------------------------------------------------------------------ */

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
            stroke="#888888"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-ink-secondary text-sm mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-1.5 text-sm font-medium rounded-btn bg-ink-primary text-white hover:opacity-90 transition-opacity duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-tertiary focus-visible:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WorkTimeline (page)                                               */
/* ------------------------------------------------------------------ */

export default function WorkTimeline() {
  const { caseId } = useParams<{ caseId: string }>();

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterSource>("All");

  const fetchArtifacts = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_PREFIX}/cases/${caseId}/artifacts`);
      if (!res.ok) {
        throw new Error(`Failed to load artifacts (${res.status})`);
      }
      const data: Artifact[] = await res.json();
      // Sort newest first
      data.sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() -
          new Date(a.occurred_at).getTime()
      );
      setArtifacts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  /* Filter artifacts */
  const filtered =
    activeFilter === "All"
      ? artifacts
      : artifacts.filter(
          (a) =>
            normalizeSource(a.source) === activeFilter
        );

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-ink-primary mb-6 animate-fadeIn">
          Work Timeline
        </h1>

        {/* Filter pills */}
        <div
          className="flex flex-wrap gap-2 mb-8 animate-fadeIn"
          role="group"
          aria-label="Filter by source"
        >
          {FILTER_OPTIONS.map((option) => (
            <FilterPill
              key={option}
              label={option}
              active={activeFilter === option}
              onClick={() => setActiveFilter(option)}
            />
          ))}
        </div>

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <ErrorBanner message={error} onRetry={fetchArtifacts} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState filter={activeFilter} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-edge-default"
              aria-hidden="true"
            />

            {/* Cards */}
            <div className="space-y-6">
              {filtered.map((artifact, index) => (
                <TimelineCard
                  key={artifact.id}
                  artifact={artifact}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
