import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useRole } from "../contexts/CaseContext";
import { PageContainer } from "../components/ui/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Severity } from "../components/ui/Severity";
import { NextStepFooter } from "../components/ui/NextStepFooter";

interface ContributorSignal {
  commit_share: number;
  review_share: number;
  discussion_share: number;
  composite: number;
}

interface Contributor {
  person_id: string;
  person_name: string;
  is_leaver: boolean;
  knowledge_share: number;
  knowledge_score: number;
  signals?: ContributorSignal;
}

interface BusAlert {
  alert_type: string;
  severity: number;
  component_name: string;
  primary_developer?: string;
  primary_developer_share?: number;
  explanation: string;
  recommendation: string;
  signals_used?: string[];
  threshold_note?: string;
}

interface ComponentRisk {
  component_id: string;
  component_name: string;
  criticality: number;
  bus_factor_number: number;
  active_contributors: number;
  top_contributor_share: number;
  leaver_share: number;
  doc_coverage: number;
  bus_factor_risk: number;
  risk_formula: string;
  contributors: Contributor[];
  alerts: BusAlert[];
}

interface BusFactorReport {
  case_id: string;
  case_name: string;
  overall_risk_score: number;
  knowledge_continuity_score: number;
  continuity_grade: string;
  total_components: number;
  at_risk_components: number;
  critical_alerts: BusAlert[];
  components: ComponentRisk[];
  summary: string;
}

interface GraphNode {
  id: string;
  type: "developer" | "component";
  label: string;
  criticality?: number;
  is_leaver?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  strength: number;
  label: string;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function BusFactor() {
  const { caseId = "case-001" } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const [report, setReport] = useState<BusFactorReport | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraphData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("analysis");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [bfRes, graphRes] = await Promise.all([
        apiFetch(`/cases/${caseId}/busfactor`),
        apiFetch(`/cases/${caseId}/knowledge-graph`),
      ]);
      if (!bfRes.ok) throw new Error("Failed to load bus-factor report");
      const bfJson = await bfRes.json();
      setReport(bfJson);

      if (graphRes.ok) {
        const graphJson = await graphRes.json();
        setGraph(graphJson);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading bus-factor report");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer width="wide" className="animate-pulse space-y-6">
        <div className="h-10 w-64 bg-surface-elevated rounded" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-28 bg-surface-elevated rounded-card" />
          <div className="h-28 bg-surface-elevated rounded-card" />
          <div className="h-28 bg-surface-elevated rounded-card" />
          <div className="h-28 bg-surface-elevated rounded-card" />
        </div>
      </PageContainer>
    );
  }

  if (error || !report) {
    return (
      <PageContainer width="wide">
        <div className="p-8 text-center bg-surface-card border border-edge-strong rounded-card shadow-card">
          <p className="text-sm font-semibold text-ink-primary mb-2">Bus-Factor Engine Unavailable</p>
          <p className="text-xs text-ink-secondary mb-4">{error || "No report generated"}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-ink-primary text-white text-xs font-semibold rounded-btn"
          >
            Retry Analysis
          </button>
        </div>
      </PageContainer>
    );
  }

  const riskPct = Math.round(report.overall_risk_score * 100);
  const continuityPct = Math.round(report.knowledge_continuity_score * 100);
  const isSuccessor = role === "successor";

  const tabs = [
    { id: "analysis", label: "Risk Analysis & Breakdown", count: report.components.length },
    { id: "graph", label: "Knowledge Graph Topology", count: graph?.nodes.length || 0 },
  ];

  return (
    <PageContainer width="wide" className="animate-fadeIn">
      {/* Page Header with Quiet Link to Model Validation */}
      <PageHeader
        stepEyebrow="2 RECONSTRUCT"
        title="Bus-Factor Risk Engine"
        description="Identifies components with excessive single-developer dependency and knowledge fragility. Grounded in git-blame line survival, review topology, CODEOWNERS policies, and exponential time decay."
        metaChips={[
          `Continuity Grade: ${report.continuity_grade}`,
          `${report.at_risk_components} Critical Subsystems`,
          "Defensible Multi-Signal",
        ]}
        primaryAction={{
          label: "Model Validation (Benchmark) ↗",
          href: `/case/${caseId}/validation`,
        }}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "analysis" | "graph")}
      />

      {/* KPI Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grade & Continuity Score */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
            Continuity Health
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              Grade {report.continuity_grade}
            </span>
            <span className="text-xs font-semibold text-ink-secondary font-mono">
              ({continuityPct}%)
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary pt-1">
            Overall organizational ability to sustain velocity post-departure.
          </p>
        </div>

        {/* Overall Bus-Factor Risk */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-strong shadow-card bg-surface-elevated/40 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-primary block">
            Overall Bus-Factor Risk
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {riskPct}%
            </span>
            <span className="text-xs font-mono font-bold text-ink-primary bg-surface-card border border-edge-strong px-2 py-0.5 rounded">
              Elevated Risk
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary pt-1">
            Weighted composite of single-maintainer shares across all subsystems.
          </p>
        </div>

        {/* Components Analyzed */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
            Components Monitored
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {report.total_components}
            </span>
            <span className="text-xs text-ink-secondary font-mono">modules</span>
          </div>
          <p className="text-[11px] text-ink-secondary pt-1">
            Continuous background evaluation of repo paths &amp; ownership.
          </p>
        </div>

        {/* At-Risk Components */}
        <div className="bg-surface-card rounded-card p-5 border border-edge-default shadow-card space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary block">
            At-Risk Components
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink-primary font-mono tabular-nums">
              {report.at_risk_components}
            </span>
            <span className="text-xs font-mono text-ink-secondary">
              of {report.total_components}
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary pt-1">
            Payment Processor &amp; Auth Service require urgent transfer.
          </p>
        </div>
      </div>

      {/* Collapsible: "How this is calculated" */}
      <div className="rounded-card border border-edge-default bg-surface-card shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => setFormulaOpen(!formulaOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-elevated/50 transition-colors"
          aria-expanded={formulaOpen}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-primary font-mono uppercase tracking-wider">
              How this is calculated
            </span>
            <span className="text-[10px] font-mono text-ink-secondary">
              • Defensible mathematical attribution model
            </span>
          </div>
          <span className="text-xs font-mono text-ink-secondary">
            {formulaOpen ? "▲ Hide calculation" : "▼ View formula & weights"}
          </span>
        </button>

        {formulaOpen && (
          <div className="p-4 pt-0 border-t border-edge-subtle space-y-3 bg-surface-elevated text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-secondary block">
                Composite Risk Formula (per component):
              </span>
              <p className="font-mono text-xs text-ink-primary bg-surface-card p-2.5 rounded border border-edge-default">
                Bus-Factor Risk = Criticality × Leaver_Share × (1 − Contributor_Diversity) × (1 − 0.4 × Doc_Coverage)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px] leading-relaxed">
              <div className="p-2.5 bg-surface-card rounded border border-edge-default space-y-1">
                <span className="font-mono font-bold text-ink-primary block uppercase text-[10px]">
                  Multi-Signal Weights (in code):
                </span>
                <ul className="space-y-0.5 font-mono text-ink-secondary">
                  <li>• Git-blame Line Survival: <strong>40%</strong></li>
                  <li>• Review Graph Co-Approval Depth: <strong>30%</strong></li>
                  <li>• CODEOWNERS Designated Path: <strong>15%</strong></li>
                  <li>• Discussion &amp; Issues: <strong>15%</strong></li>
                </ul>
              </div>

              <div className="p-2.5 bg-surface-card rounded border border-edge-default space-y-1">
                <span className="font-mono font-bold text-ink-primary block uppercase text-[10px]">
                  Mitigation &amp; Temporal Decay:
                </span>
                <ul className="space-y-0.5 font-mono text-ink-secondary">
                  <li>• Diversity = min(1.0, (active_contributors - 1) / 3)</li>
                  <li>• Temporal Decay: Exponential half-life of <strong>180 days</strong></li>
                  <li>• Noise Filter: Automated bot &amp; lockfile exclusion</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === "analysis" ? (
        <>
          {/* Proactive Critical Alerts Checklist */}
          {report.critical_alerts && report.critical_alerts.length > 0 && (
            <section className="space-y-3" aria-label="Proactive Continuity Alerts">
              <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ink-primary animate-pulse" />
                <span>Proactive Bus-Factor Alerts &amp; Continuity Checklist ({report.critical_alerts.length})</span>
              </h2>

              <div className="space-y-3">
                {report.critical_alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-card border border-edge-strong bg-surface-card shadow-card space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-ink-primary text-white">
                          {alert.alert_type.replace("_", " ")}
                        </span>
                        <h3 className="text-sm font-bold text-ink-primary">
                          {alert.component_name}
                        </h3>
                      </div>
                      <Severity
                        level={alert.severity > 0.8 ? "critical" : "high"}
                        value={alert.severity}
                      />
                    </div>

                    <div className="text-xs text-ink-primary leading-relaxed whitespace-pre-wrap bg-surface-elevated p-3 rounded border border-edge-subtle">
                      {alert.explanation}
                    </div>

                    {/* Role-Aware Knowledge Continuity Action Checklist */}
                    <div className="p-3.5 bg-surface-elevated border border-edge-strong rounded text-xs text-ink-primary leading-relaxed space-y-1.5">
                      <strong className="block font-bold text-ink-primary text-xs">
                        {isSuccessor
                          ? "Key Areas to Learn & Ask (Successor Onboarding Checklist):"
                          : "Recommended Knowledge Continuity Action (Engineering Lead):"}
                      </strong>
                      <div className="whitespace-pre-wrap text-ink-secondary text-xs">
                        {alert.recommendation}
                      </div>
                    </div>

                    {alert.signals_used && (
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-edge-subtle text-[11px] text-ink-secondary">
                        <span className="font-semibold text-ink-primary font-mono text-[10px]">Signals verified:</span>
                        {alert.signals_used.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-surface-elevated border border-edge-default font-mono text-[10px]"
                          >
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Component Risk Cards */}
          <section className="space-y-4" aria-label="Component Knowledge Breakdown">
            <h2 className="text-base font-bold text-ink-primary">
              Component-Wise Developer Dependency Breakdown
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {report.components.map((comp) => {
                const compRiskPct = Math.round(comp.bus_factor_risk * 100);
                const isHighRisk = comp.bus_factor_risk > 0.5;

                return (
                  <div
                    key={comp.component_id}
                    className={`bg-surface-card rounded-card p-5 border space-y-4 transition-all duration-200 ${
                      isHighRisk
                        ? "border-edge-strong shadow-card ring-1 ring-ink-primary/20"
                        : "border-edge-default shadow-card"
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-ink-primary">
                          {comp.component_name}
                        </h3>
                        <p className="text-[11px] text-ink-secondary mt-0.5 font-mono">
                          Criticality: {Math.round(comp.criticality * 100)}% · Doc Coverage: {Math.round(comp.doc_coverage * 100)}%
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded ${
                            isHighRisk
                              ? "bg-ink-primary text-white"
                              : "bg-surface-elevated text-ink-primary border border-edge-strong"
                          }`}
                        >
                          Bus Factor: {comp.bus_factor_number}
                        </span>
                        <span className="block text-[10px] text-ink-secondary mt-0.5 font-mono">
                          Risk: {compRiskPct}%
                        </span>
                      </div>
                    </div>

                    {/* Risk Formula String */}
                    <div className="text-[10px] font-mono text-ink-secondary bg-surface-elevated p-2 rounded border border-edge-subtle">
                      {comp.risk_formula}
                    </div>

                    {/* Contributor Distribution Bar with Hatched Leaver */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-ink-secondary block">
                        Knowledge Share by Contributor
                      </span>

                      {comp.contributors.map((contrib, idx) => {
                        const sharePct = Math.round(contrib.knowledge_share * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-ink-primary flex items-center gap-1.5">
                                {contrib.person_name}
                                {contrib.is_leaver && (
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-ink-primary text-white font-mono">
                                    Departing
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-ink-secondary tabular-nums font-semibold">
                                {sharePct}%
                              </span>
                            </div>

                            <div className="h-2 w-full bg-surface-elevated rounded-pill overflow-hidden border border-edge-default">
                              <div
                                className={`h-full rounded-pill transition-all duration-500 ${
                                  contrib.is_leaver ? "hatch-leaver" : "bg-ink-primary"
                                }`}
                                style={{ width: `${sharePct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        /* TAB 2: KNOWLEDGE GRAPH VIEW */
        <section className="bg-surface-card rounded-card p-6 border border-edge-default shadow-card space-y-6">
          <div>
            <h3 className="text-sm font-bold text-ink-primary">
              Structured Project Knowledge Graph
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Live entities and relationships: Developer → Maintains → Component, Component → Depends On → Component.
            </p>
          </div>

          {graph ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface-elevated rounded-card border border-edge-subtle space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                    Developers ({graph.nodes.filter((n) => n.type === "developer").length})
                  </h4>
                  <div className="space-y-2">
                    {graph.nodes
                      .filter((n) => n.type === "developer")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between p-2 rounded bg-surface-card border border-edge-default text-xs"
                        >
                          <span className="font-semibold text-ink-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-primary" />
                            <span>{n.label}</span>
                          </span>
                          {n.is_leaver ? (
                            <span className="text-[10px] font-mono uppercase font-bold text-ink-primary bg-surface-elevated border border-edge-strong px-1.5 py-0.5 rounded">
                              Departing
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-ink-secondary">Active</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-4 bg-surface-elevated rounded-card border border-edge-subtle space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                    Components ({graph.nodes.filter((n) => n.type === "component").length})
                  </h4>
                  <div className="space-y-2">
                    {graph.nodes
                      .filter((n) => n.type === "component")
                      .map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between p-2 rounded bg-surface-card border border-edge-default text-xs"
                        >
                          <span className="font-semibold text-ink-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-sm bg-ink-secondary" />
                            <span>{n.label}</span>
                          </span>
                          <span className="text-[10px] font-mono text-ink-secondary">
                            Criticality: {Math.round((n.criticality || 0.5) * 100)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Edge List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                  Knowledge &amp; Dependency Edges ({graph.edges.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {graph.edges.map((e, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-surface-card border border-edge-default flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-[10px] uppercase text-ink-primary font-semibold">
                        {e.relation === "maintains" ? "MAINTAINS" : "DEPENDS ON"}
                      </span>
                      <span className="text-ink-secondary text-[11px] font-mono">{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-secondary">No knowledge graph data available.</p>
          )}
        </section>
      )}

      {/* Next Step Footer */}
      <NextStepFooter
        stepNumber="2"
        stepName="Decisions & Actions"
        nextRoute={`/case/${caseId}/decisions`}
        description="Inspect architectural decisions and the successor's first 5-day continuation plan."
      />
    </PageContainer>
  );
}
