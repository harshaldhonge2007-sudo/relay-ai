import { Link } from "react-router-dom";

export interface NextStepFooterProps {
  stepNumber?: number | string;
  currentStep?: number | string;
  totalSteps?: number | string;
  stepName?: string;
  nextLabel?: string;
  nextRoute?: string;
  nextUrl?: string;
  description?: string;
  ctaText?: string;
  className?: string;
}

export function NextStepFooter({
  stepNumber,
  currentStep,
  totalSteps,
  stepName,
  nextLabel,
  nextRoute,
  nextUrl,
  description,
  ctaText = "Continue Workflow →",
  className = "",
}: NextStepFooterProps) {
  const displayStep = stepNumber ?? (currentStep ? (totalSteps ? `${currentStep} of ${totalSteps}` : `${currentStep}`) : "Next");
  const displayTitle = stepName || nextLabel || "Next Step";
  const targetRoute = nextRoute || nextUrl || "#";
  const displayDesc = description || "Proceed to the next stage in the knowledge continuity workflow.";

  return (
    <div
      className={`mt-10 p-5 rounded-card border border-edge-default bg-surface-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink-secondary bg-surface-elevated border border-edge-strong px-2 py-0.5 rounded-pill">
            Next Step · {displayStep}
          </span>
          <h3 className="text-sm font-semibold text-ink-primary">
            {displayTitle}
          </h3>
        </div>
        <p className="text-xs text-ink-secondary max-w-xl">
          {displayDesc}
        </p>
      </div>

      <Link
        to={targetRoute}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-primary"
      >
        <span>{ctaText}</span>
      </Link>
    </div>
  );
}

export default NextStepFooter;
