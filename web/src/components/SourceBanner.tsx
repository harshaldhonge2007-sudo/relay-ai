import React from "react";

interface SourceBannerProps {
  sourceMode?: string;
  sourceName?: string;
}

const SourceBanner: React.FC<SourceBannerProps> = ({
  sourceMode,
  sourceName,
}) => {
  if (!sourceMode) return null;

  return (
    <div className="bg-surface-elevated border border-edge-default rounded-card px-4 py-2 mb-4 animate-fadeIn">
      <p className="text-sm text-ink-tertiary">
        Data source: {sourceName ?? "Unknown"} ({sourceMode})
      </p>
    </div>
  );
};

export default SourceBanner;
