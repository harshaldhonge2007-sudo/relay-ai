import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InteractiveGridBackground, { GRID_CONFIG } from "../components/InteractiveGridBackground";

describe("InteractiveGridBackground Component", () => {
  beforeEach(() => {
    // Mock getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    });

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // Mock ResizeObserver
    globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Mock IntersectionObserver
    globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with aria-hidden and presentation attributes for strict accessibility", () => {
    render(<InteractiveGridBackground data-testid="grid-bg" />);

    const container = screen.getByTestId("grid-bg");
    expect(container).toBeDefined();
    expect(container.getAttribute("aria-hidden")).toBe("true");

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeDefined();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(canvas?.getAttribute("tabindex")).toBe("-1");
  });

  it("exports tuning constants block with expected technical values", () => {
    expect(GRID_CONFIG.BASE_SPACING).toBe(30);
    expect(GRID_CONFIG.LENS_RADIUS).toBe(155);
    expect(GRID_CONFIG.MAX_DISPLACEMENT).toBe(8.5);
    expect(GRID_CONFIG.POINTER_LERP).toBe(0.12);
    expect(GRID_CONFIG.RIPPLE_DURATION_MS).toBe(950);
    expect(GRID_CONFIG.MAX_RIPPLES).toBe(3);
    expect(GRID_CONFIG.LINE_MAX_ALPHA).toBeLessThanOrEqual(0.25);
  });

  it("mounts and cleans up all event listeners and observers on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <InteractiveGridBackground tone="auto" intensity={0.5} spacing={32} />
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("pointerleave", expect.any(Function));
  });

  it("respects prefers-reduced-motion: reduce without crashing", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <InteractiveGridBackground tone="light" intensity={1.0} />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeDefined();
    expect(canvas?.tagName.toLowerCase()).toBe("canvas");
  });
});
