import { REPO_URL, EVENT_NAME } from "../../constants";

const FOOTER_LINKS = [
  { label: "README", href: `${REPO_URL}/blob/main/README.md` },
  { label: "GitHub repo", href: REPO_URL },
  { label: "DISCLOSURE.md", href: `${REPO_URL}/blob/main/README.md#disclosure` },
  {
    label: "Privacy and Responsible Design",
    href: `${REPO_URL}/blob/main/PRIVACY_AND_RESPONSIBLE_DESIGN.md`,
  },
  { label: "Testing notes", href: `${REPO_URL}/blob/main/TESTING.md` },
];

/** Light section (bg-surface-base) — final section. */
export default function Footer() {
  return (
    <footer className="bg-surface-base border-t border-edge-default" aria-label="Footer">
      <div className="px-4 lg:px-6 py-10 lg:py-14">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <nav className="flex flex-wrap gap-6 text-xs font-medium uppercase tracking-widest text-ink-secondary" aria-label="Repository links">
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-primary rounded-sm"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <p className="text-[10px] text-ink-secondary font-semibold uppercase tracking-widest leading-relaxed">
              Synthetic data · Demo authentication · Not for real organisational data.
              <br />
              Built for {EVENT_NAME}.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
