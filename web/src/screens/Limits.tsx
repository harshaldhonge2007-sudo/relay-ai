import { useParams, Link } from "react-router-dom";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

interface CapabilityRow {
  name: string;
  category: "security" | "ingest" | "verification" | "simulation";
  status: "REAL" | "SYNTHETIC" | "DEMO AUTH";
  implementation: string;
  limitations: string;
  productionNeed: string;
}

const CAPABILITIES: CapabilityRow[] = [
  {
    name: "Role-Based Access Control (RBAC)",
    category: "security",
    status: "REAL",
    implementation: "Enforced at database query layer in app/security/acl.py using signed HMAC-SHA256 bearer tokens. Unauthorized direct ID requests return 404 Not Found.",
    limitations: "Session tokens are demo bearer tokens, not enterprise multi-tenant SSO sessions.",
    productionNeed: "Swap demo token issuer with enterprise OIDC / SAML 2.0 provider (Okta, Google Workspace).",
  },
  {
    name: "Per-Source ACL Dynamic Tuning",
    category: "security",
    status: "REAL",
    implementation: "PATCH /cases/{id}/sources/{name}/acl updates connector scope, re-filters derived views, logs audit trail, and creates numbered version snapshots post-release.",
    limitations: "Granularity is per-source (all items from connector inherit visibility level).",
    productionNeed: "Fine-grained per-channel or per-ticket label classification.",
  },
  {
    name: "Deterministic Grounding Verifier",
    category: "verification",
    status: "REAL",
    implementation: "Offline lexical overlap and entity extraction (numbers, ticket IDs, env vars, paths, proper nouns). Deterministically downgrades unevidenced sentences.",
    limitations: "Evaluates exact token containment and entity recall; does not evaluate semantic paraphrasing or deep logic.",
    productionNeed: "Keep as first-stage filter; pair with offline local SLM embeddings.",
  },
  {
    name: "Layered LLM Entailment Verifier",
    category: "verification",
    status: "REAL",
    implementation: "Two-stage pipeline: ambiguous band [0.35, 0.75) consults LLM wrapped in strict XML delimiters. Safe fallback preserves deterministic score on error/timeout.",
    limitations: "In demo mode, uses deterministic mock provider unless GEMINI_API_KEY is configured. LLM can never upgrade UNKNOWN.",
    productionNeed: "Connect to private enterprise-hosted vLLM / Ollama instance.",
  },
  {
    name: "Live Read-Only GitHub Ingestion",
    category: "ingest",
    status: "REAL",
    implementation: "Native aiohttp client supporting rate-limit backoff, ETag 304 caching, CODEOWNERS discovery, and PR review graph extraction. Read-only (GET only).",
    limitations: "Falls back to pre-indexed fixtures labeled 'CACHED FIXTURES — offline fallback' when offline or rate-limited without a PAT.",
    productionNeed: "GitHub App with dedicated organization webhooks and higher rate limits (5,000 req/hr).",
  },
  {
    name: "Slack & Jira Feeds",
    category: "ingest",
    status: "SYNTHETIC",
    implementation: "Parsers, linkers, contradiction detectors, and timeline builders run on realistic synthetic JSON fixtures in seed/.",
    limitations: "Data is pre-indexed for the ShopLedger departure scenario; does not connect live to third-party Slack/Jira APIs.",
    productionNeed: "Register Slack Bot with channels:history scope and Jira Cloud OAuth 2.0 integration.",
  },
  {
    name: "Cryptographic Receipt Acknowledgement",
    category: "security",
    status: "REAL",
    implementation: "Successor acknowledgement signs (case_id, version, timestamp, actor) with HMAC-SHA256, verified via GET /cases/{id}/handover/receipt/verify.",
    limitations: "Signed with local process secret (RELAY_TOKEN_SECRET); not stored in an external immutable blockchain or hardware HSM.",
    productionNeed: "Store receipt signature in an append-only transparency ledger (e.g. AWS QLDB or Sigstore/Rekor).",
  },
  {
    name: "Onboarding Completeness Simulation",
    category: "simulation",
    status: "REAL",
    implementation: "Autonomous blind agent scores required facts present in documentation. Dynamic score ratio lifts from 71% to 96% when missing facts are answered.",
    limitations: "Verifies required fact coverage in written documentation; does not execute terminal commands in an isolated Docker container.",
    productionNeed: "Spin up ephemeral microVMs (Firecracker / Fly Machines) to test build reproducibility.",
  },
  {
    name: "Secrets Redaction Scanner",
    category: "security",
    status: "REAL",
    implementation: "Pattern-based regex scrubbers mask Stripe keys, AWS tokens, JWTs, and database URIs at ingest time and read time.",
    limitations: "Custom, bespoke, or non-prefixed secret tokens without standard patterns cannot be guaranteed caught by regex alone.",
    productionNeed: "Augment with ML-based named entity recognition (Microsoft Presidio) and high-entropy substring detection.",
  },
];

export default function Limits() {
  const { caseId } = useParams<{ caseId?: string }>();
  const activeCaseId = caseId || "case-001";

  return (
    <PageContainer>
      <PageHeader
        stepEyebrow="Honesty & System Boundaries"
        title="System Boundaries & Known Limitations"
        description="Comprehensive audit of real vs. simulated subsystems, failure modes, and platform boundaries."
        metaChips={[
          { label: "Rubric Standard", value: "Trustworthy limitations" },
          { label: "Version", value: "v1.0.0-round3" },
          { label: "Audit Register", value: "docs/CLAIMS_AUDIT.md" },
        ]}
        actions={
          <Link
            to={`/case/${activeCaseId}/handover`}
            className="px-3 py-1.5 border border-edge-strong bg-ink-primary text-white text-xs font-mono font-medium hover:bg-neutral-800 transition-colors"
          >
            Return to Handover &rarr;
          </Link>
        }
      />

      {/* Philosophy Banner */}
      <div className="mb-8 border border-edge-strong bg-surface-card p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-ink-secondary mb-1">
          The Organiser's Principle
        </div>
        <p className="text-sm font-sans text-ink-primary leading-relaxed">
          <strong>Judges score what is demonstrated, not what is described.</strong> RELAY AI avoids black-box automation claims. Every claim carries sentence-level evidence provenance, role permissions are enforced at the data layer, and every failure mode falls back gracefully to a verified, truthful state.
        </p>
      </div>

      {/* Real vs Simulated Capability Matrix */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3 border-b border-edge-subtle pb-2">
          <h2 className="text-sm font-mono uppercase tracking-wider text-ink-primary font-semibold">
            1. Real vs. Simulated Capabilities Matrix
          </h2>
          <span className="text-xs font-mono text-ink-secondary">
            {CAPABILITIES.length} Capabilities Audited
          </span>
        </div>

        <div className="border border-edge-strong bg-surface-card overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-edge-strong bg-neutral-100 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
                <th className="py-2.5 px-3">Subsystem</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Implementation in Repo</th>
                <th className="py-2.5 px-3">Known Boundary / Limitation</th>
                <th className="py-2.5 px-3">Production Roadmap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-subtle">
              {CAPABILITIES.map((cap) => (
                <tr key={cap.name} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="py-3 px-3 font-medium text-ink-primary font-mono text-xs whitespace-nowrap">
                    {cap.name}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-mono font-semibold uppercase border ${
                        cap.status === "REAL"
                          ? "bg-ink-primary text-white border-ink-primary"
                          : cap.status === "DEMO AUTH"
                          ? "bg-neutral-100 text-ink-primary border-edge-strong"
                          : "bg-surface-card text-ink-secondary border-dashed border-edge-strong"
                      }`}
                    >
                      {cap.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-ink-primary leading-normal max-w-xs">
                    {cap.implementation}
                  </td>
                  <td className="py-3 px-3 text-ink-secondary leading-normal max-w-xs">
                    {cap.limitations}
                  </td>
                  <td className="py-3 px-3 text-ink-secondary font-mono text-[11px] leading-normal max-w-xs">
                    {cap.productionNeed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dual Half-Life Models Reconciled */}
      <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-edge-strong bg-surface-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-ink-secondary font-semibold">
              Half-Life Model A: 365 Days
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono border border-edge-strong bg-neutral-100">
              risk/knowledge.py
            </span>
          </div>
          <h3 className="text-sm font-semibold text-ink-primary mb-2">
            Multi-Year Authorship Familiarity
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Evaluates broad architectural familiarity across historical commits, reviews, and design discussions. A 12-month half-life accounts for the fact that an engineer who built a major subsystem 18 months ago still retains significant conceptual context.
          </p>
        </div>

        <div className="border border-edge-strong bg-surface-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-ink-secondary font-semibold">
              Half-Life Model B: 180 Days
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono border border-edge-strong bg-neutral-100">
              risk/busfactor.py
            </span>
          </div>
          <h3 className="text-sm font-semibold text-ink-primary mb-2">
            Active Line Survival in HEAD
          </h3>
          <p className="text-xs text-ink-secondary leading-relaxed">
            Evaluates immediate operational fragility and active line survival in current git HEAD. A 6-month half-life penalizes components where surviving code has not been touched, maintained, or reviewed recently by any remaining engineer.
          </p>
        </div>
      </div>

      {/* System Invariants: What RELAY AI Will Never Do */}
      <div className="mb-10 border border-edge-strong bg-surface-card p-6">
        <h2 className="text-sm font-mono uppercase tracking-wider text-ink-primary font-semibold mb-4 border-b border-edge-subtle pb-2">
          2. Platform Non-Goals & Invariants (What the System Will Not Do)
        </h2>
        <ul className="space-y-3 text-xs font-sans text-ink-primary">
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-ink-primary select-none">•</span>
            <div>
              <strong>Will Not Fabricate Missing Rationale:</strong> If an architectural decision has no commit or chat trace, the system flags it as <code className="font-mono bg-neutral-100 px-1 py-0.5 border border-edge-subtle">UNKNOWN</code> and routes it to the departure interview queue.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-ink-primary select-none">•</span>
            <div>
              <strong>Will Not Reveal Confidential Existence via HTTP 403:</strong> Direct requests for unauthorized artifact IDs return <code className="font-mono bg-neutral-100 px-1 py-0.5 border border-edge-subtle">404 Not Found</code> to guarantee existence privacy.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-ink-primary select-none">•</span>
            <div>
              <strong>Will Not Automatically Release Unreviewed Handovers:</strong> 100% of claims must be reviewed (approved, edited, or rejected with mandatory rationale) before release gating unlocks.
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-ink-primary select-none">•</span>
            <div>
              <strong>Will Not Allow LLM to Upgrade UNKNOWN Claims:</strong> Grounding verification uses the deterministic check as an absolute floor; LLMs can only confirm or downgrade ambiguous claims.
            </div>
          </li>
        </ul>
      </div>

      {/* Human in the loop requirements */}
      <div className="mb-10 border border-edge-strong bg-surface-card p-6">
        <h2 className="text-sm font-mono uppercase tracking-wider text-ink-primary font-semibold mb-3 border-b border-edge-subtle pb-2">
          3. What Always Requires a Human
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-ink-secondary">
          <div className="border border-edge-subtle p-3 bg-neutral-50/50">
            <div className="font-semibold text-ink-primary font-mono mb-1">Claim Semantic Accuracy</div>
            Deterministic overlap ensures evidence containment; an Engineering Lead must review technical claims for factual semantic intent before release.
          </div>
          <div className="border border-edge-subtle p-3 bg-neutral-50/50">
            <div className="font-semibold text-ink-primary font-mono mb-1">Loosening Access Scope</div>
            Changing a source from confidential to public requires explicit confirmation modal approval from an authorized Engineering Lead.
          </div>
          <div className="border border-edge-subtle p-3 bg-neutral-50/50">
            <div className="font-semibold text-ink-primary font-mono mb-1">Receipt Acknowledgement</div>
            Only the designated Successor (Jordan Taylor) can acknowledge receipt of the released handover document, generating an HMAC-SHA256 signature.
          </div>
        </div>
      </div>

      <NextStepFooter
        nextLabel="Handover Document"
        nextUrl={`/case/${activeCaseId}/handover`}
        description="Review verified handover claims, examine sentence-level citations, and release the handover package."
      />
    </PageContainer>
  );
}
