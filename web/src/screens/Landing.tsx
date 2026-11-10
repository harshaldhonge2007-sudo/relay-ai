import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setApiRole, API_PREFIX } from "../api";

import Header from "../components/landing/Header";
import Hero from "../components/landing/Hero";
import Manifesto from "../components/landing/Manifesto";
import MethodStepper from "../components/landing/MethodStepper";
import Capabilities from "../components/landing/Capabilities";
import ProductTour from "../components/landing/ProductTour";
import DemoVideo from "../components/landing/DemoVideo";
import RoleDemo from "../components/landing/RoleDemo";
import Comparison from "../components/landing/Comparison";
import ProofGrid from "../components/landing/ProofGrid";
import WhoItIsFor from "../components/landing/WhoItIsFor";
import KnownLimitations from "../components/landing/KnownLimitations";
import Faq from "../components/landing/Faq";
import ClosingCta from "../components/landing/ClosingCta";
import Footer from "../components/landing/Footer";
import Marquee from "../components/landing/Marquee";
import ScrollReveal from "../components/landing/ScrollReveal";
import InteractiveGridBackground from "../components/InteractiveGridBackground";

export default function Landing() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const tryDemo = useCallback(
    async (screen?: string) => {
      setSeeding(true);
      try {
        await setApiRole("engineering_lead");
        const res = await fetch(`${API_PREFIX}/cases`);
        const data = await res.json();
        const cases = Array.isArray(data) ? data : [];
        const demo =
          cases.find((c: any) => /shopledger|priya/i.test(c.name)) ??
          cases[0];
        if (demo?.id) {
          navigate(`/case/${demo.id}/${screen ?? "knowledge"}`);
        } else {
          navigate("/cases");
        }
      } catch {
        navigate("/cases");
      } finally {
        setSeeding(false);
      }
    },
    [navigate],
  );

  return (
    <div
      className="min-h-screen bg-surface-base text-ink-primary font-sans"
      style={{ overflowX: "clip" }}
    >
      {/* Skip to content — visible on focus */}
      <a
        href="#content"
        className="fixed top-4 left-[-10000px] z-50 px-3 py-2 text-xs font-semibold text-white bg-ink-primary border border-edge-strong rounded-btn focus-visible:left-4 transition-all duration-200"
      >
        Skip to content
      </a>

      <Header onTryDemo={() => { void tryDemo(); }} seeding={seeding} />

      {/* Provenance Grid fixed full-viewport canvas background */}
      <InteractiveGridBackground tone="auto" className="mask-grid-vignette" />

      <main id="content" className="relative">
        {/* 1. Hero (Light) */}
        <div data-bg-tone="light">
          <Hero onTryDemo={() => { void tryDemo(); }} seeding={seeding} />
          <Marquee reducedMotion={reduced} dark={false} />
        </div>

        {/* 2. Manifesto (Dark) */}
        <div data-bg-tone="dark">
          <ScrollReveal delay={0}>
            <Manifesto />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={true} />
        </div>

        {/* 3. Method (Light) — not wrapped in transform-based ScrollReveal to ensure sticky heading column on desktop */}
        <div data-bg-tone="light">
          <MethodStepper />
          <Marquee reducedMotion={reduced} dark={false} />
        </div>

        {/* 4. Capabilities (Dark) */}
        <div data-bg-tone="dark">
          <ScrollReveal delay={0.05}>
            <Capabilities
              onTryDemo={(screen?: string) => {
                void tryDemo(screen);
              }}
            />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={true} />
        </div>

        {/* 5. Product Tour (Light) */}
        <div data-bg-tone="light">
          <ScrollReveal delay={0.05}>
            <ProductTour
              onTryDemo={(screen?: string) => {
                void tryDemo(screen);
              }}
            />
          </ScrollReveal>

          {/* Optional Demo Video Slot (Hidden by default, shown when VIDEO_URL is defined) */}
          <DemoVideo />
          <Marquee reducedMotion={reduced} dark={false} />
        </div>

        {/* 6. Role Demo (Dark) */}
        <div data-bg-tone="dark">
          <ScrollReveal delay={0.05}>
            <RoleDemo />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={true} />
        </div>

        {/* 7. Comparison (Light) */}
        <div data-bg-tone="light">
          <ScrollReveal delay={0.05}>
            <Comparison />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={false} />
        </div>

        {/* 8. Proof Grid (Dark) */}
        <div data-bg-tone="dark">
          <ScrollReveal delay={0.05}>
            <ProofGrid
              onTryDemo={(screen?: string) => {
                void tryDemo(screen);
              }}
            />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={true} />
        </div>

        {/* 9. Who It's For (Light) */}
        <div data-bg-tone="light">
          <ScrollReveal delay={0.05}>
            <WhoItIsFor
              onTryDemo={(screen?: string) => {
                void tryDemo(screen);
              }}
            />
          </ScrollReveal>
        </div>

        {/* 10. Known Limitations Strip (Dark) */}
        <div data-bg-tone="dark">
          <KnownLimitations />
        </div>

        {/* 11. FAQ (Light) */}
        <div data-bg-tone="light">
          <ScrollReveal delay={0.05}>
            <Faq />
          </ScrollReveal>
          <Marquee reducedMotion={reduced} dark={false} />
        </div>

        {/* 12. Closing CTA (Dark) */}
        <div data-bg-tone="dark">
          <ScrollReveal delay={0.05}>
            <ClosingCta onTryDemo={() => { void tryDemo(); }} />
          </ScrollReveal>
        </div>

        {/* 13. Footer (Light) */}
        <div data-bg-tone="light">
          <Footer />
        </div>
      </main>
    </div>
  );
}
