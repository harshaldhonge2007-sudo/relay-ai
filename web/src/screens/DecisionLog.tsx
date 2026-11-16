import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { DecisionItem, ContactItem, ContinuationData } from "../types";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { ProvenanceBadge } from "../components/ui/ProvenanceBadge";
import { NextStepFooter } from "../components/ui/NextStepFooter";

export default function DecisionLog() {
  const { caseId = "case-001" } = useParams<{ caseId: string }>();
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [continuation, setContinuation] = useState<ContinuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("decisions");
  const [openRationales, setOpenRationales] = useState<Record<string, boolean>>({
    "dec-001": true,
  });
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

  const toggleRationale = (id: string) => {
    setOpenRationales((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const tabs = [
    { id: "decisions", label: "Decisions & ADRs", count: decisions.length },
    { id: "plan", label: "First 5 Days Plan", count: continuation?.first_5_days.length || 0 },
    { id: "contacts", label: "Key Domain Contacts", count: contacts.length },
  ];

  return (
    <PageContainer width="reading" className="animate-fadeIn">
      {/* Reusable Page Header */}
      <PageHeader
        stepEyebrow="2 RECONSTRUCT"
        title="Decisions & Actions"
        description="Every architectural decision is grounded in historical evidence and rationale. Includes the successor's sequential continuation plan and critical domain owners."
        metaChips={[
          `${decisions.length} Decisions`,
          "Traceable ADRs",
          "Successor Roadmap",
        ]}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-surface-elevated rounded-card" />
          <div className="h-28 bg-surface-elevated rounded-card" />
        </div>
      )}

      {error && (
        <div className="bg-surface-card border border-edge-strong rounded-card p-6 text-center shadow-card">
          <p className="text-sm text-ink-primary font-medium mb-1">Error Loading Decisions</p>
          <p className="text-xs text-ink-secondary mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-ink-primary text-white text-xs font-medium px-4 py-2 rounded-btn"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* TAB 1: DECISIONS WITH LEFT TIMELINE RAIL */}
          {activeTab === "decisions" && (
            <div className="space-y-6">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-edge-strong">
                {decisions.map((dec) => {
                  const isExpanded = Boolean(openRationales[dec.id]);
                  const formattedDate = new Date(dec.made_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <article
                      key={dec.id}
                      className="relative bg-surface-card border border-edge-default rounded-card p-5 shadow-card space-y-3"
                    >
                      {/* Timeline Node Dot */}
                      <span
                        className="absolute -left-[27px] top-5 w-3 h-3 rounded-full border-2 border-edge-strong bg-surface-card"
                        aria-hidden="true"
                      />

                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-ink-secondary font-bold">
                              {dec.id}
                            </span>
                            <span className="text-ink-secondary text-xs">•</span>
                            <span className="text-[11px] font-mono text-ink-secondary">
                              {formattedDate}
                            </span>
                          </div>
                          <h2 className="text-base font-semibold text-ink-primary">
                            {dec.title}
                          </h2>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <ProvenanceBadge type={dec.provenance} size="sm" />
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {dec.summary}
                      </p>

                      {/* Collapsible Rationale & Trade-offs Block */}
                      <div className="border border-edge-default rounded-btn overflow-hidden bg-surface-elevated">
                        <button
                          type="button"
                          onClick={() => toggleRationale(dec.id)}
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-ink-primary hover:bg-neutral-200/50 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                            <span>Rationale &amp; Trade-offs</span>
                          </span>
                          <span className="font-mono text-xs text-ink-secondary">
                            {isExpanded ? "▲ Collapse" : "▼ Expand"}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-3.5 pt-1 text-xs text-ink-primary leading-relaxed border-t border-edge-subtle">
                            {dec.rationale}
                          </div>
                        )}
                      </div>

                      {/* Footer: Participants & Evidence Citation Chips */}
                      <div className="flex flex-wrap items-center justify-between pt-2 text-xs text-ink-secondary border-t border-edge-subtle gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono">
                            Decided by: <strong className="text-ink-primary">{dec.made_by}</strong>
                          </span>
                        </div>

                        {dec.evidence_ids.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {dec.evidence_ids.map((eid) => (
                              <button
                                key={eid}
                                type="button"
                                onClick={() => inspectEvidence([eid], `${dec.title} Evidence`)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border border-edge-strong bg-surface-card hover:bg-surface-elevated text-[10px] font-mono font-medium text-ink-primary transition-colors focus:outline-none focus:ring-1 focus:ring-ink-primary"
                                title={`Inspect source evidence ${eid}`}
                              >
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M14 9V13C14 13.55 13.55 14 13 14H3C2.45 14 2 13.55 2 13V3C2 2.45 2.45 2 3 2H7" />
                                  <path d="M10 2H14V6" />
                                  <path d="M6.5 9.5L14 2" />
                                </svg>
                                <span>{eid}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CONTINUATION PLAN (FIRST 5 DAYS) */}
          {activeTab === "plan" && continuation && (
            <div className="space-y-4">
              <div className="bg-surface-card border border-edge-default rounded-card overflow-hidden shadow-card divide-y divide-edge-subtle">
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
                      <span className="text-ink-secondary text-[11px] font-mono">
                        Owner: <strong className="text-ink-primary">{item.owner}</strong>
                      </span>
                      <span className="rounded-pill border border-edge-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-primary bg-surface-elevated font-mono">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: KEY CONTACTS & DOMAIN OWNERS */}
          {activeTab === "contacts" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="bg-surface-card border border-edge-default rounded-card p-4 shadow-card flex flex-col justify-between space-y-3"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-ink-primary">
                      {contact.name}
                    </h3>
                    <p className="text-xs text-ink-secondary mt-0.5">
                      {contact.role}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="text-ink-secondary text-[11px]">email:</span>
                      <span className="text-ink-primary">{contact.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-secondary">
                      <span className="text-ink-secondary text-[11px]">slack:</span>
                      <span className="text-ink-primary">{contact.slack}</span>
                    </div>
                  </div>

                  <div className="border-t border-edge-subtle pt-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-secondary block mb-1">
                      Domain Ownership
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {contact.owns.map((o, oIdx) => (
                        <span
                          key={oIdx}
                          className="rounded bg-surface-elevated border border-edge-default px-2 py-0.5 text-[10px] font-medium text-ink-primary"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next Step Footer */}
          <NextStepFooter
            stepNumber="3"
            stepName="Findings & Conflicts"
            nextRoute={`/case/${caseId}/findings`}
            description="Proceed to review identified evidence contradictions, undocumented inflight branches, and gaps flagged for interview resolution."
          />
        </>
      )}
    </PageContainer>
  );
}
