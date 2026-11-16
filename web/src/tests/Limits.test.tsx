import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Limits from "../screens/Limits";

describe("Limits Screen (/limits)", () => {
  it("renders header, philosophy banner, and capabilities table", () => {
    render(
      <BrowserRouter>
        <Limits />
      </BrowserRouter>
    );

    // Header & badge
    expect(screen.getByText("System Boundaries & Known Limitations")).not.toBeNull();
    expect(screen.getByText("Honesty & System Boundaries")).not.toBeNull();
    expect(screen.getByText("The Organiser's Principle")).not.toBeNull();

    // Matrix capabilities
    expect(screen.getByText("Role-Based Access Control (RBAC)")).not.toBeNull();
    expect(screen.getByText("Live Read-Only GitHub Ingestion")).not.toBeNull();
    expect(screen.getByText("Slack & Jira Feeds")).not.toBeNull();
    expect(screen.getByText("Cryptographic Receipt Acknowledgement")).not.toBeNull();
    expect(screen.getByText("Onboarding Completeness Simulation")).not.toBeNull();

    // Dual half-life models
    expect(screen.getByText(/Half-Life Model A: 365 Days/i)).not.toBeNull();
    expect(screen.getByText(/Half-Life Model B: 180 Days/i)).not.toBeNull();

    // Invariants & human-in-the-loop
    expect(screen.getByText(/Platform Non-Goals & Invariants/i)).not.toBeNull();
    expect(screen.getByText(/What Always Requires a Human/i)).not.toBeNull();
  });
});
