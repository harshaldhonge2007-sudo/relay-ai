/**
 * HeroVignette — div-based product preview replacing the previous SVG.
 *
 * Shows three evidence claims with fixed provenance badges and a fourth
 * claim being downgraded by the grounding verifier to INFERRED.
 * A legend line explains the three badge labels.
 *
 * Animation: sequential fade-in on non-reduced-motion.
 * Static frame shown under prefers-reduced-motion.
 */

interface Claim {
  text: string;
  badge: "VERIFIED" | "STATED" | "INFERRED";
  cite: string;
}

const CLAIMS: Claim[] = [
  {
    text: "JWT token expires after 15 min, not 2 hours",
    badge: "VERIFIED",
    cite: "GitHub · commit a1b2c3d",
  },
  {
    text: "Currency migration (SL-287) reverted same day",
    badge: "STATED",
    cite: "Interview · Priya Nair exit session",
  },
  {
    text: "Payment system under stress",
    badge: "INFERRED",
    cite: "cross-source correlation",
  },
];

const DOWNGRADED = {
  original: "All incidents resolved",
  newBadge: "INFERRED" as const,
  reason: "Missing critical entity",
};

const BADGE_STYLES: Record<string, string> = {
  VERIFIED:
    "border-ink-primary text-ink-primary",
  STATED:
    "border-ink-secondary text-ink-secondary",
  INFERRED:
    "border-ink-tertiary text-ink-tertiary",
};

function Badge({ label }: { label: "VERIFIED" | "STATED" | "INFERRED" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-pill border text-[9px] font-bold tracking-wider uppercase whitespace-nowrap font-mono ${BADGE_STYLES[label]}`}
    >
      {label}
    </span>
  );
}

export default function HeroVignette() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  return (
    <div
      className="w-full max-w-[420px] select-none"
      role="img"
      aria-label="Product preview: three evidence claims with VERIFIED, STATED and INFERRED provenance badges, followed by the grounding verifier downgrading an unsupported claim to INFERRED with the reason 'Missing critical entity'."
    >
      {/* Legend */}
      <p className="text-[9px] font-mono uppercase tracking-widest text-ink-secondary mb-4" aria-hidden="true">
        VERIFIED — in source · STATED — asserted · INFERRED — correlation
      </p>

      {/* Three fixed claims */}
      <div className="space-y-2" aria-hidden="true">
        {CLAIMS.map((claim, i) => (
          <div
            key={claim.badge}
            className={`flex items-start gap-3 p-3 rounded-card border border-edge-default bg-surface-card ${
              reduced
                ? ""
                : "opacity-0 animate-fadeIn"
            }`}
            style={reduced ? undefined : { animationDelay: `${i * 0.3}s`, animationFillMode: "forwards" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-primary font-medium leading-snug mb-1">
                {claim.text}
              </p>
              <p className="text-[9px] font-mono text-ink-secondary tracking-wide">
                {claim.cite}
              </p>
            </div>
            <Badge label={claim.badge} />
          </div>
        ))}
      </div>

      {/* Grounding verifier — downgrade box */}
      <div
        className={`mt-3 rounded-card border border-edge-strong bg-surface-elevated p-3 ${
          reduced ? "" : "opacity-0 animate-fadeIn"
        }`}
        style={reduced ? undefined : { animationDelay: "1.1s", animationFillMode: "forwards" }}
        aria-hidden="true"
      >
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-ink-secondary mb-2">
          Grounding verifier
        </p>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-ink-secondary line-through leading-snug mb-1">
              {DOWNGRADED.original}
            </p>
            <p className="text-[9px] font-mono text-ink-secondary tracking-wide">
              Reason: {DOWNGRADED.reason}
            </p>
          </div>
          <Badge label={DOWNGRADED.newBadge} />
        </div>
      </div>
    </div>
  );
}
