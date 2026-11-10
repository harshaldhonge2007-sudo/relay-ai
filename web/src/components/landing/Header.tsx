import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { label: "Method", href: "method" },
  { label: "Capabilities", href: "capabilities" },
  { label: "Trust", href: "role-demo" },
  { label: "FAQ", href: "faq" },
];

export interface LandingHeaderProps {
  onTryDemo: () => void;
  seeding: boolean;
}

export default function LandingHeader({ onTryDemo, seeding }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const headerRef = useRef<HTMLElement>(null);

  // Hide on scroll-down — but never while mobile menu is open
  const handleScroll = useCallback(() => {
    if (menuOpen) return;
    const y = window.scrollY;
    if (y > 60 && y > lastY.current) setHidden(true);
    else if (y < lastY.current || y <= 60) setHidden(false);
    lastY.current = y > 0 ? y : 0;
  }, [menuOpen]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Reveal header when any child receives focus
  const handleFocusIn = useCallback(() => {
    setHidden(false);
  }, []);

  // Keep header visible while mobile menu is open
  useEffect(() => {
    if (menuOpen) setHidden(false);
  }, [menuOpen]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }, []);

  const tryDemo = () => {
    setMenuOpen(false);
    onTryDemo();
  };

  return (
    <>
      <header
        ref={headerRef}
        onFocusCapture={handleFocusIn}
        className={`sticky top-0 z-40 border-b border-edge-default bg-white/90 backdrop-blur-sm transition-transform duration-300 ease-out ${
          hidden ? "-translate-y-full" : ""
        }`}
      >
        <div className="flex items-center justify-between px-4 lg:px-6 h-[56px]">
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-btn"
              aria-label="RELAY AI — go to home"
            >
              <span className="font-display font-semibold text-ink-primary tracking-tight text-lg sm:text-xl">
                RELAY
              </span>
              <span className="font-mono text-[10px] text-ink-secondary font-bold uppercase tracking-widest">
                AI
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium uppercase tracking-widest" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => scrollTo(link.href)}
                className="text-ink-secondary hover:text-ink-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-sm"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={tryDemo}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-btn border border-edge-strong text-ink-primary bg-transparent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seeding ? (
                <>
                  <svg
                    className="animate-spin h-3 w-3 text-ink-tertiary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Seeding…
                </>
              ) : (
                "Try the demo"
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="19" y2="6" />
                <line x1="3" y1="11" x2="19" y2="11" />
                <line x1="3" y1="16" x2="19" y2="16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-0 z-50 w-full bg-white flex flex-col lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
          >
            <div className="p-6 flex items-center justify-between border-b border-edge-subtle">
              <Link
                to="/"
                className="font-display font-semibold text-ink-primary tracking-tight text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-btn"
                onClick={() => setMenuOpen(false)}
              >
                RELAY<span className="font-mono text-[10px] text-ink-secondary font-bold uppercase tracking-widest ml-1">AI</span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-2 text-ink-secondary hover:text-ink-primary rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary transition-colors duration-200"
                aria-label="Close menu"
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <line x1="5" y1="5" x2="17" y2="17" />
                  <line x1="17" y1="5" x2="5" y2="17" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-6 space-y-1" aria-label="Mobile primary navigation">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-left px-4 py-4 text-lg font-display font-semibold text-ink-primary hover:bg-surface-elevated transition-colors duration-200 border-b border-edge-subtle rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={tryDemo}
                disabled={seeding}
                className="mt-6 block w-full px-4 py-4 text-lg font-display font-semibold text-ink-primary border border-edge-strong rounded-btn hover:bg-surface-elevated transition-colors duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary"
              >
                {seeding ? "Seeding demo…" : "Try the demo"}
              </button>
            </nav>

            <div className="p-6 border-t border-edge-subtle bg-surface-elevated text-[10px] uppercase tracking-widest text-ink-secondary font-semibold">
              Synthetic data · Demo authentication
            </div>
          </aside>
        </>
      )}
    </>
  );
}
