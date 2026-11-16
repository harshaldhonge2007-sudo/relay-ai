import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
}

export interface TourStep {
  id: string;
  label: string;
  title: string;
  description: string;
  getPath: (caseId: string) => string;
  highlightLabel: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "connect",
    label: "1. Connect",
    title: "1. Connect: Authorized Sources & Ingest",
    description:
      "Audit connected GitHub repositories, Slack channels, Jira tickets, and docs. Review source ACL visibility tiers (Lead Only, Internal, Public). All credentials and secrets are scrubbed at ingestion.",
    getPath: (cId) => `/case/${cId}/assets`,
    highlightLabel: "Source ACLs & Credential Sanitization",
  },
  {
    id: "reconstruct",
    label: "2. Reconstruct",
    title: "2. Reconstruct: Bus-Factor Risk & Knowledge Distribution",
    description:
      "Inspect time-decayed authorship and critical single-point dependencies. Pinpoint architecture modules where Priya Nair's departure leaves zero remaining backup knowledge.",
    getPath: (cId) => `/case/${cId}/busfactor`,
    highlightLabel: "Time-Decayed Knowledge & Single Points of Failure",
  },
  {
    id: "verify",
    label: "3. Verify",
    title: "3. Verify: Deterministic Detectors & Model Validation",
    description:
      "Review unmerged PRs, hidden environment variables, and ticket-code contradictions flagged by zero-LLM deterministic detectors. Check /validation for backtest precision and canary leak tests.",
    getPath: (cId) => `/case/${cId}/findings`,
    highlightLabel: "Zero-LLM Deterministic Detectors",
  },
  {
    id: "review",
    label: "4. Review",
    title: "4. Review: Provenance-Enforced Handover Document",
    description:
      "Inspect claim-by-claim provenance (VERIFIED, STATED, INFERRED, UNKNOWN) with exact citations. Role-based withholding masks confidential items from contractor view while maintaining existence privacy.",
    getPath: (cId) => `/case/${cId}/handover`,
    highlightLabel: "Sentence-Level Provenance & Withheld Masking",
  },
  {
    id: "handover",
    label: "5. Handover",
    title: "5. Handover: Blind Agent Completeness Test",
    description:
      "Run the deterministic completeness test. A blind evaluator attempts to reproduce environment variables and service topologies using handover claims alone, calculating 3-run spread bounds.",
    getPath: (cId) => `/case/${cId}/completeness`,
    highlightLabel: "Blind Reconstruction Test & Spread Bounds",
  },
  {
    id: "continue",
    label: "6. Continue",
    title: "6. Continue: Ask the Leaver & Receipt Acknowledgment",
    description:
      "Query Priya's departure persona with strictly role-gated citations. Jordan Taylor signs the HMAC-SHA256 receipt to acknowledge handover reception.",
    getPath: (cId) => `/case/${cId}/interview`,
    highlightLabel: "Role-Gated Q&A & Cryptographic Receipts",
  },
];

export function GuidedTour({ isOpen, onClose, caseId = "case-001" }: GuidedTourProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const saved = localStorage.getItem("relay_guided_tour_step");
    const idx = saved ? parseInt(saved, 10) : 0;
    return isNaN(idx) || idx < 0 || idx >= TOUR_STEPS.length ? 0 : idx;
  });

  useEffect(() => {
    localStorage.setItem("relay_guided_tour_step", String(currentStepIndex));
  }, [currentStepIndex]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const targetPath = currentStep.getPath(caseId);
  const isOnCurrentScreen = location.pathname.startsWith(targetPath);

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
    navigate(TOUR_STEPS[index].getPath(caseId));
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      navigate(TOUR_STEPS[nextIdx].getPath(caseId));
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      navigate(TOUR_STEPS[prevIdx].getPath(caseId));
    }
  };

  const handleNavigateCurrent = () => {
    navigate(targetPath);
  };

  return (
    <aside
      aria-label="Guided Tour"
      role="region"
      className="fixed bottom-5 right-5 z-40 w-[92vw] sm:w-[460px] bg-surface-card border-2 border-edge-strong rounded-card shadow-2xl p-5 text-ink-primary font-sans animate-fadeIn transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-edge-default pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-surface-elevated border border-edge-strong text-ink-primary">
            Step {currentStepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <span className="text-xs font-mono text-ink-secondary">Guided Tour</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-mono font-semibold px-2 py-1 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
          aria-label="Dismiss guided tour"
        >
          Dismiss [Esc]
        </button>
      </div>

      {/* Step Pills Navigation */}
      <nav aria-label="Tour steps" className="grid grid-cols-6 gap-1 mb-3">
        {TOUR_STEPS.map((step, idx) => (
          <button
            key={step.id}
            type="button"
            onClick={() => handleStepClick(idx)}
            className={`py-1 text-[11px] font-mono font-semibold rounded text-center transition-colors border ${
              idx === currentStepIndex
                ? "bg-ink-primary text-surface-card border-ink-primary shadow-sm"
                : idx < currentStepIndex
                ? "bg-surface-elevated text-ink-primary border-edge-strong"
                : "bg-surface-card text-ink-secondary border-edge-default hover:text-ink-primary"
            }`}
            title={step.title}
            aria-current={idx === currentStepIndex ? "step" : undefined}
          >
            {idx + 1}
          </button>
        ))}
      </nav>

      {/* Title & Description */}
      <div className="space-y-2 mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink-primary tracking-tight">
            {currentStep.title}
          </h3>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          {currentStep.description}
        </p>
        <div className="pt-1">
          <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-surface-elevated border border-edge-default text-ink-secondary">
            Focus: <strong className="text-ink-primary">{currentStep.highlightLabel}</strong>
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-edge-default">
        {!isOnCurrentScreen ? (
          <button
            type="button"
            onClick={handleNavigateCurrent}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors"
          >
            Go to Screen →
          </button>
        ) : (
          <span className="text-[11px] font-mono text-ink-secondary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-primary inline-block" />
            Currently viewing
          </span>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="text-xs font-semibold px-3 py-1.5 rounded-btn border border-edge-default bg-surface-card hover:bg-surface-elevated text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-xs font-semibold px-3 py-1.5 rounded-btn bg-ink-primary text-surface-card hover:opacity-90 transition-opacity"
          >
            {currentStepIndex === TOUR_STEPS.length - 1 ? "Finish Tour" : "Next →"}
          </button>
        </div>
      </div>
    </aside>
  );
}
