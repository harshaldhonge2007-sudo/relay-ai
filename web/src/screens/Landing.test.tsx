import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Landing from "../screens/Landing";
import * as api from "../api";

function Harness() {
  return (
    <BrowserRouter>
      <Landing />
    </BrowserRouter>
  );
}

describe("Landing page", () => {
  it("renders the landing page with the primary CTA", () => {
    render(<Harness />);

    expect(
      screen.getByRole("heading", { name: /knowledge shouldn't/i })
    ).not.toBeNull();
    expect(
      screen.getAllByRole("button", { name: /try the sample case/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Synthetic demo data. Demo authentication.").length
    ).toBeGreaterThan(0);

    // No import CTA — no import flow exists yet
    expect(
      screen.queryAllByRole("link", { name: /import your own data/i }).length
    ).toBe(0);
    expect(
      screen.queryAllByRole("button", { name: /import your own data/i }).length
    ).toBe(0);
  });

  it("toggles an FAQ with the keyboard", () => {
    render(<Harness />);

    const btn = screen.getByRole("button", { name: /what is relay/i });
    const panel = document.getElementById("faq-panel-faq-1");
    expect(panel).not.toBeNull();
    expect(panel!.className).toContain("max-h-0");

    fireEvent.keyDown(btn, { key: "Enter" });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect((panel as HTMLElement).className).toContain("max-h-96");

    fireEvent.keyDown(btn, { key: " " });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect((panel as HTMLElement).className).toContain("max-h-0");
  });

  it("pause button stops rotation on rotating words and marquee", () => {
    render(<Harness />);

    const wordsPauseBtn = screen.getByRole("button", { name: /pause rotating words/i });
    expect(wordsPauseBtn).not.toBeNull();

    fireEvent.click(wordsPauseBtn);
    expect(screen.getByRole("button", { name: /play rotating words/i })).not.toBeNull();

    // Marquee pause buttons
    const marqueePauseButtons = screen.getAllByRole("button", { name: /pause marquee/i });
    expect(marqueePauseButtons.length).toBeGreaterThan(0);
    fireEvent.click(marqueePauseButtons[0]);
    expect(screen.getAllByRole("button", { name: /play marquee/i }).length).toBeGreaterThan(0);
  });

  it("role-demo tabs switch visible items and withheld notices", () => {
    render(<Harness />);

    // Initial state: Engineering Lead selected
    const leadTab = screen.getByRole("tab", { name: /engineering lead/i });
    const contractorTab = screen.getByRole("tab", { name: /contractor/i });
    expect(leadTab.getAttribute("aria-selected")).toBe("true");

    // Click Contractor tab
    fireEvent.click(contractorTab);
    expect(contractorTab.getAttribute("aria-selected")).toBe("true");
    expect(leadTab.getAttribute("aria-selected")).toBe("false");

    // Verify withheld items notice appears for contractor
    expect(screen.getByText(/withheld due to access restrictions/i)).not.toBeNull();
  });

  it("deep-link CTAs call the demo-login flow", async () => {
    const setApiRoleSpy = vi.spyOn(api, "setApiRole").mockResolvedValue(undefined as any);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "demo-case-123", name: "ShopLedger - Priya Nair Departure" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<Harness />);

    const primaryCta = screen.getAllByRole("button", { name: /try the sample case/i })[0];
    fireEvent.click(primaryCta);

    await waitFor(() => {
      expect(setApiRoleSpy).toHaveBeenCalledWith("engineering_lead");
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/cases"));
    });

    setApiRoleSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("provides a skip to content link", () => {
    render(<Harness />);
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip.getAttribute("href")).toBe("#content");
  });

  it("does not call the real API on initial render", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    render(<Harness />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
