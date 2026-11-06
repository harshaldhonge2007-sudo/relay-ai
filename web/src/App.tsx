import { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { CaseProvider, useCaseLoader } from "./contexts/CaseContext";

import Cases from "./screens/Cases";
import KnowledgeRadar from "./screens/KnowledgeRadar";
import WorkTimeline from "./screens/WorkTimeline";
import Findings from "./screens/Findings";
import Interview from "./screens/Interview";
import Handover from "./screens/Handover";
import CompletenessTest from "./screens/CompletenessTest";
import Admin from "./screens/Admin";

/* ------------------------------------------------------------------ */
/*  Nav item definitions                                               */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  path: string;
}

const caseNavItems: NavItem[] = [
  { label: "Knowledge Radar", path: "knowledge" },
  { label: "Work Timeline", path: "timeline" },
  { label: "Findings", path: "findings" },
  { label: "Interview", path: "interview" },
  { label: "Handover Doc", path: "handover" },
  { label: "Completeness", path: "completeness" },
  { label: "Admin", path: "admin" },
];

/* ------------------------------------------------------------------ */
/*  Hamburger / Close icon                                             */
/* ------------------------------------------------------------------ */

function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="19" y2="6" />
      <line x1="3" y1="11" x2="19" y2="11" />
      <line x1="3" y1="16" x2="19" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <line x1="5" y1="5" x2="17" y2="17" />
      <line x1="17" y1="5" x2="5" y2="17" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const pathMatch = location.pathname.match(/^\/case\/([^/]+)/);
  const caseId = pathMatch ? pathMatch[1] : undefined;
  const { caseData, loading } = useCaseLoader(caseId);

  const isActive = useCallback(
    (segment: string) => {
      if (!caseId) return false;
      return location.pathname === `/case/${caseId}/${segment}`;
    },
    [caseId, location.pathname]
  );

  const isCasesActive = location.pathname === "/";

  /* Derive a display name for the current case */
  const caseName = loading
    ? "Loading..."
    : caseData?.name ?? (caseId ? `Case ${caseId}` : null);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-surface-overlay backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-[57px] left-0 bottom-0 z-40 w-[260px]
          flex flex-col
          bg-white/80 backdrop-blur-sm border-r border-edge-default
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ---- Sidebar content ---- */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Cases link (always visible) */}
          <div className="px-3 mb-1">
            <Link
              to="/"
              onClick={onClose}
              className={`
                flex items-center px-3 py-2.5 rounded-btn text-sm transition-all duration-200
                ${
                  isCasesActive
                    ? "bg-surface-elevated font-medium text-ink-primary border-l-2 border-ink-primary pl-[10px]"
                    : "text-ink-secondary hover:bg-surface-elevated/50"
                }
              `}
            >
              Cases
            </Link>
          </div>

          {/* Case-specific nav */}
          {caseId && (
            <>
              {/* Case name header */}
              <div className="px-6 pt-5 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-tertiary">
                  Current Case
                </p>
                <p className="mt-1 text-sm font-medium text-ink-primary truncate">
                  {caseName}
                </p>
              </div>

              <div className="mx-4 border-t border-edge-subtle mb-2" />

              <div className="px-3 space-y-0.5">
                {caseNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={`/case/${caseId}/${item.path}`}
                      onClick={onClose}
                      className={`
                        flex items-center px-3 py-2.5 rounded-btn text-sm transition-all duration-200
                        ${
                          active
                            ? "bg-surface-elevated font-medium text-ink-primary border-l-2 border-ink-primary pl-[10px]"
                            : "text-ink-secondary hover:bg-surface-elevated/50"
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="px-6 py-4 border-t border-edge-subtle">
          <p className="text-[11px] text-ink-disabled">
            RELAY AI v1.0
          </p>
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  AppShell — header + sidebar + content                              */
/* ------------------------------------------------------------------ */

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  /* Close mobile sidebar on route change */
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-surface-base font-sans text-ink-primary">
      {/* ---- Header ---- */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[57px] flex items-center justify-between px-4 lg:px-6 bg-white border-b border-edge-default">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 -ml-1.5 rounded-btn text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ink-primary/20"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          >
            {sidebarOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>

          {/* Logo */}
          <Link
            to="/"
            className="text-xl font-bold tracking-tight text-ink-primary select-none"
          >
            RELAY
          </Link>
        </div>

        {/* Right side — placeholder for future controls */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-ink-tertiary font-medium tracking-wide uppercase">
            AI Investigation
          </span>
        </div>
      </header>

      {/* ---- Sidebar ---- */}
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* ---- Main content ---- */}
      <main className="pt-[57px] lg:pl-[260px] min-h-screen">
        <div className="p-6 lg:p-8 animate-fadeIn">
          <Routes>
            <Route path="/" element={<Cases />} />
            <Route path="/case/:caseId/knowledge" element={<KnowledgeRadar />} />
            <Route path="/case/:caseId/timeline" element={<WorkTimeline />} />
            <Route path="/case/:caseId/findings" element={<Findings />} />
            <Route path="/case/:caseId/interview" element={<Interview />} />
            <Route path="/case/:caseId/handover" element={<Handover />} />
            <Route path="/case/:caseId/completeness" element={<CompletenessTest />} />
            <Route path="/case/:caseId/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App root — providers + router                                      */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <BrowserRouter>
      <CaseProvider>
        {/* 
          We need useParams inside the sidebar, so we wrap the shell
          in a route that matches everything. 
        */}
        <Routes>
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </CaseProvider>
    </BrowserRouter>
  );
}
