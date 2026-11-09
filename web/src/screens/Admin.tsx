import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useRole } from "../contexts/CaseContext";

interface Source {
  source: string;
  status: string;
  last_synced: string;
  items: string | number;
}

interface IdentityMapping {
  name: string;
  github: string;
  slack: string;
  jira: string;
  confidence: string | number;
}

interface AuditEntry {
  time: string;
  actor: string;
  action: string;
}

interface RedactionLocation {
  artifact_id: string;
  type: string;
  location: string;
}

interface RedactionsInfo {
  count: number;
  locations: RedactionLocation[];
  policy: string;
}

interface AdminData {
  sources: Source[];
  identity_mappings: IdentityMapping[];
  audit_log: AuditEntry[];
  redactions?: RedactionsInfo;
}

const Admin: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch(`/cases/${caseId}/admin`);
        if (res.ok) {
          const json: AdminData = await res.json();
          if (!cancelled) setData(json);
        }
      } catch {
        // keep prior state or fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [caseId, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base p-6 md:p-10 flex items-center justify-center">
        <p className="text-ink-tertiary text-xs animate-pulse">
          Loading administration panel...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { sources, identity_mappings, audit_log, redactions } = data;

  return (
    <div className="min-h-screen bg-surface-base p-6 md:p-10 font-sans animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-ink-primary">
            Administration & Security
          </h1>
          <span className="rounded-pill bg-surface-elevated border border-edge-default px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            Permissions & Ingest
          </span>
        </div>
        <p className="text-xs text-ink-secondary">
          Data connector configurations, identity deduplication mappings, secrets redactions, and immutable audit logs.
        </p>
      </div>

      {/* Synthetic Dataset Notice */}
      <div className="mb-8 p-3 rounded-input bg-surface-elevated border border-edge-subtle flex items-center justify-between text-xs text-ink-tertiary">
        <span>Synthetic dataset: "ShopLedger — Priya Nair Departure". External APIs simulated.</span>
        <span>Role: <strong className="uppercase font-mono text-ink-primary">{role.replace("_", " ")}</strong></span>
      </div>

      {/* Redactions & Secret Scanning Panel (Engineering Lead Only) */}
      {redactions && (
        <section className="mb-10 p-5 rounded-card border-2 border-ink-primary bg-surface-card shadow-card animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-primary" />
              <h2 className="text-base font-semibold text-ink-primary">
                Automated Secrets Redaction
              </h2>
            </div>
            <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-semibold text-ink-primary">
              {redactions.count} Secrets Redacted
            </span>
          </div>

          <p className="text-xs text-ink-secondary leading-relaxed mb-4">
            {redactions.policy}
          </p>

          <div className="bg-surface-elevated rounded-input p-3 border border-edge-subtle">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary block mb-2">
              Redacted Locations (Values Masked)
            </span>
            <div className="space-y-1.5 font-mono text-xs">
              {redactions.locations.map((loc, idx) => (
                <div key={idx} className="flex items-center justify-between text-ink-secondary">
                  <span>
                    <strong className="text-ink-primary">{loc.type.toUpperCase()}:</strong> {loc.location}
                  </span>
                  <span className="text-[11px] text-ink-disabled font-normal">
                    {loc.artifact_id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 1 — Connected Sources */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-ink-primary mb-4">
          Connected Sources
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((s) => (
            <div
              key={s.source}
              className="bg-surface-card border border-edge-default shadow-card rounded-card p-5 transition-transform duration-200 hover:-translate-y-px"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-base text-ink-primary">
                  {s.source}
                </p>
                <span className="text-xs text-ink-disabled font-mono">
                  {s.last_synced}
                </span>
              </div>

              <p className="text-ink-secondary text-xs flex items-center gap-2 mb-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-primary shrink-0" />
                {s.status}
              </p>

              <p className="text-xs text-ink-tertiary">
                {typeof s.items === "number" ? `${s.items.toLocaleString()} items` : s.items}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Identity Resolution */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-ink-primary mb-4">
          Identity Resolution
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {identity_mappings.map((m) => (
            <div
              key={m.name}
              className="bg-surface-card border border-edge-default shadow-card rounded-card p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-xs text-ink-primary">{m.name}</p>
                <span className="rounded-pill bg-surface-elevated text-ink-secondary text-[10px] px-2 py-0.5 border border-edge-subtle">
                  {typeof m.confidence === "number" ? `${Math.round(m.confidence * 100)}%` : m.confidence}
                </span>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-xs">
                <span className="text-ink-tertiary">GitHub:</span>
                <span className="text-ink-secondary font-mono truncate">{m.github}</span>

                <span className="text-ink-tertiary">Slack:</span>
                <span className="text-ink-secondary font-mono truncate">{m.slack}</span>

                <span className="text-ink-tertiary">Jira:</span>
                <span className="text-ink-secondary font-mono truncate">{m.jira}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Immutable Audit Log */}
      <section>
        <h2 className="text-base font-semibold text-ink-primary mb-4">
          Audit Trail
        </h2>

        <div className="bg-surface-card border border-edge-default shadow-card rounded-card overflow-hidden">
          {audit_log.map((entry, idx) => (
            <div
              key={idx}
              className={`flex flex-col md:flex-row md:items-start px-5 py-3 text-xs ${
                idx < audit_log.length - 1 ? "border-b border-edge-subtle" : ""
              }`}
            >
              <span className="text-ink-tertiary md:w-32 shrink-0 font-mono mb-0.5 md:mb-0">
                {entry.time}
              </span>
              <span className="font-semibold text-ink-primary md:w-48 shrink-0 mb-0.5 md:mb-0">
                {entry.actor}
              </span>
              <span className="text-ink-secondary flex-1 leading-relaxed">
                {entry.action}
              </span>
            </div>
          ))}

          {audit_log.length === 0 && (
            <p className="px-5 py-6 text-ink-tertiary text-xs text-center">
              No audit log entries.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Admin;
