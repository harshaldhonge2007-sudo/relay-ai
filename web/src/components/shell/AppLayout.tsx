import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCaseLoader, useRole } from "../../contexts/CaseContext";
import { subscribeMockFallback } from "../../api";
import { ErrorBoundary } from "../ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ContextRail } from "./ContextRail";
import { CommandPalette } from "./CommandPalette";
import { MobileTabBar } from "./MobileTabBar";
import { GuidedTour } from "./GuidedTour";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();

  // Extract active case ID from URL if present
  const pathMatch = location.pathname.match(/^\/case\/([^/]+)/);
  const caseId = pathMatch ? pathMatch[1] : undefined;
  const { caseData } = useCaseLoader(caseId);

  // Persistence: sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("relay_sidebar_collapsed") === "true";
  });

  // Persistence: context rail collapse state
  const [isRailCollapsed, setIsRailCollapsed] = useState(() => {
    return localStorage.getItem("relay_rail_collapsed") === "true";
  });

  // Persistence: theme (light vs deliberate dark #121212/#1E1E1E)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("relay_theme") || localStorage.getItem("relay_sidebar_theme");
    if (saved === "light" || saved === "dark") return saved;
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [gKeyPressed, setGKeyPressed] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(() => {
    return localStorage.getItem("relay_guided_tour_active") === "true";
  });

  const handleToggleTour = useCallback(() => {
    setIsTourOpen((prev) => {
      const next = !prev;
      localStorage.setItem("relay_guided_tour_active", String(next));
      return next;
    });
  }, []);

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    localStorage.setItem("relay_guided_tour_active", "false");
  }, []);

  useEffect(() => {
    return subscribeMockFallback(setIsFallback);
  }, []);

  // Apply theme attributes to documentElement for full-site styling & color-scheme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-sidebar-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("relay_theme", theme);
    localStorage.setItem("relay_sidebar_theme", theme);
  }, [theme]);

  // Persist sidebar collapsed
  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("relay_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  // Persist rail collapsed
  const handleToggleRailCollapse = useCallback(() => {
    setIsRailCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("relay_rail_collapsed", String(next));
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Global Keyboard Shortcuts (Cmd+K, ?, G+key navigation)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Cmd+K or Ctrl+K -> Command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // '?' -> open command palette or help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // 'g' key prefix navigation
      if (e.key.toLowerCase() === "g" && !gKeyPressed) {
        setGKeyPressed(true);
        setTimeout(() => setGKeyPressed(false), 1200);
        return;
      }

      if (gKeyPressed) {
        setGKeyPressed(false);
        const targetCase = caseId || "case-001";
        switch (e.key.toLowerCase()) {
          case "h":
            navigate(`/case/${targetCase}`);
            break;
          case "r":
            navigate(`/case/${targetCase}/busfactor`);
            break;
          case "d":
            navigate(`/case/${targetCase}/handover`);
            break;
          case "f":
            navigate(`/case/${targetCase}/findings`);
            break;
          case "k":
            navigate(`/case/${targetCase}/knowledge`);
            break;
          case "a":
            navigate(`/case/${targetCase}/assets`);
            break;
          case "c":
            navigate(`/case/${targetCase}/completeness`);
            break;
          case "v":
            navigate(`/case/${targetCase}/validation`);
            break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gKeyPressed, caseId, navigate]);

  const caseName = caseData?.name || "ShopLedger";
  const isCaseRoute = Boolean(caseId);

  // Layout padding computations
  const sidebarPadding = isSidebarCollapsed ? "lg:pl-[64px]" : "lg:pl-[260px]";
  const railPadding = isCaseRoute ? (isRailCollapsed ? "xl:pr-[32px]" : "xl:pr-[320px]") : "";
  const topPadding = isFallback ? "pt-[92px]" : "pt-[56px]";

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary font-sans antialiased">
      {/* Top Bar */}
      <TopBar
        onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)}
        isSidebarOpen={mobileMenuOpen}
        role={role}
        onRoleChange={setRole}
        caseName={caseName}
        caseId={caseId}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        sidebarTheme={theme}
        onToggleSidebarTheme={handleToggleTheme}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenShortcuts={() => setCommandPaletteOpen(true)}
        isTourOpen={isTourOpen}
        onToggleTour={handleToggleTour}
      />

      {/* Persistent Fallback Notice Banner when Backend is Unreachable */}
      {isFallback && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-[48px] left-0 right-0 z-40 bg-neutral-900 border-b border-neutral-700 text-white px-4 py-2 text-xs font-mono flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-neutral-800 border border-neutral-600 rounded text-neutral-200">
              Fallback Active
            </span>
            <span className="font-medium text-neutral-200">
              Backend unreachable: showing static sample data. Changes are not saved.
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold hidden sm:inline">
            Mutations Disabled
          </span>
        </div>
      )}

      {/* Main Grid Shell */}
      <div className="max-w-shell mx-auto relative flex">
        {/* Sidebar */}
        <Sidebar
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          caseId={caseId}
          caseName={caseName}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
          sidebarTheme={theme}
          onToggleTheme={handleToggleTheme}
          theme={theme}
          onOpenShortcuts={() => setCommandPaletteOpen(true)}
        />

        {/* Scrollable Content Area */}
        <main
          className={`flex-1 min-w-0 ${topPadding} pb-20 lg:pb-12 ${sidebarPadding} ${railPadding} transition-all duration-200`}
        >
          {/* Unified left-aligned page gutter padding (32px desktop, 16px mobile) */}
          <div className="p-4 sm:p-6 lg:p-8 animate-fadeIn">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {/* Optional Right Context Rail (on Case routes) */}
        {isCaseRoute && (
          <ContextRail
            caseId={caseId}
            role={role}
            isCollapsed={isRailCollapsed}
            onToggleCollapse={handleToggleRailCollapse}
          />
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      {isCaseRoute && <MobileTabBar caseId={caseId} />}

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        caseId={caseId}
        role={role}
        onRoleChange={setRole}
        sidebarTheme={theme}
        onToggleSidebarTheme={handleToggleTheme}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 6-Step Guided Tour */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        caseId={caseId}
      />
    </div>
  );
}

