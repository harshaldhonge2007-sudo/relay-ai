import { ProvenanceBadge } from "../ui/ProvenanceBadge";

interface Claim {
  text: string;
  badge: "verified" | "stated" | "inferred";
  cite: string;
}

const CLAIMS: Claim[] = [
  {
    text: "JWT token expires after 15 min, not 2 hours",
    badge: "verified",
    cite: "GitHub · commit a1b2c3d (surviving line)",
  },
  {
    text: "Currency migration (SL-287) reverted same day",
    badge: "stated",
    cite: "Interview · Priya Nair exit session",
  },
  {
    text: "Webhook retry edge latency under high concurrency",
    badge: "inferred",
    cite: "PR review graph correlation",
  },
];

const DOWNGRADED = {
  original: "All payment webhook incidents permanently resolved",
  newBadge: "inferred" as const,
  reason: "Missing primary commit evidence · Downgraded by verifier",
};

export default function HeroVignette() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  return (
    <div
      className="w-full max-w-[420px] select-none"
      role="img"
      aria-label="Product preview: three evidence claims with VERIFIED, STATED and INFERRED provenance badges, followed by the grounding verifier downgrading an unsupported claim to INFERRED."
    >
      {/* 3 Legend Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4" aria-hidden="true">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-pill border border-edge-dark bg-surface-base text-[9px] font-mono text-ink-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-primary" />
          <span className="font-semibold">VERIFIED</span>
          <span className="text-ink-secondary">in source</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-pill border border-edge-strong bg-surface-base text-[9px] font-mono text-ink-primary">
          <span className="h-1.5 w-1.5 rotate-45 bg-ink-secondary" />
          <span className="font-semibold">STATED</span>
          <span className="text-ink-secondary">interview</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-pill border border-dashed border-edge-strong bg-surface-base text-[9px] font-mono text-ink-secondary">
          <span className="h-1.5 w-1.5 border border-ink-secondary" />
          <span className="font-semibold">INFERRED</span>
          <span className="text-ink-secondary">correlation</span>
        </div>
      </div>

      {/* Three fixed claims */}
      <div className="space-y-2.5" aria-hidden="true">
        {CLAIMS.map((claim, i) => (
          <div
            key={claim.badge}
            className={`flex items-start gap-3 p-3.5 rounded-card border border-edge-default bg-surface-card shadow-sm ${
              reduced ? "" : "opacity-0 animate-fadeIn"
            }`}
            style={reduced ? undefined : { animationDelay: `${i * 0.25}s`, animationFillMode: "forwards" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-primary font-semibold leading-snug mb-1">
                {claim.text}
              </p>
              <p className="text-[10px] font-mono text-ink-secondary tracking-wide">
                {claim.cite}
              </p>
            </div>
            <ProvenanceBadge type={claim.badge} />
          </div>
        ))}
      </div>

      {/* Grounding verifier — downgrade box */}
      <div
        className={`mt-3 rounded-card border border-edge-strong bg-surface-base p-3.5 shadow-sm ${
          reduced ? "" : "opacity-0 animate-fadeIn"
        }`}
        style={reduced ? undefined : { animationDelay: "1.0s", animationFillMode: "forwards" }}
        aria-hidden="true"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-primary">
            Grounding Verifier
          </p>
          <span className="text-[9px] font-mono uppercase bg-ink-primary text-white px-1.5 py-0.2 rounded font-semibold">
            Auto Downgrade
          </span>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-ink-tertiary line-through leading-snug mb-1">
              {DOWNGRADED.original}
            </p>
            <p className="text-[10px] font-mono text-ink-primary tracking-wide font-medium">
              {DOWNGRADED.reason}
            </p>
          </div>
          <ProvenanceBadge type={DOWNGRADED.newBadge} />
        </div>
      </div>
    </div>
  );
}
