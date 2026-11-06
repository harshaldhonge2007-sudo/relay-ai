import { useState, useEffect, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

interface Case {
  id: string;
  name: string;
  repo_url: string;
  status: string;
  source_modes: string[];
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-neutral-800 text-white",
  completed: "bg-neutral-300 text-ink-primary",
  pending: "bg-neutral-100 text-ink-secondary border border-edge-default",
  failed: "bg-neutral-600 text-white",
  draft: "bg-neutral-50 text-ink-tertiary border border-edge-default",
};

function getStatusStyle(status: string): string {
  const key = status.toLowerCase();
  return STATUS_STYLES[key] || "bg-neutral-200 text-ink-secondary";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error(`Failed to fetch cases (${res.status})`);
      const data = await res.json();
      setCases(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      if (!res.ok) throw new Error(`Seed failed (${res.status})`);
      await fetchCases();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load demo data");
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateCase = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError("Case name is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), repo_url: newRepoUrl.trim() }),
      });
      if (!res.ok) throw new Error(`Failed to create case (${res.status})`);
      setNewName("");
      setNewRepoUrl("");
      setModalOpen(false);
      await fetchCases();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreating(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    navigate(`/case/${caseId}/knowledge`);
  };

  const handleModalClose = () => {
    if (creating) return;
    setModalOpen(false);
    setNewName("");
    setNewRepoUrl("");
    setCreateError(null);
  };

  const handleOverlayKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") handleModalClose();
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-ink-primary tracking-tight">
            Departure Cases
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-btn border border-edge-strong text-ink-secondary bg-transparent hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seeding ? (
                <>
                  <svg
                    className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-ink-tertiary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                "Load Demo Data"
              )}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-btn bg-ink-primary text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 transition-all duration-200"
            >
              New Case
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-card bg-neutral-100 border border-edge-strong text-ink-primary text-sm animate-fadeIn">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-4 text-ink-tertiary hover:text-ink-primary transition-colors duration-200 focus:outline-none"
                aria-label="Dismiss error"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg
              className="animate-spin h-6 w-6 text-ink-tertiary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="ml-3 text-sm text-ink-tertiary">Loading cases...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && cases.length === 0 && (
          <div className="text-center py-20 animate-fadeIn">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-elevated border border-edge-default flex items-center justify-center">
              <svg className="w-5 h-5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-ink-secondary text-sm font-medium mb-1">No cases yet</p>
            <p className="text-ink-tertiary text-sm">
              Create a new case or load demo data to get started.
            </p>
          </div>
        )}

        {/* Cases Grid */}
        {!loading && cases.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cases.map((c, index) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCaseClick(c.id)}
                className="text-left bg-surface-card shadow-card rounded-card p-5 hover:shadow-float hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 border border-edge-subtle animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-ink-primary truncate flex-1">
                    {c.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${getStatusStyle(c.status)}`}
                  >
                    {c.status}
                  </span>
                </div>

                {c.repo_url && (
                  <p className="text-xs text-ink-tertiary truncate mb-3" title={c.repo_url}>
                    {c.repo_url}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-edge-subtle">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-ink-disabled font-medium">
                      Created
                    </span>
                    <span className="text-xs text-ink-secondary mt-0.5">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase tracking-wider text-ink-disabled font-medium">
                      Updated
                    </span>
                    <span className="text-xs text-ink-secondary mt-0.5">
                      {formatDate(c.updated_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Case Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay backdrop-blur-sm animate-fadeIn"
          onClick={handleModalClose}
          onKeyDown={handleOverlayKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Create new case"
        >
          <div
            className="w-full max-w-md bg-surface-card rounded-card shadow-modal p-6 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-ink-primary">New Case</h2>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={creating}
                className="p-1 rounded-lg text-ink-tertiary hover:text-ink-primary hover:bg-surface-elevated transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-50"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label
                  htmlFor="case-name"
                  className="block text-xs font-medium uppercase tracking-wider text-ink-secondary mb-1.5"
                >
                  Case Name
                </label>
                <input
                  id="case-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter case name"
                  autoFocus
                  disabled={creating}
                  className="w-full px-3 py-2.5 text-sm text-ink-primary bg-white border border-edge-default rounded-input placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:bg-surface-elevated"
                />
              </div>

              <div>
                <label
                  htmlFor="repo-url"
                  className="block text-xs font-medium uppercase tracking-wider text-ink-secondary mb-1.5"
                >
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  type="text"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo (optional)"
                  disabled={creating}
                  className="w-full px-3 py-2.5 text-sm text-ink-primary bg-white border border-edge-default rounded-input placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:bg-surface-elevated"
                />
              </div>

              {createError && (
                <p className="text-sm text-ink-primary bg-neutral-100 border border-edge-strong rounded-input px-3 py-2 animate-fadeIn">
                  {createError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium rounded-btn border border-edge-strong text-ink-secondary bg-transparent hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-btn bg-ink-primary text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <svg
                        className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Create Case"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
