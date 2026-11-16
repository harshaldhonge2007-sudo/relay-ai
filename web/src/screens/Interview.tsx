import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Evidence {
  artifact_id: string;
}

interface Question {
  id: string;
  finding_id: string;
  text: string;
  evidence: Evidence[];
  priority: number;
  status: "draft" | "answered";
  answer?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function priorityLabel(priority: number): string {
  if (priority >= 0.8) return "High Priority";
  if (priority >= 0.5) return "Medium Priority";
  return "Standard Priority";
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ProgressBar({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <div className="space-y-1.5 bg-surface-card border border-edge-default rounded-card p-4 mb-6">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-ink-secondary">
          INTERVIEW COMPLETION
        </span>
        <span className="font-mono font-semibold text-ink-primary">
          {answered} of {total} answered ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-pill bg-edge-default overflow-hidden">
        <div
          className="h-full rounded-pill bg-ink-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  onSubmitAnswer,
}: {
  question: Question;
  onSubmitAnswer: (questionId: string, text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAnswered = question.status === "answered";

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmitAnswer(question.id, trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`bg-surface-card border border-edge-default rounded-card p-5 space-y-4 animate-fadeIn transition-shadow hover:shadow-card ${
        isAnswered ? "border-l-4 border-l-ink-primary" : ""
      }`}
    >
      {/* Header row: priority + evidence */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
              question.priority >= 0.8
                ? "border-edge-dark bg-ink-primary text-white font-semibold"
                : "border-edge-strong bg-surface-elevated text-ink-secondary"
            }`}
          >
            {priorityLabel(question.priority)}
          </span>
          <span className="text-xs font-mono text-ink-tertiary">
            ID: {question.id}
          </span>
        </div>

        {question.finding_id && (
          <span className="text-[11px] font-mono text-ink-secondary">
            Targeting Finding #{question.finding_id}
          </span>
        )}
      </div>

      {/* Question text */}
      <p className="text-base font-semibold text-ink-primary leading-relaxed">
        {question.text}
      </p>

      {/* Draft state — textarea + submit */}
      {!isAnswered && (
        <div className="space-y-3 pt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type verified explanation, key contacts, or undocumented workflows... (Cmd+Enter to submit)"
            rows={4}
            className="w-full resize-y rounded-input border border-edge-strong bg-surface-card px-3.5 py-2.5 text-xs text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-ink-primary focus:border-ink-primary transition-colors"
          />
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-ink-secondary">
              Press ⌘+Enter to submit
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !draft.trim()}
              className="bg-ink-primary text-white rounded-btn px-4 py-2 text-xs font-semibold transition-all hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Answer"}
            </button>
          </div>
        </div>
      )}

      {/* Answered state — display answer */}
      {isAnswered && question.answer && (
        <div className="space-y-2 pt-2 border-t border-edge-default">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-pill bg-surface-base border border-edge-strong px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-primary font-semibold">
              ✓ Verified Leaver Response
            </span>
          </div>
          <div className="bg-surface-elevated rounded-input p-3 border border-edge-default">
            <p className="text-xs text-ink-primary leading-relaxed whitespace-pre-wrap font-mono">
              {question.answer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface-card border border-edge-default rounded-card p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-edge-default" />
        <div className="h-3 w-32 rounded bg-edge-default" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-edge-default" />
        <div className="h-4 w-3/4 rounded bg-edge-default" />
      </div>
      <div className="h-24 w-full rounded-input bg-edge-default" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function Interview() {
  const { caseId } = useParams<{ caseId: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/questions`);
      if (!res.ok) throw new Error(`Failed to load questions (${res.status})`);
      const data: Question[] = await res.json();
      data.sort((a, b) => b.priority - a.priority);
      setQuestions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSubmitAnswer = async (questionId: string, text: string) => {
    if (!caseId) return;
    const res = await apiFetch(`/cases/${caseId}/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Failed to submit answer (${res.status})`);

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, status: "answered" as const, answer: text } : q
      )
    );
  };

  const answeredCount = questions.filter((q) => q.status === "answered").length;
  const totalCount = questions.length;

  return (
    <PageContainer width="standard">
      <PageHeader
        stepNumber={3}
        stepEyebrow="Interview & Fill"
        title="Leaver Dynamic Interview"
        description="Targeted questionnaire generated from bus-factor hotspots and undocumented gaps to capture critical continuity knowledge."
        metaChips={[
          { label: "Total Questions", value: totalCount },
          { label: "Answered", value: answeredCount },
          { label: "Pending", value: totalCount - answeredCount },
        ]}
      />

      {/* Progress */}
      {!loading && !error && totalCount > 0 && (
        <ProgressBar answered={answeredCount} total={totalCount} />
      )}

      {/* Error state */}
      {error && (
        <div className="bg-surface-card rounded-card p-5 border border-edge-strong animate-fadeIn">
          <p className="text-sm text-ink-primary font-semibold">
            Something went wrong
          </p>
          <p className="text-xs text-ink-secondary mt-1">{error}</p>
          <button
            type="button"
            onClick={fetchQuestions}
            className="mt-3 bg-ink-primary text-white rounded-btn px-4 py-2 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && totalCount === 0 && (
        <div className="bg-surface-card border border-edge-default rounded-card p-10 text-center">
          <p className="text-ink-secondary text-sm">
            No interview questions have been generated yet.
          </p>
        </div>
      )}

      {/* Question list */}
      {!loading && !error && totalCount > 0 && (
        <div className="space-y-4 mb-8">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onSubmitAnswer={handleSubmitAnswer}
            />
          ))}
        </div>
      )}

      {/* Completion banner */}
      {!loading && !error && totalCount > 0 && answeredCount === totalCount && (
        <div className="bg-surface-card border border-edge-strong rounded-card p-5 text-center mb-8">
          <p className="text-sm font-semibold text-ink-primary">
            All interview questions answered
          </p>
          <p className="text-xs text-ink-secondary mt-1">
            All responses have been recorded and incorporated into the verified handover packet.
          </p>
        </div>
      )}

      <NextStepFooter
        nextLabel="Compile & Review Handover Pack"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/handover`}
        currentStep={3}
        totalSteps={5}
      />
    </PageContainer>
  );
}
