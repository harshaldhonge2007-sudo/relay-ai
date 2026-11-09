import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EvidenceItem {
  artifact_id: string
  title?: string
  source?: string
  source_mode?: string
  type?: string
  author_id?: string
  occurred_at?: string
  url?: string | null
  body?: string | null
  highlight?: string   // substring to highlight in body
  provenance?: string
  external_id?: string
  withheld?: boolean
}

interface DrawerContextType {
  open: boolean
  items: EvidenceItem[]
  claimText?: string
  openDrawer: (items: EvidenceItem[], claimText?: string) => void
  closeDrawer: () => void
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const EvidenceDrawerContext = createContext<DrawerContextType>({
  open: false,
  items: [],
  claimText: undefined,
  openDrawer: () => {},
  closeDrawer: () => {},
})

export function EvidenceDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [claimText, setClaimText] = useState<string | undefined>()

  const openDrawer = useCallback((newItems: EvidenceItem[], text?: string) => {
    setItems(newItems)
    setClaimText(text)
    setOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <EvidenceDrawerContext.Provider value={{ open, items, claimText, openDrawer, closeDrawer }}>
      {children}
      <EvidenceDrawer />
    </EvidenceDrawerContext.Provider>
  )
}

export function useEvidenceDrawer() {
  return useContext(EvidenceDrawerContext)
}

/* ------------------------------------------------------------------ */
/*  Source icon helper                                                 */
/* ------------------------------------------------------------------ */

function sourceLabel(source?: string): string {
  switch (source) {
    case 'github': return 'GitHub'
    case 'slack': return 'Slack'
    case 'jira': return 'Jira'
    case 'docs': return 'Docs'
    case 'meetings': return 'Meeting Notes'
    default: return source ?? 'Unknown'
  }
}

function typeLabel(type?: string): string {
  switch (type) {
    case 'pull_request': return 'Pull Request'
    case 'commit': return 'Commit'
    case 'slack_message': return 'Slack Message'
    case 'jira_ticket': return 'Jira Ticket'
    case 'document': return 'Document'
    default: return type ?? 'Artifact'
  }
}

/* ------------------------------------------------------------------ */
/*  Highlight helper                                                   */
/* ------------------------------------------------------------------ */

function HighlightedBody({ body, highlight }: { body: string; highlight?: string }) {
  if (!highlight || !body.includes(highlight)) {
    return <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{body}</p>
  }
  const idx = body.indexOf(highlight)
  const before = body.slice(0, idx)
  const match = body.slice(idx, idx + highlight.length)
  const after = body.slice(idx + highlight.length)
  return (
    <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">
      {before}
      <mark className="bg-ink-primary/10 text-ink-primary font-medium not-italic px-0.5 rounded">{match}</mark>
      {after}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/*  Drawer panel                                                       */
/* ------------------------------------------------------------------ */

function EvidenceDrawer() {
  const { open, items, claimText, closeDrawer } = useContext(EvidenceDrawerContext)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 50)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, closeDrawer])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Evidence Citations Drawer"
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[480px] flex flex-col bg-white border-l border-edge-default shadow-float overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge-subtle shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary mb-0.5">
              Evidence
            </p>
            <h2 className="text-base font-semibold text-ink-primary leading-snug">
              Source Citations
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={closeDrawer}
            className="p-2 rounded-btn text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ink-primary/20"
            aria-label="Close evidence panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Claim text (if provided) */}
        {claimText && (
          <div className="px-6 py-3 bg-surface-elevated border-b border-edge-subtle shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary mb-1">Claim</p>
            <p className="text-sm text-ink-secondary leading-relaxed line-clamp-3">{claimText}</p>
          </div>
        )}

        {/* Source count pill */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <span className="inline-flex items-center rounded-pill bg-surface-elevated border border-edge-default px-3 py-1 text-xs font-medium text-ink-secondary">
            {items.length} source{items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Evidence items */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {items.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-tertiary">No evidence sources attached to this claim.</p>
            </div>
          )}

          {items.map((item, idx) => (
            <div
              key={`${item.artifact_id}-${idx}`}
              className="border border-edge-default rounded-card p-4 bg-surface-card"
            >
              {item.withheld ? (
                <div className="py-4 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-disabled">
                    Source withheld — insufficient access
                  </span>
                  <p className="text-xs text-ink-disabled mt-1">{item.artifact_id}</p>
                </div>
              ) : (
                <>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary mb-0.5">
                        {sourceLabel(item.source)} · {typeLabel(item.type)}
                      </p>
                      <p className="text-sm font-medium text-ink-primary leading-snug truncate">
                        {item.title ?? item.external_id ?? item.artifact_id}
                      </p>
                    </div>
                    {item.provenance && (
                      <span className="shrink-0 text-xs uppercase tracking-wider font-semibold rounded-pill border border-edge-strong px-2 py-0.5 text-ink-secondary">
                        {item.provenance}
                      </span>
                    )}
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-ink-disabled">
                    {item.external_id && (
                      <span className="font-mono">{item.external_id}</span>
                    )}
                    {item.source_mode && (
                      <span className="uppercase tracking-wider">{item.source_mode}</span>
                    )}
                    {item.occurred_at && (
                      <span>{new Date(item.occurred_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                  </div>

                  {/* Body */}
                  {item.body ? (
                    <div className="bg-surface-elevated rounded-input p-3 max-h-48 overflow-y-auto">
                      <HighlightedBody body={item.body} highlight={item.highlight} />
                    </div>
                  ) : (
                    <p className="text-xs text-ink-disabled italic">No body content available.</p>
                  )}

                  {/* Link */}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-ink-primary rounded"
                    >
                      View original
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5 8.5 3.5M5 3.5h3.5V7" />
                      </svg>
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-edge-subtle bg-surface-elevated shrink-0">
          <p className="text-[11px] text-ink-disabled text-center">
            Synthetic dataset — External APIs simulated
          </p>
        </div>
      </aside>
    </>
  )
}

