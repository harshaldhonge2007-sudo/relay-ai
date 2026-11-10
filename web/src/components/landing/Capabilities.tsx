import { useCallback } from "react";

interface Capability {
  id: string;
  title: string;
  description: string;
  tags: string[];
  ariaLabel: string;
  screen: string;
}

const CAPABILITIES: Capability[] = [
  {
    id: "traceable",
    title: "Traceable",
    description:
      "Every claim carries a provenance tag — VERIFIED, STATED or INFERRED — and links to its source. Click any claim to open the evidence drawer with the exact snippet and commit SHA. Every edit, approval and rejection is tracked in version history.",
    tags: ["Evidence drawer", "Provenance badges", "Citations", "Version history"],
    ariaLabel: "See traceability — open findings in the demo",
    screen: "findings",
  },
  {
    id: "actionable",
    title: "Actionable",
    description:
      "A first 5 days plan, decision log, key contacts, ownership and risks. The successor receives a sequential checklist of what to do, who owns it and what could go wrong — starting on day one.",
    tags: ["Decision log", "Key contacts", "First 5 days plan", "Ownership & risks"],
    ariaLabel: "See the actionable handover — open handover doc in the demo",
    screen: "handover",
  },
  {
    id: "permission-aware",
    title: "Permission-aware",
    description:
      "Roles control what is visible, with per-source access levels, withheld notices and redaction. Enforcement runs server-side: the client never sees restricted titles, only aggregate withheld counts. Demo authentication is not production auth.",
    tags: ["Roles", "Per-source access", "Withheld notices", "Redaction"],
    ariaLabel: "See permission-aware views — open knowledge radar in the demo",
    screen: "knowledge",
  },
  {
    id: "tested",
    title: "Tested",
    description:
      "A blind-onboarding simulation checks whether the successor can operate from the handover doc alone. Completeness score = found fact weight ÷ total required weight. Missing facts feed a fix-missing-facts loop of targeted interview questions.",
    tags: ["Blind-onboarding simulation", "Completeness formula", "Fix-missing-facts loop"],
    ariaLabel: "See the completeness test in the demo",
    screen: "completeness",
  },
];

interface CapabilitiesProps {
  onTryDemo: (screen?: string) => void;
}

/** NOW DARK (bg-ink-primary) — alternates with light Method above. Tags always visible. */
export default function Capabilities({ onTryDemo }: CapabilitiesProps) {
  const tryDemo = useCallback((screen: string) => () => onTryDemo(screen), [onTryDemo]);

  return (
    <section
      id="capabilities"
      className="bg-ink-primary"
      aria-labelledby="capabilities-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-14">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-tertiary mb-2">
                Capabilities
              </p>
              <h2
                id="capabilities-heading"
                className="font-display font-semibold text-white tracking-tight leading-[0.95]"
                style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
              >
                Four capabilities, nothing extra
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap) => (
              <article
                key={cap.id}
                className="relative z-10 bg-[#181818] border border-white/10 rounded-card p-8 hover:bg-[#202020] hover:border-white/30 hover:-translate-y-1 transition-all duration-300 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white shadow-card"
              >
                <div className="flex items-center gap-2 mb-6">
                  <span className="flex shrink-0 items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-bold text-ink-primary">
                    {CAPABILITIES.indexOf(cap) + 1}
                  </span>
                  <h3 className="text-base font-semibold text-white">{cap.title}</h3>
                </div>
                <p className="text-sm text-ink-disabled leading-relaxed mb-6">
                  {cap.description}
                </p>

                {/* Tags — always visible (not hover-only) */}
                <ul className="flex flex-wrap gap-2 mb-6" aria-label={`${cap.title} features`}>
                  {cap.tags.map((tag) => (
                    <li
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-pill border border-white/20 text-[10px] font-medium text-ink-disabled bg-transparent"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={tryDemo(cap.screen)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-ink-disabled transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm"
                  aria-label={cap.ariaLabel}
                >
                  See it in the demo<span className="text-ink-tertiary" aria-hidden="true"> →</span>
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
