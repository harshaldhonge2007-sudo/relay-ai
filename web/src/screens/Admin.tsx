import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, isMockFallback } from "../api";
import { useRole } from "../contexts/CaseContext";
import PageContainer from "../components/ui/PageContainer";
import PageHeader, { TabItem } from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

interface SourceAcl {
  access_level: "public" | "internal" | "confidential";
  allowed_roles?: string[];
}

interface Source {
  source: string;
  status: string;
  last_synced: string;
  items: string | number;
  acl?: SourceAcl;
}

interface IdentityMapping {
  id?: string;
  name: string;
  github: string;
  slack: string;
  jira: string;
  confidence: string | number;
  status?: "auto_merged" | "confirmed" | "split";
}

interface ImportPreviewData {
  staging_token: string;
  case_id: string;
  total_items: number;
  item_counts: Record<string, number>;
  date_range: { earliest: string; latest: string };
  sample_items: Array<{
    source: string;
    type: string;
    external_id: string;
    title: string;
    snippet: string;
    quarantined: boolean;
    reasons: string[];
  }>;
  detected_people: Array<{
    name: string;
    email: string;
    handle: string;
    sources: string[];
  }>;
  detected_sensitive_items: Array<{
    id: string;
    source: string;
    title: string;
    reasons: string[];
    sample: string;
  }>;
  ingest_report: {
    files_processed: number;
    items_parsed: number;
    items_by_source: Record<string, number>;
    errors: string[];
    warnings: string[];
    skipped_files: string[];
  };
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

interface QuarantineItem {
  id: string;
  case_id: string;
  source: string;
  type: string;
  title: string;
  snippet: string;
  reasons: string[];
  quarantine_status: string;
  occurred_at: string;
  url?: string;
}

interface AdminData {
  sources: Source[];
  identity_mappings: IdentityMapping[];
  audit_log: AuditEntry[];
  redactions?: RedactionsInfo;
}

const ADMIN_TABS: TabItem[] = [
  { id: "all", label: "Overview" },
  { id: "quarantine", label: "Quarantine Queue" },
  { id: "sources", label: "Sources & Connectors" },
  { id: "identity", label: "Identity Resolution" },
  { id: "redactions", label: "Secrets Redaction" },
  { id: "audit", label: "Audit Log" },
];

const ACCESS_LEVELS = ["public", "internal", "confidential"] as const;
type AccessLevel = (typeof ACCESS_LEVELS)[number];

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  public: "Public (all roles)",
  internal: "Internal (lead + successor)",
  confidential: "Confidential (lead only)",
};

interface AclUpdateState {
  source: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
  pendingLevel: AccessLevel | null;
  confirming: boolean;
}

const Admin: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const [data, setData] = useState<AdminData | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());
  const [expandedQIds, setExpandedQIds] = useState<Set<string>>(new Set());
  const [resolvingQId, setResolvingQId] = useState<string | null>(null);
  const [bulkResolving, setBulkResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [aclStates, setAclStates] = useState<Record<string, AclUpdateState>>({});
  const [identityMappings, setIdentityMappings] = useState<IdentityMapping[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [splittingId, setSplittingId] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [sourceTiers, setSourceTiers] = useState<Record<string, "public" | "internal" | "confidential">>({
    slack: "internal",
    jira: "public",
    docs: "internal",
  });
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const fetchPromises: Promise<Response>[] = [
          apiFetch(`/cases/${caseId}/admin`),
          apiFetch(`/cases/${caseId}/sources`),
        ];
        if (role === "engineering_lead") {
          fetchPromises.push(apiFetch(`/cases/${caseId}/quarantine`));
        }

        const [adminRes, sourcesRes, qRes] = await Promise.all(fetchPromises);
        if (!cancelled) {
          if (adminRes.ok) {
            const json: AdminData = await adminRes.json();
            setData(json);
            setIdentityMappings(json.identity_mappings || []);
          }
          if (sourcesRes.ok) {
            const sJson = await sourcesRes.json();
            setSources(sJson.sources || []);
          }
          if (qRes && qRes.ok) {
            const qJson = await qRes.json();
            setQuarantineItems(Array.isArray(qJson) ? qJson : []);
          }
        }
      } catch {
        // keep prior state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [caseId, role]);

  const handleResolveQuarantine = async (artifactId: string, action: "clear" | "redact" | "confidential") => {
    setResolvingQId(artifactId);
    try {
      const res = await apiFetch(`/cases/${caseId}/quarantine/${artifactId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setQuarantineItems((prev) => prev.filter((item) => item.id !== artifactId));
        setSelectedQIds((prev) => {
          const next = new Set(prev);
          next.delete(artifactId);
          return next;
        });
        const adminRes = await apiFetch(`/cases/${caseId}/admin`);
        if (adminRes.ok) setData(await adminRes.json());
      }
    } finally {
      setResolvingQId(null);
    }
  };

  const handleBulkResolveQuarantine = async (action: "clear" | "redact" | "confidential") => {
    if (selectedQIds.size === 0) return;
    const ids = Array.from(selectedQIds);
    setBulkResolving(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/quarantine/bulk-resolve`, {
        method: "POST",
        body: JSON.stringify({ action, artifact_ids: ids }),
      });
      if (res.ok) {
        setQuarantineItems((prev) => prev.filter((item) => !selectedQIds.has(item.id)));
        setSelectedQIds(new Set());
        const adminRes = await apiFetch(`/cases/${caseId}/admin`);
        if (adminRes.ok) setData(await adminRes.json());
      }
    } finally {
      setBulkResolving(false);
    }
  };

  const toggleSelectQ = (id: string) => {
    setSelectedQIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllQ = () => {
    if (selectedQIds.size === quarantineItems.length) {
      setSelectedQIds(new Set());
    } else {
      setSelectedQIds(new Set(quarantineItems.map((i) => i.id)));
    }
  };

  const toggleExpandQ = (id: string) => {
    setExpandedQIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmIdentity = async (identityId: string) => {
    setConfirmingId(identityId);
    try {
      const res = await apiFetch(`/cases/${caseId}/identities/${identityId}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        const targetId = decodeURIComponent(identityId);
        setIdentityMappings((prev) =>
          prev.map((m) => {
            const currentId = m.id || m.name;
            return (currentId === targetId || m.name === targetId || m.id === identityId)
              ? { ...m, status: "confirmed", confidence: "100% (Lead Confirmed)" }
              : m;
          })
        );
      }
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSplitIdentity = async (identityId: string) => {
    setSplittingId(identityId);
    try {
      const res = await apiFetch(`/cases/${caseId}/identities/${identityId}/split`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        const targetId = decodeURIComponent(identityId);
        setIdentityMappings((prev) => {
          const next: IdentityMapping[] = [];
          for (const m of prev) {
            const currentId = m.id || m.name;
            if (currentId === targetId || m.name === targetId || m.id === identityId) {
              if (Array.isArray(json.split_entities)) {
                next.push(...json.split_entities);
              } else {
                next.push(
                  { id: `${identityId}_code`, name: `${m.name} (Code & Repos)`, github: m.github, slack: "—", jira: "—", confidence: "100% (Explicitly Separated)", status: "split" },
                  { id: `${identityId}_comms`, name: `${m.name} (Comms & Tasks)`, github: "—", slack: m.slack, jira: m.jira, confidence: "100% (Explicitly Separated)", status: "split" }
                );
              }
            } else {
              next.push(m);
            }
          }
          return next;
        });
      }
    } finally {
      setSplittingId(null);
    }
  };

  const handleLoadSamplePreview = async () => {
    setImportLoading(true);
    setCommitError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/import/preview`, {
        method: "POST",
        body: JSON.stringify({
          files: [
            { filename: "samples/slack_export.zip", content_text: "sample" },
            { filename: "samples/jira_export.csv", content_text: "sample" },
            { filename: "samples/meeting_notes.md", content_text: "sample" },
          ],
        }),
      });
      if (res.ok) {
        const prev: ImportPreviewData = await res.json();
        setImportPreview(prev);
      } else {
        const err = await res.json().catch(() => ({}));
        setCommitError(err.detail || "Failed to load sample preview");
      }
    } catch (e: any) {
      setCommitError(e.message || "Failed to load sample preview");
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview) return;
    setCommitLoading(true);
    setCommitError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/import/commit`, {
        method: "POST",
        body: JSON.stringify({
          staging_token: importPreview.staging_token,
          source_tiers: sourceTiers,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCommitSuccess(`Successfully imported ${json.committed_items} items (${json.quarantined_items} sensitive items quarantined). Readiness score updated to ${Math.round(json.readiness_score * 100)}%.`);
        const [adminRes, sourcesRes, qRes] = await Promise.all([
          apiFetch(`/cases/${caseId}/admin`),
          apiFetch(`/cases/${caseId}/sources`),
          apiFetch(`/cases/${caseId}/quarantine`),
        ]);
        if (adminRes.ok) {
          const adJson = await adminRes.json();
          setData(adJson);
          setIdentityMappings(adJson.identity_mappings || []);
        }
        if (sourcesRes.ok) {
          const sJson = await sourcesRes.json();
          setSources(sJson.sources || []);
        }
        if (qRes && qRes.ok) {
          setQuarantineItems(await qRes.json());
        }
        setTimeout(() => {
          setImportModalOpen(false);
          setImportPreview(null);
          setCommitSuccess(null);
        }, 1800);
      } else {
        const err = await res.json().catch(() => ({}));
        setCommitError(err.detail || "Failed to commit data import");
      }
    } catch (e: any) {
      setCommitError(e.message || "Failed to commit data import");
    } finally {
      setCommitLoading(false);
    }
  };

  const handleAclChange = async (sourceName: string, newLevel: AccessLevel) => {
    if (isMockFallback()) return;
    // Require confirmation for loosening (going from more restrictive to less)
    const src = sources.find((s) => s.source === sourceName);
    const currentLevel = (src?.acl?.access_level ?? "public") as AccessLevel;
    const levelOrder: Record<AccessLevel, number> = { public: 0, internal: 1, confidential: 2 };
    const isLoosening = levelOrder[newLevel] < levelOrder[currentLevel];

    setAclStates((prev) => ({
      ...prev,
      [sourceName]: {
        source: sourceName,
        saving: false,
        saved: false,
        error: null,
        pendingLevel: newLevel,
        confirming: isLoosening,
      },
    }));

    if (isLoosening) return; // Wait for confirmation
    await _doAclUpdate(sourceName, newLevel);
  };

  const handleAclConfirm = async (sourceName: string) => {
    const st = aclStates[sourceName];
    if (!st?.pendingLevel) return;
    await _doAclUpdate(sourceName, st.pendingLevel);
  };

  const handleAclCancel = (sourceName: string) => {
    setAclStates((prev) => ({ ...prev, [sourceName]: { ...prev[sourceName], confirming: false, pendingLevel: null } }));
  };

  const _doAclUpdate = async (sourceName: string, newLevel: AccessLevel) => {
    setAclStates((prev) => ({
      ...prev,
      [sourceName]: { ...prev[sourceName], saving: true, confirming: false, error: null, saved: false },
    }));
    try {
      const res = await apiFetch(`/cases/${caseId}/sources/${encodeURIComponent(sourceName)}/acl`, {
        method: "PATCH",
        body: JSON.stringify({ access_level: newLevel }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any).detail || "ACL update failed");
      }
      // Update local sources state
      setSources((prev) =>
        prev.map((s) =>
          s.source === sourceName
            ? { ...s, acl: { access_level: newLevel, allowed_roles: (json as any).allowed_roles } }
            : s
        )
      );
      // Refresh audit log
      const adminRes = await apiFetch(`/cases/${caseId}/admin`);
      if (adminRes.ok) {
        const ad: AdminData = await adminRes.json();
        setData(ad);
      }
      setAclStates((prev) => ({
        ...prev,
        [sourceName]: { ...prev[sourceName], saving: false, saved: true, error: null },
      }));
      setTimeout(() => {
        setAclStates((prev) => ({ ...prev, [sourceName]: { ...prev[sourceName], saved: false } }));
      }, 2500);
    } catch (err: any) {
      setAclStates((prev) => ({
        ...prev,
        [sourceName]: { ...prev[sourceName], saving: false, error: err.message },
      }));
    }
  };

  if (loading) {
    return (
      <PageContainer width="standard">
        <div className="py-24 flex items-center justify-center">
          <p className="text-ink-secondary text-xs font-mono animate-pulse">
            Loading administration panel...
          </p>
        </div>
      </PageContainer>
    );
  }

  if (!data) return null;

  const { identity_mappings, audit_log, redactions } = data;
  const displaySources = sources.length > 0 ? sources : data.sources;

  const showSources = activeTab === "all" || activeTab === "sources";
  const showQuarantine = activeTab === "all" || activeTab === "quarantine";
  const showIdentity = activeTab === "all" || activeTab === "identity";
  const showRedactions = (activeTab === "all" || activeTab === "redactions") && !!redactions;
  const showAudit = activeTab === "all" || activeTab === "audit";

  return (
    <PageContainer width="standard">
      <PageHeader
        stepNumber={1}
        stepEyebrow="Connect & Admin"
        title="Administration & Security"
        description="Data connector configurations, cross-tool identity deduplication, automated secrets redaction, and immutable audit logs."
        metaChips={[
          { label: "Quarantine", value: quarantineItems.length },
          { label: "Sources", value: displaySources.length },
          { label: "Identities", value: identity_mappings.length },
          { label: "Redactions", value: redactions?.count || 0 },
        ]}
        tabs={ADMIN_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Synthetic Dataset Notice */}
      <div className="mb-6 p-3 rounded-input bg-surface-base border border-edge-default flex items-center justify-between text-xs text-ink-secondary">
        <span>Synthetic dataset: &quot;ShopLedger — Priya Nair Departure&quot;. External connectors verified.</span>
        <span>Role: <strong className="uppercase font-mono text-ink-primary">{role.replace("_", " ")}</strong></span>
      </div>

      <div className="space-y-8 mb-8">
        {/* Item-Level Sensitive-Content Quarantine Section */}
        {showQuarantine && (
          <section className="p-5 rounded-card border border-edge-strong bg-surface-card shadow-sm animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-edge-default">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-ink-primary" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">
                    Item-Level Sensitive-Content Quarantine Queue
                  </h2>
                  <p className="text-xs text-ink-secondary">
                    Default-deny isolation for secrets, PII, HR/legal/financial data, and customer IDs inside connected sources.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto rounded-pill bg-surface-elevated border border-edge-strong px-3 py-1 text-xs font-mono font-bold text-ink-primary">
                {quarantineItems.length} Quarantined Item(s)
              </span>
            </div>

            {role !== "engineering_lead" ? (
              <div className="p-4 rounded-input bg-surface-base border border-edge-default text-xs font-mono text-ink-secondary">
                <p className="font-semibold text-ink-primary mb-1">
                  Access Restricted — Engineering Lead Required
                </p>
                <p>
                  Quarantined items are default-denied and excluded from derived views, claims, and simulation for non-lead roles until cleared or redacted.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bulk Actions Bar */}
                {quarantineItems.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-input bg-surface-base border border-edge-default text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="select-all-q"
                        checked={selectedQIds.size > 0 && selectedQIds.size === quarantineItems.length}
                        onChange={toggleSelectAllQ}
                        className="rounded border-edge-strong text-ink-primary focus:ring-0 cursor-pointer"
                        aria-label="Select all quarantined items"
                      />
                      <label htmlFor="select-all-q" className="cursor-pointer select-none text-ink-secondary">
                        Select All ({selectedQIds.size} of {quarantineItems.length} selected)
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleBulkResolveQuarantine("redact")}
                        disabled={selectedQIds.size === 0 || bulkResolving}
                        className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bulk Redact &amp; Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkResolveQuarantine("clear")}
                        disabled={selectedQIds.size === 0 || bulkResolving}
                        className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bulk Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkResolveQuarantine("confidential")}
                        disabled={selectedQIds.size === 0 || bulkResolving}
                        className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Bulk Mark Confidential
                      </button>
                    </div>
                  </div>
                )}

                {/* Quarantined Items List */}
                <div className="space-y-3">
                  {quarantineItems.map((item) => {
                    const isSelected = selectedQIds.has(item.id);
                    const isExpanded = expandedQIds.has(item.id);
                    const isResolving = resolvingQId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-card border transition-all ${
                          isSelected
                            ? "border-ink-primary bg-surface-elevated"
                            : "border-edge-strong bg-surface-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectQ(item.id)}
                              className="mt-1 rounded border-edge-strong text-ink-primary focus:ring-0 cursor-pointer"
                              aria-label={`Select item ${item.id}`}
                            />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-surface-base border border-edge-strong text-ink-primary">
                                  {item.source}
                                </span>
                                <h3 className="text-sm font-bold text-ink-primary">
                                  {item.title}
                                </h3>
                              </div>
                              <span className="text-[11px] font-mono text-ink-secondary">
                                ID: {item.id} • {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleResolveQuarantine(item.id, "redact")}
                              disabled={isResolving}
                              className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40"
                              title="Replace sensitive matches with stable placeholders like [REDACTED:salary]"
                            >
                              Redact &amp; Keep
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveQuarantine(item.id, "clear")}
                              disabled={isResolving}
                              className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40"
                              title="Clear quarantine and allow viewing under normal source ACL"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveQuarantine(item.id, "confidential")}
                              disabled={isResolving}
                              className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40"
                              title="Restrict access strictly to Engineering Lead"
                            >
                              Mark Confidential
                            </button>
                          </div>
                        </div>

                        {/* Reason Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 my-2.5">
                          <span className="text-[10px] font-mono uppercase font-bold text-ink-secondary mr-1">
                            Detected Triggers:
                          </span>
                          {item.reasons.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded border border-edge-strong bg-surface-elevated text-ink-primary"
                            >
                              {r}
                            </span>
                          ))}
                        </div>

                        {/* Snippet Toggle */}
                        <div className="mt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => toggleExpandQ(item.id)}
                            className="text-xs font-mono text-ink-secondary hover:text-ink-primary underline underline-offset-2 mb-1 inline-block"
                          >
                            {isExpanded ? "Hide Snippet ▲" : "Show Detected Snippet ▼"}
                          </button>

                          {isExpanded && (
                            <div className="p-3 rounded-input bg-surface-base border border-edge-default font-mono text-xs text-ink-primary leading-relaxed whitespace-pre-wrap">
                              {item.snippet}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {quarantineItems.length === 0 && (
                    <div className="py-8 text-center text-xs font-mono text-ink-secondary border border-dashed border-edge-default rounded-card">
                      Zero items currently held in quarantine. All connected sources clean.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
        {/* Redactions & Secret Scanning Panel */}
        {showRedactions && redactions && (
          <section className="p-5 rounded-card border border-edge-strong bg-surface-card shadow-sm animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-ink-primary" />
                <h2 className="text-base font-semibold text-ink-primary">
                  Automated Secrets Redaction
                </h2>
              </div>
              <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-mono font-semibold text-ink-primary">
                {redactions.count} Secrets Redacted
              </span>
            </div>

            <p className="text-xs text-ink-secondary leading-relaxed mb-4">
              {redactions.policy}
            </p>

            <div className="bg-surface-base rounded-input p-3 border border-edge-default">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block mb-2 font-semibold">
                Redacted Locations (Values Masked)
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {redactions.locations.map((loc, idx) => (
                  <div key={idx} className="flex items-center justify-between text-ink-secondary">
                    <span>
                      <strong className="text-ink-primary">{loc.type.toUpperCase()}:</strong> {loc.location}
                    </span>
                    <span className="text-[11px] text-ink-tertiary font-normal">
                      {loc.artifact_id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section 1 — Connected Sources */}
        {showSources && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-edge-default">
              <div>
                <h2 className="text-base font-semibold text-ink-primary">
                  Connected Sources &amp; Access Control
                </h2>
                <p className="text-xs text-ink-secondary">
                  {displaySources.length} active connectors configured
                </p>
              </div>
              <div className="flex items-center gap-2">
                {role === "engineering_lead" && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportModalOpen(true);
                      setCommitError(null);
                      setCommitSuccess(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-xs"
                  >
                    + Import Project Data (BYOD)
                  </button>
                )}
              </div>
            </div>
            {role === "engineering_lead" && (
              <p className="text-[11px] text-ink-secondary mb-4 font-mono">
                As Engineering Lead, you can change each source's access level. Changes apply to all derived views, are audit-logged, and create a new handover version after release.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displaySources.map((s) => {
                const st = aclStates[s.source];
                const currentLevel = (s.acl?.access_level ?? "public") as AccessLevel;
                return (
                  <div
                    key={s.source}
                    className="bg-surface-card border border-edge-default rounded-card p-5 transition-shadow hover:shadow-card"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-base text-ink-primary">{s.source}</p>
                      <span className="text-xs text-ink-tertiary font-mono">{s.last_synced}</span>
                    </div>

                    <p className="text-ink-secondary text-xs flex items-center gap-2 mb-2 font-mono">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-primary shrink-0" />
                      {s.status}
                    </p>

                    <p className="text-xs font-mono text-ink-secondary mb-3">
                      {typeof s.items === "number" ? `${s.items.toLocaleString()} items` : s.items}
                    </p>

                    {/* Per-source ACL control — lead only */}
                    <div className="border-t border-edge-default pt-3 mt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary font-semibold">
                          Access Level
                        </span>
                        <span className="text-[10px] font-mono text-ink-primary font-semibold uppercase">
                          {ACCESS_LEVEL_LABELS[currentLevel]}
                        </span>
                      </div>

                      {role === "engineering_lead" ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap" role="group" aria-label={`Access level for ${s.source}`}>
                            {ACCESS_LEVELS.map((level) => (
                              <button
                                key={level}
                                onClick={() => handleAclChange(s.source, level)}
                                disabled={st?.saving || level === currentLevel || isMockFallback()}
                                title={isMockFallback() ? "Backend unreachable: ACL modifications disabled in offline sample mode." : undefined}
                                aria-pressed={level === currentLevel}
                                className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-all ${
                                  level === currentLevel
                                    ? "bg-ink-primary text-white border-edge-dark font-bold"
                                    : "bg-surface-elevated text-ink-secondary border-edge-strong hover:border-edge-dark hover:text-ink-primary"
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>

                          {/* Confirmation dialog for loosening */}
                          {st?.confirming && st.pendingLevel && (
                            <div className="mt-2 p-2 rounded bg-surface-base border border-edge-strong text-[11px]" role="alertdialog" aria-modal="false">
                              <p className="font-semibold text-ink-primary mb-1">
                                Loosen access from <span className="font-mono">{currentLevel}</span> to <span className="font-mono">{st.pendingLevel}</span>?
                              </p>
                              <p className="text-ink-secondary mb-2">This will make {s.source} artifacts visible to more roles.</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAclConfirm(s.source)}
                                  className="px-2 py-0.5 bg-ink-primary text-white text-[10px] font-mono rounded hover:opacity-80"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleAclCancel(s.source)}
                                  className="px-2 py-0.5 border border-edge-strong text-ink-secondary text-[10px] font-mono rounded hover:border-edge-dark"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Status feedback */}
                          {st?.saving && <p className="text-[10px] font-mono text-ink-secondary mt-1 animate-pulse">Saving...</p>}
                          {st?.saved && <p className="text-[10px] font-mono text-ink-primary mt-1 font-semibold" role="status" aria-live="polite">Saved — audit log updated.</p>}
                          {st?.error && <p className="text-[10px] font-mono text-ink-primary mt-1 font-semibold" role="alert">{st.error}</p>}
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-ink-tertiary">
                          {currentLevel === "public" ? "Visible to all roles" : currentLevel === "internal" ? "Lead + Successor only" : "Lead only — requires higher access"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 2 — Identity Resolution */}
        {showIdentity && (
          <section>
            {(() => {
              const displayIdentities = identityMappings.length > 0 ? identityMappings : identity_mappings;
              return (
                <>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                    <h2 className="text-base font-semibold text-ink-primary">
                      Cross-Tool Identity Resolution
                    </h2>
                    <span className="text-xs font-mono text-ink-secondary">
                      {displayIdentities.length} entities resolved
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayIdentities.map((m, idx) => {
                      const identId = m.id || m.name || `id-${idx}`;
                      return (
                        <div
                          key={m.name + idx}
                          className="bg-surface-card border border-edge-default rounded-card p-4 space-y-2.5 transition-shadow hover:shadow-card"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-xs text-ink-primary">{m.name}</p>
                            <span className="rounded-pill bg-surface-elevated text-ink-primary text-[10px] font-mono px-2 py-0.5 border border-edge-strong">
                              {typeof m.confidence === "number" ? `${Math.round(m.confidence * 100)}%` : m.confidence}
                            </span>
                          </div>

                          <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-xs">
                            <span className="text-ink-tertiary font-mono">GitHub:</span>
                            <span className="text-ink-primary font-mono truncate">{m.github}</span>

                            <span className="text-ink-tertiary font-mono">Slack:</span>
                            <span className="text-ink-primary font-mono truncate">{m.slack}</span>

                            <span className="text-ink-tertiary font-mono">Jira:</span>
                            <span className="text-ink-primary font-mono truncate">{m.jira}</span>
                          </div>

                          {role === "engineering_lead" && (
                            <div className="pt-2 border-t border-edge-default flex items-center justify-between gap-1 text-[10px] font-mono">
                              <span className="text-ink-secondary">
                                {m.status === "confirmed" ? "[Confirmed]" : m.status === "split" ? "[Split]" : "[Auto-Merged]"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {m.status !== "confirmed" && m.status !== "split" && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmIdentity(identId)}
                                    disabled={confirmingId === identId}
                                    className="px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated hover:bg-surface-base text-ink-primary disabled:opacity-50"
                                  >
                                    {confirmingId === identId ? "..." : "Confirm"}
                                  </button>
                                )}
                                {m.status !== "split" && (
                                  <button
                                    type="button"
                                    onClick={() => handleSplitIdentity(identId)}
                                    disabled={splittingId === identId}
                                    className="px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated hover:bg-surface-base text-ink-primary disabled:opacity-50"
                                  >
                                    {splittingId === identId ? "..." : "Split"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* Section 3 — Immutable Audit Log */}
        {showAudit && (
          <section>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
              <h2 className="text-base font-semibold text-ink-primary">
                Immutable Audit Trail
              </h2>
              <span className="text-xs font-mono text-ink-secondary">
                {audit_log.length} events logged
              </span>
            </div>

            <div className="bg-surface-card border border-edge-default rounded-card overflow-hidden">
              {audit_log.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col md:flex-row md:items-start px-5 py-3 text-xs ${
                    idx < audit_log.length - 1 ? "border-b border-edge-default" : ""
                  }`}
                >
                  <span className="text-ink-secondary md:w-32 shrink-0 font-mono mb-0.5 md:mb-0">
                    {entry.time}
                  </span>
                  <span className="font-semibold text-ink-primary md:w-48 shrink-0 mb-0.5 md:mb-0 font-mono">
                    {entry.actor}
                  </span>
                  <span className="text-ink-secondary flex-1 leading-relaxed">
                    {entry.action}
                  </span>
                </div>
              ))}

              {audit_log.length === 0 && (
                <p className="px-5 py-6 text-ink-tertiary text-xs text-center font-mono">
                  No audit log entries.
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* BYOD Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl bg-surface-card border border-edge-strong rounded-card shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-edge-default">
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  Bring Your Own Project Data (BYOD)
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Upload Slack exports (ZIP/JSON), Jira issues (CSV/JSON), and meeting notes.
                  All items are staged and scrubbed in memory before persistence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportPreview(null);
                  setCommitSuccess(null);
                  setCommitError(null);
                }}
                className="text-ink-tertiary hover:text-ink-primary text-sm font-mono px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Upload or Presets */}
            {!importPreview && (
              <div className="space-y-4">
                <div className="p-4 rounded-input border border-dashed border-edge-strong bg-surface-base text-center space-y-3">
                  <p className="text-xs text-ink-secondary font-mono">
                    Supported formats: Slack ZIP/JSON, Jira CSV/JSON, Markdown (.md), Plain Text (.txt), PDF (.pdf)
                  </p>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadSamplePreview}
                      disabled={importLoading}
                      className="px-4 py-2 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-elevated hover:bg-surface-base text-ink-primary transition-all disabled:opacity-50"
                    >
                      {importLoading ? "Parsing & Staging..." : "1-Click: Load Sample Dataset (Slack ZIP + Jira CSV + Arch MD)"}
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-tertiary font-mono">
                    Enforces zip-slip protection, 10MB file limit, and binary sniffing before staging.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Unpersisted Preview & Tier Selection */}
            {importPreview && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-input bg-surface-base border border-edge-default flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Total Items Staged: <strong className="text-ink-primary">{importPreview.total_items}</strong></span>
                  <span>Date Range: <strong className="text-ink-primary">{importPreview.date_range.earliest.slice(0, 10)} to {importPreview.date_range.latest.slice(0, 10)}</strong></span>
                  <span>Files Processed: <strong className="text-ink-primary">{importPreview.ingest_report.files_processed}</strong></span>
                </div>

                {/* Sensitive content quarantine alert if detected */}
                {importPreview.detected_sensitive_items.length > 0 && (
                  <div className="p-3 rounded-input bg-surface-base border border-edge-strong text-xs font-mono space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-ink-primary">
                      <span>!</span>
                      <span>Item-Level Sensitive Content Detected ({importPreview.detected_sensitive_items.length} item(s))</span>
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      Flagged items will automatically enter default-deny quarantine upon ingest until cleared or redacted by lead.
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {importPreview.detected_sensitive_items.map((it, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-surface-elevated border border-edge-strong text-[10px]">
                          {it.title}: {it.reasons.join(", ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected People */}
                {importPreview.detected_people.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block mb-1.5 font-semibold">
                      Detected Contributors &amp; Authors ({importPreview.detected_people.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {importPreview.detected_people.map((p, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-pill bg-surface-elevated border border-edge-default text-[11px] font-mono text-ink-primary">
                          {p.name} {p.handle && `(${p.handle})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Visibility Tier Assignment */}
                <div className="space-y-2 pt-2 border-t border-edge-default">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block font-semibold">
                    Assign Source Visibility Tiers (Lead Policy)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.keys(importPreview.item_counts).map((src) => {
                      const currentTier = sourceTiers[src] || "internal";
                      return (
                        <div key={src} className="p-2.5 rounded-card border border-edge-default bg-surface-base space-y-1.5 font-mono">
                          <div className="flex items-center justify-between text-xs">
                            <strong className="capitalize text-ink-primary">{src}</strong>
                            <span className="text-[10px] text-ink-secondary">{importPreview.item_counts[src]} items</span>
                          </div>
                          <div className="flex gap-1" role="group" aria-label={`Visibility for ${src}`}>
                            {(["public", "internal", "confidential"] as const).map((tier) => (
                              <button
                                key={tier}
                                type="button"
                                onClick={() => setSourceTiers((prev) => ({ ...prev, [src]: tier }))}
                                className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                                  currentTier === tier
                                    ? "bg-ink-primary text-white border-edge-dark font-bold"
                                    : "bg-surface-elevated text-ink-secondary border-edge-strong hover:text-ink-primary"
                                }`}
                              >
                                {tier}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Commit Action */}
                <div className="pt-3 border-t border-edge-default flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    disabled={commitLoading}
                    className="px-3 py-1.5 text-xs font-mono rounded-btn border border-edge-default text-ink-secondary hover:text-ink-primary"
                  >
                    ← Back to files
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={commitLoading}
                    className="px-4 py-2 text-xs font-semibold rounded-btn border border-edge-strong bg-ink-primary text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {commitLoading ? "Ingesting & Scrubbing..." : "Confirm & Ingest Data"}
                  </button>
                </div>
              </div>
            )}

            {commitSuccess && (
              <div className="p-3 rounded-input bg-surface-base border border-edge-strong text-xs font-mono text-ink-primary">
                ✓ {commitSuccess}
              </div>
            )}
            {commitError && (
              <div className="p-3 rounded-input bg-surface-base border border-edge-strong text-xs font-mono text-ink-primary">
                ✕ {commitError}
              </div>
            )}
          </div>
        </div>
      )}

      <NextStepFooter
        nextLabel="Review Connected Project Assets & Documents"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/assets`}
        currentStep={1}
        totalSteps={5}
      />
    </PageContainer>
  );
};

export default Admin;
