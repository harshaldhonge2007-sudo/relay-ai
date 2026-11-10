import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";

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
  if (priority >= 0.8) return "High";
  if (priority >= 0.5) return "Medium";
  return "Low";
}

function priorityTextClass(priority: number): string {
  if (priority >= 0.8) return "text-ink-primary font-semibold";
  if (priority >= 0.5) return "text-ink-secondary font-medium";
  return "text-ink-tertiary font-normal";
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
    <div className="space-y-2">
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink-primary">{answered}</span> of{" "}
        <span className="font-semibold text-ink-primary">{total}</span> answered
      </p>
      <div className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-ink-primary transition-all duration-500 ease-out"
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
      className={[
        "bg-surface-card shadow-card rounded-card p-5 space-y-4 animate-fadeIn",
        "transition-transform duration-200 hover:-translate-y-px",
        isAnswered ? "border-l-2 border-edge-strong" : "",
      ].join(" ")}
    >
      {/* Header row: priority + evidence */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`text-xs uppercase tracking-wide ${priorityTextClass(question.priority)}`}>
          Priority: {priorityLabel(question.priority)}
        </span>

        {question.finding_id && (
          <span className="text-xs text-ink-tertiary">
            Related to: Finding #{question.finding_id}
          </span>
        )}
      </div>

      {/* Question text */}
      <p className="text-lg font-medium text-ink-primary leading-relaxed">
        {question.text}
      </p>

      {/* Draft state — textarea + submit */}
      {!isAnswered && (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here..."
            rows={4}
            className={[
              "w-full resize-y rounded-input border border-edge-default",
              "bg-surface-card px-4 py-3 text-sm text-ink-primary",
              "placeholder:text-ink-disabled",
              "focus:outline-none focus:ring-2 focus:ring-ink-primary/20 focus:border-edge-strong",
              "transition-colors duration-200",
            ].join(" ")}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !draft.trim()}
              className={[
                "bg-ink-primary text-white rounded-btn px-4 py-2 text-sm font-medium",
                "transition-all duration-200",
                "hover:opacity-90 hover:-translate-y-px",
                "focus:outline-none focus:ring-2 focus:ring-ink-primary/30 focus:ring-offset-2",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0",
              ].join(" ")}
            >
              {submitting ? "Submitting..." : "Submit Answer"}
            </button>
          </div>
        </div>
      )}

      {/* Answered state — display answer */}
      {isAnswered && question.answer && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary border border-edge-default">
              Answered
            </span>
          </div>
          <div className="bg-surface-elevated rounded-card p-4">
            <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
              {question.answer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-surface-elevated" />
        <div className="h-3 w-32 rounded bg-surface-elevated" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-surface-elevated" />
        <div className="h-4 w-3/4 rounded bg-surface-elevated" />
      </div>
      <div className="h-24 w-full rounded-input bg-surface-elevated" />
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

  /* Fetch questions */
  const fetchQuestions = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/questions`);
      if (!res.ok) throw new Error(`Failed to load questions (${res.status})`);
      const data: Question[] = await res.json();
      /* Sort by priority descending */
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

  /* Submit an answer */
  const handleSubmitAnswer = async (questionId: string, text: string) => {
    if (!caseId) return;
    const res = await apiFetch(`/cases/${caseId}/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Failed to submit answer (${res.status})`);

    /* Optimistically update local state */
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, status: "answered" as const, answer: text } : q
      )
    );
  };

  /* Derived counts */
  const answeredCount = questions.filter((q) => q.status === "answered").length;
  const totalCount = questions.length;

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
        {/* Page title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink-primary">
            Interview Questions
          </h1>
          <p className="text-sm text-ink-tertiary">
            Answer each question to help capture critical knowledge before departure.
          </p>
        </div>

        {/* Progress */}
        {!loading && !error && totalCount > 0 && (
          <ProgressBar answered={answeredCount} total={totalCount} />
        )}

        {/* Error state */}
        {error && (
          <div className="bg-surface-card shadow-card rounded-card p-5 border border-edge-default animate-fadeIn">
            <p className="text-sm text-ink-primary font-medium">
              Something went wrong
            </p>
            <p className="text-sm text-ink-secondary mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchQuestions}
              className="mt-3 bg-ink-primary text-white rounded-btn px-4 py-2 text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-ink-primary/30 focus:ring-offset-2"
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
          <div className="bg-surface-card shadow-card rounded-card p-10 text-center animate-fadeIn">
            <p className="text-ink-secondary text-sm">
              No interview questions have been generated yet.
            </p>
          </div>
        )}

        {/* Question list */}
        {!loading && !error && totalCount > 0 && (
          <div className="space-y-4">
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
          <div className="bg-surface-card shadow-card rounded-card p-5 border border-edge-strong text-center animate-fadeIn">
            <p className="text-sm font-semibold text-ink-primary">
              All questions answered
            </p>
            <p className="text-xs text-ink-tertiary mt-1">
              Thank you for sharing your knowledge. Your responses have been recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
