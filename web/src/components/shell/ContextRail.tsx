import { Link } from "react-router-dom";
import { RelayRole } from "../../api";

interface ContextRailProps {
  caseId?: string;
  role: RelayRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ContextRail({
  caseId = "case-001",
  role,
  isCollapsed,
  onToggleCollapse,
}: ContextRailProps) {
  // If rail is collapsed, render minimal expand toggle tab
  if (isCollapsed) {
    return (
      <aside
        className="hidden xl:flex fixed right-0 top-[56px] bottom-0 z-20 w-8 flex-col items-center py-4 border-l border-edge-default bg-surface-card"
        aria-label="Context rail toggle"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors text-xs font-mono"
          title="Expand context rail"
          aria-label="Expand context rail"
        >
          ◀
        </button>
      </aside>
    );
  }

  // Real mock case audit trail events
  const auditEvents = [
    { id: "ev-1", time: "10:14 UTC", text: "Commit e9f4a1 pushed to main", actor: "Priya Nair", type: "git" },
    { id: "ev-2", time: "09:30 UTC", text: "PR #47 reviewed with 2 comments", actor: "Alex Chen", type: "pr" },
    { id: "ev-3", time: "Yesterday", text: "SL-456 assigned to Priya Nair", actor: "Jira Sync", type: "jira" },
    { id: "ev-4", time: "2d ago", text: "Handover draft v2.4 generated", actor: "RELAY Engine", type: "ai" },
    { id: "ev-5", time: "3d ago", text: "Architecture runbook indexed", actor: "Google Drive", type: "doc" },
  ];

  const isContractor = role === "contractor";

  return (
    <aside
      className="hidden xl:flex fixed right-0 top-[56px] bottom-0 z-20 w-[320px] flex-col border-l border-edge-default bg-surface-card overflow-y-auto"
      aria-label="Context and next actions rail"
    >
      {/* Rail Header */}
      <div className="p-4 border-b border-edge-default flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-secondary font-bold block">
            Context Rail
          </span>
          <h2 className="text-xs font-bold text-ink-primary mt-0.5">
            Active Handover State
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors text-xs font-mono"
          title="Collapse context rail"
          aria-label="Collapse context rail"
        >
          ▶
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Section 1: Best Next Action */}
        <div className="p-3.5 rounded-card border border-edge-strong bg-surface-elevated space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary font-bold block">
            Recommended Action
          </span>
          <p className="text-xs font-semibold text-ink-primary leading-tight">
            {isContractor
              ? "Review public architectural documentation."
              : "Resume pending claim verification for Payment Processor."}
          </p>
          <Link
            to={isContractor ? `/case/${caseId}/assets` : `/case/${caseId}/handover`}
            className="block w-full text-center py-2 px-3 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm"
          >
            {isContractor ? "Browse Public Assets →" : "Resume Review (8 Pending) →"}
          </Link>
        </div>

        {/* Section 2: Review Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-primary">Claim Review Progress</span>
            <span className="font-mono text-ink-secondary">12 of 20 (60%)</span>
          </div>
          <div className="h-2 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
            <div className="h-full bg-ink-primary rounded-pill" style={{ width: "60%" }} />
          </div>
          <p className="text-[11px] text-ink-secondary">
            12 verified by Lead · 8 awaiting successor approval
          </p>
        </div>

        {/* Section 3: Items Needing Attention */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary font-bold block">
            Needs Attention
          </span>
          <div className="space-y-1.5 text-xs font-sans">
            <Link
              to={`/case/${caseId}/findings`}
              className="flex items-center justify-between p-2 rounded-btn border border-edge-default hover:bg-surface-elevated transition-colors"
            >
              <span className="text-ink-primary font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-primary" />
                <span>2 Unresolved Conflicts</span>
              </span>
              <span className="text-[11px] font-mono text-ink-secondary">Open →</span>
            </Link>

            <Link
              to={`/case/${caseId}/interview`}
              className="flex items-center justify-between p-2 rounded-btn border border-edge-default hover:bg-surface-elevated transition-colors"
            >
              <span className="text-ink-primary font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-primary" />
                <span>2 Open Interview Questions</span>
              </span>
              <span className="text-[11px] font-mono text-ink-secondary">Open →</span>
            </Link>

            <Link
              to={`/case/${caseId}/busfactor`}
              className="flex items-center justify-between p-2 rounded-btn border border-edge-default hover:bg-surface-elevated transition-colors"
            >
              <span className="text-ink-primary font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-primary" />
                <span>1 Single-Maintainer Subsystem</span>
              </span>
              <span className="text-[11px] font-mono text-ink-secondary">Open →</span>
            </Link>
          </div>
        </div>

        {/* Section 4: Role Visibility Transparency */}
        <div className="p-3 rounded-card border border-edge-default bg-surface-elevated text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase text-ink-secondary">
              Role Visibility
            </span>
            <span className="font-mono text-[10px] text-ink-primary font-bold">
              {role.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary leading-relaxed">
            {isContractor
              ? "1 public source visible. 4 internal sources and 2 critical fact keys are withheld."
              : "Full visibility. All 5 connected sources, audit logs, and internal credentials accessible."}
          </p>
        </div>

        {/* Section 5: Compact Audit Trail */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary font-bold block">
            Recent Audit Trail
          </span>
          <div className="space-y-2">
            {auditEvents.map((evt) => (
              <div key={evt.id} className="text-xs border-l-2 border-edge-strong pl-2.5 py-0.5 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary">
                  <span>{evt.actor}</span>
                  <span>{evt.time}</span>
                </div>
                <p className="text-ink-primary font-medium leading-snug">
                  {evt.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

