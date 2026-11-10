import { Link } from "react-router-dom";

/**
 * 404 Not Found page in strict monochrome style.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-base text-ink-primary font-sans flex flex-col justify-between" style={{ overflowX: "clip" }}>
      <header className="h-[56px] border-b border-edge-default px-6 flex items-center justify-between bg-white/90">
        <Link to="/" className="font-display font-semibold text-ink-primary tracking-tight text-lg">
          RELAY<span className="font-mono text-[10px] text-ink-secondary font-bold uppercase tracking-widest ml-1">AI</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-secondary mb-3">
          Error 404
        </p>
        <h1 className="font-display font-semibold text-ink-primary tracking-tight text-4xl sm:text-6xl mb-6">
          Page not found
        </h1>
        <p className="text-sm text-ink-secondary max-w-md leading-relaxed mb-8">
          The requested route does not exist. All evidence and handover records are preserved in the sample case.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-btn border border-edge-strong text-ink-primary bg-transparent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-all duration-200"
        >
          Return to home
        </Link>
      </main>

      <footer className="border-t border-edge-default py-6 text-center text-[10px] font-mono uppercase tracking-widest text-ink-secondary">
        RELAY AI · Autonomous Offboarding
      </footer>
    </div>
  );
}

