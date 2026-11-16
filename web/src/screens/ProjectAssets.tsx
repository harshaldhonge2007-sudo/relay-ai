import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../api";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

interface ProjectAssetItem {
  id: string;
  name: string;
  file_type: string;
  platform: string;
  url: string;
  owner: string;
  last_modified: string;
  relevance_score: number;
  category: string;
  is_selected: boolean;
  is_demo: boolean;
}

interface HandoverFolderResult {
  status: string;
  mode: string;
  folder_name: string;
  folder_url: string;
  platform: string;
  created_at: string;
  files_organized: number;
  categories: string[];
  demo_note: string;
  setup_instructions: string;
}

function FileIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  let iconPath = (
    // Default document / file
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
    />
  );

  if (t === "sheet" || t === "gsheet" || t === "xlsx") {
    // Grid / spreadsheet table
    iconPath = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
      />
    );
  } else if (t === "diagram" || t === "drawio") {
    // Topology / architecture graph
    iconPath = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 14.25v2.25m3-4.5 3 4.5m0 0 3-4.5m-3 4.5v-2.25m6-3.75h-15a2.25 2.25 0 0 0-2.25 2.25v7.5a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25Z"
      />
    );
  } else if (t === "markdown" || t === "md") {
    // Markdown / code document
    iconPath = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
      />
    );
  } else if (t === "pdf") {
    iconPath = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-input bg-surface-elevated border border-edge-default flex items-center justify-center text-ink-primary shrink-0">
      <svg className="w-4 h-4 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        {iconPath}
      </svg>
    </div>
  );
}

function getPlatformBadge(platform: string) {
  const p = platform.toLowerCase();
  let label = "Workspace";
  if (p === "google_drive") label = "Drive";
  else if (p === "google_sheets") label = "Sheets";
  else if (p === "onedrive") label = "OneDrive";

  return (
    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated text-ink-primary font-medium tracking-tight">
      {label}
    </span>
  );
}

export default function ProjectAssets() {
  const { caseId } = useParams<{ caseId: string }>();
  const [assets, setAssets] = useState<ProjectAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  // Handover folder state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderResult, setFolderResult] = useState<HandoverFolderResult | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/assets`);
      if (!res.ok) throw new Error("Failed to load project assets");
      const data = await res.json();
      setAssets(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading assets");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const toggleSelect = async (assetId: string, current: boolean) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, is_selected: !current } : a))
    );
    try {
      await apiFetch(`/cases/${caseId}/assets/${assetId}/select`, {
        method: "PUT",
        body: JSON.stringify({ is_selected: !current }),
      });
    } catch {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, is_selected: current } : a))
      );
    }
  };

  const handleCreateFolder = async () => {
    if (!caseId) return;
    setCreatingFolder(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/assets/create-handover-folder`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create handover folder");
      const result = await res.json();
      setFolderResult(result);
      setShowFolderModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Folder creation failed");
    } finally {
      setCreatingFolder(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => set.add(a.category));
    return Array.from(set);
  }, [assets]);

  // Filtered assets
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.owner.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        selectedCategory === "all" || a.category === selectedCategory;
      const matchPlat =
        selectedPlatform === "all" || a.platform === selectedPlatform;
      return matchSearch && matchCat && matchPlat;
    });
  }, [assets, search, selectedCategory, selectedPlatform]);

  const selectedCount = assets.filter((a) => a.is_selected).length;

  return (
    <PageContainer width="wide">
      <PageHeader
        stepNumber={1}
        stepEyebrow="Connect & Ingest"
        title="Project Documentation & Assets"
        description="Discovered project files from Google Drive, Sheets, and OneDrive. Select relevant assets to include in the handover pack."
        metaChips={[
          { label: "Total Assets", value: assets.length },
          { label: "Selected", value: selectedCount },
          { label: "Connectors", value: "Drive, Sheets, OneDrive" },
        ]}
        actions={
          <button
            onClick={handleCreateFolder}
            disabled={creatingFolder || selectedCount === 0}
            className="px-4 py-2 text-xs font-semibold bg-ink-primary hover:bg-neutral-800 text-white rounded-btn transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {creatingFolder ? (
              <>
                <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Organizing Folder…</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                </svg>
                <span>Create Handover Folder ({selectedCount})</span>
              </>
            )}
          </button>
        }
      />

      {/* Cloud Integration Status Card */}
      <div className="p-4 rounded-card border border-edge-default bg-surface-card shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-input bg-surface-elevated border border-edge-strong flex items-center justify-center text-ink-primary shrink-0">
            <svg className="w-5 h-5 text-ink-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-primary">
              Connected Storage Platforms
            </h3>
            <p className="text-[11px] text-ink-secondary mt-0.5">
              Live OAuth credentials or demonstration fixture mode. Files are indexed without altering original permissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated border border-edge-strong text-[11px] font-mono text-ink-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-primary" />
            <span>Google Drive</span>
            <span className="text-[9px] uppercase font-mono text-ink-tertiary font-bold ml-1">Demo</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated border border-edge-strong text-[11px] font-mono text-ink-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-primary" />
            <span>Google Sheets</span>
            <span className="text-[9px] uppercase font-mono text-ink-tertiary font-bold ml-1">Demo</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated border border-edge-strong text-[11px] font-mono text-ink-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-primary" />
            <span>OneDrive / Excel</span>
            <span className="text-[9px] uppercase font-mono text-ink-tertiary font-bold ml-1">Demo</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-card rounded-card border border-edge-default shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets by file name or owner…"
            className="w-full text-xs font-mono pl-8 pr-3 py-1.5 rounded-input border border-edge-default bg-surface-base text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-ink-primary"
          />
          <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-mono px-2.5 py-1.5 rounded-input border border-edge-default bg-surface-base text-ink-primary focus:outline-none focus:border-ink-primary"
          >
            <option value="all">All Categories ({assets.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ").toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="text-xs font-mono px-2.5 py-1.5 rounded-input border border-edge-default bg-surface-base text-ink-primary focus:outline-none focus:border-ink-primary"
          >
            <option value="all">All Platforms</option>
            <option value="google_drive">Google Drive</option>
            <option value="google_sheets">Google Sheets</option>
            <option value="onedrive">OneDrive</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-surface-elevated border border-edge-strong text-ink-primary text-xs rounded-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-primary">!</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadAssets}
            className="px-3 py-1 bg-ink-primary text-white text-xs font-semibold rounded-btn hover:opacity-90 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Asset Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-surface-card rounded-card border border-edge-default" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-surface-card rounded-card border border-edge-default">
          <p className="text-sm text-ink-tertiary">No assets matched your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const relPct = Math.round(item.relevance_score * 100);
            return (
              <div
                key={item.id}
                className={`bg-surface-card rounded-card p-4 border transition-all duration-200 flex flex-col justify-between ${
                  item.is_selected
                    ? "border-ink-primary shadow-float ring-1 ring-ink-primary/20"
                    : "border-edge-default shadow-card hover:-translate-y-px"
                }`}
              >
                <div>
                  {/* Top row: Platform & Checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getPlatformBadge(item.platform)}
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-elevated border border-edge-subtle text-ink-tertiary">
                        {item.category.replace("_", " ")}
                      </span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.is_selected}
                        onChange={() => toggleSelect(item.id, item.is_selected)}
                        className="h-3.5 w-3.5 rounded border-edge-strong text-ink-primary focus:ring-ink-primary cursor-pointer accent-neutral-900"
                      />
                      <span className="text-[11px] font-mono text-ink-secondary">
                        {item.is_selected ? "Included" : "Include"}
                      </span>
                    </label>
                  </div>

                  {/* Title & icon */}
                  <div className="flex items-start gap-2.5 mt-2">
                    <FileIcon type={item.file_type} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-semibold text-ink-primary leading-tight line-clamp-2">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-ink-tertiary mt-1">
                        Owner: <strong className="text-ink-secondary font-medium">{item.owner}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom row: Relevance & Link */}
                <div className="mt-4 pt-3 border-t border-edge-subtle flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-mono text-ink-tertiary block">
                      Relevance
                    </span>
                    <span className="font-mono font-bold text-ink-primary text-xs">
                      {relPct}%
                    </span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-ink-primary hover:underline flex items-center gap-1"
                  >
                    <span>Open Source</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Summary Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-ink-primary text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-6 border border-white/10">
        <span className="text-xs font-semibold">
          <strong className="font-mono text-sm">{selectedCount}</strong> asset(s) selected for handover
        </span>
        <button
          onClick={handleCreateFolder}
          disabled={creatingFolder || selectedCount === 0}
          className="px-3.5 py-1.5 bg-btn-primary text-btn-primary-text hover:opacity-90 text-xs font-bold rounded-full transition-opacity disabled:opacity-50"
        >
          {creatingFolder ? "Creating…" : "Create Google Drive Folder"}
        </button>
      </div>

      {/* Handover Folder Success Modal */}
      {showFolderModal && folderResult && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-card rounded-card max-w-lg w-full p-6 shadow-2xl border border-edge-strong space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-surface-elevated border border-edge-strong flex items-center justify-center text-ink-primary">
                  <svg className="w-4 h-4 text-ink-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Handover Folder Ready
                </h3>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-xs font-mono text-ink-tertiary hover:text-ink-primary p-1"
                aria-label="Close modal"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-surface-elevated border border-edge-strong rounded-input text-xs text-ink-primary leading-relaxed">
              <strong className="block font-semibold mb-1">
                {folderResult.folder_name}
              </strong>
              <p className="text-ink-secondary text-[11px]">{folderResult.demo_note}</p>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-edge-subtle">
                <span className="text-ink-tertiary">Files Organized:</span>
                <span className="font-semibold text-ink-primary">{folderResult.files_organized}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-edge-subtle">
                <span className="text-ink-tertiary">Categories:</span>
                <span className="font-semibold text-ink-primary">{folderResult.categories.join(", ")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-edge-subtle">
                <span className="text-ink-tertiary">Shareable URL:</span>
                <a
                  href={folderResult.folder_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-ink-primary underline truncate max-w-[260px]"
                >
                  {folderResult.folder_url}
                </a>
              </div>
            </div>

            <div className="p-3 rounded-input bg-surface-base border border-edge-subtle text-[11px] text-ink-secondary">
              <span className="font-bold text-ink-primary block mb-0.5">Live Integration Setup:</span>
              {folderResult.setup_instructions}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Link
                to={`/case/${caseId}/handover`}
                className="px-4 py-2 bg-ink-primary text-white text-xs font-semibold rounded-btn hover:bg-neutral-800 transition-colors"
              >
                Go to Handover Document →
              </Link>
            </div>
          </div>
        </div>
      )}

      <NextStepFooter
        nextLabel="Explore Unified Work Timeline"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/timeline`}
        currentStep={1}
        totalSteps={5}
      />
    </PageContainer>
  );
}
