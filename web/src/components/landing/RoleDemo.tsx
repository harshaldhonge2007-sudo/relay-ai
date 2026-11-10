import { useState, useCallback } from "react";
import { HANDOVER_ITEMS, DemoRole } from "../../fixtures/sampleCase";

const ROLES: readonly { key: DemoRole; label: string; description: string }[] = [
  { key: "lead", label: "Engineering Lead", description: "Full access — every item visible" },
  { key: "successor", label: "Successor", description: "Operational items visible; confidential sources withheld" },
  { key: "contractor", label: "Contractor", description: "Public items only; withheld items shown as access placeholders" },
];

const BADGE_STYLES: Record<string, string> = {
  verified: "border-white text-white",
  stated: "border-ink-disabled text-ink-disabled",
  inferred: "border-ink-tertiary text-ink-tertiary",
};

interface RoleDemoProps {}

/** Dark section (bg-ink-primary) — alternates with light Product Tour above and light Comparison below. */
export default function RoleDemo(_: RoleDemoProps) {
  const [active, setActive] = useState<DemoRole>("lead");

  const visible = HANDOVER_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(active)
  );
  const withheld = HANDOVER_ITEMS.length - visible.length;

  const selectRole = useCallback((key: DemoRole) => {
    setActive(key);
  }, []);

  return (
    <section
      id="role-demo"
      className="bg-ink-primary text-white"
      aria-labelledby="role-demo-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-tertiary mb-2">
                Role switcher demo
              </p>
              <h2
                id="role-demo-heading"
                className="font-display font-semibold text-white tracking-tight leading-[0.95]"
                style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)" }}
              >
                Same handover, three views
              </h2>
            </div>
          </div>

          <p className="text-xs text-ink-disabled uppercase tracking-widest font-semibold mb-8 max-w-[420px]">
            Illustration with synthetic data. Server-enforced in the demo.
          </p>

          <div role="tablist" aria-label="Demo role" className="flex gap-1 mb-10 border-b border-white/20">
            {ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                role="tab"
                aria-selected={active === role.key}
                onClick={() => selectRole(role.key)}
                className={`-mb-px border-b-2 text-xs font-medium uppercase tracking-widest py-3 px-4 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-t-sm ${
                  active === role.key
                    ? "border-white text-white font-semibold"
                    : "border-transparent text-ink-disabled hover:text-white"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          <div
            className="relative z-10 bg-[#181818] border border-white/10 rounded-card p-8 shadow-card"
            role="region"
            aria-label={`Handover excerpt for ${ROLES.find((r) => r.key === active)?.label}`}
          >
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              <aside className="lg:w-[190px] shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-tertiary mb-2">
                  Visible to {active === "lead" ? "all roles" : active === "successor" ? "lead & successor" : "contractor"}
                </p>
                <p className="text-sm text-ink-disabled leading-relaxed mb-4">
                  {ROLES.find((r) => r.key === active)?.description}
                </p>
              </aside>

              <div className="flex-1">
                {visible.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 mb-4 pb-4 border-b border-white/10 last:border-0 last:pb-0 last:mb-0"
                  >
                    <div className="flex-1 text-sm text-white leading-relaxed">{item.text}</div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-pill border text-[9px] font-medium uppercase tracking-wider whitespace-nowrap font-mono ${BADGE_STYLES[item.provenance] || "border-white/20 text-white"}`}
                      >
                        {item.provenance.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-ink-tertiary font-medium uppercase tracking-wider whitespace-nowrap font-mono">
                        {item.source}
                      </span>
                    </div>
                  </div>
                ))}
                {withheld > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-start gap-3 mb-2 text-sm text-ink-disabled">
                      <span className="flex shrink-0 items-center px-2 py-0.5 rounded-pill border border-white/30 text-[9px] font-medium text-white uppercase tracking-wider whitespace-nowrap font-mono">
                        Withheld
                      </span>
                      <span>Requires elevated role</span>
                    </div>
                    <p className="text-xs font-semibold text-white uppercase tracking-widest">
                      {withheld} item{withheld !== 1 ? "s" : ""} withheld due to access restrictions
                    </p>
                  </div>
                )}
                {visible.length === 0 && (
                  <p className="text-sm text-ink-disabled">No items visible at this role level.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
