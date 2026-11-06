import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Source {
  source: string;
  status: string;
  last_synced: string;
  items: number;
}

interface IdentityMapping {
  name: string;
  github: string;
  slack: string;
  jira: string;
  confidence: number;
}

interface AuditEntry {
  time: string;
  actor: string;
  action: string;
}

interface AdminData {
  sources: Source[];
  identity_mappings: IdentityMapping[];
  audit_log: AuditEntry[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function confidenceLabel(c: number): string {
  if (c >= 0.9) return "High";
  if (c >= 0.7) return "Medium";
  return "Low";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Fixture data (used when the API is unavailable)                    */
/* ------------------------------------------------------------------ */

const FIXTURE: AdminData = {
  sources: [
    {
      source: "GitHub",
      status: "Connected & Synced",
      last_synced: "2026-11-05T22:14:00Z",
      items: 1_247,
    },
    {
      source: "Slack",
      status: "Connected & Synced",
      last_synced: "2026-11-05T23:01:00Z",
      items: 8_432,
    },
    {
      source: "Jira",
      status: "Connected & Synced",
      last_synced: "2026-11-05T21:45:00Z",
      items: 312,
    },
    {
      source: "Confluence",
      status: "Pending Initial Sync",
      last_synced: "",
      items: 0,
    },
  ],
  identity_mappings: [
    {
      name: "Priya Nair",
      github: "priya-nair",
      slack: "@priya (U12345)",
      jira: "jira_priya",
      confidence: 0.95,
    },
    {
      name: "Marcus Chen",
      github: "mchen-dev",
      slack: "@marcus.chen (U67890)",
      jira: "jira_marcus",
      confidence: 0.88,
    },
    {
      name: "Alex Rivera",
      github: "arivera",
      slack: "@alex.r (U11223)",
      jira: "jira_alex",
      confidence: 0.72,
    },
  ],
  audit_log: [
    {
      time: "2026-11-05T23:10:00Z",
      actor: "System",
      action: "Slack source sync completed — 142 new messages ingested",
    },
    {
      time: "2026-11-05T22:14:00Z",
      actor: "System",
      action: "GitHub source sync completed — 18 new commits indexed",
    },
    {
      time: "2026-11-05T21:45:00Z",
      actor: "System",
      action: "Jira source sync completed — 5 updated tickets",
    },
    {
      time: "2026-11-05T20:00:00Z",
      actor: "Admin",
      action: 'Added new source "Confluence" with pending status',
    },
    {
      time: "2026-11-05T18:30:00Z",
      actor: "System",
      action: "Identity resolution run — 3 profiles matched across platforms",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Admin: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/cases/${caseId}/admin`);
        if (!res.ok) throw new Error("api");
        const json: AdminData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(FIXTURE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  /* ---- loading skeleton ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base p-6 md:p-10 flex items-center justify-center">
        <p className="text-ink-tertiary text-sm animate-pulse">
          Loading administration data...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { sources, identity_mappings, audit_log } = data;

  return (
    <div className="min-h-screen bg-surface-base p-6 md:p-10 font-['Inter',sans-serif]">
      {/* ---------- Page title ---------- */}
      <h1 className="text-2xl font-semibold text-ink-primary mb-8 animate-fadeIn">
        Administration
      </h1>

      {/* ========================================================== */}
      {/*  Section 1 — Connected Sources                             */}
      {/* ========================================================== */}
      <section className="mb-10 animate-fadeIn" style={{ animationDelay: "60ms" }}>
        <h2 className="text-lg font-semibold text-ink-primary mb-4">
          Connected Sources
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((s) => (
            <div
              key={s.source}
              className="bg-surface-card shadow-card rounded-card p-5 transition-transform duration-200 hover:-translate-y-px"
            >
              <p className="font-semibold text-lg text-ink-primary mb-1">
                {s.source}
              </p>

              <p className="text-ink-secondary text-sm flex items-center gap-2 mb-1">
                <span className="inline-block w-2 h-2 rounded-full bg-ink-primary flex-shrink-0" />
                {s.status}
              </p>

              {s.last_synced && (
                <p className="text-sm text-ink-tertiary mb-1">
                  Last synced: {formatTime(s.last_synced)}
                </p>
              )}

              <p className="text-sm text-ink-secondary">
                {s.items.toLocaleString()} items
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================== */}
      {/*  Section 2 — Identity Resolution                           */}
      {/* ========================================================== */}
      <section className="mb-10 animate-fadeIn" style={{ animationDelay: "120ms" }}>
        <h2 className="text-lg font-semibold text-ink-primary mb-4">
          Identity Resolution
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {identity_mappings.map((m) => (
            <div
              key={m.name}
              className="bg-surface-card shadow-card rounded-card p-5 transition-transform duration-200 hover:-translate-y-px"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-ink-primary">{m.name}</p>
                <span className="rounded-pill bg-surface-elevated text-ink-secondary text-xs px-2.5 py-0.5">
                  {confidenceLabel(m.confidence)} ({Math.round(m.confidence * 100)}%)
                </span>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-ink-tertiary">GitHub:</span>
                <span className="text-ink-secondary">{m.github}</span>

                <span className="text-ink-tertiary">Slack:</span>
                <span className="text-ink-secondary">{m.slack}</span>

                <span className="text-ink-tertiary">Jira:</span>
                <span className="text-ink-secondary">{m.jira}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================== */}
      {/*  Section 3 — Audit Log                                     */}
      {/* ========================================================== */}
      <section className="animate-fadeIn" style={{ animationDelay: "180ms" }}>
        <h2 className="text-lg font-semibold text-ink-primary mb-4">
          Audit Log
        </h2>

        <div className="bg-surface-card shadow-card rounded-card overflow-hidden">
          {audit_log.map((entry, idx) => (
            <div
              key={idx}
              className={`flex flex-col md:flex-row md:items-start px-5 py-3 ${
                idx < audit_log.length - 1
                  ? "border-b border-edge-subtle"
                  : ""
              }`}
            >
              <span className="text-sm text-ink-tertiary md:w-32 flex-shrink-0 mb-0.5 md:mb-0">
                {formatTime(entry.time)}
              </span>
              <span className="font-medium text-ink-primary md:w-40 flex-shrink-0 mb-0.5 md:mb-0">
                {entry.actor}
              </span>
              <span className="text-ink-secondary text-sm flex-1">
                {entry.action}
              </span>
            </div>
          ))}

          {audit_log.length === 0 && (
            <p className="px-5 py-6 text-ink-tertiary text-sm text-center">
              No audit log entries.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Admin;
