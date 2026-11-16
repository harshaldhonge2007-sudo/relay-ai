import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RelayRole } from "../../api";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  role: RelayRole;
  onRoleChange: (r: RelayRole) => void;
  sidebarTheme?: "light" | "dark";
  onToggleSidebarTheme?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Role Switch" | "Settings" | "Actions";
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  caseId = "case-001",
  role,
  onRoleChange,
  sidebarTheme,
  onToggleSidebarTheme,
  theme = sidebarTheme || "light",
  onToggleTheme = onToggleSidebarTheme || (() => {}),
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: "nav-home",
      category: "Navigation",
      label: "Go to Case Home",
      shortcut: "G H",
      action: () => navigate(`/case/${caseId}`),
    },
    {
      id: "nav-busfactor",
      category: "Navigation",
      label: "Go to Bus-Factor Risk Engine",
      shortcut: "G R",
      action: () => navigate(`/case/${caseId}/busfactor`),
    },
    {
      id: "nav-handover",
      category: "Navigation",
      label: "Go to Handover Document",
      shortcut: "G D",
      action: () => navigate(`/case/${caseId}/handover`),
    },
    {
      id: "nav-knowledge",
      category: "Navigation",
      label: "Go to Knowledge Radar",
      shortcut: "G K",
      action: () => navigate(`/case/${caseId}/knowledge`),
    },
    {
      id: "nav-findings",
      category: "Navigation",
      label: "Go to Findings & Conflicts",
      shortcut: "G F",
      action: () => navigate(`/case/${caseId}/findings`),
    },
    {
      id: "nav-interview",
      category: "Navigation",
      label: "Go to Interview Checklist",
      shortcut: "G I",
      action: () => navigate(`/case/${caseId}/interview`),
    },
    {
      id: "nav-assets",
      category: "Navigation",
      label: "Go to Sources & Project Assets",
      shortcut: "G A",
      action: () => navigate(`/case/${caseId}/assets`),
    },
    {
      id: "nav-completeness",
      category: "Navigation",
      label: "Go to Completeness Test",
      shortcut: "G C",
      action: () => navigate(`/case/${caseId}/completeness`),
    },
    {
      id: "nav-validation",
      category: "Navigation",
      label: "Go to Model Validation (Backtest)",
      shortcut: "G V",
      action: () => navigate(`/case/${caseId}/validation`),
    },
    {
      id: "nav-admin",
      category: "Navigation",
      label: "Go to Admin & Audit Log",
      action: () => navigate(`/case/${caseId}/admin`),
    },

    // Role Switching
    {
      id: "role-lead",
      category: "Role Switch",
      label: "Switch to: Engineering Lead (Full Access)",
      action: () => onRoleChange("engineering_lead"),
    },
    {
      id: "role-successor",
      category: "Role Switch",
      label: "Switch to: Successor (Alex Chen)",
      action: () => onRoleChange("successor"),
    },
    {
      id: "role-contractor",
      category: "Role Switch",
      label: "Switch to: Contractor (Public Only)",
      action: () => onRoleChange("contractor"),
    },

    // Settings & Theme
    {
      id: "theme-toggle",
      category: "Settings",
      label: `Toggle Theme (Current: ${theme})`,
      action: () => onToggleTheme(),
    },
    {
      id: "demo-reset",
      category: "Actions",
      label: "Reset Demo State to Initial Case",
      action: () => {
        window.location.reload();
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-card rounded-card border border-edge-strong shadow-modal overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Input Field */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge-default">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-secondary">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, screen name, or action..."
            className="w-full bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary focus:outline-none"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-edge-strong bg-surface-elevated text-ink-secondary">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-edge-subtle">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-secondary">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-btn text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-surface-elevated text-ink-primary font-semibold ring-1 ring-edge-strong"
                      : "text-ink-primary hover:bg-surface-elevated/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "border-edge-strong bg-surface-card text-ink-primary font-bold"
                          : "border-edge-default bg-surface-elevated text-ink-secondary"
                      }`}
                    >
                      {item.category}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.shortcut && (
                    <kbd
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "border-edge-strong bg-surface-card text-ink-primary font-semibold"
                          : "border-edge-default bg-surface-elevated text-ink-secondary"
                      }`}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-edge-default bg-surface-elevated flex items-center justify-between text-[10px] font-mono text-ink-secondary">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Active Role: {role}</span>
        </div>
      </div>
    </div>
  );
}

