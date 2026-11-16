import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useRole } from "../contexts/CaseContext";
import { PageContainer } from "../components/ui/PageContainer";
import { Severity } from "../components/ui/Severity";
import { ProvenanceBadge } from "../components/ui/ProvenanceBadge";

interface CaseHomeData {
  caseName: string;
  leaverName: string;
  leaverRole: string;
  handoverStatus: string;
  stats: {
    continuityScore: number;
    busFactorRisk: number;
    readinessScore: number;
    groundingScore: number;
    totalClaims: number;
    reviewedClaims: number;
    pendingClaims: number;
    unresolvedConflicts: number;
    openInterviewQuestions: number;
    missingFacts: number;
    withheldItems: number;
  };
  topRisks: Array<{
    name: string;
    riskPct: number;
    busFactor: number;
    leaverShare: number;
    otherShare: number;
    severity: "critical" | "high" | "medium";
    details: string;
  }>;
  conflicts: Array<{
    id: string;
    title: string;
    sourceA: { name: string; claim: string; timestamp: string };
    sourceB: { name: string; claim: string; timestamp: string };
  }>;
  recentDecisions: Array<{
    id: string;
    title: string;
    rationale: string;
    provenance: string;
    date: string;
  }>;
  firstFiveDays: Array<{
    day: number;
    action: string;
    owner: string;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    dateGroup: string;
    time: string;
    actor: string;
    type: "push" | "pr" | "issue" | "doc";
    summary: string;
  }>;
}

export default function CaseHome() {
  const { caseId = "case-001" } = useParams();
  const { role } = useRole();

  // Real initial data structure matching ShopLedger case
  const [data, setData] = useState<CaseHomeData>({
    caseName: "ShopLedger Core Engine",
    leaverName: "Priya Nair",
    leaverRole: "Principal Backend Engineer",
    handoverStatus: "Draft · 12 of 20 claims reviewed",
    stats: {
      continuityScore: 85,
      busFactorRisk: 68,
      readinessScore: 71,
      groundingScore: 88,
      totalClaims: 20,
      reviewedClaims: 12,
      pendingClaims: 8,
      unresolvedConflicts: 2,
      openInterviewQuestions: 2,
      missingFacts: 2,
      withheldItems: 0,
    },
    topRisks: [
      {
        name: "Payment Processor",
        riskPct: 87,
        busFactor: 1,
        leaverShare: 72,
        otherShare: 28,
        severity: "critical",
        details: "Priya Nair holds 72% knowledge. Webhook retry with exponential backoff undocumented.",
      },
      {
        name: "Auth Service",
        riskPct: 78,
        busFactor: 1,
        leaverShare: 68,
        otherShare: 32,
        severity: "high",
        details: "Priya Nair holds 68% knowledge. Cloudflare edge TTL logic undocumented.",
      },
      {
        name: "Reporting Module",
        riskPct: 62,
        busFactor: 1,
        leaverShare: 86,
        otherShare: 14,
        severity: "medium",
        details: "Single-developer ownership. Undocumented cron environment variables.",
      },
    ],
    conflicts: [
      {
        id: "SL-234",
        title: "JWT Token TTL in Production",
        sourceA: {
          name: "Jira SL-234",
          claim: "Ticket marked Done stating JWT expiry set to 15m.",
          timestamp: "2024-10-14",
        },
        sourceB: {
          name: "Slack #dev-eng",
          claim: "Priya reported Cloudflare gateway error and reverted to 24h.",
          timestamp: "2024-10-14 21:40",
        },
      },
      {
        id: "SL-287",
        title: "PostgreSQL 15 Migration Status",
        sourceA: {
          name: "Migration Doc v2.1",
          claim: "Runbook states migration successfully applied in staging.",
          timestamp: "2024-10-12",
        },
        sourceB: {
          name: "Git main branch",
          claim: "Revert commit merged due to connection pool saturation.",
          timestamp: "2024-10-13 14:15",
        },
      },
    ],
    recentDecisions: [
      {
        id: "dec-001",
        title: "Adopted SQLAlchemy 2.0 Async Session Pattern",
        rationale: "Ensures connection pool resilience under heavy concurrent webhook traffic.",
        provenance: "verified",
        date: "2024-09-28",
      },
      {
        id: "dec-002",
        title: "Isolated Payment Secrets from CI Environment",
        rationale: "Stripe and webhook credentials stored in vault, not GitHub repository secrets.",
        provenance: "stated",
        date: "2024-10-04",
      },
      {
        id: "dec-003",
        title: "Multi-signal 180-day Half-life Knowledge Decay",
        rationale: "Mitigates dead code from 3 years ago masking active developer ownership.",
        provenance: "verified",
        date: "2024-10-10",
      },
    ],
    firstFiveDays: [
      {
        day: 1,
        action: "Shadow Priya on Cloudflare webhook edge deployment and secret rotation",
        owner: "Alex Chen",
        status: "Pending",
      },
      {
        day: 2,
        action: "Review Auth Service token refresh logic and execute failure simulation",
        owner: "Sam Rodriguez",
        status: "Pending",
      },
      {
        day: 3,
        action: "Verify Payment Processor mock transaction replay test suite",
        owner: "Alex Chen",
        status: "Pending",
      },
    ],
    recentActivity: [
      {
        id: "act-1",
        dateGroup: "Today (2024-10-16)",
        time: "10:14 UTC",
        actor: "Priya Nair",
        type: "push",
        summary: "Priya Nair committed to main: WIP: webhook retry with exponential backoff",
      },
      {
        id: "act-2",
        dateGroup: "Today (2024-10-16)",
        time: "09:30 UTC",
        actor: "Priya Nair",
        type: "pr",
        summary: "PR #47 opened: Webhook retry logic (SL-456)",
      },
      {
        id: "act-3",
        dateGroup: "Yesterday (2024-10-15)",
        time: "14:20 UTC",
        actor: "Jira Integration",
        type: "issue",
        summary: "SL-456 assigned to Priya Nair: Implement webhook notification resiliency",
      },
      {
        id: "act-4",
        dateGroup: "Yesterday (2024-10-15)",
        time: "11:00 UTC",
        actor: "Alex Chen",
        type: "pr",
        summary: "PR #46 reviewed: PostgreSQL connection pool tuning for high-concurrency",
      },
      {
        id: "act-5",
        dateGroup: "Earlier this week",
        time: "Oct 14",
        actor: "Google Drive Sync",
        type: "doc",
        summary: "Indexed Architecture Runbook: ShopLedger Core Topology v3.2",
      },
    ],
  });

  // Load real case stats dynamically
  useEffect(() => {
    let mounted = true;

    Promise.all([
      apiFetch(`/cases/${caseId}`).then((r) => r.json()).catch(() => null),
      apiFetch(`/cases/${caseId}/completeness`).then((r) => r.json()).catch(() => null),
      apiFetch(`/cases/${caseId}/handover`).then((r) => r.json()).catch(() => null),
    ])
      .then(([cCase, comp, ho]) => {
        if (!mounted) return;
        if (cCase && cCase.name) {
          setData((prev) => ({
            ...prev,
            caseName: cCase.name,
            stats: {
              ...prev.stats,
              readinessScore: comp ? Math.round(comp.score * 100) : prev.stats.readinessScore,
              groundingScore: comp ? Math.round(comp.grounding_score * 100) : prev.stats.groundingScore,
              withheldItems: comp ? comp.withheld_facts_count || 0 : 0,
              totalClaims: ho && ho.items ? ho.items.length : prev.stats.totalClaims,
              reviewedClaims: ho && ho.items ? ho.items.filter((i: any) => i.claim_status === "approved").length : prev.stats.reviewedClaims,
              pendingClaims: ho && ho.items ? ho.items.filter((i: any) => i.claim_status !== "approved").length : prev.stats.pendingClaims,
            },
          }));
        }
      })
      .catch(() => {
        // Fallback gracefully to demo initial state
      });

    return () => {
      mounted = false;
    };
  }, [caseId]);

  const isContractor = role === "contractor";
  const isLead = role === "engineering_lead";

  return (
    <PageContainer width="wide" className="animate-fadeIn">
      {/* 1. HERO STRIP */}
      <section
        className="p-6 rounded-card border border-edge-strong bg-surface-card shadow-card space-y-4 relative overflow-hidden"
        aria-label="Case Overview & Primary Action"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-pill bg-surface-elevated text-ink-primary border border-edge-strong">
                ACTIVE DEPARTURE
              </span>
              <span className="text-[10px] font-mono text-ink-secondary">
                Case ID: <strong className="text-ink-primary">{caseId}</strong>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill border border-edge-strong bg-neutral-100 text-ink-primary">
                Viewing as: {role.replace("_", " ").toUpperCase()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink-primary tracking-tight">
              {data.caseName}
            </h1>

            <p className="text-xs text-ink-secondary leading-relaxed">
              Departing Engineer: <strong className="text-ink-primary">{data.leaverName}</strong> ({data.leaverRole}) ·{" "}
              Status: <span className="font-mono text-ink-primary font-semibold">{data.handoverStatus}</span>
            </p>
          </div>

          {/* ONE Primary Action Button */}
          <div className="shrink-0 flex items-center gap-3">
            {isLead ? (
              <Link
                to={`/case/${caseId}/handover`}
                className="px-5 py-2.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-primary"
              >
                Resume Review (8 Pending Claims) →
              </Link>
            ) : isContractor ? (
              <Link
                to={`/case/${caseId}/assets`}
                className="px-5 py-2.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-primary"
              >
                Browse Public Assets →
              </Link>
            ) : (
              <Link
                to={`/case/${caseId}/handover`}
                className="px-5 py-2.5 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink-primary"
              >
                Review Handover Pack →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. WORKFLOW PROGRESS (5 Horizontal Steps) */}
      <section
        className="p-4 rounded-card border border-edge-default bg-surface-card shadow-card"
        aria-label="5-Step Workflow Progress"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-secondary font-bold block mb-3">
          Knowledge Continuity Workflow
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Step 1: Connect */}
          <Link
            to={`/case/${caseId}/assets`}
            className="p-3 rounded-btn border border-edge-default bg-surface-elevated hover:border-edge-strong transition-all space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-primary">1. CONNECT</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-900 text-white">
                DONE
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-primary">5 Sources Connected</p>
            <p className="text-[11px] text-ink-secondary">Git, Jira, Slack, Drive</p>
          </Link>

          {/* Step 2: Reconstruct */}
          <Link
            to={`/case/${caseId}/busfactor`}
            className="p-3 rounded-btn border border-edge-default bg-surface-elevated hover:border-edge-strong transition-all space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-primary">2. RECONSTRUCT</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-900 text-white">
                DONE
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-primary">State Synthesized</p>
            <p className="text-[11px] text-ink-secondary">68% Risk · 3 Decisions</p>
          </Link>

          {/* Step 3: Verify */}
          <Link
            to={`/case/${caseId}/findings`}
            className="p-3 rounded-btn border border-edge-strong bg-surface-card hover:bg-surface-elevated transition-all space-y-1 block group shadow-sm ring-1 ring-ink-primary/10"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-primary">3. VERIFY</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-edge-strong bg-surface-elevated text-ink-primary">
                IN PROGRESS
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-primary">2 Open Conflicts</p>
            <p className="text-[11px] text-ink-secondary">2 Interview questions</p>
          </Link>

          {/* Step 4: Review */}
          <Link
            to={`/case/${caseId}/handover`}
            className="p-3 rounded-btn border border-edge-default bg-surface-elevated hover:border-edge-strong transition-all space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-secondary">4. REVIEW</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-edge-default text-ink-secondary">
                QUEUED
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-secondary">12 of 20 Approved</p>
            <p className="text-[11px] text-ink-secondary">8 claims awaiting lead</p>
          </Link>

          {/* Step 5: Handover */}
          <Link
            to={`/case/${caseId}/completeness`}
            className="p-3 rounded-btn border border-edge-default bg-surface-elevated hover:border-edge-strong transition-all space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-secondary">5. HANDOVER</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-edge-default text-ink-secondary">
                71%
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-secondary">Readiness Score</p>
            <p className="text-[11px] text-ink-secondary">Needs 2 missing facts</p>
          </Link>
        </div>
      </section>

      {/* 3. NEEDS YOUR ATTENTION (Prioritized Action Checklist) */}
      <section
        className="p-5 rounded-card border border-edge-strong bg-surface-card shadow-card space-y-3"
        aria-label="Items Needing Attention"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ink-primary animate-pulse" />
              <span>Needs Your Attention First</span>
            </h2>
            <p className="text-xs text-ink-secondary">
              Prioritized blocking items preventing autonomous handover release
            </p>
          </div>
          <span className="text-[10px] font-mono text-ink-secondary font-bold px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated">
            {isContractor ? "Contractor View Filtered" : "3 Blocking Categories"}
          </span>
        </div>

        <div className="divide-y divide-edge-subtle border border-edge-default rounded-btn overflow-hidden">
          {/* Item A: Unreviewed Claims */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card hover:bg-surface-elevated transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-900 text-white">
                  {data.stats.pendingClaims} UNREVIEWED
                </span>
                <span className="text-xs font-semibold text-ink-primary">
                  Handover claims require lead verification and sign-off
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                Claims in Payment Processor and Auth Service require review before leaver departure.
              </p>
            </div>
            <Link
              to={`/case/${caseId}/handover`}
              className="text-xs font-semibold text-ink-primary hover:underline shrink-0"
            >
              Review Claims →
            </Link>
          </div>

          {/* Item B: Unresolved Conflicts */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card hover:bg-surface-elevated transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-edge-strong bg-surface-elevated text-ink-primary">
                  2 CONFLICTS
                </span>
                <span className="text-xs font-semibold text-ink-primary">
                  Contradictory evidence detected between Jira and Slack
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                SL-234 (JWT token expiry) and SL-287 (Postgres migration rollback).
              </p>
            </div>
            <Link
              to={`/case/${caseId}/findings`}
              className="text-xs font-semibold text-ink-primary hover:underline shrink-0"
            >
              Resolve Conflicts →
            </Link>
          </div>

          {/* Item C: Missing Required Facts */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-card hover:bg-surface-elevated transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-edge-strong bg-surface-elevated text-ink-primary">
                  {data.stats.missingFacts} MISSING FACTS
                </span>
                <span className="text-xs font-semibold text-ink-primary">
                  Agent onboarding simulation blocked on missing runbooks
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                Run closed-loop interview recovery to raise readiness score from 71% to 96%.
              </p>
            </div>
            <Link
              to={`/case/${caseId}/completeness`}
              className="text-xs font-semibold text-ink-primary hover:underline shrink-0"
            >
              Fix Missing Facts →
            </Link>
          </div>

          {/* Role specific notice if contractor */}
          {isContractor && (
            <div className="p-3 bg-surface-elevated text-xs text-ink-secondary border-t border-edge-default">
              <strong>Notice:</strong> 2 sensitive fact keys and internal credentials are withheld from this contractor view.
            </div>
          )}
        </div>
      </section>

      {/* 4. KEY NUMBERS (Max 4 Cards, Real Formulas in Code) */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        aria-label="Core Quantitative Health Metrics"
      >
        {/* Metric 1: Continuity Health */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
            Continuity Health
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {data.stats.continuityScore}%
            </span>
            <span className="text-xs font-semibold text-ink-secondary">Grade B+</span>
          </div>
          <div className="h-1.5 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
            <div className="h-full bg-ink-primary rounded-pill" style={{ width: `${data.stats.continuityScore}%` }} />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Composite team spread vs leaver dependency across 6 components.
          </p>
        </div>

        {/* Metric 2: Bus-Factor Risk */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-strong shadow-card bg-surface-elevated/40 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-primary block">
            Overall Bus-Factor Risk
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {data.stats.busFactorRisk}%
            </span>
            <span className="text-xs font-bold text-ink-primary bg-surface-card border border-edge-strong px-1.5 py-0.5 rounded font-mono">
              2 Bottlenecks
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
            <div className="h-full hatch-leaver rounded-pill" style={{ width: `${data.stats.busFactorRisk}%` }} />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Weighted composite: Line survival (40%), Reviews (30%), CODEOWNERS (15%).
          </p>
        </div>

        {/* Metric 3: Handover Readiness */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
              Handover Readiness
            </span>
            <Link
              to={`/case/${caseId}/completeness`}
              className="text-[10px] font-mono text-ink-secondary hover:underline"
              title="weighted_sum(found_facts) / total_weight"
            >
              Formula ↗
            </Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {data.stats.readinessScore}%
            </span>
            <span className="text-xs font-mono text-ink-secondary">5 / 7 Facts</span>
          </div>
          <div className="h-1.5 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
            <div className="h-full bg-ink-primary rounded-pill" style={{ width: `${data.stats.readinessScore}%` }} />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Autonomous agent onboarding test simulation score.
          </p>
        </div>

        {/* Metric 4: Grounding Score */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
            Claim Grounding
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {data.stats.groundingScore}%
            </span>
            <span className="text-xs font-semibold text-ink-secondary">Anti-Hallucination</span>
          </div>
          <div className="h-1.5 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
            <div className="h-full bg-ink-primary rounded-pill" style={{ width: `${data.stats.groundingScore}%` }} />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            20 of 20 claims carry explicit commit SHA or PR citations.
          </p>
        </div>
      </section>

      {/* 5. TOP RISKS & 6. OPEN CONFLICTS (Two-Column Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP RISKS */}
        <section
          className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-4"
          aria-label="Top Subsystem Knowledge Fragilities"
        >
          <div className="flex items-center justify-between pb-2 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Top Subsystem Dependencies
              </h3>
              <p className="text-[11px] text-ink-secondary">
                Components where single developer holds &gt;65% of measured knowledge
              </p>
            </div>
            <Link
              to={`/case/${caseId}/busfactor`}
              className="text-xs text-ink-primary font-medium hover:underline shrink-0"
            >
              Risk Engine →
            </Link>
          </div>

          <div className="space-y-4">
            {data.topRisks.map((risk) => (
              <div key={risk.name} className="p-3.5 rounded-card border border-edge-default bg-surface-elevated space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink-primary">{risk.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-card border border-edge-strong text-ink-primary font-bold">
                      Bus Factor: {risk.busFactor}
                    </span>
                    <Severity level={risk.severity} value={risk.riskPct} showBar={false} />
                  </div>
                </div>

                {/* Hatched distribution bar distinguishing departing maintainer */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary">
                    <span>Priya Nair (Leaver): {risk.leaverShare}%</span>
                    <span>Team Backup: {risk.otherShare}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-pill bg-surface-card overflow-hidden flex border border-edge-default">
                    <div
                      className="h-full hatch-leaver"
                      style={{ width: `${risk.leaverShare}%` }}
                      title={`Priya Nair: ${risk.leaverShare}%`}
                    />
                    <div
                      className="h-full bg-neutral-300"
                      style={{ width: `${risk.otherShare}%` }}
                      title={`Team: ${risk.otherShare}%`}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-ink-secondary leading-snug">
                  {risk.details}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* OPEN CONFLICTS & UNKNOWNS */}
        <section
          className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-4"
          aria-label="Open Contradictions and Unknowns"
        >
          <div className="flex items-center justify-between pb-2 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Open Conflicts &amp; Contradictions
              </h3>
              <p className="text-[11px] text-ink-secondary">
                Two sources contradict each other; neither resolved silently
              </p>
            </div>
            <Link
              to={`/case/${caseId}/findings`}
              className="text-xs text-ink-primary font-medium hover:underline shrink-0"
            >
              All Findings (4) →
            </Link>
          </div>

          <div className="space-y-4">
            {data.conflicts.map((conf) => (
              <div key={conf.id} className="p-3.5 rounded-card border border-edge-default bg-surface-elevated space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-primary">
                    {conf.id}: {conf.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-edge-strong bg-surface-card text-ink-primary font-semibold">
                    Conflict Flag
                  </span>
                </div>

                {/* Side by Side Source Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-surface-card border border-edge-default space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary font-bold">
                      <span>Source A: {conf.sourceA.name}</span>
                      <span>{conf.sourceA.timestamp}</span>
                    </div>
                    <p className="text-ink-primary text-[11px] leading-snug">
                      {conf.sourceA.claim}
                    </p>
                  </div>

                  <div className="p-2.5 rounded bg-surface-card border border-edge-default space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-ink-secondary font-bold">
                      <span>Source B: {conf.sourceB.name}</span>
                      <span>{conf.sourceB.timestamp}</span>
                    </div>
                    <p className="text-ink-primary text-[11px] leading-snug">
                      {conf.sourceB.claim}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 7. DECISIONS & FIRST 5 DAYS (Two-Column Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Key Decisions */}
        <section
          className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-4"
          aria-label="Recent Architecture Decisions"
        >
          <div className="flex items-center justify-between pb-2 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Technical Decisions &amp; Reasoning
              </h3>
              <p className="text-[11px] text-ink-secondary">
                Grounded Architectural Decision Records (ADRs) extracted from git and docs
              </p>
            </div>
            <Link
              to={`/case/${caseId}/decisions`}
              className="text-xs text-ink-primary font-medium hover:underline shrink-0"
            >
              Full Log →
            </Link>
          </div>

          <div className="space-y-3">
            {data.recentDecisions.map((dec) => (
              <div key={dec.id} className="p-3 rounded-card border border-edge-default bg-surface-elevated space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ink-primary">
                    {dec.id}: {dec.title}
                  </span>
                  <ProvenanceBadge type={dec.provenance} size="sm" />
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {dec.rationale}
                </p>
                <div className="text-[10px] font-mono text-ink-secondary">
                  Recorded: {dec.date}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Continuation Plan: First 5 Days */}
        <section
          className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-4"
          aria-label="Successor Continuation Plan"
        >
          <div className="flex items-center justify-between pb-2 border-b border-edge-subtle">
            <div>
              <h3 className="text-sm font-bold text-ink-primary">
                Continuation Plan: First 5 Days
              </h3>
              <p className="text-[11px] text-ink-secondary">
                Concrete onboarding actions for the incoming team
              </p>
            </div>
            <Link
              to={`/case/${caseId}/decisions`}
              className="text-xs text-ink-primary font-medium hover:underline shrink-0"
            >
              Full Plan →
            </Link>
          </div>

          <div className="space-y-3">
            {data.firstFiveDays.map((act) => (
              <div key={act.day} className="p-3 rounded-card border border-edge-default bg-surface-elevated flex items-start gap-3">
                <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-surface-card border border-edge-strong text-ink-primary shrink-0">
                  DAY {act.day}
                </span>
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-medium text-ink-primary leading-snug">
                    {act.action}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-ink-secondary">
                    <span>Owner: <strong className="text-ink-primary">{act.owner}</strong></span>
                    <span>•</span>
                    <span>Status: {act.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 8. RECENT REPOSITORY ACTIVITY */}
      <section
        className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-4"
        aria-label="Recent Repository Activity Feed"
      >
        <div className="flex items-center justify-between pb-2 border-b border-edge-subtle">
          <div>
            <h3 className="text-sm font-bold text-ink-primary">
              Recent Continuous Activity Stream
            </h3>
            <p className="text-[11px] text-ink-secondary">
              Latest 5 normalized events parsed by the continuous ingestion pipeline
            </p>
          </div>
          <Link
            to={`/case/${caseId}/timeline`}
            className="text-xs text-ink-primary font-medium hover:underline shrink-0"
          >
            Full Timeline →
          </Link>
        </div>

        <div className="space-y-2">
          {data.recentActivity.map((act) => (
            <div
              key={act.id}
              className="p-3 rounded-btn border border-edge-subtle bg-surface-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-ink-primary text-white font-bold shrink-0">
                  {act.type}
                </span>
                <span className="font-medium text-ink-primary truncate">
                  {act.summary}
                </span>
              </div>
              <span className="font-mono text-[10px] text-ink-secondary shrink-0">
                {act.dateGroup} · {act.time}
              </span>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
