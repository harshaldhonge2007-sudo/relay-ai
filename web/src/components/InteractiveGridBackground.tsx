import React, { useEffect, useRef } from "react";

/* ==========================================================================
   TUNING & CONSTANTS — Provenance Grid Engine
   Adjust these knobs to dial in the aesthetic and physical response.
   ========================================================================== */
export const GRID_CONFIG = {
  // Lattice Geometry
  BASE_SPACING: 30,             // Lattice spacing in px on desktop (28-32px)
  MOBILE_SPACING_FACTOR: 1.4,   // Mobile spacing multiplier (~42px, reduces dot count by ~50%)
  BASE_RADIUS: 1.15,            // Normal dot radius in px
  LENS_MAX_RADIUS: 2.4,         // Peak dot radius under cursor lens

  // Cursor Lens & Magnetic Dynamics
  LENS_RADIUS: 155,             // Active cursor influence radius in px
  AMBIENT_RADIUS: 340,          // Wider ambient attraction/reaction radius in px
  MAX_DISPLACEMENT: 8.5,        // Max magnetic push away in px
  AMBIENT_DISPLACEMENT: 2.2,    // Subtle ambient sway for dots further out
  POINTER_LERP: 0.12,           // Weighted pointer lag (factor ~0.12)
  POINTER_FADE_RATE: 0.03,      // Dissolve rate when pointer leaves window

  // Dynamic Lattice Waves (Alive & Organic Ambient Breathing)
  BREATH_PERIOD_MS: 6400,       // Duration of primary breathing cycle in ms
  BREATH_DISPLACEMENT_X: 1.6,   // Horizontal harmonic drift in px
  BREATH_DISPLACEMENT_Y: 2.0,   // Vertical harmonic drift in px
  BREATH_RADIUS_SWING: 0.32,    // Dot size breathing swing (+/- 0.32px)
  BREATH_ALPHA_SWING: 0.09,     // Dot opacity breathing swing (+/- 0.09)

  // Scroll Parallax Dynamics (Lattice responds to page scrolling)
  SCROLL_SENSITIVITY: 0.35,     // Velocity impulse from scroll delta
  SCROLL_DISPLACEMENT: 0.22,    // Max vertical scroll lag displacement in px
  SCROLL_DAMPING: 0.88,         // Damping factor for scroll inertia

  // Click / Tap Pulses ("Relay Signal")
  MAX_RIPPLES: 3,               // Maximum concurrent pulse rings
  RIPPLE_DURATION_MS: 950,      // Ripple lifespan in ms
  RIPPLE_MAX_RADIUS: 520,       // Maximum ring reach across viewport
  RIPPLE_RING_WIDTH: 50,        // Width of the pulse wavefront in px
  RIPPLE_DISPLACEMENT: 8.0,     // Max radial displacement during pulse wave

  // Trace Lines (Evidence Connections)
  LINE_MAX_ALPHA: 0.25,         // Hairline connection opacity (<= 25%)
  LINE_WIDTH: 0.5,              // Hairline stroke width in px

  // Crosshairs (Closest Provenance Markers)
  CROSSHAIR_COUNT: 3,           // Number of closest dots morphing into "+"
  CROSSHAIR_MAX_DIST: 46,       // Max distance from pointer to morph to "+"
  CROSSHAIR_ARM_LEN: 2.8,       // Half-length of arm in px (total size ~5.6px)
  CROSSHAIR_STROKE_WIDTH: 1.0,  // 1px crisp stroke

  // Touch Devices & Ghost Cursor
  GHOST_FREQ_X: 0.00045,        // Lissajous X frequency
  GHOST_FREQ_Y: 0.00032,        // Lissajous Y frequency
  GHOST_INTENSITY: 0.50,        // Calmer lens influence for autonomous touch drift

  // Theme Colors (Strict Monochrome Tokens)
  // Light: Base #FAFAFA, Dots #787878 (32-35%), Active #111111, Lines #444444
  LIGHT_THEME: {
    dotRgb: [120, 120, 120] as const,     // #787878 (ink tertiary)
    dotBaseAlpha: 0.32,                   // 32% base opacity on light
    activeRgb: [17, 17, 17] as const,     // #111111 (ink primary)
    activeAlpha: 0.95,
    lineRgb: [60, 60, 60] as const,       // #3C3C3C hairlines
  },
  // Dark: Base #111111, Dots #BBBBBB (26-28%), Active #FFFFFF, Lines #BBBBBB
  DARK_THEME: {
    dotRgb: [195, 195, 195] as const,     // #C3C3C3 (ink disabled)
    dotBaseAlpha: 0.28,                   // 28% base opacity on dark
    activeRgb: [255, 255, 255] as const,  // #FFFFFF / full bright ink
    activeAlpha: 0.95,
    lineRgb: [210, 210, 210] as const,
  },
  THEME_CROSSFADE_MS: 400,      // Crossfade duration between light and dark tones (~400ms)

  // Performance & Quality Fallback
  DPR_CAP: 2,                   // Cap devicePixelRatio at 2 to conserve GPU fill-rate
  PERF_FALLBACK_FRAMES: 30,     // Consecutive frames > 16.7ms before disabling lines
  TARGET_FRAME_BUDGET_MS: 16.7, // Target 60fps frame budget
} as const;

/* ==========================================================================
   Component Props
   ========================================================================== */
export interface InteractiveGridBackgroundProps {
  /**
   * Color tone of the grid:
   * - "light": optimized for #FAFAFA base surfaces
   * - "dark": optimized for #111111 dark surfaces
   * - "auto": dynamically cross-fades via IntersectionObserver on [data-bg-tone]
   * @default "auto"
   */
  tone?: "light" | "dark" | "auto";

  /**
   * Global opacity/intensity multiplier (0.0 to 1.0).
   * Use ~0.4 in authenticated app shells for subtle legibility.
   * @default 1.0
   */
  intensity?: number;

  /**
   * Lattice base spacing in px.
   * @default 30
   */
  spacing?: number;

  /**
   * Enables pointer tracking, magnetic lens, and tap ripples.
   * When false, only idle breathing renders.
   * @default true
   */
  interactive?: boolean;

  /**
   * Stacking level. Defaults to 1 so the transparent canvas floats over
   * section background colors without blocking text, cards, or pointer events.
   * @default 1
   */
  zIndex?: number;

  /** Additional classes applied to container */
  className?: string;

  /** Inline styles applied to container */
  style?: React.CSSProperties;

  /** Test ID */
  "data-testid"?: string;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  active: boolean;
}

/**
 * InteractiveGridBackground — Monochrome "Provenance Grid"
 * Plain Canvas 2D engine with spatial bucketing, dual-frequency traveling waves,
 * scroll parallax inertia, typed arrays, and zero per-frame allocations.
 */
export default function InteractiveGridBackground({
  tone = "auto",
  intensity = 1.0,
  spacing = GRID_CONFIG.BASE_SPACING,
  interactive = true,
  zIndex = 1,
  className = "",
  style,
  "data-testid": testId,
}: InteractiveGridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const propsRef = useRef({ tone, intensity, spacing, interactive });
  propsRef.current = { tone, intensity, spacing, interactive };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Accessibility check: reduced motion
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let prefersReducedMotion = reducedMotionQuery.matches;

    // Touch device detection
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches);

    // Dimensions & Scaling
    let width = 0;
    let height = 0;
    let dpr = 1;
    let effectiveSpacing = spacing;
    let cols = 0;
    let rows = 0;
    let totalDots = 0;
    let originX = 0;
    let originY = 0;

    // Preallocated Typed Arrays for dot states (Zero GC in animation loop)
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let curX = new Float32Array(0);
    let curY = new Float32Array(0);
    let curRadius = new Float32Array(0);
    let curAlpha = new Float32Array(0);
    let isActive = new Uint8Array(0);
    let isCrosshair = new Uint8Array(0);

    // Pointer state
    const targetPointer = { x: -1000, y: -1000, active: false };
    const smoothedPointer = { x: -1000, y: -1000 };
    let pointerInfluence = 0.0;

    // Scroll parallax dynamics
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let scrollVelocity = 0;
    let scrollOffset = 0;

    // Ripples pool (fixed size to avoid allocations)
    const ripples: Ripple[] = [
      { x: 0, y: 0, startTime: 0, active: false },
      { x: 0, y: 0, startTime: 0, active: false },
      { x: 0, y: 0, startTime: 0, active: false },
    ];

    // Theme cross-fade state (0.0 = Light, 1.0 = Dark)
    let currentToneFactor = propsRef.current.tone === "dark" ? 1.0 : 0.0;
    let targetToneFactor = currentToneFactor;

    // Performance & adaptive fallback
    let consecutiveSlowFrames = 0;
    let enableTraceLines = true;
    let animationFrameId: number | null = null;
    let lastFrameTime = performance.now();
    let isDocumentHidden = document.hidden;

    /* ------------------------------------------------------------------ */
    /*  Grid Initialization & Allocation                                  */
    /* ------------------------------------------------------------------ */
    const initGrid = () => {
      width = window.innerWidth || document.documentElement.clientWidth || 1920;
      height = window.innerHeight || document.documentElement.clientHeight || 1080;
      dpr = Math.min(window.devicePixelRatio || 1, GRID_CONFIG.DPR_CAP);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      effectiveSpacing = isTouch
        ? propsRef.current.spacing * GRID_CONFIG.MOBILE_SPACING_FACTOR
        : propsRef.current.spacing;

      cols = Math.ceil(width / effectiveSpacing) + 1;
      rows = Math.ceil(height / effectiveSpacing) + 1;
      totalDots = cols * rows;

      originX = (width - (cols - 1) * effectiveSpacing) * 0.5;
      originY = (height - (rows - 1) * effectiveSpacing) * 0.5;

      if (baseX.length < totalDots) {
        baseX = new Float32Array(totalDots);
        baseY = new Float32Array(totalDots);
        curX = new Float32Array(totalDots);
        curY = new Float32Array(totalDots);
        curRadius = new Float32Array(totalDots);
        curAlpha = new Float32Array(totalDots);
        isActive = new Uint8Array(totalDots);
        isCrosshair = new Uint8Array(totalDots);
      }

      for (let r = 0; r < rows; r++) {
        const yPos = originY + r * effectiveSpacing;
        const rowOffset = r * cols;
        for (let c = 0; c < cols; c++) {
          const idx = rowOffset + c;
          baseX[idx] = originX + c * effectiveSpacing;
          baseY[idx] = yPos;
          curX[idx] = baseX[idx];
          curY[idx] = yPos;
          curRadius[idx] = GRID_CONFIG.BASE_RADIUS;
          curAlpha[idx] = GRID_CONFIG.LIGHT_THEME.dotBaseAlpha;
          isActive[idx] = 0;
          isCrosshair[idx] = 0;
        }
      }
    };

    /* ------------------------------------------------------------------ */
    /*  IntersectionObserver for Tone Awareness ("auto" mode)             */
    /* ------------------------------------------------------------------ */
    let intersectionObserver: IntersectionObserver | null = null;
    const trackedElements = new Set<Element>();

    const updateObservedElements = () => {
      if (propsRef.current.tone !== "auto" || typeof IntersectionObserver === "undefined") {
        return;
      }

      if (!intersectionObserver) {
        intersectionObserver = new IntersectionObserver(
          () => {
            const vCenter = window.innerHeight * 0.5;
            let detectedTone: "dark" | "light" | null = null;
            let largestRatio = 0;

            trackedElements.forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.top <= vCenter && rect.bottom >= vCenter) {
                const explicit = el.getAttribute("data-bg-tone");
                if (explicit === "dark" || explicit === "light") {
                  detectedTone = explicit;
                } else if (el.classList.contains("bg-ink-primary")) {
                  detectedTone = "dark";
                }
              }

              const visibleH =
                Math.min(rect.bottom, window.innerHeight) -
                Math.max(rect.top, 0);
              if (visibleH > 0 && visibleH > largestRatio) {
                largestRatio = visibleH;
                if (!detectedTone) {
                  const explicit = el.getAttribute("data-bg-tone");
                  if (explicit === "dark" || explicit === "light") {
                    detectedTone = explicit;
                  }
                }
              }
            });

            if (detectedTone) {
              targetToneFactor = detectedTone === "dark" ? 1.0 : 0.0;
            }
          },
          { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
        );
      }

      const nodes = document.querySelectorAll(
        "[data-bg-tone], section.bg-ink-primary, section.bg-surface-base"
      );
      trackedElements.clear();
      nodes.forEach((node) => {
        trackedElements.add(node);
        intersectionObserver?.observe(node);
      });
    };

    /* ------------------------------------------------------------------ */
    /*  Event Listeners                                                   */
    /* ------------------------------------------------------------------ */
    const handlePointerMove = (e: PointerEvent) => {
      if (!propsRef.current.interactive) return;
      targetPointer.x = e.clientX;
      targetPointer.y = e.clientY;
      targetPointer.active = true;
    };

    const handlePointerLeave = () => {
      targetPointer.active = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!propsRef.current.interactive) return;
      const now = performance.now();
      let slot = ripples.findIndex((r) => !r.active);
      if (slot === -1) {
        let oldestTime = Infinity;
        slot = 0;
        for (let i = 0; i < ripples.length; i++) {
          if (ripples[i].startTime < oldestTime) {
            oldestTime = ripples[i].startTime;
            slot = i;
          }
        }
      }
      ripples[slot].x = e.clientX;
      ripples[slot].y = e.clientY;
      ripples[slot].startTime = now;
      ripples[slot].active = true;
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      scrollVelocity += Math.max(-25, Math.min(25, delta * GRID_CONFIG.SCROLL_SENSITIVITY));
    };

    const handleVisibilityChange = () => {
      isDocumentHidden = document.hidden;
      if (!isDocumentHidden && !animationFrameId && !prefersReducedMotion) {
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        renderStatic();
      } else {
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    const resizeObserver = new ResizeObserver(() => {
      initGrid();
      updateObservedElements();
      if (prefersReducedMotion) {
        renderStatic();
      }
    });
    resizeObserver.observe(document.body);

    /* ------------------------------------------------------------------ */
    /*  Static Render for prefers-reduced-motion: reduce                   */
    /* ------------------------------------------------------------------ */
    const renderStatic = () => {
      ctx.clearRect(0, 0, width, height);
      const isDark =
        propsRef.current.tone === "dark" ||
        (propsRef.current.tone === "auto" && targetToneFactor > 0.5);

      const color = isDark
        ? GRID_CONFIG.DARK_THEME.dotRgb
        : GRID_CONFIG.LIGHT_THEME.dotRgb;
      const alpha =
        (isDark
          ? GRID_CONFIG.DARK_THEME.dotBaseAlpha
          : GRID_CONFIG.LIGHT_THEME.dotBaseAlpha) * propsRef.current.intensity;

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < totalDots; i++) {
        ctx.moveTo(baseX[i] + GRID_CONFIG.BASE_RADIUS, baseY[i]);
        ctx.arc(baseX[i], baseY[i], GRID_CONFIG.BASE_RADIUS, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    /* ------------------------------------------------------------------ */
    /*  Animation Loop                                                     */
    /* ------------------------------------------------------------------ */
    const render = (now: number) => {
      if (isDocumentHidden || prefersReducedMotion) {
        animationFrameId = null;
        return;
      }

      const dt = Math.min(now - lastFrameTime, 100);
      lastFrameTime = now;

      // Adaptive Performance Monitoring
      if (dt > GRID_CONFIG.TARGET_FRAME_BUDGET_MS) {
        consecutiveSlowFrames++;
        if (consecutiveSlowFrames >= GRID_CONFIG.PERF_FALLBACK_FRAMES) {
          enableTraceLines = false;
        }
      } else {
        consecutiveSlowFrames = Math.max(0, consecutiveSlowFrames - 1);
      }

      const { tone: currentToneProp, intensity: globalIntensity, interactive: isInteractive } =
        propsRef.current;

      if (currentToneProp === "dark") {
        targetToneFactor = 1.0;
      } else if (currentToneProp === "light") {
        targetToneFactor = 0.0;
      }

      const toneSpeed = dt / GRID_CONFIG.THEME_CROSSFADE_MS;
      currentToneFactor += (targetToneFactor - currentToneFactor) * Math.min(1.0, toneSpeed);

      // Color interpolation
      const lightTheme = GRID_CONFIG.LIGHT_THEME;
      const darkTheme = GRID_CONFIG.DARK_THEME;
      const tf = currentToneFactor;

      const dotR = Math.round(lightTheme.dotRgb[0] + (darkTheme.dotRgb[0] - lightTheme.dotRgb[0]) * tf);
      const dotG = Math.round(lightTheme.dotRgb[1] + (darkTheme.dotRgb[1] - lightTheme.dotRgb[1]) * tf);
      const dotB = Math.round(lightTheme.dotRgb[2] + (darkTheme.dotRgb[2] - lightTheme.dotRgb[2]) * tf);
      const dotBaseAlpha =
        (lightTheme.dotBaseAlpha + (darkTheme.dotBaseAlpha - lightTheme.dotBaseAlpha) * tf) *
        globalIntensity;

      const activeR = Math.round(lightTheme.activeRgb[0] + (darkTheme.activeRgb[0] - lightTheme.activeRgb[0]) * tf);
      const activeG = Math.round(lightTheme.activeRgb[1] + (darkTheme.activeRgb[1] - lightTheme.activeRgb[1]) * tf);
      const activeB = Math.round(lightTheme.activeRgb[2] + (darkTheme.activeRgb[2] - lightTheme.activeRgb[2]) * tf);
      const activeAlpha =
        (lightTheme.activeAlpha + (darkTheme.activeAlpha - lightTheme.activeAlpha) * tf) *
        globalIntensity;

      const lineR = Math.round(lightTheme.lineRgb[0] + (darkTheme.lineRgb[0] - lightTheme.lineRgb[0]) * tf);
      const lineG = Math.round(lightTheme.lineRgb[1] + (darkTheme.lineRgb[1] - lightTheme.lineRgb[1]) * tf);
      const lineB = Math.round(lightTheme.lineRgb[2] + (darkTheme.lineRgb[2] - lightTheme.lineRgb[2]) * tf);

      // Scroll Damped Spring Decay
      scrollVelocity *= GRID_CONFIG.SCROLL_DAMPING;
      scrollOffset += scrollVelocity;
      scrollOffset *= 0.84; // spring pull back to rest

      // Continuous Scroll Phase: moving down the page advances the spatial wave
      const scrollPhase = (typeof window !== "undefined" ? window.scrollY : 0) * 0.003;

      // Pointer Lerp Dynamics
      let activePointerX = smoothedPointer.x;
      let activePointerY = smoothedPointer.y;

      if (isInteractive) {
        if (targetPointer.active) {
          smoothedPointer.x += (targetPointer.x - smoothedPointer.x) * GRID_CONFIG.POINTER_LERP;
          smoothedPointer.y += (targetPointer.y - smoothedPointer.y) * GRID_CONFIG.POINTER_LERP;
          pointerInfluence = Math.min(1.0, pointerInfluence + 0.08);
          activePointerX = smoothedPointer.x;
          activePointerY = smoothedPointer.y;
        } else if (isTouch) {
          const ghostX = width * 0.5 + Math.sin(now * GRID_CONFIG.GHOST_FREQ_X) * (width * 0.35);
          const ghostY = height * 0.5 + Math.cos(now * GRID_CONFIG.GHOST_FREQ_Y) * (height * 0.30);
          smoothedPointer.x += (ghostX - smoothedPointer.x) * 0.05;
          smoothedPointer.y += (ghostY - smoothedPointer.y) * 0.05;
          pointerInfluence = GRID_CONFIG.GHOST_INTENSITY;
          activePointerX = smoothedPointer.x;
          activePointerY = smoothedPointer.y;
        } else {
          pointerInfluence = Math.max(0.0, pointerInfluence - GRID_CONFIG.POINTER_FADE_RATE);
        }
      } else {
        pointerInfluence = 0.0;
      }

      /* ---------------------------------------------------------------- */
      /*  1. Dual-Frequency Traveling Waves + Scroll Reaction (Never Static) */
      /* ---------------------------------------------------------------- */
      const t = now * 0.001; // time in seconds
      for (let r = 0; r < rows; r++) {
        const rowOffset = r * cols;
        for (let c = 0; c < cols; c++) {
          const idx = rowOffset + c;

          // Two overlapping traveling waves travelling diagonally with scroll phase
          const wave1 = Math.sin(t * 0.95 + c * 0.16 + r * 0.12 + scrollPhase);
          const wave2 = Math.cos(t * 0.70 - c * 0.10 + r * 0.16 + scrollPhase * 0.8);
          const compositeWave = (wave1 + wave2) * 0.5;

          // Distinct, organic drift: horizontal and vertical undulating movement
          const driftX = Math.cos(t * 0.8 + r * 0.14) * GRID_CONFIG.BREATH_DISPLACEMENT_X;
          const driftY = compositeWave * GRID_CONFIG.BREATH_DISPLACEMENT_Y + scrollOffset * GRID_CONFIG.SCROLL_DISPLACEMENT;

          curX[idx] = baseX[idx] + driftX;
          curY[idx] = baseY[idx] + driftY;

          // Rhythmic dot size breathing across the entire lattice
          curRadius[idx] = Math.max(
            0.8,
            GRID_CONFIG.BASE_RADIUS + compositeWave * GRID_CONFIG.BREATH_RADIUS_SWING
          );

          // Luminous opacity wave: dots gently oscillate between ~22% and ~44%
          curAlpha[idx] = Math.max(
            0.08,
            dotBaseAlpha + compositeWave * GRID_CONFIG.BREATH_ALPHA_SWING * globalIntensity
          );

          isActive[idx] = 0;
          isCrosshair[idx] = 0;
        }
      }

      /* ---------------------------------------------------------------- */
      /*  2. Wide-Range Ambient Field + Tight Lens Spatial Bucketing     */
      /* ---------------------------------------------------------------- */
      let c1Idx = -1, c1Dist = Infinity;
      let c2Idx = -1, c2Dist = Infinity;
      let c3Idx = -1, c3Dist = Infinity;

      let lensCMin = 0, lensCMax = -1;
      let lensRMin = 0, lensRMax = -1;

      if (pointerInfluence > 0.001) {
        const ambientRadius = GRID_CONFIG.AMBIENT_RADIUS;
        const lensRadius = GRID_CONFIG.LENS_RADIUS;

        // Query spatial box covering wide ambient radius
        const ambCMin = Math.max(0, Math.floor((activePointerX - ambientRadius - originX) / effectiveSpacing));
        const ambCMax = Math.min(cols - 1, Math.ceil((activePointerX + ambientRadius - originX) / effectiveSpacing));
        const ambRMin = Math.max(0, Math.floor((activePointerY - ambientRadius - originY) / effectiveSpacing));
        const ambRMax = Math.min(rows - 1, Math.ceil((activePointerY + ambientRadius - originY) / effectiveSpacing));

        lensCMin = Math.max(0, Math.floor((activePointerX - lensRadius - originX) / effectiveSpacing));
        lensCMax = Math.min(cols - 1, Math.ceil((activePointerX + lensRadius - originX) / effectiveSpacing));
        lensRMin = Math.max(0, Math.floor((activePointerY - lensRadius - originY) / effectiveSpacing));
        lensRMax = Math.min(rows - 1, Math.ceil((activePointerY + lensRadius - originY) / effectiveSpacing));

        for (let r = ambRMin; r <= ambRMax; r++) {
          const rowOffset = r * cols;
          for (let c = ambCMin; c <= ambCMax; c++) {
            const idx = rowOffset + c;
            const dx = baseX[idx] - activePointerX;
            const dy = baseY[idx] - activePointerY;
            const dist = Math.hypot(dx, dy);

            // A. Inside Tight Lens (< 155px): Peak growth, lines, magnetic push, crosshairs
            if (dist < lensRadius) {
              isActive[idx] = 1;

              const u = 1.0 - dist / lensRadius;
              const falloff = u * u * (3.0 - 2.0 * u);

              const push = GRID_CONFIG.MAX_DISPLACEMENT * Math.sin(u * Math.PI) * pointerInfluence;
              const invDist = 1.0 / (dist + 0.001);
              curX[idx] += dx * invDist * push;
              curY[idx] += dy * invDist * push;

              curRadius[idx] =
                GRID_CONFIG.BASE_RADIUS +
                (GRID_CONFIG.LENS_MAX_RADIUS - GRID_CONFIG.BASE_RADIUS) * falloff * pointerInfluence;

              curAlpha[idx] += (activeAlpha - curAlpha[idx]) * falloff * pointerInfluence;

              if (dist < GRID_CONFIG.CROSSHAIR_MAX_DIST) {
                if (dist < c1Dist) {
                  c3Dist = c2Dist; c3Idx = c2Idx;
                  c2Dist = c1Dist; c2Idx = c1Idx;
                  c1Dist = dist;   c1Idx = idx;
                } else if (dist < c2Dist) {
                  c3Dist = c2Dist; c3Idx = c2Idx;
                  c2Dist = dist;   c2Idx = idx;
                } else if (dist < c3Dist) {
                  c3Dist = dist;   c3Idx = idx;
                }
              }
            }
            // B. In Ambient Field (155px to 340px): Subtle organic sway when moving pointer nearby
            else if (dist < ambientRadius) {
              const uAmb = 1.0 - (dist - lensRadius) / (ambientRadius - lensRadius);
              const ambPush = Math.sin(uAmb * Math.PI) * GRID_CONFIG.AMBIENT_DISPLACEMENT * pointerInfluence;
              const invDist = 1.0 / (dist + 0.001);
              curX[idx] += dx * invDist * ambPush;
              curY[idx] += dy * invDist * ambPush;
              curAlpha[idx] += 0.06 * uAmb * pointerInfluence;
            }
          }
        }

        if (c1Idx !== -1) { isCrosshair[c1Idx] = 1; curAlpha[c1Idx] = activeAlpha; }
        if (c2Idx !== -1) { isCrosshair[c2Idx] = 1; curAlpha[c2Idx] = activeAlpha; }
        if (c3Idx !== -1) { isCrosshair[c3Idx] = 1; curAlpha[c3Idx] = activeAlpha; }
      }

      /* ---------------------------------------------------------------- */
      /*  3. Click / Tap Expanding Ripple Pulses                          */
      /* ---------------------------------------------------------------- */
      for (let i = 0; i < ripples.length; i++) {
        const rip = ripples[i];
        if (!rip.active) continue;

        const elapsed = now - rip.startTime;
        const progress = elapsed / GRID_CONFIG.RIPPLE_DURATION_MS;

        if (progress >= 1.0) {
          rip.active = false;
          continue;
        }

        const currRadius = progress * GRID_CONFIG.RIPPLE_MAX_RADIUS;
        const ringWidth = GRID_CONFIG.RIPPLE_RING_WIDTH;

        const ripCMin = Math.max(0, Math.floor((rip.x - currRadius - ringWidth - originX) / effectiveSpacing));
        const ripCMax = Math.min(cols - 1, Math.ceil((rip.x + currRadius + ringWidth - originX) / effectiveSpacing));
        const ripRMin = Math.max(0, Math.floor((rip.y - currRadius - ringWidth - originY) / effectiveSpacing));
        const ripRMax = Math.min(rows - 1, Math.ceil((rip.y + currRadius + ringWidth - originY) / effectiveSpacing));

        for (let r = ripRMin; r <= ripRMax; r++) {
          const rowOffset = r * cols;
          for (let c = ripCMin; c <= ripCMax; c++) {
            const idx = rowOffset + c;
            const dx = baseX[idx] - rip.x;
            const dy = baseY[idx] - rip.y;
            const dist = Math.hypot(dx, dy);
            const delta = Math.abs(dist - currRadius);

            if (delta < ringWidth) {
              const wave = Math.cos((delta / ringWidth) * (Math.PI * 0.5));
              const amp = wave * wave * (1.0 - progress) * GRID_CONFIG.RIPPLE_DISPLACEMENT;
              const invDist = 1.0 / (dist + 0.001);

              curX[idx] += dx * invDist * amp;
              curY[idx] += dy * invDist * amp;
              curAlpha[idx] = Math.min(1.0, curAlpha[idx] + wave * 0.30 * (1.0 - progress));
              isActive[idx] = 1;
            }
          }
        }
      }

      /* ---------------------------------------------------------------- */
      /*  4. Canvas Rendering                                             */
      /* ---------------------------------------------------------------- */
      ctx.clearRect(0, 0, width, height);

      // A. Trace Lines inside the Cursor Lens
      if (enableTraceLines && pointerInfluence > 0.05 && lensCMax >= lensCMin) {
        ctx.lineWidth = GRID_CONFIG.LINE_WIDTH;
        ctx.beginPath();
        let linesCount = 0;

        for (let r = lensRMin; r <= lensRMax; r++) {
          const rowOffset = r * cols;
          for (let c = lensCMin; c <= lensCMax; c++) {
            const idx = rowOffset + c;
            if (isActive[idx] !== 1) continue;

            const x1 = curX[idx];
            const y1 = curY[idx];

            if (c + 1 < cols) {
              const rightIdx = idx + 1;
              const midX = (x1 + curX[rightIdx]) * 0.5;
              const midY = (y1 + curY[rightIdx]) * 0.5;
              const midDist = Math.hypot(midX - activePointerX, midY - activePointerY);
              if (midDist < GRID_CONFIG.LENS_RADIUS) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(curX[rightIdx], curY[rightIdx]);
                linesCount++;
              }
            }

            if (r + 1 < rows) {
              const bottomIdx = idx + cols;
              const midX = (x1 + curX[bottomIdx]) * 0.5;
              const midY = (y1 + curY[bottomIdx]) * 0.5;
              const midDist = Math.hypot(midX - activePointerX, midY - activePointerY);
              if (midDist < GRID_CONFIG.LENS_RADIUS) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(curX[bottomIdx], curY[bottomIdx]);
                linesCount++;
              }
            }

            if (c + 1 < cols && r + 1 < rows) {
              const diagIdx = idx + cols + 1;
              const midX = (x1 + curX[diagIdx]) * 0.5;
              const midY = (y1 + curY[diagIdx]) * 0.5;
              const midDist = Math.hypot(midX - activePointerX, midY - activePointerY);
              if (midDist < GRID_CONFIG.LENS_RADIUS * 0.85) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(curX[diagIdx], curY[diagIdx]);
                linesCount++;
              }
            }
          }
        }

        if (linesCount > 0) {
          const lineAlpha = (GRID_CONFIG.LINE_MAX_ALPHA * pointerInfluence * globalIntensity).toFixed(3);
          ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${lineAlpha})`;
          ctx.stroke();
        }
      }

      // B. Dynamic Ambient Dots across the Lattice
      // Batched in two fast passes: standard dots and active dots
      for (let i = 0; i < totalDots; i++) {
        if (isCrosshair[i] === 0) {
          const alpha = curAlpha[i].toFixed(3);
          const r = curRadius[i];
          const colorR = isActive[i] === 1 ? activeR : dotR;
          const colorG = isActive[i] === 1 ? activeG : dotG;
          const colorB = isActive[i] === 1 ? activeB : dotB;

          ctx.fillStyle = `rgba(${colorR}, ${colorG}, ${colorB}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(curX[i], curY[i], r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // C. Crosshair Accents ("+" Provenance Markers)
      const arm = GRID_CONFIG.CROSSHAIR_ARM_LEN;
      ctx.lineWidth = GRID_CONFIG.CROSSHAIR_STROKE_WIDTH;
      ctx.strokeStyle = `rgba(${activeR}, ${activeG}, ${activeB}, ${activeAlpha.toFixed(3)})`;
      ctx.beginPath();
      let crosshairsDrawn = 0;
      for (let i = 0; i < totalDots; i++) {
        if (isCrosshair[i] === 1) {
          const px = Math.round(curX[i]) + 0.5;
          const py = Math.round(curY[i]) + 0.5;
          ctx.moveTo(px - arm, py);
          ctx.lineTo(px + arm, py);
          ctx.moveTo(px, py - arm);
          ctx.lineTo(px, py + arm);
          crosshairsDrawn++;
        }
      }
      if (crosshairsDrawn > 0) {
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Kickoff
    initGrid();
    updateObservedElements();

    if (prefersReducedMotion) {
      renderStatic();
    } else {
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    }

    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex, ...style }}
      aria-hidden="true"
      data-testid={testId}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
