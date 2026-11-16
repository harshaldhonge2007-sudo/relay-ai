import React from "react";

export type SeverityLevel = "low" | "medium" | "high" | "critical" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SeverityProps {
  level: SeverityLevel;
  value?: number; // 0 to 1 or percentage (e.g. 0.87 or 87)
  score?: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showBar?: boolean;
  className?: string;
}

export function Severity({
  level,
  value,
  score,
  showBar = true,
  className = "",
}: SeverityProps) {
  const effectiveValue = value !== undefined ? value : score;
  const normValue = effectiveValue !== undefined ? (effectiveValue <= 1 ? Math.round(effectiveValue * 100) : Math.round(effectiveValue)) : null;
  const normalizedLevel = level.toLowerCase() as "low" | "medium" | "high" | "critical";

  // Monochrome fill density / hatching configuration
  const barStyle: React.CSSProperties = {};
  let hatchClass = "";
  let barWidth = "25%";

  switch (normalizedLevel) {
    case "critical":
      hatchClass = "hatch-critical bg-edge-dark";
      barWidth = normValue ? `${Math.max(normValue, 85)}%` : "95%";
      break;
    case "high":
      hatchClass = "hatch-leaver bg-edge-strong";
      barWidth = normValue ? `${Math.max(normValue, 65)}%` : "75%";
      break;
    case "medium":
      hatchClass = "bg-ink-tertiary";
      barWidth = normValue ? `${Math.max(normValue, 40)}%` : "50%";
      break;
    case "low":
    default:
      hatchClass = "bg-edge-strong";
      barWidth = normValue ? `${Math.max(normValue, 15)}%` : "25%";
      break;
  }

  const labelText = normalizedLevel.toUpperCase();

  return (
    <div
      className={`inline-flex items-center gap-2 font-mono text-xs select-none ${className}`}
      role="status"
      aria-label={`Severity: ${normalizedLevel}${normValue !== null ? ` ${normValue}%` : ""}`}
    >
      <span className="font-semibold tracking-wider text-[11px] text-ink-primary">
        [{labelText}]
      </span>

      {showBar && (
        <div
          className="w-14 h-2 bg-surface-elevated rounded-sm overflow-hidden border border-edge-strong flex-shrink-0"
          aria-hidden="true"
        >
          <div
            className={`h-full ${hatchClass} transition-all duration-300`}
            style={{ width: barWidth, ...barStyle }}
          />
        </div>
      )}

      {normValue !== null && (
        <span className="text-[11px] font-bold text-ink-primary tabular-nums">
          {normValue}%
        </span>
      )}
    </div>
  );
}

export default Severity;
