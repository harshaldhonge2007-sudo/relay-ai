import React, { useState, useEffect } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
}

export type MetaChipType = React.ReactNode | { label: string; value: string | number };

export interface PageHeaderProps {
  stepNumber?: number | string;
  stepEyebrow?: string; // e.g. "3 VERIFY"
  title: string;
  description?: string;
  metaChips?: MetaChipType[];
  actions?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export function PageHeader({
  stepNumber,
  stepEyebrow,
  title,
  description,
  metaChips,
  actions,
  primaryAction,
  secondaryActions,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: PageHeaderProps) {
  const [showCondensed, setShowCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setShowCondensed(window.scrollY > 140);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const eyebrowText = stepEyebrow
    ? stepNumber
      ? `${stepNumber} ${stepEyebrow}`
      : stepEyebrow
    : stepNumber
    ? `STEP ${stepNumber}`
    : undefined;

  return (
    <div className={`relative border-b border-edge-default pb-5 mb-6 space-y-4 ${className}`}>
      {/* Background dot grid band behind header fading to transparent */}
      <div className="header-dot-grid" aria-hidden="true" />

      {/* Main header block */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          {eyebrowText && (
            <div className="text-[11px] font-mono uppercase tracking-widest text-ink-secondary font-bold flex items-center gap-2">
              <span>{eyebrowText}</span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink-primary tracking-tight truncate">
            {title}
          </h1>

          {description && (
            <p className="text-xs text-ink-secondary max-w-3xl leading-relaxed">
              {description}
            </p>
          )}

          {metaChips && metaChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {metaChips.map((chip, idx) => {
                if (chip && typeof chip === "object" && "label" in chip && "value" in chip) {
                  return (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-surface-base text-ink-primary border border-edge-strong font-medium"
                    >
                      <span className="text-ink-secondary">{chip.label}:</span>{" "}
                      <span className="font-semibold">{chip.value}</span>
                    </span>
                  );
                }
                return (
                  <span
                    key={idx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-surface-base text-ink-primary border border-edge-strong font-medium"
                  >
                    {chip as React.ReactNode}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions section */}
        {(actions || primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto pt-1">
            {actions}

            {secondaryActions && secondaryActions.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors focus:outline-none focus:ring-1 focus:ring-ink-primary"
                  aria-label="More actions"
                >
                  •••
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 z-50 w-44 rounded-btn border border-edge-strong bg-surface-card shadow-float py-1">
                    {secondaryActions.map((sec, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          sec.onClick();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-ink-primary hover:bg-surface-elevated transition-colors"
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-primary flex items-center gap-1.5"
              >
                {primaryAction.icon}
                <span>{primaryAction.label}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Row */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-edge-default pt-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={`relative px-3.5 py-2 text-xs font-medium transition-colors focus:outline-none ${
                  isActive
                    ? "text-ink-primary font-semibold"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-pill ${
                        isActive
                          ? "bg-ink-primary text-white"
                          : "bg-edge-default text-ink-secondary"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Condensed Header Subheader on Scroll */}
      {showCondensed && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-surface-card/90 backdrop-blur-md border-b border-edge-default py-2 px-6 shadow-sm transition-all animate-fadeIn">
          <div className="max-w-wide mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate">
              {eyebrowText && (
                <span className="text-[10px] font-mono uppercase text-ink-secondary">
                  {eyebrowText}
                </span>
              )}
              <span className="text-sm font-semibold text-ink-primary truncate">
                {title}
              </span>
            </div>

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="px-3 py-1 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shrink-0"
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PageHeader;
