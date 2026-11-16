import { Link, useLocation } from "react-router-dom";
import { Icons } from "./Sidebar";

interface MobileTabBarProps {
  caseId?: string;
}

export function MobileTabBar({ caseId = "case-001" }: MobileTabBarProps) {
  const location = useLocation();

  const tabs = [
    {
      label: "Home",
      path: `/case/${caseId}`,
      icon: Icons.Home,
      isActive: location.pathname === `/case/${caseId}`,
    },
    {
      label: "Verify",
      path: `/case/${caseId}/findings`,
      icon: Icons.Findings,
      isActive:
        location.pathname.includes("/findings") ||
        location.pathname.includes("/uncertainty") ||
        location.pathname.includes("/interview") ||
        location.pathname.includes("/validation"),
    },
    {
      label: "Review",
      path: `/case/${caseId}/handover`,
      icon: Icons.Review,
      isActive: location.pathname.includes("/handover"),
    },
    {
      label: "Handover",
      path: `/case/${caseId}/completeness`,
      icon: Icons.Completeness,
      isActive: location.pathname.includes("/completeness"),
    },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-surface-card border-t border-edge-default flex items-center justify-around px-2 shadow-card"
      aria-label="Mobile bottom navigation"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          to={tab.path}
          className={`flex flex-col items-center justify-center gap-1 w-16 py-1 text-[10px] font-medium transition-colors ${
            tab.isActive
              ? "text-ink-primary font-bold"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
          aria-current={tab.isActive ? "page" : undefined}
        >
          <span className="shrink-0">{tab.icon}</span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

