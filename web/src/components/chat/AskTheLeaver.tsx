import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getApiRole } from "../../api";
import { useEvidenceDrawer } from "../EvidenceDrawer";

interface Citation {
  id: string;
  type: string;
  label: string;
  title: string;
  url: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "leaver";
  text: string;
  citations?: Citation[];
  confidence?: number;
  abstained?: boolean;
  interview_question_id?: string | null;
  timestamp: string;
}

interface AskTheLeaverProps {
  caseId: string;
  leaverName?: string;
  className?: string;
}

const SUGGESTED_QUERIES = [
  "Why was JWT token lifetime changed to 15m?",
  "What happened with the SL-287 currency rollout?",
  "What is the retry policy for Stripe webhooks?",
  "Where are the AWS production root keys stored?", // Trap test
];

export default function AskTheLeaver({
  caseId,
  leaverName = "Priya Nair",
  className = "",
}: AskTheLeaverProps) {
  const navigate = useNavigate();
  const { openDrawer } = useEvidenceDrawer();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-welcome",
      sender: "leaver",
      text: `Hi, I'm ${leaverName}'s verified knowledge continuity avatar. Ask me about architectural decisions, rollback incidents, runbooks, or undocumented subsystems. I am strictly grounded in ${leaverName}'s digital footprint—if I don't know something, I won't guess; I'll escalate it directly to my exit interview queue.`,
      timestamp: "Just now",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setLoading(true);

    try {
      const role = getApiRole();
      const res = await apiFetch(`/cases/${caseId}/ask`, {
        method: "POST",
        body: JSON.stringify({ question: textToSend, role }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      const leaverMsg: ChatMessage = {
        id: "leaver-" + Date.now(),
        sender: "leaver",
        text: data.answer || "No response received.",
        citations: data.citations || [],
        confidence: data.confidence,
        abstained: Boolean(data.abstained),
        interview_question_id: data.interview_question_id,
        timestamp: "Just now",
      };

      setMessages((prev) => [...prev, leaverMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: "err-" + Date.now(),
        sender: "leaver",
        text: "Apologies, I encountered an issue querying the knowledge footprint. Please try again or check connection.",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCitationClick = (c: Citation, originalQuestion: string) => {
    openDrawer(
      [
        {
          artifact_id: c.id,
          title: c.title,
          source: c.type,
          body: c.snippet,
          url: c.url,
          highlight: c.id,
        },
      ],
      `Grounding citation for: "${originalQuestion}"`
    );
  };

  return (
    <div className={`rounded-card border border-edge-strong bg-surface-card shadow-card flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-edge-default bg-surface-elevated flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-ink-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {leaverName.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink-primary">
                Ask {leaverName}
              </h2>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-elevated text-ink-primary border border-edge-strong">
                Grounded Avatar
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary">
              Grounded exclusively in {leaverName}&apos;s verified commits, PRs & tickets
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-ink-tertiary">
          RBAC Protected · Zero Hallucination
        </span>
      </div>

      {/* Suggested Query Chips */}
      <div className="px-4 py-2 bg-surface-base border-b border-edge-subtle flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-ink-tertiary font-mono">Suggested questions:</span>
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void handleSend(q)}
            disabled={loading}
            className="text-[10px] font-mono px-2 py-0.5 rounded-pill border border-edge-default bg-surface-card text-ink-secondary hover:text-ink-primary hover:border-ink-secondary transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[460px] min-h-[300px] bg-surface-base/50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-input p-3.5 text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-ink-primary text-white shadow-sm"
                  : m.abstained
                  ? "bg-surface-elevated border border-edge-strong text-ink-primary shadow-sm"
                  : "bg-surface-card border border-edge-strong text-ink-primary shadow-sm"
              }`}
            >
              {/* If abstained, render the distinctive escalation notice card */}
              {m.abstained ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-ink-primary border-b border-edge-default pb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-primary" />
                    <span>Insufficient Evidence Trace — Escalated to Exit Interview</span>
                  </div>
                  <p className="text-ink-secondary">{m.text}</p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-ink-tertiary">
                      Auto-Logged in Case Interview Queue
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/case/${caseId}/interview`)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-ink-primary text-white hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      View in Interview Queue →
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p>{m.text}</p>

                  {/* Render Citation Chips if available */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-edge-default">
                      <div className="text-[10px] font-mono uppercase text-ink-tertiary mb-1.5 flex items-center justify-between">
                        <span>Verified Evidence Citations:</span>
                        {m.confidence && (
                          <span className="text-ink-primary font-mono font-semibold">
                            {(m.confidence * 100).toFixed(0)}% Grounded
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.citations.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleCitationClick(c, m.text)}
                            title={c.title}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-edge-strong bg-surface-elevated text-ink-primary hover:bg-surface-card text-[10px] font-mono transition-colors"
                          >
                            <svg className="w-3 h-3 text-ink-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                            </svg>
                            <span className="font-bold">{c.label}</span>
                            <span className="text-ink-secondary truncate max-w-[140px]">{c.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <span className="text-[9px] text-ink-tertiary mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-input bg-surface-card border border-edge-default max-w-xs text-xs text-ink-secondary">
            <svg className="animate-spin h-3.5 w-3.5 text-ink-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Retrieving leaver evidence & verifying citations...</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="p-3 border-t border-edge-default bg-surface-card flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={`Ask ${leaverName} about architecture, rollbacks, or runbooks...`}
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs font-mono rounded-input border border-edge-strong bg-surface-base text-ink-primary placeholder:text-ink-disabled focus:outline-none focus:border-ink-primary"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !inputQuery.trim()}
          className="px-4 py-2 text-xs font-semibold rounded-btn bg-ink-primary text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

