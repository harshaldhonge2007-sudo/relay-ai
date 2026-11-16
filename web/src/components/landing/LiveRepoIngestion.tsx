import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setApiRole } from "../../api";

interface LiveRepoIngestionProps {
  onSuccess?: (caseId: string) => void;
  className?: string;
}

interface IngestStatus {
  status: "pending" | "running" | "complete" | "failed";
  phase: string;
  progress_pct: number;
  commits: number;
  pull_requests: number;
  reviews: number;
  issues: number;
  codeowners_found: boolean;
  error?: string | null;
  offline_fallback?: boolean;
  offline_label?: string;
}

const PRESETS = [
  { label: "pallets/flask", repo: "pallets/flask", desc: "Python web microframework" },
  { label: "fastapi/fastapi", repo: "fastapi/fastapi", desc: "Modern Python API framework" },
  { label: "psf/requests", repo: "psf/requests", desc: "Standard Python HTTP library" },
];

export default function LiveRepoIngestion({ onSuccess, className = "" }: LiveRepoIngestionProps) {
  const navigate = useNavigate();
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [sinceMonths, setSinceMonths] = useState<number>(3);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Ingestion execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const cleanUpPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanUpPolling();
    };
  }, [cleanUpPolling]);

  const pollStatus = useCallback(
    async (caseId: string) => {
      try {
        const res = await apiFetch(`/cases/${caseId}/ingest/status`);
        if (res.ok) {
          const data = await res.json();
          setIngestStatus({
            status: data.status || (data.progress_pct >= 100 ? "complete" : "running"),
            phase: data.phase || "processing",
            progress_pct: data.progress_pct ?? 0,
            commits: data.commits ?? 0,
            pull_requests: data.pull_requests ?? 0,
            reviews: data.reviews ?? 0,
            issues: data.issues ?? 0,
            codeowners_found: Boolean(data.codeowners_found),
            error: data.error,
            offline_fallback: data.offline_fallback ?? false,
            offline_label: data.offline_label,
          });

          if (data.status === "complete" || data.progress_pct >= 100) {
            cleanUpPolling();
            setTimeout(() => {
              if (onSuccess) {
                onSuccess(caseId);
              } else {
                navigate(`/case/${caseId}/intelligence`);
              }
            }, 800);
          } else if (data.status === "failed") {
            cleanUpPolling();
            setErrorMsg(data.error || "Ingestion failed. Please check repository name or token rate limits.");
          }
        }
      } catch (err: any) {
        // Continue polling unless explicit hard error
        console.warn("Polling status error:", err);
      }
    },
    [cleanUpPolling, navigate, onSuccess]
  );

  const handleStartIngest = async (targetRepo?: string) => {
    const chosenRepo = (targetRepo || repo).trim();
    if (!chosenRepo) {
      setErrorMsg("Please enter a GitHub repository (e.g. owner/repo).");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    setIngestStatus({
      status: "pending",
      phase: "initializing",
      progress_pct: 5,
      commits: 0,
      pull_requests: 0,
      reviews: 0,
      issues: 0,
      codeowners_found: false,
    });

    try {
      // Ensure lead role for creating cases
      await setApiRole("engineering_lead");

      const res = await apiFetch("/cases/from-repo", {
        method: "POST",
        body: JSON.stringify({
          repo: chosenRepo,
          token: token.trim() || undefined,
          since_months: sinceMonths,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Server returned status ${res.status}`);
      }

      const data = await res.json();
      const newCaseId = data.case_id || data.id;
      setActiveCaseId(newCaseId);

      // If the server indicates this is an offline fixture fallback, label it immediately
      if (data.offline_fallback && data.progress?.offline_label) {
        setIngestStatus({
          status: "complete",
          phase: "ready",
          progress_pct: 100,
          commits: 0,
          pull_requests: 0,
          reviews: 0,
          issues: 0,
          codeowners_found: false,
          offline_fallback: true,
          offline_label: data.progress.offline_label,
        });
        cleanUpPolling();
        setTimeout(() => {
          if (onSuccess) onSuccess(newCaseId);
          else navigate(`/case/${newCaseId}/intelligence`);
        }, 1200);
        return;
      }

      // Start polling
      cleanUpPolling();
      pollTimerRef.current = window.setInterval(() => {
        void pollStatus(newCaseId);
      }, 750);
      // Immediate first poll
      void pollStatus(newCaseId);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start live repository analysis.");
      setIsSubmitting(false);
      cleanUpPolling();
    }
  };

  const handleCancel = () => {
    cleanUpPolling();
    setIsSubmitting(false);
    setActiveCaseId(null);
    setIngestStatus(null);
  };

  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case "fetching_commits":
      case "commits":
        return "Scanning commit log & author churn...";
      case "fetching_pull_requests":
      case "pull_requests":
        return "Extracting PRs & discussion threads...";
      case "fetching_reviews":
      case "reviews":
        return "Mapping review topology & co-approvals...";
      case "fetching_issues":
      case "issues":
        return "Correlating bug & incident references...";
      case "codeowners":
        return "Parsing CODEOWNERS rules...";
      case "risk_computation":
        return "Computing bus-factor line survival & decay...";
      case "ready":
      case "complete":
        return "Complete! Redirecting to intelligence dashboard...";
      default:
        return "Synchronizing repository metadata...";
    }
  };

  return (
    <div className={`w-full rounded-card border border-edge-strong bg-surface-card p-5 shadow-card transition-all ${className}`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ink-primary animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-primary">
            Live GitHub Ingestion
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-edge-strong text-ink-secondary bg-surface-elevated">
          Real Data · Zero Fabrication
        </span>
      </div>

      <p className="text-xs text-ink-secondary leading-normal mb-4">
        Ingest any public GitHub repository to compute live bus-factor risk, line survival, and living memory.
      </p>

      {/* Input row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={repo}
            onChange={(e) => {
              setRepo(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="owner/repo (e.g. pallets/flask)"
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-xs font-mono rounded-input border border-edge-strong bg-surface-base text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-ink-primary focus:ring-1 focus:ring-ink-primary transition-colors disabled:opacity-50"
            aria-label="GitHub repository to analyze"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleStartIngest()}
          disabled={isSubmitting || !repo.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 whitespace-nowrap shadow-sm"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span>Analyze repository</span>
            </>
          )}
        </button>
      </div>

      {/* Preset pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[10px] text-ink-tertiary mr-1">Quick presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.repo}
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setRepo(p.repo);
              if (errorMsg) setErrorMsg(null);
            }}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-pill border transition-colors ${
              repo === p.repo
                ? "border-ink-primary bg-ink-primary text-white"
                : "border-edge-strong bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:border-ink-secondary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Advanced toggle */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[11px] text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1 transition-colors"
        >
          <span>{showAdvanced ? "▾" : "▸"}</span>
          <span>Advanced options (GitHub Token & Lookback)</span>
        </button>

        {showAdvanced && (
          <div className="mt-2.5 p-3 rounded-input bg-surface-elevated border border-edge-default space-y-2.5 text-xs animate-fadeIn">
            <div>
              <label className="block text-[10px] font-semibold text-ink-secondary uppercase mb-1">
                GitHub Token (Optional, for 5,000 req/hr rate limit)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                disabled={isSubmitting}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-input border border-edge-strong bg-surface-card text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-ink-primary"
              />
              <p className="text-[10px] text-ink-tertiary mt-1">
                Public repos work unauthenticated (60 req/hr). Add a Personal Access Token with <code className="font-mono">repo</code> scope for large repos.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-ink-secondary uppercase mb-1">
                Lookback Window: {sinceMonths} month{sinceMonths > 1 ? "s" : ""}
              </label>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={sinceMonths}
                onChange={(e) => setSinceMonths(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-full cursor-pointer accent-neutral-800"
              />
              <div className="flex justify-between text-[9px] text-ink-tertiary">
                <span>1 month (fastest)</span>
                <span>6 months</span>
                <span>12 months (deep)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="mt-3 p-3 rounded-input bg-surface-elevated border border-edge-strong text-ink-primary text-xs flex items-start gap-2">
          <span className="font-bold text-ink-primary">!</span>
          <div className="flex-1">
            <p className="font-semibold">{errorMsg}</p>
            <p className="text-[11px] text-ink-secondary mt-0.5">
              You can also use the sample case below to tour the full platform offline.
            </p>
          </div>
        </div>
      )}

      {/* Live Ingestion Progress Overlay / Inline View */}
      {isSubmitting && ingestStatus && (
        <div className="mt-4 p-4 rounded-input border border-edge-strong bg-surface-base space-y-3">
          {/* Offline fallback badge */}
          {ingestStatus.offline_fallback && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-card border border-edge-strong text-[10px] font-mono text-ink-secondary" role="status" aria-live="polite">
              <span className="font-bold text-ink-primary">[OFFLINE]</span>
              <span>{ingestStatus.offline_label ?? "CACHED FIXTURES — offline fallback"}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-primary">
              {getPhaseDescription(ingestStatus.phase)}
            </span>
            <span className="font-mono font-bold text-ink-primary">
              {Math.min(100, Math.max(0, Math.round(ingestStatus.progress_pct)))}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-edge-strong overflow-hidden">
            <div
              className="h-full bg-ink-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(5, ingestStatus.progress_pct))}%` }}
            />
          </div>

          {/* Counters Grid */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-edge-default text-center">
            <div className="p-1.5 rounded bg-surface-card border border-edge-subtle">
              <span className="block text-[9px] font-mono text-ink-tertiary uppercase">Commits</span>
              <span className="block text-xs font-mono font-bold text-ink-primary">
                {ingestStatus.commits}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-card border border-edge-subtle">
              <span className="block text-[9px] font-mono text-ink-tertiary uppercase">PRs</span>
              <span className="block text-xs font-mono font-bold text-ink-primary">
                {ingestStatus.pull_requests}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-card border border-edge-subtle">
              <span className="block text-[9px] font-mono text-ink-tertiary uppercase">Reviews</span>
              <span className="block text-xs font-mono font-bold text-ink-primary">
                {ingestStatus.reviews}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-card border border-edge-subtle">
              <span className="block text-[9px] font-mono text-ink-tertiary uppercase">Issues</span>
              <span className="block text-xs font-mono font-bold text-ink-primary">
                {ingestStatus.issues}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-ink-tertiary font-mono">
              {activeCaseId ? `[${activeCaseId}] ` : ""}
              {ingestStatus.offline_fallback
                ? "Using pre-built fixture data"
                : ingestStatus.codeowners_found ? "✓ CODEOWNERS detected" : "• Scanning repository tree..."}
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-[10px] text-ink-secondary hover:text-ink-primary transition-colors font-mono"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
