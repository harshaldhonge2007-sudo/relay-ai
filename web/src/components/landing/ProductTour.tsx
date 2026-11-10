/**
 * ProductTour — tabbed browser-frame component (light section).
 *
 * Screenshots are not generated here: they require a running app instance
 * and Playwright. Placeholders are used instead.
 *
 * To capture real screenshots, run:
 *   npx playwright screenshot --viewport-size=1280,800 \
 *     http://localhost:5173/case/<DEMO_ID>/findings \
 *     web/public/tour/findings.webp
 *
 * Required screens and recommended viewport (1280 × 800, 2× devicePixelRatio):
 *  1. findings.webp    — Uncertainty & conflicts view
 *  2. knowledge.webp   — Knowledge Radar with evidence drawer open
 *  3. handover.webp    — Review screen with version diff visible
 *  4. role-view.webp   — Knowledge Radar as Contractor (withheld items shown)
 *  5. completeness.webp — Completeness score after two interview answers
 *
 * Drop the WebP files into web/public/tour/ and replace the placeholder <div>s
 * with <img> tags (lazy, explicit width/height, descriptive alt).
 */
import { useState, useCallback } from "react";

const TABS = [
  {
    id: "findings",
    label: "Uncertainty & conflicts",
    description:
      "Two Jira tickets marked Done contradict Slack evidence from the same evening. The conflict is shown — not resolved silently.",
    screenshotPath: "/tour/findings.webp",
    alt: "Findings screen showing two contradictions: SL-234 JWT expiry and SL-287 migration revert, each with linked source snippets and severity scores.",
    width: 1280,
    height: 800,
  },
  {
    id: "knowledge",
    label: "Evidence drawer",
    description:
      "Every claim links to its source. Click any item on the Knowledge Radar to open the evidence drawer with the exact snippet and commit SHA.",
    screenshotPath: "/tour/knowledge.webp",
    alt: "Knowledge Radar with an evidence drawer open on the right, showing commit a1b2c3d, the source file path, and provenance badge VERIFIED.",
    width: 1280,
    height: 800,
  },
  {
    id: "handover",
    label: "Review with version diff",
    description:
      "The engineering lead approves, edits or rejects every claim. The version diff shows exactly what changed between v1 and v2.",
    screenshotPath: "/tour/handover.webp",
    alt: "Handover review screen showing a diff between version 1 and version 2, with a rejected claim reason visible.",
    width: 1280,
    height: 800,
  },
  {
    id: "role-view",
    label: "Role view — withheld items",
    description:
      "Switch to the Contractor role: restricted items are replaced with withheld-item notices. The server never sends the restricted content.",
    screenshotPath: "/tour/role-view.webp",
    alt: "Knowledge Radar in Contractor role showing two withheld-item placeholders where confidential sources would appear.",
    width: 1280,
    height: 800,
  },
  {
    id: "completeness",
    label: "Completeness score",
    description:
      "The blind-onboarding simulation starts at 52 %. Two targeted interview questions close the gap to 87 %.",
    screenshotPath: "/tour/completeness.webp",
    alt: "Completeness test screen showing a progress bar at 87%, two answered interview questions, and a list of covered required facts.",
    width: 1280,
    height: 800,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ProductTourProps {
  onTryDemo: (screen?: string) => void;
}

/** Light section (bg-surface-base). */
export default function ProductTour({ onTryDemo }: ProductTourProps) {
  const [activeId, setActiveId] = useState<TabId>("findings");
  const tryDemo = useCallback((screen: string) => () => onTryDemo(screen), [onTryDemo]);

  const tab = TABS.find((t) => t.id === activeId)!;

  return (
    <section
      id="product-tour"
      className="bg-surface-base"
      aria-labelledby="product-tour-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
            Product tour
          </p>
          <h2
            id="product-tour-heading"
            className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-4"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Five screens, one sample case
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-12 max-w-[560px]">
            All screens run on the synthetic ShopLedger sample case. No real
            organisational data.
          </p>

          {/* Tab list */}
          <div
            role="tablist"
            aria-label="Product tour screens"
            className="flex flex-wrap gap-1 mb-8 border-b border-edge-default"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeId === t.id}
                aria-controls={`tour-panel-${t.id}`}
                id={`tour-tab-${t.id}`}
                onClick={() => setActiveId(t.id as TabId)}
                className={`-mb-px border-b-2 text-xs font-medium uppercase tracking-widest py-3 px-4 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-t-sm ${
                  activeId === t.id
                    ? "border-ink-primary text-ink-primary"
                    : "border-transparent text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab panel */}
          <div
            id={`tour-panel-${activeId}`}
            role="tabpanel"
            aria-labelledby={`tour-tab-${activeId}`}
            tabIndex={0}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-primary"
          >
            <p className="text-sm text-ink-secondary leading-relaxed mb-6 max-w-[560px]">
              {tab.description}
            </p>

            {/* Browser frame */}
            <div className="relative z-10 rounded-card border border-edge-default overflow-hidden shadow-card bg-surface-card">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-edge-default bg-surface-elevated">
                <span className="w-3 h-3 rounded-full border border-edge-strong bg-surface-base" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full border border-edge-strong bg-surface-base" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full border border-edge-strong bg-surface-base" aria-hidden="true" />
                <span className="ml-3 flex-1 h-5 rounded-pill bg-surface-base border border-edge-default text-[9px] font-mono text-ink-secondary flex items-center px-3 select-none">
                  relay · {tab.id}
                </span>
              </div>

              {/* Screenshot or placeholder */}
              <div className="relative w-full" style={{ aspectRatio: "1280/800" }}>
                {/* PLACEHOLDER — replace with real screenshot once generated */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-surface-elevated text-center px-8"
                  aria-label={tab.alt}
                >
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-secondary mb-2">
                    Screenshot placeholder
                  </p>
                  <p className="text-xs text-ink-secondary max-w-[400px] leading-relaxed mb-4">
                    {tab.alt}
                  </p>
                  <p className="text-[9px] font-mono text-ink-tertiary uppercase tracking-widest">
                    Capture: {tab.screenshotPath} · {tab.width}×{tab.height}
                  </p>
                  <button
                    type="button"
                    onClick={tryDemo(tab.id)}
                    className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-btn border border-edge-strong text-ink-primary bg-transparent hover:bg-surface-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200"
                  >
                    Open live in demo<span className="text-ink-tertiary" aria-hidden="true"> →</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[9px] font-mono uppercase tracking-widest text-ink-secondary">
              Synthetic sample case · Screenshots to be generated with Playwright once the demo server is running
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

