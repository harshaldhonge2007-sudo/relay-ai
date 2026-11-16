import { describe, it, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Validation from "../screens/Validation";

describe("Validation Screen", () => {
  it("renders loading state and then renders backtest results", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bus-Factor Model Validation & Backtest/i)).not.toBeNull();
    });

    // Check KPI metrics
    expect(screen.getByText("Precision @ 1")).not.toBeNull();
    expect(screen.getByText("Precision @ 3")).not.toBeNull();
    expect(screen.getByText(/Mean Reciprocal Rank/i)).not.toBeNull();

    // Check repos listed in timeline
    expect(screen.getAllByText("pallets/flask").length).toBeGreaterThan(0);
    expect(screen.getAllByText("psf/requests").length).toBeGreaterThan(0);
    expect(screen.getAllByText("expressjs/express").length).toBeGreaterThan(0);
    expect(screen.getAllByText("encode/starlette").length).toBeGreaterThan(0);

    // Check methodology notes
    expect(screen.getByText(/Surviving Lines vs. Churn/i)).not.toBeNull();
  });

  it("switches inspected repository when timeline item is clicked", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bus-Factor Model Validation & Backtest/i)).not.toBeNull();
    });

    const requestsCard = screen.getByText("Kenneth Reitz");
    fireEvent.click(requestsCard);

    await waitFor(() => {
      expect(screen.getByText(/psf\/requests — Kenneth Reitz/i)).not.toBeNull();
      expect(screen.getByText("src/requests/sessions.py")).not.toBeNull();
    });
  });

  it("renders permission canary leak test results card when report is available", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Permission Canary Leak Test/i)).not.toBeNull();
    });

    expect(screen.getByText(/Permission-Aware Security Verification/i)).not.toBeNull();
    expect(screen.getByText(/CANARY_CONF_7f3a/i)).not.toBeNull();
    expect(screen.getByText(/CANARY_INT_91bc/i)).not.toBeNull();
  });

  it("renders verifier adversarial evidence panel and toggles between test and dev splits", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Verifier Adversarial Evaluation & Calibration/i)).not.toBeNull();
    });

    // Check header and badge
    expect(screen.getByText(/Layered Grounding Verifier Evaluation/i)).not.toBeNull();
    expect(screen.getByText(/False-VERIFY: 0.0% \(Unseen Test Split\)/i)).not.toBeNull();

    // Check KPI cards
    expect(screen.getByText(/False-VERIFY Rate \(Key\)/i)).not.toBeNull();
    expect(screen.getByText(/Precision \(VERIFIED\)/i)).not.toBeNull();
    expect(screen.getByText(/Recall \(VERIFIED\)/i)).not.toBeNull();
    expect(screen.getAllByText(/Ambiguous-Band Resolution/i).length).toBeGreaterThan(0);

    // Check category breakdown table renders
    expect(screen.getByText(/high lexical wrong evidence/i)).not.toBeNull();
    expect(screen.getByText(/temporal order flip/i)).not.toBeNull();

    // Switch to Dev Split
    const devBtn = screen.getByText(/Dev Split \(Calibration & Tuning/i);
    fireEvent.click(devBtn);

    await waitFor(() => {
      expect(screen.getByText(/DEV Split\)/i)).not.toBeNull();
    });
  });

  it("renders statistical disclaimer, provenance git SHA, and toggles backtest splits (overall, test, dev)", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bus-Factor Model Validation & Backtest/i)).not.toBeNull();
    });

    // Check statistical disclaimer and provenance
    expect(screen.getByText(/Statistical Disclaimer:/i)).not.toBeNull();
    expect(screen.getByText(/not statistically significant across all software engineering populations/i)).not.toBeNull();
    expect(screen.getAllByText(/Git SHA:/i).length).toBeGreaterThan(0);

    // Check 8-repo presence
    expect(screen.getAllByText(/vuejs\/vue/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/reduxjs\/redux/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tiangolo\/fastapi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tornadoweb\/tornado/i).length).toBeGreaterThan(0);

    // Switch to Held-Out Test Set
    const testSplitBtn = screen.getByText(/Held-Out Test Set/i);
    fireEvent.click(testSplitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Split Aggregate \(TEST\)/i)).not.toBeNull();
    });

    // Switch to Dev Tuning Set
    const devSplitBtn = screen.getByText(/Dev Tuning Set/i);
    fireEvent.click(devSplitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Split Aggregate \(DEV\)/i)).not.toBeNull();
    });
  });

  it("renders multi-baseline comparison table and blind Q&A evaluation benchmark", async () => {
    render(
      <BrowserRouter>
        <Validation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Multi-Baseline Comparison & 95% Bootstrap Confidence Intervals/i)).not.toBeNull();
    });

    // Check 5 baselines
    expect(screen.getByText(/RELAY Multi-Signal Model \(Defensible\)/i)).not.toBeNull();
    expect(screen.getByText(/Baseline 1: Raw Commit Count/i)).not.toBeNull();
    expect(screen.getByText(/Baseline 2: Line Survival \(Blame Only\)/i)).not.toBeNull();
    expect(screen.getByText(/Baseline 3: Recency-Weighted Commits/i)).not.toBeNull();
    expect(screen.getByText(/Baseline 4: CODEOWNERS Only/i)).not.toBeNull();

    // Check failure cases / loss scenarios
    expect(screen.getByText(/Cases Where the Model Loses, Ties, or Experiences Degraded Lift/i)).not.toBeNull();
    expect(screen.getByText(/Solo Author Dominance \(Express Tie\)/i)).not.toBeNull();
    expect(screen.getByText(/Compact Codebases \(Redux Blame Match\)/i)).not.toBeNull();

    // Check Q&A Grounding & Blind Evaluation Benchmark
    expect(screen.getByText(/Tested against/i)).not.toBeNull();
    expect(screen.getByText(/38 gold-standard questions/i)).not.toBeNull();
    expect(screen.getByText(/Contractor Existence Privacy/i)).not.toBeNull();
  });
});
