import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HandoverItem {
  id: string;
  section: string;
  text: string;
  evidence_ids: string[];
  provenance: "inferred" | "stated" | "verified";
  confidence: number;
}

interface CaseData {
  id: string;
  name: string;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

const API_BASE = "";

async function fetchHandover(caseId: string): Promise<HandoverItem[]> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/handover`);
  if (!res.ok) throw new Error("Failed to fetch handover data");
  return res.json();
}

async function fetchCase(caseId: string): Promise<CaseData> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}`);
  if (!res.ok) throw new Error("Failed to fetch case data");
  return res.json();
}

async function approveHandover(caseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/handover/approve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to approve handover");
}

async function releaseHandover(caseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/handover/release`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to release handover");
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  let classes =
    "inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold uppercase tracking-wider select-none";

  if (normalized === "approved") {
    classes += " bg-ink-primary text-white";
  } else if (normalized === "released") {
    classes += " border-2 border-ink-primary text-ink-primary bg-transparent";
  } else {
    // interviewing / default
    classes += " bg-surface-elevated text-ink-secondary";
  }

  return <span className={classes}>{status}</span>;
}

function ProvenanceBadge({
  provenance,
}: {
  provenance: "inferred" | "stated" | "verified";
}) {
  let classes =
    "inline-flex items-center rounded-pill px-3 py-1 text-xs uppercase tracking-wider font-medium select-none";

  switch (provenance) {
    case "verified":
      classes += " bg-ink-primary text-white";
      break;
    case "stated":
      classes += " bg-surface-elevated text-ink-primary border border-edge-strong";
      break;
    case "inferred":
      classes += " bg-surface-elevated text-ink-tertiary border border-edge-default";
      break;
  }

  return <span className={classes}>{provenance}</span>;
}

function renderBoldText(raw: string): React.ReactNode {
  // Split on **bold** markers and render <strong> elements
  const parts = raw.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function HandoverCard({ item }: { item: HandoverItem }) {
  const confidencePct = Math.round(item.confidence * 100);
  const sourceCount = item.evidence_ids.length;
  const sourceLabel = sourceCount === 1 ? "1 source" : `${sourceCount} sources`;

  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 transition-transform duration-200 hover:-translate-y-px">
      {/* Content */}
      <p className="text-ink-primary text-sm leading-relaxed whitespace-pre-wrap mb-4">
        {renderBoldText(item.text)}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <ProvenanceBadge provenance={item.provenance} />

        <span className="text-xs text-ink-secondary font-medium">
          Confidence: {confidencePct}%
        </span>

        <span className="text-xs text-ink-tertiary">{sourceLabel}</span>
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  items,
}: {
  title: string;
  items: HandoverItem[];
}) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-ink-primary border-b border-edge-default pb-2 mb-4">
        {title}
      </h2>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <HandoverCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Title skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-56 bg-surface-elevated rounded-btn" />
        <div className="h-6 w-24 bg-surface-elevated rounded-pill" />
      </div>

      {/* Button row skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-24 bg-surface-elevated rounded-btn" />
        <div className="h-10 w-24 bg-surface-elevated rounded-btn" />
        <div className="h-10 w-28 bg-surface-elevated rounded-btn" />
      </div>

      {/* Section skeletons */}
      {[1, 2].map((s) => (
        <div key={s} className="space-y-4">
          <div className="h-6 w-40 bg-surface-elevated rounded-btn" />
          <div className="h-32 w-full bg-surface-elevated rounded-card" />
          <div className="h-32 w-full bg-surface-elevated rounded-card" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Back arrow icon (inline SVG)                                       */
/* ------------------------------------------------------------------ */

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function Handover() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [items, setItems] = useState<HandoverItem[]>([]);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  /* ---- Fetch data ------------------------------------------------ */

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [handoverItems, cd] = await Promise.all([
        fetchHandover(caseId),
        fetchCase(caseId),
      ]);
      setItems(handoverItems);
      setCaseData(cd);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---- Group items by section ------------------------------------ */

  const sections = useMemo(() => {
    const map = new Map<string, HandoverItem[]>();
    for (const item of items) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [items]);

  /* ---- Actions --------------------------------------------------- */

  const handleApprove = async () => {
    if (!caseId) return;
    setActing(true);
    try {
      await approveHandover(caseId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActing(false);
    }
  };

  const handleRelease = async () => {
    if (!caseId) return;
    setActing(true);
    try {
      await releaseHandover(caseId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setActing(false);
    }
  };

  const handleExport = () => {
    alert("PDF export will be available in a future release.");
  };

  /* ---- Derived state --------------------------------------------- */

  const status = caseData?.status?.toLowerCase() ?? "";
  const canApprove = status === "interviewing";
  const canRelease = status === "approved";

  /* ---- Render ---------------------------------------------------- */

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 animate-fadeIn">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink-primary transition-colors duration-200 mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2 rounded-btn"
        >
          <ArrowLeftIcon />
          Back
        </button>

        {loading && <Skeleton />}

        {error && !loading && (
          <div className="bg-surface-card border border-edge-strong rounded-card p-6 text-center shadow-card">
            <p className="text-ink-primary font-medium mb-1">
              Something went wrong
            </p>
            <p className="text-ink-tertiary text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="bg-ink-primary text-white text-sm font-medium px-5 py-2 rounded-btn hover:-translate-y-px transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && caseData && (
          <>
            {/* ---- Header row ---- */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-ink-primary">
                  Handover Document
                </h1>
                <StatusBadge status={caseData.status} />
              </div>

              <p className="text-sm text-ink-tertiary truncate max-w-xs">
                {caseData.name}
              </p>
            </div>

            {/* ---- Action buttons ---- */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <button
                type="button"
                disabled={!canApprove || acting}
                onClick={handleApprove}
                className={`inline-flex items-center justify-center text-sm font-medium px-5 py-2.5 rounded-btn transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2 ${
                  canApprove && !acting
                    ? "bg-ink-primary text-white hover:-translate-y-px shadow-card"
                    : "bg-ink-primary text-white opacity-50 cursor-not-allowed"
                }`}
              >
                {acting ? "Processing..." : "Approve"}
              </button>

              <button
                type="button"
                disabled={!canRelease || acting}
                onClick={handleRelease}
                className={`inline-flex items-center justify-center text-sm font-medium px-5 py-2.5 rounded-btn transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2 ${
                  canRelease && !acting
                    ? "bg-ink-primary text-white hover:-translate-y-px shadow-card"
                    : "bg-ink-primary text-white opacity-50 cursor-not-allowed"
                }`}
              >
                Release
              </button>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center text-sm font-medium px-5 py-2.5 rounded-btn border border-edge-strong text-ink-secondary bg-surface-card hover:-translate-y-px hover:border-ink-primary transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2"
              >
                Export PDF
              </button>
            </div>

            {/* ---- Sections ---- */}
            {sections.length === 0 && (
              <div className="bg-surface-card shadow-card rounded-card p-10 text-center">
                <p className="text-ink-tertiary text-sm">
                  No handover items found for this case.
                </p>
              </div>
            )}

            {sections.map(([title, sectionItems]) => (
              <SectionBlock key={title} title={title} items={sectionItems} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
