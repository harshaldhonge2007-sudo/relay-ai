import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Component {
  id: string;
  name: string;
  path_globs: string[];
  criticality: number;
}

interface KnowledgeBreakdown {
  edits: number;
  reviews: number;
  discussion: number;
}

interface KnowledgeScore {
  id: string;
  component_id: string;
  person_id: string;
  score: number;
  breakdown: KnowledgeBreakdown;
}

interface Person {
  id: string;
  display_name: string;
  is_leaver: boolean;
}

interface PersonKnowledge {
  person: Person;
  score: number;
  breakdown: KnowledgeBreakdown;
}

interface ComponentCard {
  component: Component;
  people: PersonKnowledge[];
  hasConcentrationRisk: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_BASE = "";

async function fetchJSON<T>(url: string): Promise<T> {
  const path = url.replace(/^.*?\/api/, "").replace(/^\/?api/, "");
  const res = await apiFetch(path.startsWith("/") ? path : `/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function detectConcentrationRisk(people: PersonKnowledge[]): boolean {
  if (people.length === 0) return false;
  const sorted = [...people].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  if (!top.person.is_leaver) return false;
  const second = sorted[1];
  if (!second) return true; // only contributor is the leaver
  return top.score - second.score >= 20; // significantly higher
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CriticalityBar({ value }: { value: number }) {
  return (
    <div className="mt-1.5">
      <span className="text-xs text-ink-secondary">
        Criticality: {Math.round(value)}%
      </span>
      <div className="mt-1 h-1.5 w-full rounded-pill bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-pill bg-ink-tertiary transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownRow({ breakdown }: { breakdown: KnowledgeBreakdown }) {
  const items: { label: string; value: number }[] = [
    { label: "Edits", value: breakdown.edits },
    { label: "Reviews", value: breakdown.reviews },
    { label: "Discussion", value: breakdown.discussion },
  ];

  return (
    <div className="flex items-center gap-4 mt-1 pl-[140px]">
      {items.map((item) => (
        <span key={item.label} className="text-[11px] text-ink-tertiary">
          {item.label}: {Math.round(item.value)}%
        </span>
      ))}
    </div>
  );
}

function PersonBar({
  entry,
  maxScore,
}: {
  entry: PersonKnowledge;
  maxScore: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const showBreakdown = expanded || hovered;
  const barWidth = maxScore > 0 ? (entry.score / 100) * 100 : 0;

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center gap-3 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2 rounded-input"
        aria-expanded={expanded}
      >
        {/* Person name */}
        <span className="w-[130px] shrink-0 text-sm text-ink-primary truncate">
          {entry.person.display_name}
          {entry.person.is_leaver && (
            <span className="ml-1.5 text-xs text-ink-tertiary">(Departing)</span>
          )}
        </span>

        {/* Bar track */}
        <div className="flex-1 h-2.5 rounded-pill bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-pill bg-ink-primary transition-all duration-500"
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Score label */}
        <span className="w-[44px] shrink-0 text-right text-xs font-medium text-ink-secondary tabular-nums">
          {Math.round(entry.score)}%
        </span>
      </button>

      {/* Breakdown */}
      {showBreakdown && (
        <div className="animate-fadeIn">
          <BreakdownRow breakdown={entry.breakdown} />
        </div>
      )}
    </div>
  );
}

function RiskBanner() {
  return (
    <div className="mt-4 border-l-4 border-ink-primary bg-surface-elevated rounded-r-lg px-4 py-2.5 animate-fadeIn">
      <p className="text-sm font-semibold text-ink-primary">
        High Concentration Risk
      </p>
      <p className="text-xs text-ink-secondary mt-0.5">
        The departing team member holds significantly more knowledge of this
        component than anyone else.
      </p>
    </div>
  );
}

function ComponentCardView({ data }: { data: ComponentCard }) {
  const { component, people, hasConcentrationRisk } = data;
  const maxScore = people.reduce((m, p) => Math.max(m, p.score), 0);
  const sorted = [...people].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 animate-fadeIn transition-transform duration-200 hover:-translate-y-px hover:shadow-float">
      {/* Header */}
      <h3 className="text-base font-medium text-ink-primary">
        {component.name}
      </h3>
      <CriticalityBar value={component.criticality} />

      {/* People list */}
      <div className="mt-4 space-y-0.5">
        {sorted.length === 0 && (
          <p className="text-sm text-ink-tertiary">No knowledge data</p>
        )}
        {sorted.map((entry) => (
          <PersonBar key={entry.person.id} entry={entry} maxScore={maxScore} />
        ))}
      </div>

      {/* Risk indicator */}
      {hasConcentrationRisk && <RiskBanner />}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-card shadow-card rounded-card p-5 space-y-3"
        >
          <div className="h-4 w-2/3 rounded bg-surface-elevated animate-pulse" />
          <div className="h-1.5 w-full rounded-pill bg-surface-elevated animate-pulse" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full rounded bg-surface-elevated animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-surface-elevated animate-pulse" />
            <div className="h-3 w-4/6 rounded bg-surface-elevated animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 border border-edge-strong animate-fadeIn">
      <p className="text-sm font-medium text-ink-primary">
        Something went wrong
      </p>
      <p className="text-xs text-ink-secondary mt-1">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function KnowledgeRadar() {
  const { caseId } = useParams<{ caseId: string }>();
  const [cards, setCards] = useState<ComponentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    try {
      const [components, knowledge] = await Promise.all([
        fetchJSON<Component[]>(`${API_BASE}/cases/${caseId}/components`),
        fetchJSON<KnowledgeScore[]>(`${API_BASE}/cases/${caseId}/knowledge`),
      ]);

      // Collect unique person IDs
      const personIds = Array.from(
        new Set(knowledge.map((k) => k.person_id))
      );

      // Fetch all people in parallel
      const people = await Promise.all(
        personIds.map((pid) =>
          fetchJSON<Person>(`${API_BASE}/people/${pid}`)
        )
      );
      const personMap = new Map(people.map((p) => [p.id, p]));

      // Group knowledge by component
      const knowledgeByComponent = new Map<string, KnowledgeScore[]>();
      for (const k of knowledge) {
        const existing = knowledgeByComponent.get(k.component_id) ?? [];
        existing.push(k);
        knowledgeByComponent.set(k.component_id, existing);
      }

      // Build cards
      const result: ComponentCard[] = components.map((comp) => {
        const scores = knowledgeByComponent.get(comp.id) ?? [];
        const peopleKnowledge: PersonKnowledge[] = scores
          .map((s) => {
            const person = personMap.get(s.person_id);
            if (!person) return null;
            return {
              person,
              score: s.score,
              breakdown: s.breakdown,
            };
          })
          .filter(Boolean) as PersonKnowledge[];

        return {
          component: comp,
          people: peopleKnowledge,
          hasConcentrationRisk: detectConcentrationRisk(peopleKnowledge),
        };
      });

      // Sort: high-criticality and risky components first
      result.sort((a, b) => {
        if (a.hasConcentrationRisk !== b.hasConcentrationRisk) {
          return a.hasConcentrationRisk ? -1 : 1;
        }
        return b.component.criticality - a.component.criticality;
      });

      setCards(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-2xl font-semibold text-ink-primary">
            Knowledge Radar
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Knowledge distribution across components and contributors.
          </p>
        </div>

        {/* Summary strip */}
        {!loading && !error && cards.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-4 animate-fadeIn">
            <div className="bg-surface-card shadow-card rounded-card px-4 py-3">
              <p className="text-xs text-ink-tertiary">Components</p>
              <p className="text-lg font-semibold text-ink-primary tabular-nums">
                {cards.length}
              </p>
            </div>
            <div className="bg-surface-card shadow-card rounded-card px-4 py-3">
              <p className="text-xs text-ink-tertiary">At Risk</p>
              <p className="text-lg font-semibold text-ink-primary tabular-nums">
                {cards.filter((c) => c.hasConcentrationRisk).length}
              </p>
            </div>
            <div className="bg-surface-card shadow-card rounded-card px-4 py-3">
              <p className="text-xs text-ink-tertiary">Contributors</p>
              <p className="text-lg font-semibold text-ink-primary tabular-nums">
                {
                  new Set(
                    cards.flatMap((c) => c.people.map((p) => p.person.id))
                  ).size
                }
              </p>
            </div>
          </div>
        )}

        {/* Knowledge Concentration Risk Formula Banner */}
        {!loading && !error && cards.length > 0 && (
          <div className="mb-6 bg-surface-card border border-edge-default rounded-card p-4 shadow-card animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary block">
                  Knowledge Concentration Risk Formula
                </span>
                <p className="text-xs font-mono font-semibold text-ink-primary mt-0.5">
                  Risk = Criticality × L × (1 − B) × (1 − 0.6 × D)
                </p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  L = Leaver authorship share (time-decayed) · B = Bench strength (backup ratio) · D = Doc coverage (0–1)
                </p>
              </div>
              <div className="sm:text-right">
                <span className="inline-block text-xs font-mono font-bold text-ink-primary bg-surface-elevated border border-edge-strong px-2.5 py-1 rounded">
                  Max Leaver Concentration: {Math.max(...cards.flatMap((c) => c.people.filter((p) => p.person.is_leaver).map((p) => Math.round(p.score))), 0)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        {loading && <LoadingSkeleton />}
        {error && <ErrorBanner message={error} />}
        {!loading && !error && cards.length === 0 && (
          <div className="bg-surface-card shadow-card rounded-card p-8 text-center animate-fadeIn">
            <p className="text-sm text-ink-tertiary">
              No component or knowledge data found for this case.
            </p>
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cards.map((card) => (
              <ComponentCardView key={card.component.id} data={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
