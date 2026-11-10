import { REPO_URL } from "../../constants";

const LIMITATIONS = [
  {
    title: "Demo authentication has no passwords",
    description: "Role switching is designed for prototype evaluation and uses client-selectable signed tokens, not production-grade identity management.",
  },
  {
    title: "Connectors are fixtures except where stated",
    description: "Sources (GitHub, Slack, Jira) are loaded from static synthetic seed files rather than live cloud API webhooks.",
  },
  {
    title: "Regex redaction can miss novel secrets",
    description: "Pattern-based token and key masking captures standard formats (AWS keys, DB URIs) but may overlook custom or obfuscated tokens.",
  },
  {
    title: "Verifier checks lexical and entity overlap, not semantic meaning",
    description: "Claims are verified against source strings, ticket keys, and code paths deterministically without deep language reasoning.",
  },
  {
    title: "Simulation checks required-fact coverage without running commands",
    description: "The blind-onboarding simulation evaluates whether key facts are present in the handover text; it does not execute terminal commands or runbooks.",
  },
];

/** Dark section (bg-ink-primary) — sits between light WhoItIsFor and light Faq. */
export default function KnownLimitations() {
  return (
    <section
      id="limitations"
      className="bg-ink-primary text-white border-y border-white/10"
      aria-labelledby="limitations-heading"
    >
      <div className="px-4 lg:px-6 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-tertiary mb-2 font-mono">
                System boundaries
              </p>
              <h2
                id="limitations-heading"
                className="font-display font-semibold text-white tracking-tight text-xl sm:text-2xl"
              >
                Known limitations &amp; design scope
              </h2>
            </div>
            <a
              href={`${REPO_URL}/blob/main/README.md#limitations`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-white underline underline-offset-4 hover:text-ink-disabled transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm"
            >
              Read full limitations in README →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LIMITATIONS.map((lim, idx) => (
              <div
                key={lim.title}
                className="relative z-10 p-5 rounded-card bg-[#181818] border border-white/10 shadow-card"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] text-ink-tertiary font-bold">
                    0{idx + 1}
                  </span>
                  <h3 className="text-xs font-semibold text-white leading-snug">
                    {lim.title}
                  </h3>
                </div>
                <p className="text-xs text-ink-disabled leading-relaxed">
                  {lim.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

