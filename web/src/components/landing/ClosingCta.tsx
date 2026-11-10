import { useCallback } from "react";
import { REPO_URL } from "../../constants";

interface ClosingCtaProps {
  onTryDemo: () => void;
  hasImportRoute?: boolean;
}

/** Dark section (bg-ink-primary) — sits between light Faq and light Footer. */
export default function ClosingCta({
  onTryDemo,
  hasImportRoute = false,
}: ClosingCtaProps) {
  const tryDemo = useCallback(() => onTryDemo(), [onTryDemo]);

  return (
    <section
      className="bg-ink-primary text-white py-20 lg:py-32"
      aria-labelledby="closing-heading"
    >
      <div className="px-4 lg:px-6 max-w-6xl mx-auto text-center">
        <h2
          id="closing-heading"
          className="font-display font-semibold text-white tracking-tight leading-[0.95] mb-10 sm:mb-14"
          style={{ fontSize: "clamp(3.5rem, 12vw, 7rem)" }}
        >
          Also for your team&apos;s next goodbye.
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={tryDemo}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold rounded-btn border border-white text-white hover:bg-white hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-200"
          >
            Try the sample case
          </button>
          {hasImportRoute && (
            <a
              href={`${REPO_URL}/blob/main/README.md#quickstart`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-ink-disabled hover:text-white transition-colors duration-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm"
            >
              Import your own data
            </a>
          )}
        </div>
        <p className="mt-8 text-[10px] text-ink-disabled tracking-widest uppercase font-semibold">
          Synthetic demo data. Demo authentication.
        </p>
      </div>
    </section>
  );
}
