import { useEffect, useState, useRef } from "react";

export interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  once?: boolean;
}

/**
 * Reveals children with a small translate + opacity when they enter the viewport.
 * No animation library. Respects prefers-reduced-motion via global CSS.
 */
export default function ScrollReveal({
  children,
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;
    let fired = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (!once || !fired)) {
            setVisible(true);
            fired = true;
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, once]);

  const style = {
    transitionDelay: `${delay}s`,
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(22px)",
  };

  return (
    <div
      ref={ref}
      style={style}
      className="transition-all duration-700 ease-out"
    >
      {children}
    </div>
  );
}
