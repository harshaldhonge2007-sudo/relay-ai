import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../api";
import AskTheLeaver from "../components/chat/AskTheLeaver";

interface EventItem {
  type: string;
  ts: string;
  repo?: string;
  branch?: string;
  commit_count?: number;
  pusher?: string;
  commit_messages?: string[];
  action?: string;
  pr_number?: number;
  pr_title?: string;
  author?: string;
  state?: string;
  issue_number?: number;
  issue_title?: string;
}

interface IntelligenceData {
  case_id: string;
  project_name: string;
  project_status: string;
  health_score: number;
  knowledge_continuity_score: number;
  overall_risk_score: number;
  last_updated: string;
  total_events_processed: number;
  recent_events: EventItem[];
  stats: {
    total_artifacts: number;
    total_findings: number;
    open_findings: number;
    total_components: number;
    high_risk_components: number;
    total_handover_items: number;
    verified_items: number;
  };
  living_memory_status: "active" | "pending";
  demo_note?: string;
}

export default function IntelligenceDashboard() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulatingDrift, setSimulatingDrift] = useState(false);
  const [driftToast, setDriftToast] = useState<string | null>(null);
  const [driftPending, setDriftPending] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, driftRes] = await Promise.all([
        apiFetch(`/cases/${caseId}/intelligence`),
        apiFetch(`/cases/${caseId}/handover/drift-status`),
      ]);
      if (!res.ok) throw new Error("Failed to load project intelligence data");
      const json = await res.json();
      setData(json);

      if (driftRes && driftRes.ok) {
        const dJson = await driftRes.json();
        setDriftPending(dJson.has_drift || dJson.re_review_pending_count > 0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading intelligence");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const handleSimulateDrift = async () => {
    if (!caseId) return;
    setSimulatingDrift(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/webhooks/simulate-drift`, {
        method: "POST",
        body: JSON.stringify({
          event_type: "pull_request",
          action: "closed",
          merged: true,
          pr_number: 47,
          issue_key: "SL-456",
        }),
      });
      if (res.ok) {
        setDriftToast("Simulated GitHub Webhook: PR #47 (SL-456) merged into main! In-flight claim ho-001 flagged stale.");
        setDriftPending(true);
        await load();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to simulate drift");
    } finally {
      setSimulatingDrift(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-surface-elevated rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface-card rounded-card border border-edge-default" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-surface-card rounded-card border border-edge-strong">
        <h3 className="text-sm font-semibold text-ink-primary">Failed to load intelligence</h3>
        <p className="text-xs text-ink-secondary mt-1">{error || "Unknown error"}</p>
        <button
          onClick={load}
          className="mt-3 px-3 py-1.5 bg-ink-primary text-white text-xs font-medium rounded-btn"
        >
          Retry
        </button>
      </div>
    );
  }

  const healthPct = Math.round(data.health_score * 100);
  const continuityPct = Math.round(data.knowledge_continuity_score * 100);
  const riskPct = Math.round(data.overall_risk_score * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-ink-primary text-white tracking-widest">
              Living Project Memory
            </span>
            <span className="text-xs text-ink-tertiary">
              Updated {new Date(data.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Project Intelligence: {data.project_name}
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Continuously updated representation of project knowledge, bus-factor risks, and handover readiness.
          </p>
        </div>

        {/* Quick action shortcuts */}
        <div className="flex items-center gap-2">
          <Link
            to={`/case/${caseId}/busfactor`}
            className="px-3 py-1.5 text-xs font-medium border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors shadow-sm"
          >
            Bus-Factor Alerts
          </Link>
          <Link
            to={`/case/${caseId}/assets`}
            className="px-3 py-1.5 text-xs font-medium border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors shadow-sm"
          >
            Project Assets
          </Link>
          <Link
            to={`/case/${caseId}/handover`}
            className="px-3.5 py-1.5 text-xs font-semibold bg-ink-primary hover:bg-neutral-800 text-white rounded-btn transition-colors shadow-sm"
          >
            Always-Ready Handover →
          </Link>
        </div>
      </div>

      {/* Living Memory Status Notice */}
      <div className="p-4 rounded-card border border-edge-strong bg-surface-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-ink-primary animate-pulse" />
          <div>
            <p className="text-xs font-semibold text-ink-primary">
              Continuous Intelligence Pipeline Active
            </p>
            <p className="text-[11px] text-ink-secondary mt-0.5">
              Listening to GitHub commits, pull requests, issues, and connected documentation.
              Processed <strong className="text-ink-primary font-mono">{data.total_events_processed}</strong> events.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-1 bg-surface-elevated border border-edge-default rounded text-ink-tertiary">
          Webhook Endpoint: /api/webhooks/github
        </span>
      </div>

      {/* 4 Primary KPI Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Health */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary block">
            Handover Grounding & Health
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {healthPct}%
            </span>
            <span className="text-xs font-medium text-ink-secondary">
              ({data.stats.verified_items}/{data.stats.total_handover_items} verified)
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-surface-elevated rounded-pill overflow-hidden">
            <div
              className="h-full bg-ink-primary rounded-pill transition-all duration-500"
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>

        {/* Knowledge Continuity */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary block">
            Knowledge Continuity Score
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {continuityPct}%
            </span>
            <span className="text-xs font-semibold text-ink-secondary">
              {continuityPct >= 70 ? "Stable" : "At Risk"}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-ink-tertiary">
            Multi-signal measure of team knowledge spread vs leaver dependency
          </p>
        </div>

        {/* Bus-Factor Risk */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-strong shadow-card bg-surface-elevated/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-primary block">
            Bus-Factor Risk Score
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {riskPct}%
            </span>
            <span className="text-xs font-mono font-bold text-ink-primary bg-surface-elevated border border-edge-strong px-2 py-0.5 rounded">
              {data.stats.high_risk_components} Critical Component(s)
            </span>
          </div>
          <p className="mt-3 text-[11px] text-ink-secondary">
            Payment Processor & Auth Service have single-developer bottlenecks
          </p>
        </div>

        {/* Living Memory Status */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary block">
            Memory Status
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink-primary font-mono">
              Always Ready
            </span>
          </div>
          <p className="mt-3 text-[11px] text-ink-secondary">
            Pre-synthesized draft updated continuously. No 2-week notice lag.
          </p>
        </div>
      </div>

      {/* Grid: 6 Operational Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">Artifacts</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.total_artifacts}</span>
        </div>
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">Findings</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.total_findings}</span>
        </div>
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">Open Findings</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.open_findings}</span>
        </div>
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">Components</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.total_components}</span>
        </div>
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">High Risk</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.high_risk_components}</span>
        </div>
        <div className="bg-surface-card rounded-btn p-3 border border-edge-default text-center shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-ink-tertiary block">Claims</span>
          <span className="text-lg font-bold text-ink-primary font-mono">{data.stats.total_handover_items}</span>
        </div>
      </div>

      {/* Ask the Leaver — Grounded Conversational Continuity */}
      {caseId && (
        <div className="my-6">
          <AskTheLeaver caseId={caseId} leaverName="Priya Nair" />
        </div>
      )}

      {/* Prompt 12: Living Handover & Evidence Drift Card */}
      <div className="my-6 p-5 rounded-card border-2 border-edge-strong bg-surface-card shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-white dark:bg-amber-600 uppercase tracking-wider">
                Living Handover Invariant
              </span>
              <h3 className="text-sm font-bold text-ink-primary">
                Post-Approval Evidence Drift Monitor
              </h3>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Monitors repository webhooks and Jira state transitions. When post-release events change cited evidence (e.g. in-flight PR #47 merges), dependent handover claims are flagged stale with a diff, and a re-review item is queued for the lead without auto-editing approved text.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={simulatingDrift}
              onClick={handleSimulateDrift}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-elevated text-ink-primary hover:bg-surface-subtle transition-colors disabled:opacity-40 shadow-sm"
              title="Simulate post-release GitHub webhook: PR #47 (SL-456) merges into main"
            >
              {simulatingDrift ? "Simulating Webhook..." : "⚡ Simulate Drift (SL-456 Merged)"}
            </button>
            <Link
              to={`/cases/${caseId || "case-001"}/handover`}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:opacity-90 shadow-sm"
            >
              Inspect Handover {driftPending ? "• Drift Active" : ""} →
            </Link>
          </div>
        </div>

        {driftToast && (
          <div className="mt-3 p-3 rounded-btn border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 text-xs text-ink-primary flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-amber-800 dark:text-amber-200">⟳ DRIFT DETECTED:</span>
              <span>{driftToast}</span>
            </div>
            <button onClick={() => setDriftToast(null)} className="text-ink-tertiary hover:text-ink-primary ml-2 font-mono">✕</button>
          </div>
        )}
      </div>

      {/* Two Column Layout: Event Ingestion Pipeline & Critical Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Ingested Events */}
        <div className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Continuous Event Ingestion Pipeline
              </h3>
              <p className="text-[11px] text-ink-tertiary">
                Normalized events updating the project knowledge graph
              </p>
            </div>
            <span className="text-[10px] font-mono text-ink-disabled">
              Deduplication active
            </span>
          </div>

          <div className="space-y-3">
            {(!data.recent_events || data.recent_events.length === 0) ? (
              <div className="space-y-2">
                <div className="p-3 rounded-btn bg-surface-elevated border border-edge-subtle text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-ink-primary text-white">
                      PUSH
                    </span>
                    <span className="text-[10px] text-ink-tertiary">2024-10-16 10:00 UTC</span>
                  </div>
                  <p className="font-semibold text-ink-primary">Priya Nair committed to main (2 commits)</p>
                  <p className="text-ink-secondary text-[11px] mt-0.5">WIP: webhook retry with exponential backoff</p>
                </div>

                <div className="p-3 rounded-btn bg-surface-elevated border border-edge-subtle text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-ink-primary text-white">
                      PULL REQUEST
                    </span>
                    <span className="text-[10px] text-ink-tertiary">2024-10-16 09:00 UTC</span>
                  </div>
                  <p className="font-semibold text-ink-primary">PR #47 opened by Priya Nair</p>
                  <p className="text-ink-secondary text-[11px] mt-0.5">WIP: Webhook retry logic (SL-456)</p>
                </div>

                <div className="p-3 rounded-btn bg-surface-elevated border border-edge-subtle text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-ink-primary text-white">
                      ISSUE
                    </span>
                    <span className="text-[10px] text-ink-tertiary">2024-10-15 11:00 UTC</span>
                  </div>
                  <p className="font-semibold text-ink-primary">SL-456 assigned to Priya Nair</p>
                  <p className="text-ink-secondary text-[11px] mt-0.5">Implement webhook retry logic for payment notifications</p>
                </div>
              </div>
            ) : (
              data.recent_events.map((evt, idx) => (
                <div key={idx} className="p-3 rounded-btn bg-surface-elevated border border-edge-subtle text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-ink-primary text-white uppercase">
                        {evt.type}
                      </span>
                      {((evt as any).evidence_drift || (evt as any).drift_detected) && (
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase">
                          Drift Detected
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-ink-tertiary">
                      {new Date(evt.ts).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-semibold text-ink-primary">
                    {evt.pusher ? `${evt.pusher} committed to ${evt.branch}` : evt.pr_title || evt.issue_title || "Project activity recorded"}
                  </p>
                  {evt.commit_messages && (
                    <p className="text-ink-secondary text-[11px] mt-0.5 truncate">
                      {evt.commit_messages[0]}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Critical Component Dependency Knowledge */}
        <div className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Critical Knowledge Dependencies
              </h3>
              <p className="text-[11px] text-ink-tertiary">
                Components where single developer holds over 65% knowledge
              </p>
            </div>
            <Link
              to={`/case/${caseId}/busfactor`}
              className="text-xs text-ink-primary font-medium hover:underline"
            >
              Full Analysis →
            </Link>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-card border-l-4 border-l-ink-primary bg-surface-elevated border border-edge-strong">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-primary">Payment Processor</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-primary text-white font-bold">
                  Bus Factor: 1
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-1">
                <strong>Priya Nair</strong> holds <strong>72%</strong> of measured knowledge. Alex Chen holds 21%.
              </p>
              <div className="mt-2 text-[11px] text-ink-tertiary flex items-center gap-3">
                <span>Criticality: 95%</span>
                <span>•</span>
                <span>Doc coverage: 20%</span>
                <span>•</span>
                <span className="text-ink-primary font-semibold font-mono">Risk: High</span>
              </div>
            </div>

            <div className="p-3.5 rounded-card border-l-4 border-l-edge-strong bg-surface-elevated border border-edge-default">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-primary">Auth Service</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-ink-primary border border-edge-strong font-bold">
                  Bus Factor: 1
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-1">
                <strong>Priya Nair</strong> holds <strong>68%</strong> of measured knowledge. Alex Chen holds 26%.
              </p>
              <div className="mt-2 text-[11px] text-ink-tertiary flex items-center gap-3">
                <span>Criticality: 90%</span>
                <span>•</span>
                <span>Doc coverage: 40%</span>
                <span>•</span>
                <span className="text-ink-secondary font-mono">Risk: Moderate</span>
              </div>
            </div>

            <div className="p-3.5 rounded-card border-l-4 border-l-edge-strong bg-surface-elevated border border-edge-default">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-primary">Reporting Module</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-ink-primary border border-edge-strong font-bold">
                  Black Box (86%)
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-1">
                Sole developer ownership. Undocumented cron environment variables detected in Slack.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

