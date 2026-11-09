import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { DecisionItem, ContactItem, ContinuationData } from "../types";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";

export default function DecisionLog() {
  const { caseId } = useParams<{ caseId: string }>();
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [continuation, setContinuation] = useState<ContinuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openDrawer } = useEvidenceDrawer();

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [decRes, conRes, planRes] = await Promise.all([
        apiFetch(`/cases/${caseId}/decisions`),
        apiFetch(`/cases/${caseId}/contacts`),
        apiFetch(`/cases/${caseId}/continuation`),
      ]);
      if (!decRes.ok || !conRes.ok || !planRes.ok) {
        throw new Error("Failed to fetch decisions or continuation plan");
      }
      const [decJson, conJson, planJson] = await Promise.all([
        decRes.json(),
        conRes.json(),
        planRes.json(),
      ]);
      setDecisions(decJson);
      setContacts(conJson);
      setContinuation(planJson);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading decisions");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inspectEvidence = async (evidenceIds: string[], title: string) => {
    const items = [];
    for (const id of evidenceIds) {
      try {
        const res = await apiFetch(`/artifacts/${id}`);
        if (res.ok) {
          const art = await res.json();
          items.push(art);
        } else {
          items.push({ artifact_id: id, withheld: true });
        }
      } catch {
        items.push({ artifact_id: id, withheld: true });
      }
    }
    openDrawer(items, title);
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 animate-fadeIn">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-ink-primary">
              Decisions & Next Actions
            </h1>
            <span className="rounded-pill bg-surface-elevated border border-edge-default px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Traceable Architecture
            </span>
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Every major decision is linked to its rationale and historical evidence. Includes the incoming engineer's first 5-day continuation plan and primary domain owners.
          </p>
        </div>

        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-32 bg-surface-elevated rounded-card" />
            <div className="h-32 bg-surface-elevated rounded-card" />
          </div>
        )}

        {error && (
          <div className="bg-surface-card border border-edge-strong rounded-card p-6 text-center shadow-card">
            <p className="text-sm text-ink-primary font-medium mb-1">Error</p>
            <p className="text-xs text-ink-tertiary mb-4">{error}</p>
            <button
              onClick={loadData}
              className="bg-ink-primary text-white text-xs font-medium px-4 py-2 rounded-btn"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && (
          <div className="space-y-10">
            {/* Architectural Decisions */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">
                    Key Decisions & Rationale
                  </h2>
                  <p className="text-xs text-ink-tertiary">
                    Why things were built the way they were, captured from meetings, commits, and discussions.
                  </p>
                </div>
                <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                  {decisions.length}
                </span>
              </div>

              <div className="space-y-4">
                {decisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="bg-surface-card border border-edge-default rounded-card p-5 shadow-card space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink-primary">
                        {dec.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="rounded-pill border border-edge-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                          {dec.provenance}
                        </span>
                        <span className="text-xs text-ink-disabled font-mono">
                          {dec.id}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-ink-secondary leading-relaxed">
                      {dec.summary}
                    </p>

                    <div className="bg-surface-elevated p-3.5 rounded-input border border-edge-subtle space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary block">
                        Rationale & Trade-offs
                      </span>
                      <p className="text-xs text-ink-primary leading-relaxed">
                        {dec.rationale}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-2 text-xs text-ink-tertiary border-t border-edge-subtle">
                      <div className="flex items-center gap-3">
                        <span>Participants: <strong className="font-medium text-ink-secondary">{dec.made_by}</strong></span>
                        <span>·</span>
                        <span>{new Date(dec.made_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>

                      {dec.evidence_ids.length > 0 && (
                        <button
                          onClick={() => inspectEvidence(dec.evidence_ids, dec.title)}
                          className="font-medium text-ink-primary underline hover:text-ink-secondary focus:outline-none"
                        >
                          View {dec.evidence_ids.length} Source{dec.evidence_ids.length !== 1 ? "s" : ""} →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Continuation Plan (First 5 Days) */}
            {continuation && (
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                  <div>
                    <h2 className="text-lg font-semibold text-ink-primary">
                      Continuation Plan — First 5 Days
                    </h2>
                    <p className="text-xs text-ink-tertiary">
                      Actionable sequential checklist for the successor taking over the role.
                    </p>
                  </div>
                  <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                    {continuation.first_5_days.length} Tasks
                  </span>
                </div>

                <div className="bg-surface-card border border-edge-default rounded-card overflow-hidden shadow-card">
                  <div className="divide-y divide-edge-subtle">
                    {continuation.first_5_days.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-elevated/40 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <span className="rounded-btn bg-surface-elevated border border-edge-strong px-2.5 py-1 text-xs font-semibold text-ink-primary font-mono shrink-0">
                            Day {item.day}
                          </span>
                          <span className="text-xs text-ink-primary font-medium leading-relaxed">
                            {item.task}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 text-xs">
                          <span className="text-ink-tertiary">
                            Owner: <span className="font-medium text-ink-secondary">{item.owner}</span>
                          </span>
                          <span className="rounded-pill border border-edge-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Key Contacts Table */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">
                    Key Contacts & Domain Owners
                  </h2>
                  <p className="text-xs text-ink-tertiary">
                    Whom to contact when questions arise regarding specific components or external services.
                  </p>
                </div>
                <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                  {contacts.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="bg-surface-card border border-edge-default rounded-card p-4 shadow-card flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-ink-primary">
                        {contact.name}
                      </h3>
                      <p className="text-xs text-ink-tertiary mt-0.5">
                        {contact.role}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span className="text-ink-tertiary font-mono">email:</span>
                        <span className="font-mono">{contact.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span className="text-ink-tertiary font-mono">slack:</span>
                        <span className="font-mono">{contact.slack}</span>
                      </div>
                    </div>

                    <div className="border-t border-edge-subtle pt-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary block mb-1">
                        Domain Responsibilities
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {contact.owns.map((o, oIdx) => (
                          <span
                            key={oIdx}
                            className="rounded bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-ink-secondary"
                          >
                            {o}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

