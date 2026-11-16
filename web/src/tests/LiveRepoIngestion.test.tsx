import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import LiveRepoIngestion from "../components/landing/LiveRepoIngestion";

describe("LiveRepoIngestion Component", () => {
  it("renders with header, input, and preset buttons", () => {
    render(
      <BrowserRouter>
        <LiveRepoIngestion />
      </BrowserRouter>
    );

    expect(screen.getByText(/Live GitHub Ingestion/i)).not.toBeNull();
    expect(screen.getByPlaceholderText(/owner\/repo/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /analyze repository/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: "pallets/flask" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "fastapi/fastapi" })).not.toBeNull();
  });

  it("populates repository input when a preset pill is clicked", () => {
    render(
      <BrowserRouter>
        <LiveRepoIngestion />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/owner\/repo/i) as HTMLInputElement;
    expect(input.value).toBe("");

    const flaskPreset = screen.getByRole("button", { name: "pallets/flask" });
    fireEvent.click(flaskPreset);

    expect(input.value).toBe("pallets/flask");
  });

  it("toggles advanced options (token & lookback window)", () => {
    render(
      <BrowserRouter>
        <LiveRepoIngestion />
      </BrowserRouter>
    );

    expect(screen.queryByPlaceholderText(/ghp_/i)).toBeNull();

    const toggleBtn = screen.getByRole("button", { name: /advanced options/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByPlaceholderText(/ghp_/i)).not.toBeNull();
    expect(screen.getByText(/Lookback Window:/i)).not.toBeNull();
  });

  it("initiates ingestion and triggers onSuccess callback", async () => {
    const onSuccess = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/cases/from-repo")) {
        return new Response(JSON.stringify({ case_id: "test-case-live", status: "ingesting" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("/ingest/status")) {
        return new Response(
          JSON.stringify({
            status: "complete",
            progress_pct: 100,
            commits: 50,
            pull_requests: 10,
            reviews: 8,
            issues: 5,
            codeowners_found: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify({ token: "test-tok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(
      <BrowserRouter>
        <LiveRepoIngestion onSuccess={onSuccess} />
      </BrowserRouter>
    );

    const preset = screen.getByRole("button", { name: "fastapi/fastapi" });
    fireEvent.click(preset);

    const analyzeBtn = screen.getByRole("button", { name: /analyze repository/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("test-case-live");
    }, { timeout: 3000 });

    fetchSpy.mockRestore();
  });
});
