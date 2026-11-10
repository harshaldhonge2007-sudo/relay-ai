import { useState, useCallback, useRef } from "react";
import { REPO_URL } from "../../constants";

const FAQS = [
  {
    id: "faq-1",
    question: "What is RELAY?",
    answer:
      "RELAY turns scattered project activity — GitHub, Slack, Jira, meeting notes and docs — into an evidence-linked, role-appropriate handover when someone leaves. Core workflow: Connect, Reconstruct, Verify, Review, Handover.",
  },
  {
    id: "faq-2",
    question: "Where does the data come from, and is anything real?",
    answer:
      "Nothing in this demo is real. The sample case (ShopLedger, Priya Nair) is a realistic but fictional scenario. Slack, Jira and meeting notes are seeded from local fixtures, and no real organisational data is ever used.",
  },
  {
    id: "faq-3",
    question: "How does it avoid making things up?",
    answer:
      "Every claim links to its evidence. A deterministic grounding verifier checks lexical and entity overlap against sources and tags each claim STATED, INFERRED or VERIFIED. Unsupported claims are downgraded with a reason — never invented, never silently hidden — and contradictions are shown side by side.",
  },
  {
    id: "faq-4",
    question: "Who can see what?",
    answer:
      "Roles control visibility, with per-source access levels, withheld notices and redaction. Enforcement runs server-side through signed demo tokens: the client never receives restricted titles, only aggregate withheld counts. Demo authentication is not production auth.",
  },
  {
    id: "faq-5",
    question: "Does the handover go out without human review?",
    answer:
      "No. The engineering lead edits, rejects (with a mandatory reason) or approves every claim. Release is gated until review is complete, and the incoming engineer formally acknowledges receipt.",
  },
  {
    id: "faq-6",
    question: "What does the blind-onboarding simulation actually do?",
    answer:
      "It checks whether required facts are covered using only the content the viewer’s role is allowed to see. It does not execute commands and does not access production systems.",
  },
  {
    id: "faq-7",
    question: "What are the limitations?",
    answer:
      "Pattern-based redaction can miss novel secret formats; connectors are fixtures except where noted; and the deterministic verifier checks lexical overlap, not meaning. These are design choices, disclosed up front in the known limitations section.",
  },
  {
    id: "faq-8",
    question: "Which AI tools were used to build it?",
    answer: (
      <>
        Google Gemini (prompt generation) and Anthropic Claude (architecture
        consultation and code auditing). See the{" "}
        <a
          href={`${REPO_URL}/blob/main/README.md#disclosure`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-primary underline underline-offset-2 hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary"
        >
          Disclosure section of the README
        </a>
        .
      </>
    ),
  },
] as const;

interface FaqProps {}

/** Light section (bg-surface-base) — sits between dark Limitations and dark ClosingCta. */
export default function Faq(_: FaqProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string, index: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (index + 1) % FAQS.length;
        buttonRefs.current[next]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (index - 1 + FAQS.length) % FAQS.length;
        buttonRefs.current[prev]?.focus();
      }
    },
    [toggle],
  );

  return (
    <section
      id="faq"
      className="bg-surface-base"
      aria-labelledby="faq-heading"
    >
      <div className="px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-[640px] mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-12"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Honest answers
          </h2>
          <div className="space-y-3" role="region" aria-label="Frequently asked questions">
            {FAQS.map(({ id, question, answer }, index) => {
              const isOpen = openId === id;
              return (
                <div key={id} className="relative z-10 border border-edge-default rounded-card overflow-hidden bg-surface-card">
                  <button
                    ref={(el) => (buttonRefs.current[index] = el)}
                    type="button"
                    onClick={() => toggle(id)}
                    onKeyDown={(e) => handleKeyDown(e, id, index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${id}`}
                    id={`faq-btn-${id}`}
                    className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left text-sm font-medium text-ink-primary bg-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200"
                  >
                    <span>{question}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke={isOpen ? "#111111" : "#555555"}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""} shrink-0`}
                      aria-hidden="true"
                    >
                      <polyline points="4 7 8 11 12 7" />
                    </svg>
                  </button>
                  <div
                    id={`faq-panel-${id}`}
                    role="region"
                    aria-labelledby={`faq-btn-${id}`}
                    className={`px-6 pb-4 text-sm text-ink-secondary leading-relaxed transition-all duration-300 ease-out ${
                      isOpen
                        ? "opacity-100 max-h-96"
                        : "opacity-0 max-h-0 overflow-hidden"
                    }`}
                  >
                    {answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
