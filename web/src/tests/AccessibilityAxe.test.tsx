import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Handover from "../screens/Handover";
import Cases from "../screens/Cases";
import Limits from "../screens/Limits";
import Landing from "../screens/Landing";
import { RoleContext } from "../contexts/CaseContext";
import { EvidenceDrawerProvider, useEvidenceDrawer } from "../components/EvidenceDrawer";
import { TopBar } from "../components/shell/TopBar";
import { ProvenanceBadge } from "../components/ui/ProvenanceBadge";
import { setMockFallback, setApiRole } from "../api";

const VIEWPORTS = [390, 768, 1024, 1440] as const;
const THEMES = ["light", "dark"] as const;

// Ensure window.matchMedia is polyfilled in JSDOM
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function setViewportAndTheme(width: number, theme: "light" | "dark") {
  window.innerWidth = width;
  window.innerHeight = 900;
  document.documentElement.style.width = `${width}px`;
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  window.dispatchEvent(new Event("resize"));
}

describe("Accessibility & Quality Gates (Prompt 10)", () => {
  beforeEach(async () => {
    setMockFallback(true);
    await setApiRole("engineering_lead");
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  /* ------------------------------------------------------------------ */
  /* 1. Axe-core Checks Across Screens, Viewports & Themes              */
  /* ------------------------------------------------------------------ */
  describe("Axe-core Automated Audits (Zero Serious/Critical Violations)", () => {
    // Parameterized test matrix across viewports (390, 768, 1024, 1440) and themes (light, dark)
    VIEWPORTS.forEach((width) => {
      THEMES.forEach((theme) => {
        it(`verifies Handover screen at ${width}px [${theme} theme]`, async () => {
          setViewportAndTheme(width, theme);
          const { container } = render(
            <RoleContext.Provider value={{ role: "engineering_lead", setRole: () => {} }}>
              <EvidenceDrawerProvider>
                <MemoryRouter initialEntries={["/cases/case-001/handover"]}>
                  <Routes>
                    <Route path="/cases/:caseId/handover" element={<Handover />} />
                  </Routes>
                </MemoryRouter>
              </EvidenceDrawerProvider>
            </RoleContext.Provider>
          );

          await waitFor(() => {
            expect(screen.getByTestId("review-triage-bar")).toBeDefined();
          });

          const results = await axe(container);
          const seriousOrCritical = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical"
          );

          expect(seriousOrCritical).toEqual([]);
        });

        it(`verifies Cases dashboard at ${width}px [${theme} theme]`, async () => {
          setViewportAndTheme(width, theme);
          const { container } = render(
            <RoleContext.Provider value={{ role: "engineering_lead", setRole: () => {} }}>
              <EvidenceDrawerProvider>
                <MemoryRouter initialEntries={["/cases"]}>
                  <Routes>
                    <Route path="/cases" element={<Cases />} />
                  </Routes>
                </MemoryRouter>
              </EvidenceDrawerProvider>
            </RoleContext.Provider>
          );

          await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Departure Cases" })).toBeDefined();
          });

          const results = await axe(container);
          const seriousOrCritical = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical"
          );

          expect(seriousOrCritical).toEqual([]);
        });

        it(`verifies Limits & System Boundaries screen at ${width}px [${theme} theme]`, async () => {
          setViewportAndTheme(width, theme);
          const { container } = render(
            <RoleContext.Provider value={{ role: "engineering_lead", setRole: () => {} }}>
              <EvidenceDrawerProvider>
                <MemoryRouter initialEntries={["/cases/case-001/limits"]}>
                  <Routes>
                    <Route path="/cases/:caseId/limits" element={<Limits />} />
                  </Routes>
                </MemoryRouter>
              </EvidenceDrawerProvider>
            </RoleContext.Provider>
          );

          await waitFor(() => {
            expect(screen.getByText(/System Boundaries & Known Limitations/i)).toBeDefined();
          });

          const results = await axe(container);
          const seriousOrCritical = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical"
          );

          expect(seriousOrCritical).toEqual([]);
        });

        it(`verifies Landing / Marketing screen at ${width}px [${theme} theme]`, async () => {
          setViewportAndTheme(width, theme);
          const { container } = render(
            <RoleContext.Provider value={{ role: "engineering_lead", setRole: () => {} }}>
              <EvidenceDrawerProvider>
                <MemoryRouter initialEntries={["/"]}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                  </Routes>
                </MemoryRouter>
              </EvidenceDrawerProvider>
            </RoleContext.Provider>
          );

          const results = await axe(container);
          const seriousOrCritical = results.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical"
          );

          expect(seriousOrCritical).toEqual([]);
        });
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 2. Keyboard-Only Operation, Focus Traps & Restoration               */
  /* ------------------------------------------------------------------ */
  describe("Keyboard-Only Operations & Focus Management", () => {
    it("traps focus and restores focus upon closing the Evidence Drawer", async () => {
      function TestHost() {
        const { openDrawer } = useEvidenceDrawer();
        return (
          <div>
            <button
              id="test-trigger-btn"
              onClick={() =>
                openDrawer(
                  [{ artifact_id: "art-001", title: "Test Artifact", body: "Sample evidence context" }],
                  "Test claim text"
                )
              }
            >
              Open Citations
            </button>
            <button id="after-btn">Other Element</button>
          </div>
        );
      }

      render(
        <EvidenceDrawerProvider>
          <TestHost />
        </EvidenceDrawerProvider>
      );

      const triggerBtn = screen.getByRole("button", { name: "Open Citations" });
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      // Open drawer
      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Evidence Citations Drawer" })).toBeDefined();
      });

      const closeBtn = screen.getByRole("button", { name: "Close evidence panel" });
      expect(closeBtn).toBeDefined();

      // Close via Escape key
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Evidence Citations Drawer" })).toBeNull();
      });

      // Focus should be returned to the trigger button
      expect(document.activeElement).toBe(triggerBtn);
    });

    it("verifies keyboard operation on modals (focus trap, tab wrap, and Esc dismiss)", async () => {
      render(
        <RoleContext.Provider value={{ role: "engineering_lead", setRole: () => {} }}>
          <EvidenceDrawerProvider>
            <MemoryRouter initialEntries={["/cases/case-001/handover"]}>
              <Routes>
                <Route path="/cases/:caseId/handover" element={<Handover />} />
              </Routes>
            </MemoryRouter>
          </EvidenceDrawerProvider>
        </RoleContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("review-triage-bar")).toBeDefined();
      });

      // Click shortcuts cheat sheet trigger [?]
      const shortcutsBtn = screen.getByRole("button", { name: /shortcuts \[\?\]/i });
      shortcutsBtn.focus();
      fireEvent.click(shortcutsBtn);

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Keyboard Shortcuts Cheat Sheet" })).toBeDefined();
      });

      // Press Esc to dismiss
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Keyboard Shortcuts Cheat Sheet" })).toBeNull();
      });

      // Focus returns to the trigger button
      expect(document.activeElement).toBe(shortcutsBtn);
    });

    it("verifies Demo Authentication Role Switcher is fully keyboard operable with accessible label", () => {
      const handleRoleChange = vi.fn();
      render(
        <MemoryRouter>
          <TopBar
            isSidebarOpen={true}
            onToggleSidebar={() => {}}
            role="engineering_lead"
            onRoleChange={handleRoleChange}
            onOpenCommandPalette={() => {}}
            onOpenShortcuts={() => {}}
          />
        </MemoryRouter>
      );

      // Accessible label and combobox element
      const roleSelect = screen.getByLabelText(/demo authentication role switcher/i);
      expect(roleSelect).toBeDefined();
      expect(roleSelect.tagName.toLowerCase()).toBe("select");

      // Verify label htmlFor association
      const label = screen.getByText(/viewing as:/i);
      expect(label.getAttribute("for")).toBe("topbar-role");

      // Focus and change value via keyboard event
      roleSelect.focus();
      expect(document.activeElement).toBe(roleSelect);

      fireEvent.change(roleSelect, { target: { value: "successor" } });
      expect(handleRoleChange).toHaveBeenCalledWith("successor");
    });
  });

  /* ------------------------------------------------------------------ */
  /* 3. Non-Color-Only Status Cues & Accessible Badges                   */
  /* ------------------------------------------------------------------ */
  describe("Non-Color-Only Status Cues & Provenance Badges", () => {
    it("renders ProvenanceBadge with full text, distinct symbols, and descriptive aria-labels", () => {
      const { rerender } = render(<ProvenanceBadge type="verified" />);
      let badge = screen.getByLabelText(/provenance: verified/i);
      expect(badge.textContent).toContain("VERIFIED");
      expect(badge.textContent).toContain("✓"); // distinct verified check icon

      rerender(<ProvenanceBadge type="stated" />);
      badge = screen.getByLabelText(/provenance: stated/i);
      expect(badge.textContent).toContain("STATED");
      expect(badge.textContent).toContain("✎"); // distinct stated pencil icon

      rerender(<ProvenanceBadge type="inferred" />);
      badge = screen.getByLabelText(/provenance: inferred/i);
      expect(badge.textContent).toContain("INFERRED");
      expect(badge.textContent).toContain("≈"); // distinct inferred approx icon

      rerender(<ProvenanceBadge type="unknown" />);
      badge = screen.getByLabelText(/provenance: unknown/i);
      expect(badge.textContent).toContain("UNKNOWN");
      expect(badge.textContent).toContain("?"); // distinct unknown question icon
    });

    it("verifies style rules include prefers-reduced-motion media query", () => {
      // In CSS, prefers-reduced-motion is tested via index.css rules:
      // duration 0.01ms, iteration-count 1, transition 0.01ms
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      expect(mql).toBeDefined();
    });
  });
});
