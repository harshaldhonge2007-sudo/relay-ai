import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, API_PREFIX, getApiToken } from "../api";
import { useRole } from "../contexts/CaseContext";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import {
  HandoverItem,
  Case,
  HandoverVersionSummary,
  HandoverDiffResponse,
  HandoverWordDiffToken,
  RecurringProblem,
  ComponentContactsGroup,
  ReReviewQueueItem,
} from "../types";
import PageContainer from "../components/ui/PageContainer";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";
import CoveragePanel, { CoverageData } from "../components/CoveragePanel";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function WordDiffViewer({ tokens, fallbackText }: { tokens?: HandoverWordDiffToken[]; fallbackText: string }) {
  if (!tokens || tokens.length === 0) {
    return <span className="whitespace-pre-line">{fallbackText}</span>;
  }
  return (
    <span className="leading-relaxed whitespace-pre-line font-mono text-xs">
      {tokens.map((token, idx) => {
        if (token.type === "delete") {
          return (
            <span
              key={idx}
              className="line-through bg-surface-elevated text-ink-tertiary px-1 py-0.5 rounded border border-edge-subtle"
              title="Removed in revision"
            >
              {token.text}
            </span>
          );
        }
        if (token.type === "insert") {
          return (
            <span
              key={idx}
              className="font-bold underline bg-surface-elevated text-ink-primary px-1 py-0.5 rounded border border-edge-strong"
              title="Added in revision"
            >
              {token.text}
            </span>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </span>
  );
}

function ProvenanceBadge({
  provenance,
  onClick,
}: {
  provenance: "inferred" | "stated" | "verified" | "unknown";
  onClick?: () => void;
}) {
  const norm = (provenance || "unknown").toLowerCase();
  let classes =
    "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-mono uppercase tracking-wider font-semibold select-none cursor-pointer transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ink-primary focus:outline-none";
  let icon = "?";

  switch (norm) {
    case "verified":
      classes += " bg-ink-primary text-white border border-ink-primary";
      icon = "✓";
      break;
    case "stated":
      classes += " bg-surface-elevated text-ink-primary border border-edge-strong";
      icon = "✎";
      break;
    case "inferred":
      classes += " bg-surface-elevated text-ink-secondary border border-dashed border-edge-strong";
      icon = "≈";
      break;
    default:
      classes += " bg-surface-elevated text-ink-tertiary border border-dotted border-edge-strong";
      icon = "?";
      break;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      aria-label={`Provenance: ${norm.toUpperCase()}. Click to inspect supporting evidence in drawer`}
      title="Click to inspect supporting evidence"
    >
      <span aria-hidden="true" className="font-mono text-[10px]">{icon}</span>
      <span>{norm}</span>
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
/*  Claim Card with Review Controls & Inline Evidence                  */
/* ------------------------------------------------------------------ */

interface ClaimCardProps {
  item: HandoverItem;
  canReview: boolean;
  isFocused?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onEdit: (id: string, newText: string) => void;
  onUndo?: (id: string) => void;
  onInspectEvidence: (evidenceIds: string[], text: string) => void;
  onAskLead?: (item: HandoverItem) => void;
  onOpenReReview?: (claimId: string) => void;
  role?: string;
}

function ClaimCard({
  item,
  canReview,
  isFocused,
  onApprove,
  onReject,
  onEdit,
  onUndo,
  onInspectEvidence,
  onAskLead,
  onOpenReReview,
  role,
}: ClaimCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

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
  const isWithheld = !!(item as any).withheld;

  return (
    <div
      tabIndex={0}
      data-claim-id={item.id}
      className={`bg-surface-card rounded-card p-5 border transition-all duration-200 outline-none ${
        isFocused ? "ring-2 ring-ink-primary border-ink-primary shadow-float" : ""
      } ${
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
          {isWithheld && (
            <span className="inline-flex items-center rounded-pill bg-ink-primary text-white px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider">
              [WITHHELD]
            </span>
          )}
          {item.unsupported_flag && (
            <span className="inline-flex items-center rounded-pill bg-ink-primary text-white px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider">
              [UNSUPPORTED DOWNGRADED TO {item.provenance.toUpperCase()}]
            </span>
          )}
          {(item.is_stale || item.evidence_drift?.is_stale) && (
            <span
              className="inline-flex items-center gap-1 rounded-pill bg-amber-500 text-white dark:bg-amber-600 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider"
              title="Evidence changed since approval"
            >
              <span>⟳</span> Evidence changed since approval
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

      {item.unsupported_flag && item.unsupported_reason && (
        <div className="mb-3 p-2 rounded bg-surface-elevated border border-edge-strong text-[11px] font-mono text-ink-secondary">
          <strong className="text-ink-primary font-bold">Verification Warning:</strong> {item.unsupported_reason}
        </div>
      )}

      {/* Claim Body / Editor */}
      {isEditing ? (
        <div className="space-y-3 mb-4">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-sm p-3 border border-edge-strong rounded-input bg-surface-card text-ink-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-ink-primary"
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

      {/* Prompt 12: Evidence Drift Diff Panel */}
      {(item.is_stale || item.evidence_drift?.is_stale) && (
        <div className="mb-4 p-3.5 rounded-btn border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 text-xs text-ink-primary space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider text-[10px] font-mono">
                Post-Approval Evidence Drift Detected
              </span>
              <span className="text-[11px] text-ink-secondary">
                • Original approved text is preserved
              </span>
            </div>
            {canReview && onOpenReReview && (
              <button
                type="button"
                onClick={() => onOpenReReview(item.id)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-ink-primary text-white hover:opacity-90 shadow-subtle shrink-0"
              >
                Open Re-Review Queue
              </button>
            )}
          </div>
          <p className="text-ink-primary font-medium leading-relaxed">
            {item.evidence_drift?.drift_summary || "Underlying cited evidence has been modified or merged in the repository after handover approval."}
          </p>
          {item.evidence_drift?.diff && (
            <div className="p-2.5 rounded bg-surface-card border border-edge-subtle font-mono text-[11px] text-ink-secondary whitespace-pre-wrap leading-normal">
              {item.evidence_drift.diff}
            </div>
          )}
        </div>
      )}

      {/* Inline Evidence Accordion Preview */}
      {sourceCount > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowEvidence((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium py-1 transition-colors"
          >
            <span className="font-mono text-[10px]">{showEvidence ? "▼" : "▶"}</span>
            <span>Inline Evidence Preview ({sourceCount} source{sourceCount !== 1 ? "s" : ""})</span>
          </button>
          {showEvidence && (
            <div className="mt-2 p-3 bg-surface-elevated rounded border border-edge-strong space-y-2 text-xs animate-fadeIn">
              <div className="flex items-center justify-between pb-1.5 border-b border-edge-subtle">
                <span className="font-semibold text-ink-secondary">Citations &amp; Supporting Context</span>
                <button
                  type="button"
                  onClick={() => onInspectEvidence(item.evidence_ids, item.text)}
                  className="text-xs font-semibold underline text-ink-primary hover:text-ink-secondary"
                >
                  Open in Evidence Drawer →
                </button>
              </div>
              <div className="space-y-1.5">
                {item.evidence_ids.slice(0, 2).map((eid, idx) => (
                  <div key={idx} className="p-2 bg-surface-card rounded border border-edge-subtle text-xs">
                    <span className="font-mono font-bold text-[10px] text-ink-primary block mb-0.5">
                      Citation [{eid}]:
                    </span>
                    <p className="text-ink-secondary italic text-[11px] leading-relaxed">
                      "{item.text.slice(0, 140)}..."
                    </p>
                  </div>
                ))}
              </div>
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
            className="w-full text-xs p-2 rounded border border-edge-default bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-ink-primary"
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={item.claim_status === "approved"}
              onClick={() => onApprove(item.id)}
              className="px-3 py-1 text-xs font-medium rounded-btn border border-edge-strong text-ink-primary bg-surface-card hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed"
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
            {(item.claim_status === "approved" || isRejected) && onUndo && (
              <button
                type="button"
                onClick={() => onUndo(item.id)}
                className="px-2.5 py-1 text-xs font-medium rounded-btn border border-edge-subtle text-ink-tertiary hover:text-ink-primary"
                title="Undo review decision on this claim"
              >
                Undo
              </button>
            )}
            {isFocused && (
              <span className="hidden sm:inline font-mono text-[10px] text-ink-disabled ml-1">
                [A] Approve • [R] Reject • [E] Edit
              </span>
            )}
          </div>
        )}

        {!canReview && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAskLead?.(item)}
              className="px-3 py-1 text-xs font-medium rounded-btn border border-edge-strong bg-surface-elevated text-ink-primary hover:bg-surface-card transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              <span>Ask Lead</span>
            </button>
            <span className="text-[11px] text-ink-disabled italic">
              Review locked to Lead{role ? ` (${role.replace("_", " ")})` : ""}
            </span>
          </div>
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
  const { role } = useRole();
  const { openDrawer } = useEvidenceDrawer();

  const [items, setItems] = useState<HandoverItem[]>([]);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [groundingScore, setGroundingScore] = useState<number>(0.82);
  const [groundingMethod, setGroundingMethod] = useState<string>("deterministic lexical and entity overlap (offline)");
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Real Version History & Gating State
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [releasedVersion, setReleasedVersion] = useState<number | null>(null);
  const [acknowledgedVersion, setAcknowledgedVersion] = useState<number | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [acknowledgedBy, setAcknowledgedBy] = useState<string | null>(null);
  const [unreviewedCount, setUnreviewedCount] = useState<number>(0);
  const [canRelease, setCanRelease] = useState<boolean>(false);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);

  // Modals for Versions and Side-by-Side Diff
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false);
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [versionList, setVersionList] = useState<HandoverVersionSummary[]>([]);
  const [diffV1, setDiffV1] = useState<number>(1);
  const [diffV2, setDiffV2] = useState<number>(1);
  const [diffData, setDiffData] = useState<HandoverDiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);

  // PDF Export state
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Prompt 7: Recurring Problems, Key Contacts & Version Restore
  const [recurringProblems, setRecurringProblems] = useState<RecurringProblem[]>([]);
  const [problemCategoryFilter, setProblemCategoryFilter] = useState<string>("all");
  const [componentContacts, setComponentContacts] = useState<ComponentContactsGroup[]>([]);
  const [continuationPlan, setContinuationPlan] = useState<any>(null);
  const [restoringVersion, setRestoringVersion] = useState<boolean>(false);

  // Prompt 9: Review Triage, Batch Approve, Pre-Flight, Continuation, Ask-Lead
  const [sortByRisk, setSortByRisk] = useState<boolean>(true);
  const [claimFilter, setClaimFilter] = useState<string>("all");
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [batchToast, setBatchToast] = useState<string | null>(null);

  // Prompt 12: Evidence Drift & Living Re-Review Queue
  const [reReviewPendingCount, setReReviewPendingCount] = useState<number>(0);
  const [hasEvidenceDrift, setHasEvidenceDrift] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [showReReviewModal, setShowReReviewModal] = useState<boolean>(false);
  const [reReviewQueue, setReReviewQueue] = useState<ReReviewQueueItem[]>([]);
  const [loadingReReview, setLoadingReReview] = useState<boolean>(false);
  const [editedClaimText, setEditedClaimText] = useState<string>("");
  const [resolvingDrift, setResolvingDrift] = useState<boolean>(false);
  const [simulatingDrift, setSimulatingDrift] = useState<boolean>(false);
  const [driftToast, setDriftToast] = useState<string | null>(null);

  // Modals for Prompt 9
  const [showBatchConfirm, setShowBatchConfirm] = useState<boolean>(false);
  const [batchApproving, setBatchApproving] = useState<boolean>(false);
  const [showPreflightModal, setShowPreflightModal] = useState<boolean>(false);
  const [preflightData, setPreflightData] = useState<any>(null);
  const [loadingPreflight, setLoadingPreflight] = useState<boolean>(false);
  const [previewRole, setPreviewRole] = useState<"lead" | "successor" | "contractor">("lead");
  const [previewItems, setPreviewItems] = useState<HandoverItem[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showAskLeadModal, setShowAskLeadModal] = useState<boolean>(false);
  const [askLeadTarget, setAskLeadTarget] = useState<HandoverItem | null>(null);
  const [askLeadQuestion, setAskLeadQuestion] = useState<string>("");
  const [askingLead, setAskingLead] = useState<boolean>(false);
  const [continuationTasks, setContinuationTasks] = useState<any[]>([]);
  const [openQuestions, setOpenQuestions] = useState<any[]>([]);

  // Accessible Modal Focus Traps & Focus Restoration (Prompt 10 & 12)
  const versionHistoryModalRef = useModalFocusTrap(showVersionHistory, () => setShowVersionHistory(false));
  const diffModalRef = useModalFocusTrap(showDiffModal, () => setShowDiffModal(false));
  const batchConfirmModalRef = useModalFocusTrap(showBatchConfirm, () => setShowBatchConfirm(false));
  const preflightModalRef = useModalFocusTrap(showPreflightModal, () => setShowPreflightModal(false));
  const askLeadModalRef = useModalFocusTrap(showAskLeadModal, () => setShowAskLeadModal(false));
  const shortcutsModalRef = useModalFocusTrap(showShortcutsModal, () => setShowShortcutsModal(false));
  const reReviewModalRef = useModalFocusTrap(showReReviewModal, () => setShowReReviewModal(false));

  const canReview = role === "engineering_lead";

  /* ---- Load Data ------------------------------------------------- */

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [hoRes, cRes, vRes, probRes, contactRes, contRes, contProgRes, qRes] = await Promise.all([
        apiFetch(`/cases/${caseId}/handover`),
        apiFetch(`/cases/${caseId}`),
        apiFetch(`/cases/${caseId}/handover/versions`),
        apiFetch(`/cases/${caseId}/recurring-problems`),
        apiFetch(`/cases/${caseId}/contacts?by_component=true`),
        apiFetch(`/cases/${caseId}/continuation`),
        apiFetch(`/cases/${caseId}/continuation/progress`),
        apiFetch(`/cases/${caseId}/questions`),
      ]);
      if (!hoRes.ok || !cRes.ok) throw new Error("Failed to load handover data");
      const hoJson = await hoRes.json();
      const cJson = await cRes.json();
      if (vRes.ok) {
        const vJson = await vRes.json();
        setVersionList(vJson);
        if (vJson.length >= 2) {
          setDiffV1(vJson[vJson.length - 2].version);
          setDiffV2(vJson[vJson.length - 1].version);
        } else if (vJson.length === 1) {
          setDiffV1(vJson[0].version);
          setDiffV2(vJson[0].version);
        }
      }

      if (probRes && probRes.ok) {
        const probJson = await probRes.json();
        setRecurringProblems(Array.isArray(probJson) ? probJson : []);
      } else if (hoJson.recurring_problems) {
        setRecurringProblems(hoJson.recurring_problems);
      }

      if (contactRes && contactRes.ok) {
        const contJson = await contactRes.json();
        setComponentContacts(Array.isArray(contJson) ? contJson : []);
      } else if (hoJson.key_contacts) {
        setComponentContacts(hoJson.key_contacts);
      }

      if (contRes && contRes.ok) {
        const cPlanJson = await contRes.json();
        setContinuationPlan(cPlanJson);
      } else if (hoJson.continuation) {
        setContinuationPlan(hoJson.continuation);
      }

      if (contProgRes && contProgRes.ok) {
        const progJson = await contProgRes.json();
        setContinuationTasks(progJson.tasks || []);
      } else if (hoJson.continuation?.first_5_days) {
        setContinuationTasks(hoJson.continuation.first_5_days);
      }

      if (qRes && qRes.ok) {
        const qJson = await qRes.json();
        setOpenQuestions(Array.isArray(qJson) ? qJson : []);
      }

      setItems(hoJson.items || hoJson);
      setGroundingScore(hoJson.grounding_score ?? 0.82);
      setGroundingMethod(hoJson.grounding_method ?? "deterministic lexical and entity overlap (offline)");
      setAcknowledged(hoJson.acknowledged ?? false);
      setCurrentVersion(hoJson.current_version ?? 1);
      setReleasedVersion(hoJson.released_version ?? null);
      setAcknowledgedVersion(hoJson.acknowledged_version ?? null);
      setAcknowledgedAt(hoJson.acknowledged_at ?? null);
      setAcknowledgedBy(hoJson.acknowledged_by ?? null);
      setUnreviewedCount(hoJson.unreviewed_count ?? 0);
      setCanRelease(hoJson.can_release ?? false);
      setCoverage(hoJson.coverage ?? null);
      setReReviewPendingCount(hoJson.re_review_pending_count ?? 0);
      setHasEvidenceDrift(hoJson.has_evidence_drift ?? false);
      const isUpAvail = hoJson.update_available ?? (
        hoJson.released_version != null &&
        hoJson.acknowledged_version != null &&
        hoJson.released_version > hoJson.acknowledged_version
      );
      setUpdateAvailable(isUpAvail);
      setCaseData(cJson);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  /* ---- Prompt 12: Evidence Drift & Living Re-Review Handlers ------- */

  const handleOpenReReview = async (targetClaimId?: string) => {
    if (!caseId) return;
    setLoadingReReview(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/re-review-queue`);
      if (res.ok) {
        const queue: ReReviewQueueItem[] = await res.json();
        setReReviewQueue(queue);
        const active = targetClaimId
          ? queue.find((q) => q.claim_id === targetClaimId) || queue[0]
          : queue[0];
        if (active) {
          setEditedClaimText(active.suggested_update || active.claim_text);
        }
        setShowReReviewModal(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load re-review queue");
    } finally {
      setLoadingReReview(false);
    }
  };

  const handleResolveReReview = async (claimId: string, action: "amend" | "acknowledge" | "dismiss") => {
    if (!caseId || role !== "engineering_lead") return;
    setResolvingDrift(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/re-review/${claimId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          action,
          new_text: editedClaimText,
          notes: `Engineering lead resolved drift via ${action}`,
        }),
      });
      if (res.ok) {
        setShowReReviewModal(false);
        setDriftToast(`Resolved evidence drift on claim ${claimId} via ${action}. Handover version bumped!`);
        await loadData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.detail || "Failed to resolve re-review queue item.");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error resolving re-review item");
    } finally {
      setResolvingDrift(false);
    }
  };

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
        setDriftToast("Simulated GitHub Webhook: PR #47 (SL-456) merged into main! Claim ho-001 flagged stale.");
        await loadData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to simulate drift");
    } finally {
      setSimulatingDrift(false);
    }
  };

  const handleRestoreVersion = async (versionNum: number) => {
    if (!caseId || role !== "engineering_lead") return;
    const ok = window.confirm(
      `Restore Version v${versionNum} as a new working draft? Existing version history will be preserved as immutable records.`
    );
    if (!ok) return;
    setRestoringVersion(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/versions/${versionNum}/restore-as-draft`, {
        method: "POST",
      });
      if (res.ok) {
        await loadData();
        setShowVersionHistory(false);
        setShowDiffModal(false);
      }
    } catch (err) {
      console.warn("Failed to restore draft:", err);
    } finally {
      setRestoringVersion(false);
    }
  };

  /* ---- Diff Loader ----------------------------------------------- */

  const loadDiff = async (v1: number, v2: number) => {
    if (!caseId) return;
    setLoadingDiff(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/diff?v1=${v1}&v2=${v2}`);
      if (res.ok) {
        const d = await res.json();
        setDiffData(d);
      }
    } catch (err) {
      console.warn("Failed to load diff:", err);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleOpenDiff = () => {
    setShowDiffModal(true);
    loadDiff(diffV1, diffV2);
  };

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
      if (res.ok) {
        setUndoStack((prev) => [...prev, claimId]);
        await loadData();
      }
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
      if (res.ok) {
        setUndoStack((prev) => [...prev, claimId]);
        await loadData();
      }
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
      if (res.ok) {
        setUndoStack((prev) => [...prev, claimId]);
        await loadData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Edit claim failed");
    }
  };

  /* ---- Prompt 9 Actions: Batch Approve, Undo, Pre-Flight, Tasks, Ask Lead ---- */

  const handleBatchApprove = async () => {
    if (!caseId || !canReview) return;
    setBatchApproving(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/batch-approve-verified`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBatchToast(`Batch approved ${data.approved_count} verified claims (${data.skipped_inferred_or_unknown_count} inferred/unknown claims skipped).`);
        await loadData();
        setShowBatchConfirm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch approval failed");
    } finally {
      setBatchApproving(false);
    }
  };

  const handleUndo = async (claimId?: string) => {
    if (!caseId || !canReview) return;
    const targetId = claimId || (undoStack.length > 0 ? undoStack[undoStack.length - 1] : null);
    if (!targetId) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/${targetId}/undo`, { method: "POST" });
      if (res.ok) {
        setUndoStack((prev) => prev.filter((id) => id !== targetId));
        setBatchToast(`Undid review decision on claim ${targetId} (reverted to pending).`);
        await loadData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  };

  const handleOpenPreflight = async () => {
    if (!caseId) return;
    setShowPreflightModal(true);
    setLoadingPreflight(true);
    setPreviewRole("lead");
    setPreviewItems(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/preflight`);
      if (res.ok) {
        const data = await res.json();
        setPreflightData(data);
      }
    } catch (err) {
      console.warn("Failed to load preflight checks:", err);
    } finally {
      setLoadingPreflight(false);
    }
  };

  const handleRolePreview = async (targetRole: "lead" | "successor" | "contractor") => {
    if (!caseId) return;
    setPreviewRole(targetRole);
    if (targetRole === "lead") {
      setPreviewItems(null);
      return;
    }
    setLoadingPreview(true);
    try {
      // Invariant: Calls the real role-filtered endpoint, never client-side filtering!
      const res = await apiFetch(`/cases/${caseId}/handover?preview_role=${targetRole}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewItems(data.items || data);
      }
    } catch (err) {
      console.warn("Failed to fetch role preview:", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAcknowledgeContradictions = async () => {
    if (!caseId || !canReview) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/contradictions/acknowledge`, {
        method: "POST",
        body: JSON.stringify({
          notes: "Acknowledged contradictory statements to remain visible as Open Questions for incoming successor.",
        }),
      });
      if (res.ok) {
        const pfRes = await apiFetch(`/cases/${caseId}/handover/preflight`);
        if (pfRes.ok) {
          setPreflightData(await pfRes.json());
        }
        await loadData();
      }
    } catch (err) {
      console.warn("Failed to acknowledge contradictions:", err);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (!caseId) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/continuation/progress`, {
        method: "PUT",
        body: JSON.stringify({ task_id: taskId, completed }),
      });
      if (res.ok) {
        const data = await res.json();
        setContinuationTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...data.task } : t))
        );
      }
    } catch (err) {
      console.warn("Failed to update task progress:", err);
    }
  };

  const handleSubmitAskLead = async () => {
    if (!caseId || !askLeadTarget || !askLeadQuestion.trim()) return;
    setAskingLead(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/handover/${askLeadTarget.id}/ask-lead`, {
        method: "POST",
        body: JSON.stringify({ question: askLeadQuestion.trim(), context: askLeadTarget.section }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpenQuestions((prev) => [data.question, ...prev]);
        setShowAskLeadModal(false);
        setAskLeadQuestion("");
        setAskLeadTarget(null);
        setBatchToast(`Inquiry sent to Engineering Lead for claim ${data.claim_id}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to ask lead");
    } finally {
      setAskingLead(false);
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
      setShowPreflightModal(false);
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

  const handleDownloadPdf = async () => {
    if (!caseId) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = getApiToken();
      if (token) headers["authorization"] = `Bearer ${token}`;

      const url = `${API_PREFIX}/cases/${caseId}/handover/export/pdf`;
      const res = await fetch(url, { headers });

      if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        const safeName = caseData?.name ? caseData.name.replace(/[^a-zA-Z0-9_-]/g, "-") : String(caseId);
        a.download = `relay-handover-${safeName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        setPdfError("Direct PDF streaming unavailable from backend. Please ensure the backend is running with reportlab installed.");
      }
    } catch {
      setPdfError("Could not connect to backend server for PDF generation.");
    } finally {
      setPdfLoading(false);
    }
  };

  /* ---- Triage Sorting, Filtering & Risk Priority Calculations ---- */

  // Risk ordering: Contradicted (0) -> Unknown (1) -> Inferred (2) -> Stated (3) -> Verified (4)
  const getRiskScore = (claim: HandoverItem): number => {
    if (claim.unsupported_flag || (claim.rejection_reason && claim.rejection_reason.toLowerCase().includes("contradict"))) {
      return 0;
    }
    const prov = (claim.provenance || "").toLowerCase();
    if (prov === "unknown") return 1;
    if (prov === "inferred") return 2;
    if (prov === "stated") return 3;
    if (prov === "verified") return 4;
    return 5;
  };

  const counts = useMemo(() => {
    const total = items.length;
    const reviewed = items.filter(
      (i) => i.claim_status === "approved" || i.claim_status === "rejected" || i.claim_status === "edited"
    ).length;
    const unreviewed = total - reviewed;
    const approved = items.filter((i) => i.claim_status === "approved").length;
    const rejected = items.filter((i) => i.claim_status === "rejected").length;
    const verified = items.filter((i) => (i.provenance || "").toLowerCase() === "verified").length;
    const inferredOrUnknown = items.filter((i) => {
      const p = (i.provenance || "").toLowerCase();
      return p === "inferred" || p === "unknown";
    }).length;
    const contradictions = items.filter(
      (i) => i.unsupported_flag || (i.rejection_reason && i.rejection_reason.toLowerCase().includes("contradict"))
    ).length;
    const corroboratedVerified = items.filter(
      (i) =>
        (i.provenance || "").toLowerCase() === "verified" &&
        i.evidence_ids.length >= 2 &&
        i.claim_status !== "approved" &&
        i.claim_status !== "rejected"
    ).length;

    return {
      total,
      reviewed,
      unreviewed,
      approved,
      rejected,
      verified,
      inferredOrUnknown,
      contradictions,
      corroboratedVerified,
    };
  }, [items]);

  const filteredClaims = useMemo(() => {
    return items.filter((item) => {
      if (!canReview && item.claim_status === "rejected") {
        return false;
      }
      if (claimFilter === "unreviewed") {
        return item.claim_status !== "approved" && item.claim_status !== "rejected" && item.claim_status !== "edited";
      }
      if (claimFilter === "approved") {
        return item.claim_status === "approved";
      }
      if (claimFilter === "rejected") {
        return item.claim_status === "rejected";
      }
      if (claimFilter === "verified") {
        return (item.provenance || "").toLowerCase() === "verified";
      }
      if (claimFilter === "inferred_unknown") {
        const p = (item.provenance || "").toLowerCase();
        return p === "inferred" || p === "unknown";
      }
      if (claimFilter === "contradictions") {
        return item.unsupported_flag || (item.rejection_reason && item.rejection_reason.toLowerCase().includes("contradict"));
      }
      return true;
    });
  }, [items, canReview, claimFilter]);

  const sections = useMemo(() => {
    const list = [...filteredClaims];
    if (sortByRisk) {
      list.sort((a, b) => getRiskScore(a) - getRiskScore(b));
    }
    const map = new Map<string, HandoverItem[]>();
    for (const item of list) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return Array.from(map.entries());
  }, [filteredClaims, sortByRisk]);

  const visibleClaims = useMemo(() => {
    return sections.flatMap(([, sItems]) => sItems);
  }, [sections]);

  /* ---- Keyboard Shortcuts Handler (Prompt 9) ---- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowVersionHistory(false);
        setShowDiffModal(false);
        setShowPreflightModal(false);
        setShowBatchConfirm(false);
        setShowShortcutsModal(false);
        setShowAskLeadModal(false);
        return;
      }

      // Check if user is typing in an input, textarea, or select
      const activeEl = document.activeElement;
      if (activeEl && ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName)) {
        return;
      }

      // If any modal is open, suppress shortcuts
      if (
        showVersionHistory ||
        showDiffModal ||
        showPreflightModal ||
        showBatchConfirm ||
        showShortcutsModal ||
        showAskLeadModal
      ) {
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, Math.max(0, visibleClaims.length - 1)));
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      const focusedClaim = visibleClaims[focusedIndex];
      if (!focusedClaim) return;

      if ((e.key === "a" || e.key === "A") && canReview) {
        e.preventDefault();
        handleApproveClaim(focusedClaim.id);
        return;
      }

      if ((e.key === "r" || e.key === "R") && canReview) {
        e.preventDefault();
        const reason = window.prompt(`Reject claim ${focusedClaim.id}? Enter rationale (required):`);
        if (reason && reason.trim()) {
          handleRejectClaim(focusedClaim.id, reason.trim());
        }
        return;
      }

      if ((e.key === "e" || e.key === "E") && canReview) {
        e.preventDefault();
        const newText = window.prompt(`Edit claim text:`, focusedClaim.text);
        if (newText && newText.trim()) {
          handleEditClaim(focusedClaim.id, newText.trim());
        }
        return;
      }

      if ((e.key === "u" || e.key === "U" || e.key === "z" || e.key === "Z") && canReview) {
        e.preventDefault();
        handleUndo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showVersionHistory,
    showDiffModal,
    showPreflightModal,
    showBatchConfirm,
    showShortcutsModal,
    showAskLeadModal,
    visibleClaims,
    focusedIndex,
    canReview,
  ]);

  const filteredProblems = useMemo(() => {
    if (problemCategoryFilter === "all") return recurringProblems;
    return recurringProblems.filter((p) => p.category === problemCategoryFilter);
  }, [recurringProblems, problemCategoryFilter]);

  const caseStatus = caseData?.status?.toLowerCase() ?? "";
  const isReleased = caseStatus === "released";

  return (
    <PageContainer width="standard">
      <PageHeader
        stepNumber={4}
        stepEyebrow="Review & Sign-Off"
        title="Handover Document"
        description={`Verified knowledge continuity package compiled from code, conversations, and leaver interview sessions (${groundingMethod}).`}
        metaChips={[
          { label: "Version", value: `v${currentVersion}` },
          { label: "Grounding", value: `${Math.round(groundingScore * 100)}%` },
          { label: "Status", value: caseData?.status || "In Review" },
          ...(hasEvidenceDrift ? [{ label: "Drift", value: "Detected" }] : []),
          ...(releasedVersion ? [{ label: "Released", value: `v${releasedVersion}` }] : []),
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/case/${caseId || "case-001"}/limits`}
              className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors"
              title="System boundaries, real vs simulated capabilities, and failure modes"
            >
              Limits & Boundaries
            </Link>
            <button
              type="button"
              onClick={() => setShowVersionHistory(true)}
              className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors"
            >
              History ({versionList.length})
            </button>
            <button
              type="button"
              onClick={handleOpenDiff}
              className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors"
            >
              Compare Diff
            </button>
            <button
              type="button"
              disabled={pdfLoading}
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-ink-primary text-white hover:bg-neutral-800 rounded-btn transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              title="Download professional PDF of verified handover pack"
            >
              {pdfLoading ? (
                <>
                  <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {canReview && (
              <>
                {reReviewPendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenReReview()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-btn bg-amber-500 text-white dark:bg-amber-600 hover:opacity-90 flex items-center gap-1.5 shadow-subtle"
                  >
                    <span>⟳</span>
                    <span>Re-Review Queue ({reReviewPendingCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={simulatingDrift}
                  onClick={handleSimulateDrift}
                  className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors disabled:opacity-40"
                  title="Simulate post-release webhook: PR #47 (SL-456) merges into main"
                >
                  {simulatingDrift ? "Simulating Webhook..." : "⚡ Simulate Drift (SL-456)"}
                </button>
                <button
                  type="button"
                  disabled={acting || caseStatus === "approved" || isReleased}
                  onClick={handleApproveAll}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  Approve Handover
                </button>
                <button
                  type="button"
                  disabled={acting || isReleased}
                  onClick={handleOpenPreflight}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-edge-strong text-ink-primary bg-surface-card hover:bg-surface-elevated rounded-btn transition-colors disabled:opacity-40"
                >
                  Release to Successor
                </button>
              </>
            )}
            {!canReview && (
              <button
                type="button"
                disabled={simulatingDrift}
                onClick={handleSimulateDrift}
                className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-card hover:bg-surface-elevated rounded-btn text-ink-primary transition-colors disabled:opacity-40"
                title="Simulate post-release webhook: PR #47 (SL-456) merges into main"
              >
                {simulatingDrift ? "Simulating..." : "⚡ Simulate Drift (SL-456)"}
              </button>
            )}
          </div>
        }
      />

        {/* Prompt 12: Successor "Update Available" Ribbon */}
        {updateAvailable && (
          <div className="mb-6 p-4 rounded-card border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-ink-primary shadow-float flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-200 uppercase tracking-wider shrink-0 mt-0.5">
                Update Available
              </span>
              <div>
                <h4 className="text-sm font-bold text-ink-primary">
                  Handover v{releasedVersion || (currentVersion + 1)} Released with Updated Evidence
                </h4>
                <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                  Engineering Lead Alex Chen has published an amended handover version reflecting post-release code changes (e.g. PR #47 / SL-456 merged into main).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDiffV1(acknowledgedVersion || 1);
                  setDiffV2(releasedVersion || 2);
                  setShowDiffModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-btn bg-surface-card border border-edge-strong text-ink-primary hover:bg-surface-elevated shadow-subtle"
              >
                Compare v{acknowledgedVersion || 1} vs v{releasedVersion || 2}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={handleAcknowledge}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:opacity-90 disabled:opacity-40 shadow-subtle"
              >
                Acknowledge v{releasedVersion || 2}
              </button>
            </div>
          </div>
        )}

        {/* Drift Toast Notification */}
        {driftToast && (
          <div className="mb-6 p-4 rounded-card border-2 border-ink-primary bg-surface-card text-xs flex items-center justify-between shadow-card animate-fadeIn" role="status">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                Living Ingestion
              </span>
              <span className="font-medium text-ink-primary">{driftToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setDriftToast(null)}
              className="font-mono text-xs text-ink-tertiary hover:text-ink-primary px-2 py-0.5 rounded hover:bg-surface-elevated"
              aria-label="Dismiss drift notification"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Batch / Undo Notification Toast Banner */}
        {batchToast && (
          <div className="mb-6 p-4 rounded-card border-2 border-ink-primary bg-surface-card text-xs flex items-center justify-between shadow-card animate-fadeIn" role="status">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-ink-primary text-white">
                Notification
              </span>
              <span className="font-medium text-ink-primary">{batchToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setBatchToast(null)}
              className="font-mono text-xs text-ink-tertiary hover:text-ink-primary px-2 py-0.5 rounded hover:bg-surface-elevated"
              aria-label="Dismiss notification"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Release Gating Alert */}
        {canReview && !isReleased && !canRelease && (
          <div className="mb-6 p-4 rounded-card border-2 border-edge-strong bg-surface-card text-xs text-ink-primary flex items-start gap-3">
            <span className="font-mono font-bold uppercase tracking-wider text-[11px] px-1.5 py-0.5 bg-ink-primary text-white rounded">
              Release Gated
            </span>
            <div className="flex-1">
              <strong className="block font-semibold mb-0.5">
                {unreviewedCount} claim(s) require review before release
              </strong>
              <span className="text-ink-secondary">
                To prevent unverified information from reaching the successor, every claim must be explicitly approved, edited, or rejected before this handover can be released. Rejected claims are permanently omitted from the released package.
              </span>
            </div>
          </div>
        )}

        {/* Successor Acknowledgement Banner */}
        {role === "successor" && isReleased && (
          <div className="mb-8 p-5 rounded-card border-2 border-ink-primary bg-surface-card shadow-float animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                    Receipt Acknowledgement
                  </h3>
                  <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-surface-elevated border border-edge-default">
                    Released v{releasedVersion} (Immutable)
                  </span>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  As the incoming engineer, you are reviewing the finalized released version. Acknowledging permanently binds receipt to Version v{releasedVersion}.
                </p>
              </div>

              {acknowledged ? (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-elevated border border-edge-default text-xs font-semibold text-ink-primary">
                    <span className="h-2 w-2 rounded-full bg-ink-primary" />
                    Acknowledged (v{acknowledgedVersion || releasedVersion})
                  </div>
                  {acknowledgedAt && (
                    <span className="text-[10px] text-ink-tertiary">
                      {new Date(acknowledgedAt).toLocaleString()}{acknowledgedBy ? ` • ${acknowledgedBy}` : ""}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleAcknowledge}
                  className="px-4 py-2 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:shadow-float shrink-0 disabled:opacity-40"
                >
                  Acknowledge Receipt (v{releasedVersion})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Coverage Panel: Sources, Provenance, & Boundary Disclosures */}
        <CoveragePanel coverage={coverage} className="mb-6" />

        {/* Demo Mode Notice */}
        <div className="mb-6 p-3 rounded-input bg-surface-elevated border border-edge-subtle flex items-center justify-between text-xs text-ink-tertiary">
          <span>Active Role: <strong className="text-ink-primary uppercase font-mono">{role.replace("_", " ")}</strong></span>
          <span>Click any provenance badge to inspect grounding evidence</span>
        </div>

        {/* Project Assets & Cloud Folder Integration Banner */}
        <div className="mb-6 p-4 rounded-card border border-edge-default bg-surface-card shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-input bg-surface-elevated border border-edge-default flex items-center justify-center text-ink-primary shrink-0">
              <svg className="w-4 h-4 text-ink-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-primary flex items-center gap-2">
                <span>Handover Project Assets &amp; Cloud Folder</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated text-ink-primary uppercase font-semibold">
                  Google Drive Linked
                </span>
              </h3>
              <p className="text-[11px] text-ink-secondary mt-0.5">
                Technical specs, architecture diagrams, runbooks, and spreadsheets organized for the incoming employee.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://drive.google.com/drive/folders/demo-handover-shopledger"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-semibold border border-edge-strong bg-surface-elevated hover:bg-surface-card rounded-btn text-ink-primary transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
              </svg>
              <span>Drive Folder ↗</span>
            </a>
            <Link
              to={`/case/${caseId}/assets`}
              className="px-3 py-1.5 text-xs font-semibold bg-ink-primary text-white hover:bg-neutral-800 rounded-btn transition-colors shadow-sm"
            >
              Manage Assets ({4}) →
            </Link>
          </div>
        </div>

        {pdfError && (
          <div className="mb-6 p-3.5 rounded-card bg-surface-elevated border border-edge-strong text-xs text-ink-secondary flex items-start justify-between gap-3 animate-fadeIn">
            <div>
              <strong className="text-ink-primary block mb-0.5 font-semibold">PDF Generation Notice</strong>
              {pdfError}
            </div>
            <button onClick={() => setPdfError(null)} className="text-ink-disabled hover:text-ink-primary text-xs">✕</button>
          </div>
        )}

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

        {/* Review Triage Bar (Prompt 9) */}
        {!loading && items.length > 0 && (
          <div className="mb-8 p-5 rounded-card border-2 border-edge-strong bg-surface-card shadow-card space-y-4" data-testid="review-triage-bar">
            {/* Top row: Counter & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary font-mono">
                    Review Triage &amp; Quality Gates
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary">
                    {counts.reviewed} / {counts.total} reviewed ({Math.round((counts.reviewed / (counts.total || 1)) * 100)}%)
                  </span>
                </div>
                <p className="text-[11px] text-ink-tertiary">
                  Claims must be reviewed, verified, or explicitly rejected before release to the successor.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canReview && (
                  <button
                    type="button"
                    disabled={counts.corroboratedVerified === 0 || batchApproving}
                    onClick={() => setShowBatchConfirm(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Batch approve verified claims with 2+ independent sources (Skips inferred/unknown)"
                  >
                    Batch Approve Corroborated ({counts.corroboratedVerified})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSortByRisk((prev) => !prev)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-elevated hover:bg-surface-card text-ink-primary transition-colors font-mono"
                  title="Toggle risk priority sorting (UNKNOWN / Inferred / Contradictions first) vs document order"
                >
                  Order: {sortByRisk ? "Risk Priority (UNKNOWN first)" : "Document Order"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(true)}
                  className="px-2.5 py-1.5 text-xs font-mono font-semibold rounded-btn border border-edge-subtle bg-surface-card hover:bg-surface-elevated text-ink-secondary transition-colors"
                  title="View keyboard shortcuts cheat sheet"
                >
                  Shortcuts [?]
                </button>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div
              className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden border border-edge-subtle"
              role="progressbar"
              aria-label={`Triage review progress: ${counts.reviewed} of ${counts.total} items reviewed`}
              aria-valuenow={counts.reviewed}
              aria-valuemin={0}
              aria-valuemax={counts.total}
            >
              <div
                className="h-full bg-ink-primary transition-all duration-300"
                style={{ width: `${(counts.reviewed / (counts.total || 1)) * 100}%` }}
              />
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-edge-subtle">
              {[
                { id: "all", label: "All", count: counts.total },
                { id: "unreviewed", label: "Unreviewed", count: counts.unreviewed },
                { id: "approved", label: "Approved", count: counts.approved },
                { id: "rejected", label: "Rejected", count: counts.rejected },
                { id: "verified", label: "Verified", count: counts.verified },
                { id: "inferred_unknown", label: "Inferred / Unknown", count: counts.inferredOrUnknown },
                { id: "contradictions", label: "Contradictions", count: counts.contradictions },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setClaimFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-pill transition-colors flex items-center gap-1.5 ${
                    claimFilter === tab.id
                      ? "bg-ink-primary text-white font-bold"
                      : "bg-surface-elevated text-ink-secondary hover:text-ink-primary border border-edge-subtle font-medium"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${claimFilter === tab.id ? "bg-white/20 text-white" : "bg-surface-card text-ink-tertiary"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section Blocks */}
        {!loading && filteredClaims.length === 0 && (
          <div className="p-12 text-center bg-surface-card rounded-card border border-edge-default mb-10">
            <p className="text-sm text-ink-secondary mb-3">No claims match the filter "{claimFilter}".</p>
            <button
              type="button"
              onClick={() => setClaimFilter("all")}
              className="px-3.5 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800 transition-colors"
            >
              Reset Filters
            </button>
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
                    isFocused={visibleClaims[focusedIndex]?.id === item.id}
                    onApprove={handleApproveClaim}
                    onReject={handleRejectClaim}
                    onEdit={handleEditClaim}
                    onUndo={handleUndo}
                    onInspectEvidence={inspectEvidence}
                    onAskLead={(c) => {
                      setAskLeadTarget(c);
                      setShowAskLeadModal(true);
                    }}
                    onOpenReReview={handleOpenReReview}
                    role={role}
                  />
                ))}
              </div>
            </div>
          ))}

        {/* Recurring Operational Vulnerabilities & Incidents */}
        <div className="mb-10" data-testid="recurring-problems-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-4 border-b border-edge-default gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink-primary">
                  Recurring Operational Vulnerabilities
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-edge-strong text-ink-secondary">
                  {recurringProblems.length} detected
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Deterministic failure pattern clustering across code churn (3+ commits in 90d), reopened Jira bugs, repeated Slack incidents, and flaky tests.
              </p>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "All" },
                { id: "code_churn", label: "Code Churn" },
                { id: "reopened_bug", label: "Reopened Bugs" },
                { id: "repeated_incident", label: "Incidents" },
                { id: "flaky_test", label: "Flaky Tests" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProblemCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-pill transition-colors ${
                    problemCategoryFilter === tab.id
                      ? "bg-ink-primary text-white"
                      : "bg-surface-elevated text-ink-secondary hover:text-ink-primary border border-edge-subtle"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredProblems.length === 0 ? (
            <div className="p-8 text-center bg-surface-card rounded-card border border-edge-default">
              <p className="text-xs text-ink-tertiary">No recurring problems matching the selected filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProblems.map((problem) => (
                <div
                  key={problem.id}
                  className="p-4 rounded-card border border-edge-strong bg-surface-card shadow-sm flex flex-col justify-between"
                  data-testid={`problem-card-${problem.id}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary">
                          {problem.category.replace('_', ' ')}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            problem.provenance === "VERIFIED"
                              ? "bg-ink-primary text-white"
                              : "bg-surface-elevated border border-edge-strong text-ink-secondary"
                          }`}
                          title={problem.provenance === "VERIFIED" ? "Corroborated across 2+ source types" : "Single-source observation"}
                        >
                          {problem.provenance}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-ink-secondary font-semibold shrink-0">
                        {problem.frequency}x occurrence{problem.frequency !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-ink-primary mb-1">
                      {problem.title}
                    </h3>
                    <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
                      {problem.description}
                    </p>

                    <div className="text-[11px] font-mono text-ink-tertiary space-y-1 mb-3">
                      <div>
                        <span className="text-ink-primary font-semibold">Component:</span> {problem.component}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>First seen: {new Date(problem.first_seen).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Last seen: {new Date(problem.last_seen).toLocaleDateString()}</span>
                      </div>
                      {problem.sources_corroborated && problem.sources_corroborated.length > 0 && (
                        <div>
                          <span className="text-ink-primary font-semibold">Sources:</span>{" "}
                          {problem.sources_corroborated.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-edge-subtle space-y-2.5">
                    {problem.suggested_action && (
                      <div className="p-2.5 rounded bg-surface-elevated border border-edge-subtle text-xs">
                        <span className="font-semibold text-ink-primary block mb-0.5">
                          Suggested Action:
                        </span>
                        <p className="text-ink-secondary leading-relaxed">{problem.suggested_action}</p>
                      </div>
                    )}

                    {problem.evidence_ids && problem.evidence_ids.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-ink-tertiary">
                          {problem.evidence_ids.length} supporting artifact{problem.evidence_ids.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => inspectEvidence(problem.evidence_ids, problem.title)}
                          className="text-xs font-mono font-semibold text-ink-primary hover:underline"
                        >
                          Inspect Evidence →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Contacts ("Who to Ask" by Component) */}
        <div className="mb-10" data-testid="key-contacts-section">
          <div className="pb-2 mb-4 border-b border-edge-default">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink-primary">
                Key Contacts ("Who to Ask" by Component)
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-edge-strong text-ink-secondary">
                {componentContacts.length} components
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              Top remaining knowledge holders (strictly excluding departing staff), CODEOWNERS, frequent reviewers, and critical external parties.
            </p>
          </div>

          {componentContacts.length === 0 ? (
            <div className="p-8 text-center bg-surface-card rounded-card border border-edge-default">
              <p className="text-xs text-ink-tertiary">No component contacts resolved.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {componentContacts.map((group, gIdx) => {
                const compName = group.component_name || "Component";
                const contactsList = Array.isArray(group.contacts) ? group.contacts : [];
                return (
                  <div
                    key={group.component_name || gIdx}
                    className="p-5 rounded-card border border-edge-default bg-surface-card"
                    data-testid={`component-group-${compName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-edge-subtle">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
                          {compName}
                        </h3>
                        <span className="text-xs text-ink-tertiary font-mono">
                          ({contactsList.length} contact{contactsList.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                      {!group.has_remaining_owner && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-ink-primary text-ink-primary">
                          Orphan Component
                        </span>
                      )}
                    </div>

                  {/* CRITICAL WARNING BANNER IF NO REMAINING OWNER */}
                  {!group.has_remaining_owner && (
                    <div
                      className="mb-4 p-3 rounded bg-surface-elevated border-2 border-edge-strong text-xs flex items-start gap-2.5"
                      data-testid="no-owner-warning"
                    >
                      <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-ink-primary text-white shrink-0">
                        CRITICAL WARNING
                      </span>
                      <div className="text-ink-primary leading-relaxed font-medium">
                        {group.warning || "NO REMAINING PRIMARY OWNER — All primary knowledge holders have departed or will depart. Immediate succession handover required."}
                      </div>
                    </div>
                  )}

                  {/* Contacts grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.contacts.map((contact, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded bg-surface-elevated border border-edge-subtle text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-ink-primary truncate">
                              {contact.name}
                            </span>
                            <span className="font-mono text-ink-tertiary text-[11px] truncate">
                              ({contact.handle})
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                              contact.provenance === "VERIFIED"
                                ? "bg-ink-primary text-white"
                                : contact.provenance === "STATED"
                                ? "border border-ink-primary text-ink-primary"
                                : "bg-surface-card border border-edge-strong text-ink-secondary"
                            }`}
                          >
                            {contact.provenance}
                          </span>
                        </div>

                        <div className="text-[11px] text-ink-secondary flex items-center justify-between">
                          <span>{contact.role}</span>
                          {contact.knowledge_score !== undefined && (
                            <span className="font-mono text-ink-tertiary">
                              score: {Math.round(contact.knowledge_score * 100)}%
                            </span>
                          )}
                        </div>

                        {contact.notes && (
                          <p className="text-[11px] text-ink-tertiary italic">
                            {contact.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* First 5 Days Onboarding Plan (Prompt 9) */}
        {(continuationPlan || continuationTasks.length > 0) && (
          <div className="mb-10" data-testid="continuation-plan-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-4 border-b border-edge-default gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-ink-primary">
                    First 5 Days Continuation &amp; Verification Plan
                  </h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-edge-strong text-ink-secondary">
                    Day 1 - 5 Roadmap
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-edge-strong text-ink-primary font-semibold">
                    {continuationTasks.filter((t) => t.completed).length} / {continuationTasks.length > 0 ? continuationTasks.length : (Array.isArray(continuationPlan) ? continuationPlan.length : (continuationPlan?.first_5_days || []).length)} completed
                  </span>
                </div>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Day-by-day deterministic execution checklist with explicit evidence citations, verification tasks, and persisted progress.
                </p>
              </div>

              {/* Mini task progress bar */}
              {continuationTasks.length > 0 && (
                <div className="w-full sm:w-48">
                  <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden border border-edge-subtle">
                    <div
                      className="h-full bg-ink-primary transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (continuationTasks.filter((t) => t.completed).length / (continuationTasks.length || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border border-edge-strong rounded-card overflow-hidden bg-surface-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated border-b border-edge-strong text-ink-tertiary font-mono uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-14 text-center">Status</th>
                      <th className="py-2.5 px-3 w-16">Day</th>
                      <th className="py-2.5 px-3 w-48">Focus &amp; Owner</th>
                      <th className="py-2.5 px-3">Target Verification Tasks</th>
                      <th className="py-2.5 px-3 w-36">Evidence &amp; Citations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge-subtle">
                    {(continuationTasks.length > 0
                      ? continuationTasks
                      : Array.isArray(continuationPlan)
                      ? continuationPlan
                      : continuationPlan?.first_5_days || continuationPlan?.plan || continuationPlan?.days || []
                    ).map((step: any, idx: number) => {
                      const taskId = step.id || `task-day${step.day || idx + 1}-${idx + 1}`;
                      const evidenceList = step.evidence_ids || (Array.isArray(step.claims) ? step.claims : []);
                      return (
                        <tr key={taskId || idx} className={`transition-colors ${step.completed ? "bg-surface-elevated/40" : "hover:bg-surface-elevated/50"}`}>
                          <td className="py-3 px-3 text-center align-top">
                            <input
                              type="checkbox"
                              data-testid={`task-checkbox-${taskId}`}
                              checked={Boolean(step.completed)}
                              onChange={(e) => handleToggleTask(taskId, e.target.checked)}
                              className="h-4 w-4 rounded border-edge-strong text-ink-primary focus:ring-ink-primary cursor-pointer accent-neutral-900"
                              title="Mark task completed / pending"
                              aria-label={`Mark Day ${step.day || idx + 1} task: ${step.title || step.focus || step.task || "Verification task"} as ${step.completed ? "incomplete" : "complete"}`}
                            />
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-ink-primary align-top">
                            Day {step.day || idx + 1}
                          </td>
                          <td className="py-3 px-3 font-semibold text-ink-primary align-top">
                            <div>{step.title || step.focus || step.objective || (step.owner ? `Owner: ${step.owner}` : `Day ${step.day || idx + 1}`)}</div>
                            {step.owner && (
                              <span className="text-[11px] font-mono text-ink-tertiary block mt-0.5">
                                Owner: {step.owner}
                              </span>
                            )}
                            {step.completed && (
                              <div className="text-[10px] font-mono text-ink-secondary mt-1">
                                Completed{step.completed_at ? ` on ${new Date(step.completed_at).toLocaleDateString()}` : ""}{step.completed_by ? ` by ${step.completed_by}` : ""}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-ink-secondary leading-relaxed align-top">
                            {Array.isArray(step.tasks) ? (
                              <ul className="list-disc list-inside space-y-1">
                                {step.tasks.map((t: string, i: number) => (
                                  <li key={i}>{t}</li>
                                ))}
                              </ul>
                            ) : (
                              <span>{step.description || step.task || step.tasks}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-ink-tertiary align-top">
                            {evidenceList.length > 0 ? (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => inspectEvidence(evidenceList, step.title || step.task || `Day ${step.day} Verification`)}
                                  className="font-semibold underline text-ink-primary hover:text-ink-secondary block"
                                >
                                  Inspect Evidence ({evidenceList.length}) ↗
                                </button>
                                <span className="text-[10px] text-ink-disabled block truncate max-w-[120px]">
                                  {evidenceList.join(", ")}
                                </span>
                              </div>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Open Questions & Contradictions List (Prompt 9) */}
            <div className="mt-8 pt-4 border-t border-edge-subtle" data-testid="open-questions-section">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary font-mono">
                    Open Questions &amp; Successor Inquiries ({openQuestions.length})
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated border border-edge-subtle text-ink-tertiary">
                    Inquiry Queue
                  </span>
                </div>
                <span className="text-[11px] text-ink-tertiary hidden sm:inline">
                  Successors can click "Ask Lead" on any claim card to submit an inquiry.
                </span>
              </div>

              {openQuestions.length === 0 ? (
                <div className="p-4 rounded-card bg-surface-card border border-edge-subtle text-xs text-ink-tertiary text-center">
                  No open inquiries logged. Incoming successors can request clarification on any claim using the "Ask Lead" action.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {openQuestions.map((q: any, idx: number) => (
                    <div
                      key={q.id || idx}
                      className="p-3.5 rounded-card bg-surface-card border border-edge-strong text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary">
                            {q.status || "open"}
                          </span>
                          {q.claim_id && (
                            <span className="font-mono text-[10px] text-ink-secondary">
                              Claim [{q.claim_id}]
                            </span>
                          )}
                          <span className="font-semibold text-ink-primary">
                            {q.asked_by || "Successor"}
                          </span>
                        </div>
                        {q.created_at && (
                          <span className="font-mono text-[10px] text-ink-disabled">
                            {new Date(q.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-ink-secondary leading-relaxed font-medium">
                        "{q.question || q.text}"
                      </p>
                      {q.context && (
                        <div className="text-[10px] font-mono text-ink-tertiary">
                          Context section: {q.context}
                        </div>
                      )}
                      {q.answer && (
                        <div className="mt-2 p-2 rounded bg-surface-elevated border border-edge-subtle text-ink-primary">
                          <span className="font-mono font-bold text-[10px] uppercase block mb-0.5 text-ink-secondary">
                            Lead Response:
                          </span>
                          <p className="text-xs leading-relaxed">{q.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Version History Modal */}
        {showVersionHistory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Version History"
          >
            <div ref={versionHistoryModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden outline-none">
              <div className="flex items-center justify-between p-5 border-b border-edge-default">
                <div>
                  <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                    Handover Version History
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Immutable snapshot generated for every edit, approval, rejection, and release.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVersionHistory(false)}
                  className="p-1.5 rounded-btn hover:bg-surface-elevated text-ink-secondary hover:text-ink-primary font-mono text-xs uppercase"
                  aria-label="Close version history"
                >
                  ESC / Close
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3 divide-y divide-edge-subtle">
                {versionList.map((ver) => (
                  <div key={ver.version} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-ink-primary text-white">
                          v{ver.version}
                        </span>
                        {ver.is_released && (
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-ink-primary text-ink-primary">
                            Released
                          </span>
                        )}
                        <span className="text-xs font-semibold text-ink-primary">
                          {ver.author}
                        </span>
                        <span className="text-[11px] text-ink-tertiary">
                          • {new Date(ver.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {ver.change_summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-ink-tertiary font-mono">
                        {ver.claim_count} claims
                      </span>
                      {canReview && (
                        <button
                          type="button"
                          disabled={restoringVersion}
                          onClick={() => handleRestoreVersion(ver.version)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-surface-elevated border border-edge-strong hover:bg-surface-card text-ink-primary disabled:opacity-50"
                        >
                          Restore as Draft
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-edge-default bg-surface-elevated flex items-center justify-between">
                <Link
                  to={`/case/${caseId}/audit`}
                  className="text-xs font-mono font-medium text-ink-secondary hover:text-ink-primary underline"
                >
                  View Audit Log ↗
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowVersionHistory(false);
                    handleOpenDiff();
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:shadow-float"
                >
                  Open Side-by-Side Diff →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-Side Diff Modal */}
        {showDiffModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Side-by-Side Version Diff"
          >
            <div ref={diffModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden outline-none">
              <div className="flex items-center justify-between p-5 border-b border-edge-default">
                <div>
                  <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                    Side-by-Side Version Diff
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Compare claims and revision history between any two numbered snapshots.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiffModal(false)}
                  className="p-1.5 rounded-btn hover:bg-surface-elevated text-ink-secondary hover:text-ink-primary font-mono text-xs uppercase"
                  aria-label="Close diff view"
                >
                  ESC / Close
                </button>
              </div>

              {/* Version Selectors & Summary */}
              <div className="p-4 border-b border-edge-default bg-surface-elevated flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                      Version A:
                    </label>
                    <select
                      value={diffV1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setDiffV1(val);
                        loadDiff(val, diffV2);
                      }}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-surface-card border border-edge-strong text-ink-primary cursor-pointer focus:outline-none"
                    >
                      {versionList.map((v) => (
                        <option key={v.version} value={v.version}>
                          v{v.version} ({v.change_summary.slice(0, 30)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs font-mono text-ink-tertiary">vs</span>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                      Version B:
                    </label>
                    <select
                      value={diffV2}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setDiffV2(val);
                        loadDiff(diffV1, val);
                      }}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-surface-card border border-edge-strong text-ink-primary cursor-pointer focus:outline-none"
                    >
                      {versionList.map((v) => (
                        <option key={v.version} value={v.version}>
                          v{v.version} ({v.change_summary.slice(0, 30)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {diffData && (
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-surface-card border border-edge-strong text-ink-secondary">
                    {diffData.summary}
                  </span>
                )}
              </div>

              {/* Diff Container */}
              <div className="p-5 overflow-y-auto space-y-4">
                {loadingDiff && (
                  <div className="py-12 text-center text-xs text-ink-tertiary animate-pulse font-mono">
                    Generating side-by-side comparison...
                  </div>
                )}

                {!loadingDiff && diffData && diffData.diff.length === 0 && (
                  <div className="py-12 text-center text-xs text-ink-tertiary">
                    No claims to compare between these versions.
                  </div>
                )}

                {!loadingDiff &&
                  diffData &&
                  diffData.diff.map((entry) => (
                    <div
                      key={entry.claim_id}
                      className="p-4 rounded-card border border-edge-default bg-surface-card"
                    >
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-edge-subtle">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink-primary">
                            {entry.claim_id}
                          </span>
                          <span className="text-xs text-ink-tertiary">
                            [{entry.section}]
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            entry.change_type === "modified" || entry.change_type === "edited"
                              ? "bg-ink-primary text-white"
                              : entry.change_type === "removed" || entry.change_type === "rejected"
                              ? "border border-ink-primary text-ink-primary"
                              : entry.change_type === "added"
                              ? "bg-surface-elevated text-ink-primary border border-edge-strong"
                              : entry.change_type === "downgraded"
                              ? "border border-dashed border-edge-strong text-ink-secondary"
                              : "text-ink-tertiary"
                          }`}
                        >
                          {entry.change_type === "removed"
                            ? "Excluded on Release"
                            : entry.change_type === "modified"
                            ? "Edited"
                            : entry.change_type}
                        </span>
                      </div>

                      {/* Word Diff Token Viewer if available */}
                      {entry.word_diff && entry.word_diff.length > 0 && (
                        <div className="mb-3 p-3 rounded bg-surface-elevated border border-edge-strong">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-secondary block mb-1">
                            Word-Level Revision Diff:
                          </span>
                          <WordDiffViewer tokens={entry.word_diff} fallbackText={entry.v2?.text || ""} />
                        </div>
                      )}

                      {/* Side by side columns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 rounded bg-surface-elevated border border-edge-subtle">
                          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-edge-subtle text-[11px] font-semibold text-ink-tertiary">
                            <span>Version A (v{diffData.v1})</span>
                            <span className="font-mono uppercase">
                              Status: {entry.v1?.status || "n/a"}
                            </span>
                          </div>
                          <p className="text-ink-secondary leading-relaxed whitespace-pre-line">
                            {entry.v1?.text || "(Not present in this version)"}
                          </p>
                        </div>

                        <div className="p-3 rounded bg-surface-elevated border border-edge-subtle">
                          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-edge-subtle text-[11px] font-semibold text-ink-tertiary">
                            <span>Version B (v{diffData.v2})</span>
                            <span className="font-mono uppercase">
                              Status: {entry.v2?.status || "n/a"}
                            </span>
                          </div>
                          <p className="text-ink-primary font-medium leading-relaxed whitespace-pre-line">
                            {entry.v2?.text || "(Excluded / Not present in this version)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Diff Modal Footer */}
              <div className="p-4 border-t border-edge-default bg-surface-elevated flex items-center justify-between">
                <div>
                  {diffData?.audit_log_url ? (
                    <a
                      href={diffData.audit_log_url}
                      className="text-xs font-mono font-medium text-ink-secondary hover:text-ink-primary underline"
                    >
                      Audit Trail Endpoint ↗
                    </a>
                  ) : (
                    <Link
                      to={`/case/${caseId}/audit`}
                      className="text-xs font-mono font-medium text-ink-secondary hover:text-ink-primary underline"
                    >
                      View Audit Log ↗
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canReview && (
                    <button
                      type="button"
                      disabled={restoringVersion}
                      onClick={() => handleRestoreVersion(diffV1)}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-surface-card border border-edge-strong hover:bg-surface-elevated text-ink-primary disabled:opacity-50"
                    >
                      Restore v{diffV1} as New Draft
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDiffModal(false)}
                    className="px-4 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:shadow-float"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Batch Approve Corroborated Claims Confirmation Modal (Prompt 9) */}
        {showBatchConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Batch Approval"
          >
            <div ref={batchConfirmModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-lg w-full p-6 space-y-4 outline-none">
              <div className="flex items-center justify-between pb-3 border-b border-edge-default">
                <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                  Batch Approve Verified Claims
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBatchConfirm(false)}
                  className="font-mono text-xs text-ink-tertiary hover:text-ink-primary"
                  aria-label="Close batch confirmation"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <p className="text-ink-primary font-medium">
                  You are about to batch approve <strong className="text-ink-primary font-bold">{counts.corroboratedVerified}</strong> claims that satisfy the corroboration safety threshold:
                </p>
                <ul className="list-disc list-inside space-y-1 text-ink-secondary pl-1 font-mono text-[11px]">
                  <li>Provenance is strictly <strong>VERIFIED</strong></li>
                  <li>Backed by <strong>2 or more independent evidence sources</strong></li>
                  <li>Currently in <strong>Pending</strong> review status</li>
                </ul>

                <div className="p-3 rounded bg-surface-elevated border-2 border-edge-strong text-[11px] text-ink-primary">
                  <span className="font-mono font-bold uppercase block mb-1">
                    Strict Quality Invariant
                  </span>
                  Claims marked as <strong>INFERRED</strong> or <strong>UNKNOWN</strong> are strictly excluded from batch approvals and must be reviewed individually by an engineering lead.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-edge-subtle">
                <button
                  type="button"
                  onClick={() => setShowBatchConfirm(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-edge-strong rounded-btn text-ink-secondary hover:text-ink-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={batchApproving || counts.corroboratedVerified === 0}
                  onClick={handleBatchApprove}
                  className="px-4 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800 disabled:opacity-40 shadow-sm"
                >
                  {batchApproving ? "Approving..." : `Approve ${counts.corroboratedVerified} Verified Claims`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Release Pre-Flight Verification Dialog (Prompt 9) */}
        {showPreflightModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Release Pre-Flight Checklist"
          >
            <div ref={preflightModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden outline-none">
              <div className="flex items-center justify-between p-5 border-b border-edge-default">
                <div>
                  <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                    Handover Release Pre-Flight Verification
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Automated quality gates and authentic server-side role preview before releasing knowledge package.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreflightModal(false)}
                  className="font-mono text-xs text-ink-tertiary hover:text-ink-primary"
                  aria-label="Close preflight dialog"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                {loadingPreflight ? (
                  <div className="py-12 text-center text-xs text-ink-tertiary font-mono animate-pulse">
                    Running automated pre-flight security and completeness checks...
                  </div>
                ) : (
                  <>
                    {/* Automated Checklist Grid */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary font-mono">
                        Automated Readiness Checklist
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Check 1: Unreviewed Claims */}
                        <div className={`p-3 rounded-card border ${preflightData?.unreviewed_count === 0 ? "border-edge-default bg-surface-card" : "border-edge-strong bg-surface-elevated"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-ink-primary">1. Claim Completeness</span>
                            <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${preflightData?.unreviewed_count === 0 ? "bg-ink-primary text-white" : "border border-ink-primary text-ink-primary"}`}>
                              {preflightData?.unreviewed_count === 0 ? "PASSED" : "BLOCKED"}
                            </span>
                          </div>
                          <p className="text-ink-secondary text-[11px]">
                            {preflightData?.unreviewed_count === 0
                              ? "All claims have been reviewed (0 pending)."
                              : `${preflightData?.unreviewed_count ?? unreviewedCount} claims require review before release.`}
                          </p>
                        </div>

                        {/* Check 2: Contradictions */}
                        <div className={`p-3 rounded-card border ${(preflightData?.contradictions_count === 0 || preflightData?.contradictions_acknowledged) ? "border-edge-default bg-surface-card" : "border-edge-strong bg-surface-elevated"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-ink-primary">2. Clashing Statements</span>
                            <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${(preflightData?.contradictions_count === 0 || preflightData?.contradictions_acknowledged) ? "bg-ink-primary text-white" : "border border-ink-primary text-ink-primary"}`}>
                              {preflightData?.contradictions_count === 0 ? "CLEAN" : preflightData?.contradictions_acknowledged ? "ACKNOWLEDGED" : "ACTION REQ"}
                            </span>
                          </div>
                          <p className="text-ink-secondary text-[11px] mb-2">
                            {preflightData?.contradictions_count === 0
                              ? "No ungrounded contradictions detected."
                              : `${preflightData?.contradictions_count} contradictory claim(s) detected.`}
                          </p>
                          {preflightData?.contradictions_count > 0 && !preflightData?.contradictions_acknowledged && (
                            <button
                              type="button"
                              onClick={handleAcknowledgeContradictions}
                              className="w-full py-1 text-[11px] font-semibold bg-surface-elevated border border-edge-strong text-ink-primary rounded hover:bg-surface-card"
                            >
                              Acknowledge &amp; Keep as Open Questions
                            </button>
                          )}
                        </div>

                        {/* Check 3: Secrets Scan */}
                        <div className="p-3 rounded-card border border-edge-default bg-surface-card">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-ink-primary">3. Secrets &amp; PII Scan</span>
                            <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-ink-primary text-white">
                              {preflightData?.secrets_detected_count === 0 ? "0 SECRETS" : "ALERT"}
                            </span>
                          </div>
                          <p className="text-ink-secondary text-[11px]">
                            {preflightData?.secrets_detected_count === 0
                              ? "Automated scanner found 0 unredacted secrets or private tokens."
                              : `${preflightData?.secrets_detected_count} unredacted secret(s) detected.`}
                          </p>
                        </div>

                        {/* Check 4: Quarantine Queue */}
                        <div className="p-3 rounded-card border border-edge-default bg-surface-card">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-ink-primary">4. Quarantine Queue</span>
                            <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-ink-primary text-white">
                              {preflightData?.quarantine_pending_count === 0 ? "EMPTY (0)" : "BLOCKED"}
                            </span>
                          </div>
                          <p className="text-ink-secondary text-[11px]">
                            {preflightData?.quarantine_pending_count === 0
                              ? "Quarantine queue is clear; 0 pending ingestion items."
                              : `${preflightData?.quarantine_pending_count} pending quarantined items.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Live Role Preview Section (Prompt 9 Invariant: Calls authentic server endpoint) */}
                    <div className="space-y-3 pt-4 border-t border-edge-subtle">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary font-mono">
                            Live Role-Filtered Preview
                          </h3>
                          <p className="text-[11px] text-ink-tertiary">
                            Preview the exact sanitized view returned by the backend role-filtering engine (never client filtered).
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {(["lead", "successor", "contractor"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleRolePreview(r)}
                              className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors ${
                                previewRole === r
                                  ? "bg-ink-primary text-white"
                                  : "bg-surface-elevated text-ink-secondary hover:text-ink-primary border border-edge-subtle"
                              }`}
                            >
                              {r === "lead" ? "Lead View" : r === "successor" ? "Successor" : "Contractor (Restricted)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {loadingPreview ? (
                        <div className="py-6 text-center text-xs text-ink-tertiary font-mono animate-pulse">
                          Fetching authentic preview for role: {previewRole}...
                        </div>
                      ) : previewRole !== "lead" && previewItems ? (
                        <div className="p-3 bg-surface-elevated rounded border border-edge-strong space-y-2 max-h-60 overflow-y-auto">
                          <div className="text-[11px] font-mono font-semibold text-ink-secondary pb-1 border-b border-edge-subtle">
                            Showing {previewItems.length} claims as seen by role: <span className="uppercase text-ink-primary font-bold">{previewRole}</span>
                          </div>
                          {previewItems.map((pi: any) => (
                            <div key={pi.id} className="p-2 rounded bg-surface-card border border-edge-subtle text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-ink-tertiary">{pi.id}</span>
                                {pi.withheld ? (
                                  <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-ink-primary text-white">
                                    [WITHHELD]
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] uppercase text-ink-secondary">
                                    {pi.provenance}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] ${pi.withheld ? "font-mono text-ink-secondary italic" : "text-ink-primary"}`}>
                                {pi.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 border-t border-edge-default bg-surface-elevated flex items-center justify-between">
                <div className="text-xs">
                  {preflightData?.can_release ? (
                    <span className="font-semibold text-ink-primary">
                      ✓ All pre-flight safety gates passed. Ready for immutable release.
                    </span>
                  ) : (
                    <span className="text-ink-secondary">
                      Release blocked: {preflightData?.blockers?.join("; ") || `${unreviewedCount} unreviewed claims`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreflightModal(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold border border-edge-strong rounded-btn text-ink-secondary hover:text-ink-primary"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={acting || !preflightData?.can_release}
                    onClick={handleRelease}
                    className="px-4 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800 disabled:opacity-40 shadow-sm"
                  >
                    {acting ? "Releasing..." : "Release to Successor (Immutable)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ask Lead Modal (Prompt 9) */}
        {showAskLeadModal && askLeadTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Ask the Lead"
          >
            <div ref={askLeadModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-lg w-full p-6 space-y-4 outline-none">
              <div className="flex items-center justify-between pb-3 border-b border-edge-default">
                <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                  Ask Engineering Lead for Clarification
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAskLeadModal(false)}
                  className="font-mono text-xs text-ink-tertiary hover:text-ink-primary"
                  aria-label="Close ask lead modal"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded bg-surface-elevated border border-edge-subtle space-y-1">
                  <span className="font-mono text-[10px] text-ink-tertiary uppercase block">
                    Target Claim [{askLeadTarget.id}] • {askLeadTarget.section}
                  </span>
                  <p className="text-ink-primary font-medium leading-relaxed">
                    "{askLeadTarget.text}"
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-ink-primary mb-1">
                    Your Question / Inquiry for the Lead:
                  </label>
                  <textarea
                    rows={4}
                    value={askLeadQuestion}
                    onChange={(e) => setAskLeadQuestion(e.target.value)}
                    placeholder="e.g. Can you clarify how the exponential backoff handles dead-letter queue retries on network partitions?"
                    className="w-full text-xs p-3 rounded-input border border-edge-strong bg-surface-card text-ink-primary focus:outline-none focus:ring-2 focus:ring-ink-primary leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge-subtle">
                <button
                  type="button"
                  onClick={() => setShowAskLeadModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-edge-strong rounded-btn text-ink-secondary hover:text-ink-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={askingLead || !askLeadQuestion.trim()}
                  onClick={handleSubmitAskLead}
                  className="px-4 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800 disabled:opacity-40 shadow-sm"
                >
                  {askingLead ? "Submitting..." : "Send Inquiry"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Cheat Sheet Modal (Prompt 9) */}
        {showShortcutsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard Shortcuts Cheat Sheet"
          >
            <div ref={shortcutsModalRef} tabIndex={-1} className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-md w-full p-6 space-y-4 outline-none">
              <div className="flex items-center justify-between pb-3 border-b border-edge-default">
                <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                  Review Keyboard Shortcuts
                </h2>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="font-mono text-xs text-ink-tertiary hover:text-ink-primary"
                  aria-label="Close shortcuts modal"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs divide-y divide-edge-subtle font-mono">
                {[
                  { key: "J / ↓", desc: "Move focus to next claim card" },
                  { key: "K / ↑", desc: "Move focus to previous claim card" },
                  { key: "A", desc: "Approve currently focused claim (Lead only)" },
                  { key: "R", desc: "Reject currently focused claim with rationale (Lead only)" },
                  { key: "E", desc: "Edit currently focused claim text (Lead only)" },
                  { key: "U / Z", desc: "Undo most recent review action (Lead only)" },
                  { key: "?", desc: "Toggle this keyboard shortcuts cheat sheet" },
                  { key: "Esc", desc: "Close any active modal dialog" },
                ].map((item, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-4">
                    <kbd className="px-2 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary font-bold text-[11px] shadow-sm">
                      {item.key}
                    </kbd>
                    <span className="text-ink-secondary text-right font-sans text-xs">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-edge-subtle flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:bg-neutral-800"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prompt 12: Re-Review Queue Modal for Lead */}
        {showReReviewModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="Re-Review Queue"
          >
            <div
              ref={reReviewModalRef}
              tabIndex={-1}
              className="bg-surface-card border-2 border-edge-strong rounded-card shadow-float max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 outline-none text-ink-primary"
            >
              <div className="flex items-center justify-between pb-3 border-b border-edge-default">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-white dark:bg-amber-600 uppercase tracking-wider">
                    Re-Review Queue
                  </span>
                  <h2 className="text-base font-bold text-ink-primary uppercase tracking-wider">
                    Evidence Drift Review ({reReviewQueue.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReReviewModal(false)}
                  className="font-mono text-xs text-ink-tertiary hover:text-ink-primary"
                  aria-label="Close re-review queue dialog"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed">
                Post-release ingestion received events modifying evidence cited by approved claims.
                The system <strong>never auto-edits approved text</strong>; version numbers bump only upon explicit lead action.
              </p>

              {loadingReReview ? (
                <div className="p-8 text-center text-xs text-ink-secondary border border-edge-subtle rounded-btn">
                  Loading re-review queue items...
                </div>
              ) : reReviewQueue.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-tertiary border border-edge-subtle rounded-btn">
                  All claims are up to date with underlying repository evidence.
                </div>
              ) : (
                <div className="space-y-6">
                  {reReviewQueue.map((item) => (
                    <div key={item.id} className="p-4 rounded-btn border border-edge-strong bg-surface-elevated space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-ink-primary">
                            Claim {item.claim_id}
                          </span>
                          <span className="text-[11px] text-ink-tertiary">
                            Section: {item.section}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase">
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs text-ink-primary font-medium">
                        {item.drift_summary}
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold text-ink-secondary mb-1">
                          Evidence Diff:
                        </span>
                        <div className="p-2.5 rounded bg-surface-card border border-edge-subtle font-mono text-[11px] text-ink-secondary whitespace-pre-wrap">
                          {item.diff}
                        </div>
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold text-ink-secondary mb-1">
                          Original Approved Claim Text (Preserved):
                        </span>
                        <div className="p-2.5 rounded bg-surface-card border border-edge-subtle text-xs text-ink-primary whitespace-pre-wrap">
                          {item.claim_text}
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`edit-text-${item.id}`} className="block text-[11px] font-semibold text-ink-primary mb-1">
                          Amended Claim Text (reflecting post-release reality):
                        </label>
                        <textarea
                          id={`edit-text-${item.id}`}
                          value={editedClaimText || item.suggested_update || item.claim_text}
                          onChange={(e) => setEditedClaimText(e.target.value)}
                          rows={3}
                          className="w-full text-xs p-2.5 rounded-input border border-edge-strong bg-surface-card text-ink-primary focus:outline-none focus:ring-2 focus:ring-ink-primary"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-edge-subtle">
                        <button
                          type="button"
                          disabled={resolvingDrift}
                          onClick={() => handleResolveReReview(item.claim_id, "dismiss")}
                          className="px-3 py-1.5 text-xs border border-edge-strong text-ink-tertiary hover:text-ink-primary rounded-btn disabled:opacity-40"
                        >
                          Dismiss Drift
                        </button>
                        <button
                          type="button"
                          disabled={resolvingDrift}
                          onClick={() => handleResolveReReview(item.claim_id, "acknowledge")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card text-ink-primary hover:bg-surface-subtle disabled:opacity-40"
                          title="Acknowledge drift without editing claim text, bumps version"
                        >
                          Acknowledge &amp; Bump
                        </button>
                        <button
                          type="button"
                          disabled={resolvingDrift}
                          onClick={() => handleResolveReReview(item.claim_id, "amend")}
                          className="px-4 py-1.5 text-xs font-bold rounded-btn bg-ink-primary text-white hover:opacity-90 disabled:opacity-40 shadow-subtle"
                          title="Apply amended text and bump handover version"
                        >
                          {resolvingDrift ? "Amending..." : `Amend & Bump to v${(releasedVersion || currentVersion) + 1}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 mb-4 p-3 border border-edge-subtle bg-surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-ink-secondary">
          <span>
            Operating under strict evidence invariants. Grounding is computed deterministically with offline fail-safe boundaries.
          </span>
          <Link
            to={`/case/${caseId || "case-001"}/limits`}
            className="font-mono font-medium text-ink-primary hover:underline shrink-0"
          >
            Inspect System Limits &rarr;
          </Link>
        </div>

        <NextStepFooter
          nextLabel="Test Successor Completeness & Simulate Knowledge Loss"
          nextUrl={`/cases/${caseId || "shopledger-priya"}/completeness`}
          currentStep={4}
          totalSteps={5}
        />
    </PageContainer>
  );
}
