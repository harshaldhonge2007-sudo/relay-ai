import React from "react";
import { Link, useLocation } from "react-router-dom";

export type StepCompletion = "empty" | "half" | "full";

export interface NavGroup {
  id: string;
  stepNumber?: number;
  label: string;
  completion: StepCompletion;
  items: Array<{
    id: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    count?: number | string;
  }>;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  caseId?: string;
  caseName?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sidebarTheme?: "light" | "dark";
  theme?: "light" | "dark";
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

// 16px consistent line icons (1.5px stroke)
export const Icons = {
  Home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 6.5L8 2L13.5 6.5V13.5H2.5V6.5Z" />
      <path d="M6 13.5V9H10V13.5" />
    </svg>
  ),
  Connect: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 6L13.5 2.5M10.5 8.5L14 5M6 10L2.5 13.5M5.5 7.5L2 11" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </svg>
  ),
  Timeline: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8L10.5 10.5" />
    </svg>
  ),
  Radar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2V8L12.5 8" />
    </svg>
  ),
  Risk: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" />
      <path d="M8 6V9" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  Decisions: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2.5H13V13.5H3V2.5Z" />
      <path d="M5.5 6H10.5M5.5 9H9.5M5.5 12H8" />
    </svg>
  ),
  Intelligence: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5V14.5M1.5 8H14.5" />
      <circle cx="8" cy="8" r="2" />
      <circle cx="8" cy="8" r="5.5" strokeDasharray="2 2" />
    </svg>
  ),
  Findings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
      <path d="M7 5V7.5L8.5 8.5" />
    </svg>
  ),
  Uncertainty: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M6.5 6C6.5 5 7 4.5 8 4.5C9 4.5 9.5 5 9.5 6C9.5 7 8 7.5 8 9" />
      <circle cx="8" cy="11" r="0.5" fill="currentColor" />
    </svg>
  ),
  Interview: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V10.5C14 11.33 13.33 12 12.5 12H4.5L2 14.5V3.5Z" />
      <circle cx="5.5" cy="7" r="0.8" fill="currentColor" />
      <circle cx="8" cy="7" r="0.8" fill="currentColor" />
      <circle cx="10.5" cy="7" r="0.8" fill="currentColor" />
    </svg>
  ),
  Validation: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 13.5H13.5" />
      <path d="M4 10.5V13.5M7 7.5V13.5M10 4.5V13.5M13 2V13.5" />
    </svg>
  ),
  Limits: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M5 8H11" />
    </svg>
  ),
  Review: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 2.5H10.5L13.5 5.5V13.5H3.5V2.5Z" />
      <path d="M6 8L7.5 9.5L10.5 6.5" />
    </svg>
  ),
  Completeness: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8L7 10L11 6" />
    </svg>
  ),
  Admin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5V3.5M8 12.5V14.5M1.5 8H3.5M12.5 8H14.5M3.4 3.4L4.8 4.8M11.2 11.2L12.6 12.6M3.4 12.6L4.8 11.2M11.2 4.8L12.6 3.4" />
    </svg>
  ),
  Collapse: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3L5 8L10 13" />
    </svg>
  ),
  Expand: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3L11 8L6 13" />
    </svg>
  ),
};

// Completion Indicator Ring (Pure Monochrome)
function StepRing({ state }: { state: StepCompletion }) {
  if (state === "full") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-ink-primary shrink-0">
        <circle cx="6" cy="6" r="4.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
        <path d="M4 6L5.5 7.5L8 4.5" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  if (state === "half") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-ink-primary shrink-0">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 1.5 A 4.5 4.5 0 0 1 6 10.5 Z" fill="currentColor" />
      </svg>
    );
  }
  // empty ring
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="text-edge-strong shrink-0">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Sidebar({
  open,
  onClose,
  caseId = "case-001",
  caseName = "ShopLedger",
  isCollapsed,
  onToggleCollapse,
  sidebarTheme,
  theme,
  onToggleTheme,
  onOpenShortcuts,
}: SidebarProps) {
  const location = useLocation();

  // Workflow Groups matching specification
  const groups: NavGroup[] = [
    {
      id: "home",
      label: "Overview",
      completion: "full",
      items: [
        {
          id: "case-home",
          label: "Case Home",
          path: `/case/${caseId}`,
          icon: Icons.Home,
        },
      ],
    },
    {
      id: "connect",
      stepNumber: 1,
      label: "Connect",
      completion: "full",
      items: [
        {
          id: "assets",
          label: "Sources & Import",
          path: `/case/${caseId}/assets`,
          icon: Icons.Connect,
          count: 5,
        },
        {
          id: "admin-sources",
          label: "Admin Sources",
          path: `/case/${caseId}/admin`,
          icon: Icons.Admin,
        },
      ],
    },
    {
      id: "reconstruct",
      stepNumber: 2,
      label: "Reconstruct",
      completion: "full",
      items: [
        {
          id: "timeline",
          label: "Work Timeline",
          path: `/case/${caseId}/timeline`,
          icon: Icons.Timeline,
        },
        {
          id: "knowledge",
          label: "Knowledge Radar",
          path: `/case/${caseId}/knowledge`,
          icon: Icons.Radar,
        },
        {
          id: "busfactor",
          label: "Bus-Factor Risk",
          path: `/case/${caseId}/busfactor`,
          icon: Icons.Risk,
          count: "2 Alert",
        },
        {
          id: "decisions",
          label: "Decisions & Actions",
          path: `/case/${caseId}/decisions`,
          icon: Icons.Decisions,
          count: 3,
        },
        {
          id: "intelligence",
          label: "Project Intelligence",
          path: `/case/${caseId}/intelligence`,
          icon: Icons.Intelligence,
        },
      ],
    },
    {
      id: "verify",
      stepNumber: 3,
      label: "Verify",
      completion: "half",
      items: [
        {
          id: "findings",
          label: "Findings & Conflicts",
          path: `/case/${caseId}/findings`,
          icon: Icons.Findings,
          count: 2,
        },
        {
          id: "uncertainty",
          label: "Uncertainty & Gaps",
          path: `/case/${caseId}/uncertainty`,
          icon: Icons.Uncertainty,
        },
        {
          id: "interview",
          label: "Interview Checklist",
          path: `/case/${caseId}/interview`,
          icon: Icons.Interview,
          count: 2,
        },
        {
          id: "validation",
          label: "Model Validation",
          path: `/case/${caseId}/validation`,
          icon: Icons.Validation,
        },
        {
          id: "limits",
          label: "Limits & Boundaries",
          path: `/case/${caseId}/limits`,
          icon: Icons.Limits,
        },
      ],
    },
    {
      id: "review",
      stepNumber: 4,
      label: "Review",
      completion: "half",
      items: [
        {
          id: "handover",
          label: "Handover Doc",
          path: `/case/${caseId}/handover`,
          icon: Icons.Review,
          count: "8 Pending",
        },
      ],
    },
    {
      id: "handover-step",
      stepNumber: 5,
      label: "Handover",
      completion: "empty",
      items: [
        {
          id: "completeness",
          label: "Completeness Test",
          path: `/case/${caseId}/completeness`,
          icon: Icons.Completeness,
          count: "71%",
        },
      ],
    },
  ];

  const sidebarWidthClass = isCollapsed ? "w-[64px]" : "w-[260px]";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`
          fixed top-[56px] left-0 bottom-0 z-40
          ${sidebarWidthClass}
          flex flex-col
          bg-[var(--sidebar-surface)] border-r border-[var(--sidebar-border)]
          transition-all duration-200 ease-in-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          color: "var(--sidebar-ink)",
        }}
        aria-label="Application navigation"
      >
        {/* Brand & Case Header (in expanded view) */}
        {!isCollapsed ? (
          <div className="p-4 border-b border-[var(--sidebar-border)] space-y-3 shrink-0">
            {/* Brand Header */}
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2 group">
                <span className="font-display font-bold text-base tracking-tight text-[var(--sidebar-ink)]">
                  RELAY
                </span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-pill border border-edge-strong text-[var(--sidebar-ink)] bg-[var(--sidebar-active-bg)]">
                  AI
                </span>
              </Link>

              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1 rounded-btn hover:bg-[var(--sidebar-active-bg)] text-ink-secondary hover:text-ink-primary transition-colors"
                title="Collapse sidebar to icon rail"
                aria-label="Collapse sidebar"
              >
                {Icons.Collapse}
              </button>
            </div>

            {/* Case Switcher Card */}
            <Link
              to="/cases"
              className="block p-2 rounded-card border border-edge-default bg-[var(--sidebar-active-bg)] hover:border-edge-strong transition-all shadow-card group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-secondary">
                  Active Case
                </span>
                <span className="text-xs text-ink-secondary group-hover:text-ink-primary transition-colors">
                  ▾
                </span>
              </div>
              <p className="text-xs font-semibold text-ink-primary truncate mt-0.5">
                {caseName}, Priya Nair departure
              </p>
              <p className="text-[10px] font-mono text-ink-secondary flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-primary inline-block" />
                <span>Review in progress</span>
              </p>
            </Link>
          </div>
        ) : (
          /* Collapsed Brand Icon */
          <div className="p-3 border-b border-[var(--sidebar-border)] flex flex-col items-center gap-2 shrink-0">
            <Link to="/" className="font-display font-bold text-sm" title="RELAY AI">
              R
            </Link>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-btn hover:bg-[var(--sidebar-active-bg)] text-ink-secondary hover:text-ink-primary transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {Icons.Expand}
            </button>
          </div>
        )}

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {groups.map((grp) => {
            return (
              <div key={grp.id} className="space-y-1">
                {/* Group Header */}
                {!isCollapsed && (
                  <div className="px-2 py-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-secondary font-bold select-none">
                    <span className="flex items-center gap-1.5">
                      {grp.stepNumber && <span>{grp.stepNumber}.</span>}
                      <span>{grp.label}</span>
                    </span>
                    <StepRing state={grp.completion} />
                  </div>
                )}

                {/* Group Nav Items */}
                <div className="space-y-0.5">
                  {grp.items.map((item) => {
                    const isExactHome = item.path === `/case/${caseId}` && location.pathname === `/case/${caseId}`;
                    const isChildMatch = item.path !== `/case/${caseId}` && location.pathname.startsWith(item.path);
                    const isActive = isExactHome || isChildMatch;

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onClose}
                        title={isCollapsed ? item.label : undefined}
                        className={`
                          group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-btn text-xs font-medium transition-all duration-150
                          ${
                            isActive
                              ? "bg-[var(--sidebar-active-bg)] text-ink-primary font-semibold border border-[var(--sidebar-active-border)] shadow-sm"
                              : "text-ink-secondary hover:text-ink-primary hover:bg-[var(--sidebar-active-bg)]/60"
                          }
                          ${isCollapsed ? "justify-center px-0 py-2" : ""}
                        `}
                      >
                        {/* 2px ink bar on active */}
                        {isActive && !isCollapsed && (
                          <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-ink-primary rounded-full" />
                        )}

                        <span className="shrink-0 text-ink-secondary group-hover:text-ink-primary">
                          {item.icon}
                        </span>

                        {!isCollapsed && (
                          <>
                            <span className="truncate flex-1">{item.label}</span>
                            {item.count !== undefined && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-pill border border-edge-strong text-ink-secondary bg-[var(--sidebar-surface)]">
                                {item.count}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] space-y-2 shrink-0">
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex items-center gap-1 hover:text-ink-primary transition-colors"
                  aria-label="Toggle color theme"
                >
                  <span>{(theme || sidebarTheme) === "light" ? "◐ Dark Mode" : "○ Light Mode"}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  className="font-mono hover:text-ink-primary transition-colors text-[10px] px-1.5 py-0.5 rounded border border-edge-strong bg-[var(--sidebar-active-bg)]"
                  title="Keyboard shortcuts (?)"
                >
                  ⌘K
                </button>
              </div>

              {/* High-Contrast Disclosure Chip */}
              <div className="px-2.5 py-1.5 rounded-btn border border-edge-strong bg-[var(--sidebar-active-bg)] text-[10px] font-mono text-ink-secondary leading-tight">
                <span className="font-semibold block text-ink-primary">DEMO AUTHENTICATION</span>
                <span>Synthetic dataset · APIs simulated</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1 rounded hover:bg-[var(--sidebar-active-bg)] text-xs"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {(theme || sidebarTheme) === "light" ? "◐" : "○"}
              </button>
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="p-1 rounded hover:bg-[var(--sidebar-active-bg)] font-mono text-[10px]"
                title="Shortcuts"
              >
                ?
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
