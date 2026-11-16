import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { RelayRole, apiFetch } from "../../api";

interface TopBarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  role: RelayRole;
  onRoleChange: (r: RelayRole) => void;
  caseName?: string;
  caseId?: string;
  onOpenCommandPalette: () => void;
  sidebarTheme?: "light" | "dark";
  onToggleSidebarTheme?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  onOpenShortcuts: () => void;
  isTourOpen?: boolean;
  onToggleTour?: () => void;
}

// Map pathname to breadcrumb parts
function getBreadcrumbs(pathname: string, caseName = "ShopLedger") {
  if (pathname === "/" || pathname === "/cases") {
    return [{ label: "Cases", path: "/cases" }];
  }

  const parts = [{ label: caseName, path: `/case/case-001` }];

  if (pathname.includes("/assets") || pathname.includes("/admin")) {
    parts.push({ label: "1 Connect", path: `/case/case-001/assets` });
    if (pathname.includes("/assets")) parts.push({ label: "Sources & Import", path: pathname });
    if (pathname.includes("/admin")) parts.push({ label: "Admin", path: pathname });
  } else if (
    pathname.includes("/timeline") ||
    pathname.includes("/knowledge") ||
    pathname.includes("/busfactor") ||
    pathname.includes("/decisions") ||
    pathname.includes("/intelligence")
  ) {
    parts.push({ label: "2 Reconstruct", path: `/case/case-001/busfactor` });
    if (pathname.includes("/timeline")) parts.push({ label: "Work Timeline", path: pathname });
    if (pathname.includes("/knowledge")) parts.push({ label: "Knowledge Radar", path: pathname });
    if (pathname.includes("/busfactor")) parts.push({ label: "Bus-Factor Risk", path: pathname });
    if (pathname.includes("/decisions")) parts.push({ label: "Decisions & Actions", path: pathname });
    if (pathname.includes("/intelligence")) parts.push({ label: "Project Intelligence", path: pathname });
  } else if (
    pathname.includes("/findings") ||
    pathname.includes("/uncertainty") ||
    pathname.includes("/interview") ||
    pathname.includes("/validation")
  ) {
    parts.push({ label: "3 Verify", path: `/case/case-001/findings` });
    if (pathname.includes("/findings")) parts.push({ label: "Findings & Conflicts", path: pathname });
    if (pathname.includes("/uncertainty")) parts.push({ label: "Uncertainty & Gaps", path: pathname });
    if (pathname.includes("/interview")) parts.push({ label: "Interview", path: pathname });
    if (pathname.includes("/validation")) parts.push({ label: "Model Validation", path: pathname });
  } else if (pathname.includes("/handover")) {
    parts.push({ label: "4 Review", path: `/case/case-001/handover` });
    parts.push({ label: "Handover Doc", path: pathname });
  } else if (pathname.includes("/completeness")) {
    parts.push({ label: "5 Handover", path: `/case/case-001/completeness` });
    parts.push({ label: "Completeness Test", path: pathname });
  } else {
    parts.push({ label: "Overview", path: pathname });
  }

  return parts;
}

export function TopBar({
  onToggleSidebar,
  isSidebarOpen,
  role,
  onRoleChange,
  caseName = "ShopLedger",
  onOpenCommandPalette,
  sidebarTheme,
  onToggleSidebarTheme,
  theme = sidebarTheme || "light",
  onToggleTheme = onToggleSidebarTheme,
  onOpenShortcuts,
  isTourOpen = false,
  onToggleTour,
}: TopBarProps) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const breadcrumbs = getBreadcrumbs(location.pathname, caseName);

  const handleResetSandbox = async () => {
    setResetting(true);
    try {
      await apiFetch("/demo/reset-sandbox", { method: "POST" });
      setResetMsg("Reset OK");
      setTimeout(() => {
        setResetMsg(null);
        window.location.reload();
      }, 600);
    } catch {
      setResetMsg("Error");
      setTimeout(() => setResetMsg(null), 1200);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-30 h-[56px]
        flex items-center justify-between px-4 lg:px-6
        border-b border-edge-default
        transition-all duration-200
        ${scrolled ? "bg-surface-card/90 backdrop-blur-md shadow-card" : "bg-surface-card"}
      `}
    >
      {/* Left: Mobile Menu Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 -ml-1 rounded-btn text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
          aria-label={isSidebarOpen ? "Close navigation" : "Open navigation"}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            {isSidebarOpen ? (
              <path d="M4 4L16 16M16 4L4 16" />
            ) : (
              <path d="M3 5H17M3 10H17M3 15H17" />
            )}
          </svg>
        </button>

        {/* Breadcrumb Trail */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
          <Link to="/" className="font-display font-bold text-ink-primary hover:opacity-80 transition-opacity mr-1">
            RELAY AI
          </Link>
          <span className="text-edge-strong">/</span>

          {breadcrumbs.map((b, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <span key={idx} className="flex items-center gap-1.5">
                {isLast ? (
                  <span className="text-ink-primary font-bold truncate max-w-[200px]" aria-current="page">
                    {b.label}
                  </span>
                ) : (
                  <>
                    <Link
                      to={b.path}
                      className="text-ink-secondary hover:text-ink-primary transition-colors truncate max-w-[140px]"
                    >
                      {b.label}
                    </Link>
                    <span className="text-edge-strong">/</span>
                  </>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-sm mx-4 hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-ink-secondary bg-surface-elevated hover:bg-neutral-200/60 border border-edge-default rounded-btn transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-ink-primary"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span>Search or jump to...</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-edge-strong bg-surface-card text-ink-primary font-semibold">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Role Switcher & Theme & Shortcuts */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Role Switcher with "Demo authentication" unclipped */}
        <div className="relative flex flex-col items-end">
          <div className="flex items-center gap-1.5 bg-surface-elevated border border-edge-strong rounded-btn px-2.5 py-1 shadow-sm">
            <label htmlFor="topbar-role" className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary select-none">
              Viewing as:
            </label>
            <select
              id="topbar-role"
              aria-label="Demo authentication role switcher"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as RelayRole)}
              className="bg-transparent text-xs font-semibold text-ink-primary focus:outline-none cursor-pointer pr-1"
            >
              <option value="engineering_lead">Lead (Full Access)</option>
              <option value="successor">Successor (Jordan Taylor)</option>
              <option value="contractor">Contractor (Public Only)</option>
            </select>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-ink-secondary font-semibold mt-0.5 select-none" title="demo authentication — not for production">
            Demo authentication
          </span>
        </div>

        {/* Reset Sandbox Button */}
        <button
          type="button"
          onClick={handleResetSandbox}
          disabled={resetting}
          className="px-2.5 py-1 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors flex items-center gap-1.5 shadow-sm"
          title="Reset your isolated sandbox to clean default seed data"
          aria-label="Reset my sandbox"
        >
          {resetMsg ? (
            <span className="text-[11px] font-mono font-bold text-ink-primary">{resetMsg}</span>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="hidden xl:inline text-[11px]">Reset Sandbox</span>
            </>
          )}
        </button>

        {/* Guided Tour Toggle */}
        {onToggleTour && (
          <button
            type="button"
            onClick={onToggleTour}
            className={`px-2.5 py-1 text-xs font-semibold rounded-btn border transition-colors flex items-center gap-1.5 shadow-sm ${
              isTourOpen
                ? "bg-ink-primary text-surface-card border-ink-primary"
                : "border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary"
            }`}
            title="Toggle 6-step guided evaluation tour"
            aria-label="Toggle guided tour"
            aria-pressed={isTourOpen}
          >
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Tour</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 text-xs rounded-btn border border-edge-default bg-surface-card hover:bg-surface-elevated text-ink-secondary hover:text-ink-primary transition-colors hidden sm:block"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          aria-label={`Toggle theme (currently ${theme})`}
        >
          {theme === "light" ? "◐" : "○"}
        </button>

        {/* Shortcuts Help */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="p-1.5 text-xs font-mono font-bold rounded-btn border border-edge-default bg-surface-card hover:bg-surface-elevated text-ink-secondary hover:text-ink-primary transition-colors"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
    </header>
  );
}

