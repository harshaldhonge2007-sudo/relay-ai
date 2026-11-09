import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useRole } from "../contexts/CaseContext";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { HandoverItem, Case } from "../types";

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
    classes += " bg-surface-elevated text-ink-secondary";
  }

  return <span className={classes}>{status}</span>;
}

function ProvenanceBadge({
  provenance,
  onClick,
}: {
  provenance: "inferred" | "stated" | "verified";
  onClick?: () => void;
}) {
  let classes =
    "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs uppercase tracking-wider font-semibold select-none cursor-pointer transition-transform hover:scale-105";

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

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      title="Click to view supporting evidence"
    >
      {provenance}
    </button>
  );
}

function ClaimStatusBadge({ status }: { status?: string }) {
  if (!status || status === "pending") {
    return (
      <span className="inline-flex items-center rounded-pill border border-edge-default px-2 py-0.5 text-[11px] font-medium text-ink-tertiary uppercase">
        Pending Review
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center rounded-pill bg-ink-primary text-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-pill border-2 border-ink-primary text-ink-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
        Rejected
      </span>
    );
  }
  if (status === "edited") {
    return (
      <span className="inline-flex items-center rounded-pill bg-surface-elevated border border-edge-strong px-2 py-0.5 text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
        Edited
      </span>
    );
  }
  return null;
}

function renderBoldText(raw: string): React.ReactNode {
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

/* ------------------------------------------------------------------ */
/*  Claim Card with Review Controls                                    */
/* ------------------------------------------------------------------ */

interface ClaimCardProps {
  item: HandoverItem;
  canReview: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onEdit: (id: string, newText: string) => void;
  onInspectEvidence: (evidenceIds: string[], text: string) => void;
}

function ClaimCard({
  item,
  canReview,
  onApprove,
  onReject,
  onEdit,
  onInspectEvidence,
}: ClaimCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const confidencePct = Math.round(item.confidence * 100);
  const sourceCount = item.evidence_ids.length;

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    onEdit(item.id, editText);
    setIsEditing(false);
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    onReject(item.id, rejectReason);
    setShowRejectInput(false);
    setRejectReason("");
  };

  const isRejected = item.claim_status === "rejected";

  return (
    <div
      className={`bg-surface-card rounded-card p-5 border transition-all duration-200 ${
        isRejected
          ? "border-edge-subtle opacity-70 bg-surface-base"
          : "border-edge-default shadow-card hover:-translate-y-px"
      }`}
    >
      {/* Top Meta row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ProvenanceBadge
            provenance={item.provenance}
            onClick={() => onInspectEvidence(item.evidence_ids, item.text)}
          />
          <ClaimStatusBadge status={item.claim_status} />
          {item.original_text && (
            <span className="text-[10px] uppercase tracking-wider text-ink-disabled font-medium">
              (Edited by Lead)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-tertiary">
            Conf: {confidencePct}%
          </span>
          {sourceCount > 0 && (
            <button
              onClick={() => onInspectEvidence(item.evidence_ids, item.text)}
              className="text-xs text-ink-primary font-medium underline hover:text-ink-secondary"
            >
              {sourceCount} source{sourceCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Claim Body / Editor */}
      {isEditing ? (
        <div className="space-y-3 mb-4">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-sm p-3 border border-edge-strong rounded-input bg-white text-ink-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-ink-primary"
            rows={4}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 bg-ink-primary text-white text-xs font-medium rounded-btn hover:shadow-float"
            >
              Save Change
            </button>
            <button
              onClick={() => {
                setEditText(item.text);
                setIsEditing(false);
              }}
              className="px-3 py-1.5 border border-edge-strong text-ink-secondary text-xs rounded-btn hover:text-ink-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isRejected ? "line-through text-ink-disabled" : "text-ink-primary"
            }`}
          >
            {renderBoldText(item.text)}
          </p>

          {item.original_text && (
            <div className="mt-2 p-2.5 rounded bg-surface-elevated text-xs border border-edge-subtle">
              <span className="font-semibold text-ink-tertiary block mb-0.5">
                Original text before edit:
              </span>
              <p className="text-ink-disabled italic">{item.original_text}</p>
            </div>
          )}

          {item.rejection_reason && (
            <div className="mt-2 p-2.5 rounded border border-edge-strong bg-surface-elevated text-xs">
              <span className="font-semibold text-ink-primary block mb-0.5">
                Rejection Note:
              </span>
              <p className="text-ink-secondary">{item.rejection_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Reject inline prompt */}
      {showRejectInput && (
        <div className="mb-4 p-3 border border-edge-strong rounded-input bg-surface-elevated space-y-2">
          <label className="block text-xs font-semibold text-ink-primary">
            Reason for rejecting this claim:
          </label>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Obsolete after Q3 infra migration; unverified"
            className="w-full text-xs p-2 rounded border border-edge-default bg-white text-ink-primary focus:outline-none focus:ring-1 focus:ring-ink-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
              className="px-3 py-1 bg-ink-primary text-white text-xs font-medium rounded disabled:opacity-40"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-3 py-1 border border-edge-strong text-ink-secondary text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-edge-subtle">
        {/* Lead Review Actions */}
        {canReview && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={item.claim_status === "approved"}
              onClick={() => onApprove(item.id)}
              className="px-3 py-1 text-xs font-medium rounded-btn border border-edge-strong text-ink-primary bg-white hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isRejected}
              onClick={() => setShowRejectInput(true)}
              className="px-3 py-1 text-xs font-medium rounded-btn border border-edge-strong text-ink-secondary hover:text-ink-primary disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs font-medium rounded-btn border border-edge-subtle text-ink-tertiary hover:text-ink-primary"
            >
              Edit
            </button>
          </div>
        )}

        {!canReview && (
          <span className="text-[11px] text-ink-disabled italic">
            Claim review locked to Engineering Lead
          </span>
        )}

        {/* Audit history toggle */}
        {item.history && item.history.length > 0 && (
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="text-xs text-ink-tertiary hover:text-ink-primary underline ml-auto"
          >
            {showHistory ? "Hide History" : `History (${item.history.length})`}
          </button>
        )}
      </div>

      {/* History timeline */}
      {showHistory && item.history && item.history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-edge-subtle space-y-1.5 text-xs text-ink-tertiary">
          {item.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>
                <strong className="text-ink-secondary">{h.actor}</strong> {h.action} claim
                {h.note ? `: "${h.note}"` : ""}
              </span>
              <span className="font-mono text-[10px] text-ink-disabled">
                {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Handover Screen                                               */
/* ------------------------------------------------------------------ */

export default function Handover() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { role } = useRole();
  const { openDrawer } = useEvidenceDrawer();

  const [items, setItems] = useState<HandoverItem[]>([]);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [groundingScore, setGroundingScore] = useState<number>(0.82);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const canReview = role === "engineering_lead";

  /* ---- Load Data ------------------------------------------------- */

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [hoRes, cRes] = await Promise.all([
        apiFetch(`/cases/${caseId}/handover`),
        apiFetch(`/cases/${caseId}`),
      ]);
      if (!hoRes.ok || !cRes.ok) throw new Error("Failed to load handover data");
      const hoJson = await hoRes.json();
      const cJson = await cRes.json();

      setItems(hoJson.items || hoJson);
      setGroundingScore(hoJson.grounding_score ?? 0.82);
      setAcknowledged(hoJson.acknowledged ?? false);
      setCaseData(cJson);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---- Evidence Inspect ------------------------------------------ */

  const inspectEvidence = async (evidenceIds: string[], claimText: string) => {
    const list = [];
    for (const id of evidenceIds) {
      try {
        const res = await apiFetch(`/artifacts/${id}`);
        if (res.ok) {
          const art = await res.json();
          list.push(art);
        } else {
          list.push({ artifact_id: id, withheld: true });
        }
      } catch {
        list.push({ artifact_id: id, withheld: true });
      }
    }
    openDrawer(list, claimText);
  };

  /* ---- Claim Actions --------------------------------------------- */

  const handleApproveClaim = async (claimId: string) => {
    if (!caseId || !canReview) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/${claimId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approve claim failed");
    }
  };

  const handleRejectClaim = async (claimId: string, reason: string) => {
    if (!caseId || !canReview) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/${claimId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (res.ok) await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reject claim failed");
    }
  };

  const handleEditClaim = async (claimId: string, newText: string) => {
    if (!caseId || !canReview) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/${claimId}/edit`, {
        method: "PUT",
        body: JSON.stringify({ text: newText }),
      });
      if (res.ok) await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Edit claim failed");
    }
  };

  /* ---- Top-Level Actions ----------------------------------------- */

  const handleApproveAll = async () => {
    if (!caseId || !canReview) return;
    setActing(true);
    try {
      await apiFetch(`/cases/${caseId}/handover/approve`, { method: "POST" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActing(false);
    }
  };

  const handleRelease = async () => {
    if (!caseId || !canReview) return;
    setActing(true);
    try {
      await apiFetch(`/cases/${caseId}/handover/release`, { method: "POST" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setActing(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!caseId) return;
    setActing(true);
    try {
      await apiFetch(`/cases/${caseId}/handover/acknowledge`, { method: "POST" });
      setAcknowledged(true);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Acknowledgement failed");
    } finally {
      setActing(false);
    }
  };

  /* ---- Group Sections -------------------------------------------- */

  const sections = useMemo(() => {
    const map = new Map<string, HandoverItem[]>();
    for (const item of items) {
      // In released mode for non-lead, hide rejected claims
      if (!canReview && item.claim_status === "rejected") {
        continue;
      }
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [items, canReview]);

  const caseStatus = caseData?.status?.toLowerCase() ?? "";
  const isReleased = caseStatus === "released";

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink-primary transition-colors mb-2"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-ink-primary">
                Handover Document
              </h1>
              {caseData && <StatusBadge status={caseData.status} />}
              <span className="inline-flex items-center rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-semibold text-ink-secondary">
                Grounding: {Math.round(groundingScore * 100)}%
              </span>
            </div>
          </div>

          {/* Lead Controls */}
          {canReview && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={acting || caseStatus === "approved" || isReleased}
                onClick={handleApproveAll}
                className="px-4 py-2 text-xs font-medium bg-ink-primary text-white rounded-btn hover:shadow-float disabled:opacity-40"
              >
                Approve Handover
              </button>
              <button
                type="button"
                disabled={acting || isReleased}
                onClick={handleRelease}
                className="px-4 py-2 text-xs font-medium border-2 border-ink-primary text-ink-primary rounded-btn hover:bg-surface-elevated disabled:opacity-40"
              >
                Release to Successor
              </button>
            </div>
          )}
        </div>

        {/* Successor Acknowledgement Banner */}
        {role === "successor" && isReleased && (
          <div className="mb-8 p-5 rounded-card border-2 border-ink-primary bg-surface-card shadow-float animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider mb-1">
                  Receipt Acknowledgement
                </h3>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  As the incoming engineer, please review the verified claims and acknowledge receipt of this handover package.
                </p>
              </div>

              {acknowledged ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-elevated border border-edge-default text-xs font-semibold text-ink-primary shrink-0">
                  <span className="h-2 w-2 rounded-full bg-ink-primary" />
                  Receipt Acknowledged
                </div>
              ) : (
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleAcknowledge}
                  className="px-4 py-2 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:shadow-float shrink-0"
                >
                  Acknowledge Receipt
                </button>
              )}
            </div>
          </div>
        )}

        {/* Demo Mode Notice */}
        <div className="mb-6 p-3 rounded-input bg-surface-elevated border border-edge-subtle flex items-center justify-between text-xs text-ink-tertiary">
          <span>Active Role: <strong className="text-ink-primary uppercase font-mono">{role.replace("_", " ")}</strong></span>
          <span>Click any provenance badge to inspect grounding evidence</span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-card border border-edge-strong bg-surface-card text-xs text-ink-primary">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-32 bg-surface-elevated rounded-card" />
            <div className="h-32 bg-surface-elevated rounded-card" />
          </div>
        )}

        {/* Section Blocks */}
        {!loading && sections.length === 0 && (
          <div className="p-12 text-center bg-surface-card rounded-card border border-edge-default">
            <p className="text-sm text-ink-tertiary">No handover claims available.</p>
          </div>
        )}

        {!loading &&
          sections.map(([title, sectionItems]) => (
            <div key={title} className="mb-10">
              <div className="flex items-center justify-between pb-2 mb-4 border-b border-edge-default">
                <h2 className="text-lg font-semibold text-ink-primary">
                  {title}
                </h2>
                <span className="text-xs text-ink-tertiary">
                  {sectionItems.length} claim{sectionItems.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {sectionItems.map((item) => (
                  <ClaimCard
                    key={item.id}
                    item={item}
                    canReview={canReview}
                    onApprove={handleApproveClaim}
                    onReject={handleRejectClaim}
                    onEdit={handleEditClaim}
                    onInspectEvidence={inspectEvidence}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
