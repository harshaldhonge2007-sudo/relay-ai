import { useCallback } from "react";

interface Scenario {
  id: string;
  role: string;
  title: string;
  description: string;
  status: "Available" | "Planned";
  screen?: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "eng-lead",
    role: "Engineering Lead",
    title: "Handing over a production service",
    description:
      "Ingests commits, Slack incident channels, Jira tickets and architecture notes. Surfaces unmerged PRs, undocumented environment variables, active workarounds, and unstated ownership boundaries.",
    status: "Available",
    screen: "knowledge",
  },
  {
    id: "treasurer",
    role: "Student Club Treasurer",
    title: "Handing over club finances & grants",
    description:
      "Reconstructs grant spending, outstanding reimbursements, recurring vendor subscriptions, and bank authorization steps across email threads and spreadsheets.",
    status: "Planned",
  },
  {
    id: "volunteer",
    role: "Volunteer Coordinator",
    title: "Handing over an annual event",
    description:
      "Compiles venue permits, vendor agreements, emergency contact rosters, and shift schedules into an actionable runbook with verification checkmarks.",
    status: "Planned",
  },
];

interface WhoItIsForProps {
  onTryDemo: (screen?: string) => void;
}

/** Light section (bg-surface-base) — sits between dark ProofGrid and dark LimitationsStrip. */
export default function WhoItIsFor({ onTryDemo }: WhoItIsForProps) {
  const tryDemo = useCallback(
    (screen?: string) => () => onTryDemo(screen),
    [onTryDemo]
  );

  return (
    <section
      id="who-it-is-for"
      className="bg-surface-base"
      aria-labelledby="who-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
            Scenarios
          </p>
          <h2
            id="who-heading"
            className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-4"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Who it&apos;s for
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-12 max-w-[560px]">
            Designed for high-consequence departures where forgotten knowledge creates operational risk.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SCENARIOS.map((s) => (
              <div
                key={s.id}
                className="relative z-10 flex flex-col justify-between p-8 rounded-card border border-edge-default bg-surface-card shadow-card"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-secondary">
                      {s.role}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-pill border text-[9px] font-mono uppercase tracking-widest font-semibold ${
                        s.status === "Available"
                          ? "border-edge-strong text-ink-primary bg-surface-base"
                          : "border-edge-default text-ink-tertiary bg-surface-elevated"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-ink-primary mb-3">
                    {s.title}
                  </h3>
                  <p className="text-sm text-ink-secondary leading-relaxed mb-6">
                    {s.description}
                  </p>
                </div>

                <div>
                  {s.status === "Available" ? (
                    <button
                      type="button"
                      onClick={tryDemo(s.screen)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-primary hover:text-ink-secondary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-sm"
                    >
                      Try in sample case<span className="text-ink-tertiary" aria-hidden="true"> →</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-ink-disabled font-mono">
                      No sample bundle · Planned
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

