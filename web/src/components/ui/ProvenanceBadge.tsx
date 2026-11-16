import { useState } from "react";

export type ProvenanceType = "verified" | "stated" | "inferred" | "unknown";

interface ProvenanceBadgeProps {
  type: ProvenanceType | string;
  size?: "sm" | "md";
  className?: string;
  showTooltip?: boolean;
}

const DESCRIPTIONS: Record<string, { label: string; desc: string; icon: string }> = {
  verified: {
    label: "VERIFIED",
    desc: "Directly corroborated by git commits, PR review diffs, or passing test runs.",
    icon: "✓",
  },
  stated: {
    label: "STATED",
    desc: "Recorded in developer notes, Slack chats, or ticket comments without automated diff proof.",
    icon: "✎",
  },
  inferred: {
    label: "INFERRED",
    desc: "Deduced by semantic heuristics or file co-occurrence; unverified by an engineer.",
    icon: "≈",
  },
  unknown: {
    label: "UNKNOWN",
    desc: "Missing explicit evidence; flag raised for departure interview verification.",
    icon: "?",
  },
};

export function ProvenanceBadge({
  type,
  size = "md",
  className = "",
  showTooltip = true,
}: ProvenanceBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const normalized = (type || "unknown").toLowerCase();
  const info = DESCRIPTIONS[normalized] || DESCRIPTIONS.unknown;

  // Distinct shapes & fill treatments:
  // - verified: solid black fill with white text and double border outline
  // - stated: crisp solid border with light grey fill
  // - inferred: dashed border outline
  // - unknown: dotted border outline with muted text
  let styleClasses = "";
  switch (normalized) {
    case "verified":
      styleClasses = "bg-ink-primary text-white border border-ink-primary ring-1 ring-ink-primary/20";
      break;
    case "stated":
      styleClasses = "bg-neutral-100 text-ink-primary border border-edge-strong";
      break;
    case "inferred":
      styleClasses = "bg-surface-card text-ink-secondary border border-dashed border-edge-strong";
      break;
    case "unknown":
    default:
      styleClasses = "bg-surface-card text-ink-muted border border-dotted border-edge-strong";
      break;
  }

  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
      aria-label={`Provenance: ${info.label}. ${info.desc}`}
    >
      <span
        className={`font-mono font-bold uppercase tracking-wider rounded-btn flex items-center gap-1 select-none transition-all ${styleClasses} ${sizeClasses} ${className}`}
      >
        <span aria-hidden="true" className="font-mono text-[9px]">{info.icon}</span>
        <span>{info.label}</span>
      </span>

      {showTooltip && hovered && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 p-2 bg-neutral-900 text-white text-[11px] font-sans leading-tight rounded-btn shadow-float pointer-events-none animate-fadeIn border border-neutral-700"
        >
          <div className="font-mono font-bold uppercase tracking-wider text-[10px] text-neutral-300 mb-0.5">
            {info.label} PROVENANCE
          </div>
          <div>{info.desc}</div>
        </div>
      )}
    </div>
  );
}

