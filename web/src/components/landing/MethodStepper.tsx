import { useState, useCallback } from "react";

const STEPS = [
  {
    id: "connect",
    title: "Connect",
    description:
      "Ingests GitHub, Slack, Jira, docs and meeting notes from authorised connectors. Identities are deduplicated across sources, so knowledge is attributed to people, not accounts.",
    illustration: (
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <line x1="30" y1="120" x2="75" y2="50" stroke="#555555" strokeWidth="1.5" />
        <line x1="75" y1="50" x2="120" y2="120" stroke="#555555" strokeWidth="1.5" />
        <line x1="30" y1="120" x2="120" y2="120" stroke="#111111" strokeWidth="1.5" />
        <circle cx="30" cy="120" r="6" fill="#111111" />
        <circle cx="75" cy="50" r="6" fill="#555555" />
        <circle cx="120" cy="120" r="6" fill="#111111" />
      </svg>
    ),
  },
  {
    id: "reconstruct",
    title: "Reconstruct",
    description:
      "Builds a time-decayed knowledge map: who touched what, when, and how critically. Surfaces concentration risk when one person holds most of the context.",
    illustration: (
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <rect x="42" y="90" width="22" height="42" rx="3" fill="#111111" />
        <rect x="64" y="62" width="22" height="70" rx="3" fill="#555555" />
        <rect x="86" y="40" width="22" height="92" rx="3" fill="#888888" />
      </svg>
    ),
  },
  {
    id: "verify",
    title: "Verify",
    description:
      "Runs a deterministic grounding verifier — offline lexical and entity overlap against sources. Claims are tagged VERIFIED / STATED / INFERRED. Unsupported claims are downgraded, never invented away.",
    illustration: (
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <rect x="20" y="50" width="110" height="20" rx="4" fill="#111111" />
        <rect x="20" y="80" width="80" height="20" rx="4" fill="#555555" />
        <rect x="20" y="110" width="45" height="20" rx="4" fill="#888888" />
      </svg>
    ),
  },
  {
    id: "review",
    title: "Review",
    description:
      "The engineering lead approves, rejects (with a mandatory reason) or edits every claim. Release is gated until review is complete, and every change is tracked in immutable version history.",
    illustration: (
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <rect x="40" y="45" width="34" height="60" rx="4" fill="none" stroke="#111111" strokeWidth="1.5" />
        <rect x="40" y="45" width="34" height="10" rx="2" fill="#111111" />
        <path d="M54 75l-8 8 -6-6" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="72" cy="105" r="8" fill="#555555" />
      </svg>
    ),
  },
  {
    id: "handover",
    title: "Handover",
    description:
      "First 5 days plan, decision log, key contacts and a successor receipt acknowledgement. A blind-onboarding simulation confirms the successor can operate from the handover doc alone.",
    illustration: (
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <rect x="34" y="40" width="82" height="90" rx="6" fill="none" stroke="#111111" strokeWidth="1.5" />
        <rect x="34" y="40" width="82" height="14" rx="2" fill="#111111" />
        <line x1="50" y1="64" x2="106" y2="64" stroke="#555555" strokeWidth="1.5" />
        <line x1="50" y1="82" x2="90" y2="82" stroke="#888888" strokeWidth="1.5" />
        <circle cx="62" cy="104" r="6" fill="#111111" />
      </svg>
    ),
  },
];

/** NOW LIGHT (bg-surface-base) — alternates with dark Manifesto above it. */
export default function MethodStepper() {
  const [activeId, setActiveId] = useState(STEPS[0].id);
  const [openId, setOpenId] = useState<string | null>(null);

  const step = STEPS.find((s) => s.id === activeId)!;

  const selectStep = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const detail = (s: typeof STEPS[number]) => (
    <div className="pt-4">
      <p className="text-sm text-ink-secondary leading-relaxed max-w-[460px] mb-4">
        {s.description}
      </p>
      <div className="w-full h-44 flex items-center justify-center">{s.illustration}</div>
    </div>
  );

  return (
    <section
      id="method"
      className="bg-surface-base"
      aria-labelledby="method-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          {/* Desktop: sticky heading + stepper side by side */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-12">
            {/* Sticky heading column — works because page wrapper uses overflow-x:clip not overflow-x:hidden */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 self-start">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-3">
                Method
              </p>
              <h2
                id="method-heading"
                className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-8 sm:mb-10"
                style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
              >
                We don&apos;t hope the handover works. We test it.
              </h2>
              <p className="text-sm text-ink-secondary leading-relaxed mb-8 max-w-[420px]">
                Each step below is a real stage of the demo case. Click a step
                to see what it does and how it is illustrated in the product.
              </p>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-secondary mb-2">
                    How the verification works
                  </p>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    Offline, deterministic lexical and entity overlap against the
                    connected sources — numbers, ticket IDs, code paths and proper
                    nouns. An optional model check runs only when available and
                    never overrides the deterministic result. Unsupported claims
                    are downgraded to INFERRED with a reason, not hidden.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-secondary mb-2">
                    Built for the person inheriting
                  </p>
                  <p className="text-sm text-ink-secondary leading-relaxed">
                    A first 5 days plan, a decision log and key contacts give the
                    successor something to act on from day one. The handover is
                    released only after human review, and the successor formally
                    acknowledges receipt.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 mt-10 lg:mt-0">
              <div className="flex flex-col gap-2 mb-8">
                {STEPS.map((s) => {
                  const isActive = activeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectStep(s.id)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-4 px-4 py-3 text-left rounded-btn transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary ${
                        isActive
                          ? "bg-ink-primary text-white border border-ink-primary font-semibold"
                          : "text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary border border-transparent"
                      }`}
                    >
                      <span
                        className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${
                          isActive
                            ? "border-white bg-white text-ink-primary"
                            : "border-edge-strong text-ink-secondary"
                        }`}
                      >
                        {STEPS.indexOf(s) + 1}
                      </span>
                      <span className="text-sm font-medium">{s.title}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative z-10 bg-surface-card border border-edge-default rounded-card p-8 shadow-card">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-white bg-ink-primary text-[11px] font-bold">
                    {STEPS.indexOf(step) + 1}
                  </span>
                  <div>{detail(step)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: accordion */}
          <div className="lg:hidden">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-3">
              Method
            </p>
            <h2
              id="method-heading-mobile"
              className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-8"
              style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
            >
              We don&apos;t hope the handover works. We test it.
            </h2>
            <div className="space-y-1">
              {STEPS.map((s) => (
                <div key={s.id} className="border border-edge-default rounded-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    aria-expanded={openId === s.id}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary"
                  >
                    <span className="flex items-center gap-3">
                      <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border border-edge-strong text-ink-secondary">
                        {STEPS.indexOf(s) + 1}
                      </span>
                      {s.title}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-200 shrink-0 ${openId === s.id ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <polyline points="4 7 8 11 12 7" />
                    </svg>
                  </button>
                  {openId === s.id && (
                    <div className="bg-surface-elevated border-t border-edge-default px-4 pb-4">
                      {detail(s)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
