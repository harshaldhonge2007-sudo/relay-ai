import { MOCK_DB } from "./mockDb";
import type { RelayRole } from "../api";

// In-memory mock progress for simulated live repository ingestion
const mockIngestProgress: Record<string, any> = {};

export function handleMockApi(path: string, options: RequestInit = {}, role: RelayRole = "successor"): Response {
  // Normalize path: strip /api prefix and query parameters
  const cleanPath = path.replace(/^\/?api/, "").split("?")[0];
  const method = (options.method || "GET").toUpperCase();

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  // Live repository ingestion endpoint
  if (cleanPath === "/cases/from-repo" || cleanPath === "cases/from-repo") {
    let repo = "pallets/flask";
    try {
      const parsed = typeof options.body === "string" ? JSON.parse(options.body) : options.body || {};
      repo = parsed.repo || repo;
    } catch {}

    const newCaseId = "case-live-" + Math.floor(Math.random() * 9000 + 1000);
    mockIngestProgress[newCaseId] = {
      status: "ingesting",
      phase: "inspecting_repository",
      progress_pct: 15,
      commits: 0,
      pull_requests: 0,
      reviews: 0,
      issues: 0,
      codeowners_found: true,
      error: null,
      step: 1,
    };
    return jsonResponse({
      case_id: newCaseId,
      name: `${repo} (Live)`,
      repo_url: `https://github.com/${repo.replace('https://github.com/', '')}`,
      status: "ingesting",
      progress: mockIngestProgress[newCaseId],
    });
  }

  // Live ingest status polling
  if (cleanPath.includes("/ingest/status")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const caseId = parts[1];
    let prog = mockIngestProgress[caseId];
    if (!prog) {
      prog = {
        status: "complete",
        phase: "ready",
        progress_pct: 100,
        commits: 124,
        pull_requests: 42,
        reviews: 38,
        issues: 19,
        codeowners_found: true,
        error: null,
      };
    } else {
      prog.step = (prog.step || 1) + 1;
      if (prog.step === 2) {
        prog.phase = "fetching_commits";
        prog.commits = 48;
        prog.progress_pct = 35;
      } else if (prog.step === 3) {
        prog.phase = "fetching_pull_requests";
        prog.commits = 124;
        prog.pull_requests = 18;
        prog.reviews = 14;
        prog.progress_pct = 65;
      } else if (prog.step === 4) {
        prog.phase = "fetching_issues";
        prog.commits = 124;
        prog.pull_requests = 42;
        prog.reviews = 38;
        prog.issues = 19;
        prog.progress_pct = 85;
      } else {
        prog.status = "complete";
        prog.phase = "ready";
        prog.progress_pct = 100;
      }
    }
    return jsonResponse({
      case_id: caseId,
      case_status: prog.status === "complete" ? "detecting" : "ingesting",
      ...prog,
    });
  }

  // Auth endpoint
  if (cleanPath === "/auth/demo-login" || cleanPath === "auth/demo-login") {
    let userRole = role;
    if (options.body) {
      try {
        const parsed = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        if (parsed.user === "lead") userRole = "engineering_lead";
        else if (parsed.user === "successor") userRole = "successor";
        else if (parsed.user === "contractor") userRole = "contractor";
      } catch {}
    }
    return jsonResponse({
      token: "demo-standalone-token-" + Date.now(),
      role: userRole,
      display_name:
        userRole === "engineering_lead"
          ? "Alex Chen (Engineering Lead)"
          : userRole === "contractor"
          ? "Sam Rodriguez (Contractor)"
          : "Jordan Taylor (Successor)",
      note: "demo authentication — offline standalone fallback",
    });
  }

  // Cases endpoint
  if (cleanPath === "/cases" || cleanPath === "cases") {
    if (method === "POST") {
      try {
        const parsed = typeof options.body === "string" ? JSON.parse(options.body) : {};
        return jsonResponse({
          ...MOCK_DB.cases[0],
          id: "case-" + Math.floor(Math.random() * 900 + 100),
          name: parsed.name || "New Handover Case",
          repo_url: parsed.repo_url || "https://github.com/shopledger/api",
        });
      } catch {
        return jsonResponse(MOCK_DB.cases[0]);
      }
    }
    return jsonResponse(MOCK_DB.cases);
  }

  if (cleanPath === "/demo/seed" || cleanPath === "demo/seed") {
    return jsonResponse({ status: "ok", case_id: "case-001" });
  }

  // Empirical Backtest Validation endpoint
  if (cleanPath === "/validation/backtest" || cleanPath === "validation/backtest") {
    return jsonResponse({
      benchmark_name: "RELAY Defensible Multi-Signal Bus-Factor Backtest",
      version: "3.0",
      git_sha: "a75bcc9",
      generated_at: new Date().toISOString(),
      sample_size: {
        total_repos: 8,
        dev_repos: 4,
        test_repos: 4,
        total_components: 52,
        total_departures: 8,
      },
      headline_disclaimer: "case studies (n=8, 52 components), not statistically significant across all software engineering populations",
      summary: {
        total_repos_evaluated: 8,
        total_components_evaluated: 52,
        model_precision_at_1: 1.0,
        baseline_precision_at_1: 0.125,
        model_precision_at_3: 0.917,
        baseline_precision_at_3: 0.417,
        model_recall_at_3: 1.0,
        baseline_recall_at_3: 0.5,
        model_mrr: 1.0,
        baseline_mrr: 0.448,
        precision_at_3_lift_pct: 120.0,
      },
      splits: {
        overall: {
          total_repos: 8,
          total_components: 52,
          critical_components: 22,
          model_precision_at_1: 1.0,
          baseline_precision_at_1: 0.125,
          model_precision_at_3: 0.917,
          baseline_precision_at_3: 0.417,
          model_recall_at_3: 1.0,
          baseline_recall_at_3: 0.5,
          model_mrr: 1.0,
          baseline_mrr: 0.448,
          precision_at_3_lift_pct: 120.0,
          all_baselines: {
            commit_count: { precision_at_1: 0.125, precision_at_3: 0.417, recall_at_3: 0.5, mrr: 0.448 },
            line_count: { precision_at_1: 1.0, precision_at_3: 0.917, recall_at_3: 1.0, mrr: 1.0 },
            recency_weighted: { precision_at_1: 0.25, precision_at_3: 0.417, recall_at_3: 0.5, mrr: 0.531 },
            codeowners_only: { precision_at_1: 0.75, precision_at_3: 0.625, recall_at_3: 0.688, mrr: 0.781 },
          },
        },
        dev_tuning_set: {
          total_repos: 4,
          total_components: 25,
          critical_components: 10,
          model_precision_at_1: 1.0,
          baseline_precision_at_1: 0.25,
          model_precision_at_3: 0.833,
          baseline_precision_at_3: 0.5,
          model_recall_at_3: 1.0,
          baseline_recall_at_3: 0.667,
          model_mrr: 1.0,
          baseline_mrr: 0.562,
          precision_at_3_lift_pct: 66.7,
        },
        test_held_out_set: {
          total_repos: 4,
          total_components: 27,
          critical_components: 12,
          model_precision_at_1: 1.0,
          baseline_precision_at_1: 0.0,
          model_precision_at_3: 1.0,
          baseline_precision_at_3: 0.333,
          model_recall_at_3: 1.0,
          baseline_recall_at_3: 0.333,
          model_mrr: 1.0,
          baseline_mrr: 0.333,
          precision_at_3_lift_pct: 200.0,
        },
      },
      bootstrap_95_ci: {
        relay_defensible: {
          precision_at_1: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
          precision_at_3: { mean: 0.917, ci_95_low: 0.792, ci_95_high: 1.0 },
          recall_at_3: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
          mrr: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
        },
        commit_count: {
          precision_at_1: { mean: 0.125, ci_95_low: 0.0, ci_95_high: 0.375 },
          precision_at_3: { mean: 0.417, ci_95_low: 0.25, ci_95_high: 0.542 },
          recall_at_3: { mean: 0.5, ci_95_low: 0.292, ci_95_high: 0.708 },
          mrr: { mean: 0.448, ci_95_low: 0.333, ci_95_high: 0.583 },
        },
        line_count: {
          precision_at_1: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
          precision_at_3: { mean: 0.917, ci_95_low: 0.792, ci_95_high: 1.0 },
          recall_at_3: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
          mrr: { mean: 1.0, ci_95_low: 1.0, ci_95_high: 1.0 },
        },
        recency_weighted: {
          precision_at_1: { mean: 0.25, ci_95_low: 0.0, ci_95_high: 0.5 },
          precision_at_3: { mean: 0.417, ci_95_low: 0.25, ci_95_high: 0.542 },
          recall_at_3: { mean: 0.5, ci_95_low: 0.292, ci_95_high: 0.708 },
          mrr: { mean: 0.531, ci_95_low: 0.375, ci_95_high: 0.708 },
        },
        codeowners_only: {
          precision_at_1: { mean: 0.75, ci_95_low: 0.5, ci_95_high: 1.0 },
          precision_at_3: { mean: 0.625, ci_95_low: 0.458, ci_95_high: 0.792 },
          recall_at_3: { mean: 0.688, ci_95_low: 0.5, ci_95_high: 0.875 },
          mrr: { mean: 0.781, ci_95_low: 0.625, ci_95_high: 0.938 },
        },
      },
      methodology_notes: [
        "1. Surviving Lines vs. Churn: Baseline commits falsely flag utility & testing files (e.g., testsuite.py in Flask) because they see high commit counts from many short PRs. Line survival in HEAD correctly identifies core architectural modules.",
        "2. Review Topology vs. Solo Commits: The review graph penalizes lone unreviewed commits and credits active peer reviewers with secondary continuity.",
        "3. Honest Tradeoffs & Mixed Findings: On expressjs/express, TJ Holowaychuk was so overwhelmingly dominant that raw commits also captured the top components (tie between models). The defensible model provides the most dramatic lift in collaborative repositories where commit counts are noisy.",
        "4. Limitations: Repositories lacking CODEOWNERS rely more heavily on line survival and review graphs; repos with squashed commit merges require PR header parsing to recover granular author identities."
      ],
      repos: [
        {
          repo: "pallets/flask",
          split: "dev",
          leaver: "Armin Ronacher",
          departure_date: "2017-06-01",
          total_components: 6,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["core/app.py", "context/ctx.py", "blueprints/blueprints.py"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.333,
            recall_at_3: 0.333,
            mrr: 0.333,
            top_ranked_components: ["testing/testsuite.py", "cli/cli.py", "core/app.py"]
          },
          delta: { precision_at_3_lift: 0.667, mrr_lift: 0.667 }
        },
        {
          repo: "psf/requests",
          split: "dev",
          leaver: "Kenneth Reitz",
          departure_date: "2018-09-01",
          total_components: 7,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["src/requests/sessions.py", "src/requests/models.py", "src/requests/adapters.py"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.333,
            recall_at_3: 0.333,
            mrr: 0.333,
            top_ranked_components: ["src/requests/utils.py", "src/requests/api.py", "src/requests/models.py"]
          },
          delta: { precision_at_3_lift: 0.667, mrr_lift: 0.667 }
        },
        {
          repo: "expressjs/express",
          split: "dev",
          leaver: "TJ Holowaychuk",
          departure_date: "2014-06-01",
          total_components: 6,
          critical_components_count: 2,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 0.667,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["lib/router/index.js", "lib/application.js", "lib/response.js"]
          },
          baseline: {
            precision_at_1: 1.0,
            precision_at_3: 0.667,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["lib/router/index.js", "lib/application.js", "lib/response.js"]
          },
          delta: { precision_at_3_lift: 0.0, mrr_lift: 0.0 }
        },
        {
          repo: "encode/starlette",
          split: "dev",
          leaver: "Tom Christie",
          departure_date: "2022-01-01",
          total_components: 6,
          critical_components_count: 2,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 0.667,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["starlette/applications.py", "starlette/routing.py", "starlette/requests.py"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.667,
            recall_at_3: 1.0,
            mrr: 0.5,
            top_ranked_components: ["starlette/responses.py", "starlette/applications.py", "starlette/routing.py"]
          },
          delta: { precision_at_3_lift: 0.0, mrr_lift: 0.5 }
        },
        {
          repo: "vuejs/vue",
          split: "test",
          leaver: "Evan You",
          departure_date: "2019-10-01",
          total_components: 7,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["src/core/instance/index.js", "src/core/vdom/patch.js", "src/core/observer/index.js"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.0,
            recall_at_3: 0.0,
            mrr: 0.25,
            top_ranked_components: ["test/unit/features/directives/model.spec.js", "src/shared/util.js", "src/platforms/web/compiler/index.js"]
          },
          delta: { precision_at_3_lift: 1.0, mrr_lift: 0.75 }
        },
        {
          repo: "reduxjs/redux",
          split: "test",
          leaver: "Dan Abramov",
          departure_date: "2016-08-01",
          total_components: 6,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["src/createStore.js", "src/combineReducers.js", "src/applyMiddleware.js"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.667,
            recall_at_3: 0.667,
            mrr: 0.5,
            top_ranked_components: ["test/createStore.spec.js", "src/createStore.js", "src/combineReducers.js"]
          },
          delta: { precision_at_3_lift: 0.333, mrr_lift: 0.5 }
        },
        {
          repo: "tiangolo/fastapi",
          split: "test",
          leaver: "Sebastián Ramírez",
          departure_date: "2023-01-01",
          total_components: 7,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["fastapi/routing.py", "fastapi/applications.py", "fastapi/dependencies/models.py"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.333,
            recall_at_3: 0.333,
            mrr: 0.333,
            top_ranked_components: ["tests/test_tutorial/test_intro.py", "fastapi/openapi/utils.py", "fastapi/applications.py"]
          },
          delta: { precision_at_3_lift: 0.667, mrr_lift: 0.667 }
        },
        {
          repo: "tornadoweb/tornado",
          split: "test",
          leaver: "Ben Darnell",
          departure_date: "2021-04-01",
          total_components: 7,
          critical_components_count: 3,
          model: {
            precision_at_1: 1.0,
            precision_at_3: 1.0,
            recall_at_3: 1.0,
            mrr: 1.0,
            top_ranked_components: ["tornado/ioloop.py", "tornado/web.py", "tornado/httpclient.py"]
          },
          baseline: {
            precision_at_1: 0.0,
            precision_at_3: 0.333,
            recall_at_3: 0.333,
            mrr: 0.333,
            top_ranked_components: ["tornado/test/ioloop_test.py", "tornado/util.py", "tornado/web.py"]
          },
          delta: { precision_at_3_lift: 0.667, mrr_lift: 0.667 }
        }
      ]
    });
  }

  // Eval benchmark endpoint
  if (cleanPath === "/validation/eval" || cleanPath === "validation/eval") {
    return jsonResponse({
      benchmark_name: "RELAY Ask-the-Leaver Grounded Conversational Benchmark",
      version: "3.0",
      git_sha: "a75bcc9",
      generated_at: new Date().toISOString(),
      target_leaver: "Priya Nair",
      headline_disclaimer: "Defensible Q&A grounding benchmark (n=38). Contractor existence privacy rigorously verified.",
      summary: {
        total_questions: 38,
        answerable_count: 18,
        answerable_accuracy: 1.0,
        trap_count: 20,
        abstention_accuracy_on_traps: 1.0,
        abstention_pass_threshold: 0.8,
        abstention_passed: true,
        citation_precision: 0.69,
        overall_accuracy: 1.0,
        contractor_existence_privacy_preserved: true,
        category_breakdown: {
          original_benchmark: { total: 22, correct: 22, accuracy: 1.0 },
          partially_supported: { total: 4, correct: 4, accuracy: 1.0 },
          outdated_info: { total: 4, correct: 4, accuracy: 1.0 },
          contractor_confidential_abstention: { total: 3, correct: 3, accuracy: 1.0 },
          contractor_allowed: { total: 1, correct: 1, accuracy: 1.0 },
          hallucination_traps: { total: 2, correct: 2, accuracy: 1.0 },
          temporal_reasoning: { total: 1, correct: 1, accuracy: 1.0 },
          lead_authorized: { total: 1, correct: 1, accuracy: 1.0 },
        },
      },
      methodology: "38 gold questions (18 answerable, 20 trap/unanswerable) evaluated against Priya Nair's digital footprint.",
    });
  }

  // Permission canary leak test endpoint
  if (
    cleanPath === "/validation/leak-test" ||
    cleanPath === "validation/leak-test" ||
    cleanPath === "/leak_test_report.json" ||
    cleanPath === "leak_test_report.json"
  ) {
    return jsonResponse({
      status: "passed",
      generated_at: new Date().toISOString(),
      summary: {
        total_routes_checked: 34,
        roles_evaluated: ["engineering_lead", "successor", "contractor"],
        total_calls_tested: 114,
        canaries_checked: ["CANARY_CONF_7f3a", "CANARY_INT_91bc"],
        leaks_detected: 0,
        leak_free: true,
      },
      routes: [],
    });
  }

  // Verifier adversarial evaluation endpoint
  if (
    cleanPath === "/validation/verifier-eval" ||
    cleanPath === "validation/verifier-eval" ||
    cleanPath === "/verifier_adversarial_results.json" ||
    cleanPath === "verifier_adversarial_results.json"
  ) {
    return jsonResponse({
      status: "passed",
      generated_at: new Date().toISOString(),
      dataset_version: "1.0",
      total_pairs: 64,
      splits: {
        dev: {
          sample_count: 32,
          deterministic_only: {
            total_samples: 32,
            true_positives: 4,
            false_positives: 2,
            true_negatives: 24,
            false_negatives: 2,
            false_verify_rate: 0.0769,
            false_verify_rate_pct: 7.7,
            precision: 0.6667,
            precision_pct: 66.7,
            recall: 0.6667,
            recall_pct: 66.7,
            abstain_count: 2,
            abstain_rate: 0.0625,
            abstain_rate_pct: 6.2,
            ambiguous_band_total: 19,
            ambiguous_band_resolved: 17,
            ambiguous_band_resolved_pct: 89.5,
          },
          layered_verifier: {
            total_samples: 32,
            true_positives: 5,
            false_positives: 0,
            true_negatives: 26,
            false_negatives: 1,
            false_verify_rate: 0.0,
            false_verify_rate_pct: 0.0,
            precision: 1.0,
            precision_pct: 100.0,
            recall: 0.8333,
            recall_pct: 83.3,
            abstain_count: 0,
            abstain_rate: 0.0,
            abstain_rate_pct: 0.0,
            ambiguous_band_total: 19,
            ambiguous_band_resolved: 19,
            ambiguous_band_resolved_pct: 100.0,
          },
          categories: {
            entity_swap: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
            faithful_paraphrase: { total: 4, det_correct: 2, lay_correct: 3, det_false_verify: 0, lay_false_verify: 0 },
            high_lexical_wrong_evidence: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
            negation_flip: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            numeric_swap: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            prompt_injection: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            scope_overreach: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            temporal_order_flip: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
          },
        },
        test: {
          sample_count: 32,
          deterministic_only: {
            total_samples: 32,
            true_positives: 5,
            false_positives: 8,
            true_negatives: 18,
            false_negatives: 1,
            false_verify_rate: 0.3077,
            false_verify_rate_pct: 30.8,
            precision: 0.3846,
            precision_pct: 38.5,
            recall: 0.8333,
            recall_pct: 83.3,
            abstain_count: 3,
            abstain_rate: 0.0938,
            abstain_rate_pct: 9.4,
            ambiguous_band_total: 15,
            ambiguous_band_resolved: 12,
            ambiguous_band_resolved_pct: 80.0,
          },
          layered_verifier: {
            total_samples: 32,
            true_positives: 6,
            false_positives: 0,
            true_negatives: 26,
            false_negatives: 0,
            false_verify_rate: 0.0,
            false_verify_rate_pct: 0.0,
            precision: 1.0,
            precision_pct: 100.0,
            recall: 1.0,
            recall_pct: 100.0,
            abstain_count: 0,
            abstain_rate: 0.0,
            abstain_rate_pct: 0.0,
            ambiguous_band_total: 15,
            ambiguous_band_resolved: 15,
            ambiguous_band_resolved_pct: 100.0,
          },
          categories: {
            entity_swap: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
            faithful_paraphrase: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            high_lexical_wrong_evidence: { total: 4, det_correct: 0, lay_correct: 4, det_false_verify: 4, lay_false_verify: 0 },
            negation_flip: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
            numeric_swap: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            prompt_injection: { total: 4, det_correct: 4, lay_correct: 4, det_false_verify: 0, lay_false_verify: 0 },
            scope_overreach: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
            temporal_order_flip: { total: 4, det_correct: 3, lay_correct: 4, det_false_verify: 1, lay_false_verify: 0 },
          },
        },
      },
      categories_evaluated: [
        "entity_swap",
        "faithful_paraphrase",
        "high_lexical_wrong_evidence",
        "negation_flip",
        "numeric_swap",
        "prompt_injection",
        "scope_overreach",
        "temporal_order_flip",
      ],
      thresholds: {
        deterministic_grounding_threshold: 0.6,
        llm_ambiguous_band_low: 0.35,
        llm_ambiguous_band_high: 0.75,
        calibration_rationale: "Calibrated on dev split: Deterministic guards cap contradictory claims at <=0.45 regardless of lexical overlap. Layered LLM entailment checker resolves ambiguous band items (0.35-0.75) and flags subtle contradictions in high-lexical overlap claims, reducing the False-VERIFY rate from 30.8% down to 0.0% on the unseen test split.",
      },
      known_limitations: [
        "Invariant 5 strictly prohibits LLM from raising UNKNOWN (score < 0.35) to prevent hallucinated verification.",
        "Complete vocabulary dissociation (0.0 lexical overlap on paraphrases without shared nouns) scores 0.0 and remains UNKNOWN.",
        "Domain entities with ambiguous acronyms require explicit ticket or identifier grounding.",
      ],
    });
  }

  // People
  if (cleanPath.startsWith("/people/") || cleanPath.startsWith("people/")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const pid = parts[1];
    const person = MOCK_DB.people[pid] || { id: pid, display_name: "Team Member", is_leaver: false };
    return jsonResponse(person);
  }

  // Artifact detail
  if (cleanPath.startsWith("/artifacts/") || cleanPath.startsWith("artifacts/")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const artId = parts[1];
    const art = MOCK_DB.artifacts.find((a: any) => a.id === artId) || MOCK_DB.artifacts[0];
    return jsonResponse(art);
  }

  // Case sub-routes: /cases/:caseId/...
  if (cleanPath.startsWith("/cases/") || cleanPath.startsWith("cases/")) {
    const parts = cleanPath.split("/").filter(Boolean); // ['cases', caseId, ...]
    const sub = parts[2];

    if (!sub) {
      return jsonResponse(MOCK_DB.cases[0]);
    }

    if (sub === "components") {
      return jsonResponse(MOCK_DB.components);
    }

    if (sub === "ask") {
      let q = "";
      try {
        const bodyObj = typeof options.body === "string" ? JSON.parse(options.body) : options.body || {};
        q = (bodyObj.question || "").toLowerCase();
      } catch {}

      const traps = ["root key", "wifi", "mongodb", "salary", "bonus", "competitor", "rust", "ceo"];
      const isTrap = traps.some(t => q.includes(t));

      if (isTrap || !q.trim()) {
        return jsonResponse({
          case_id: parts[1],
          leaver_name: "Priya Nair",
          question: q,
          answer: "Priya Nair didn't leave enough written trace on this topic. We have abstained from guessing and automatically added this inquiry to Priya Nair's Exit Interview Queue.",
          citations: [],
          confidence: 0.0,
          abstained: true,
          interview_question_id: "q-escalated-" + Math.floor(Math.random() * 9000 + 1000),
          role,
          reason: "The departing engineer left insufficient written evidence regarding this inquiry.",
        });
      }

      if (q.includes("jwt") || q.includes("token") || q.includes("expire")) {
        return jsonResponse({
          case_id: parts[1],
          leaver_name: "Priya Nair",
          question: q,
          answer: "Based on the commit log and PR review history, the JWT access token lifetime was reduced from 2 hours down to 15 minutes to mitigate replay attack risks. Refresh tokens remain valid for 7 days. See commit a1b2c3d and PR #142 for the implementation details.",
          citations: [
            {
              id: "a1b2c3d",
              type: "commit",
              label: "[COMMIT a1b2c3d]",
              title: "Reduce JWT lifetime from 2h to 15m",
              url: "https://github.com/shopledger/api/commit/a1b2c3d",
              snippet: "auth: reduce JWT access token expiration from 2 hours to 15 minutes to limit replay attack windows."
            },
            {
              id: "142",
              type: "pr",
              label: "[PR 142]",
              title: "PR #142: Token revocation via Redis",
              url: "https://github.com/shopledger/api/pull/142",
              snippet: "Implements token blacklist via Redis for explicit logout. Closes security audit item SEC-89."
            }
          ],
          confidence: 0.95,
          abstained: false,
          interview_question_id: null,
          role,
          reason: "Claims grounded in verified leaver commits, PRs, and tickets.",
        });
      }

      if (q.includes("currency") || q.includes("sl-287") || q.includes("revert")) {
        return jsonResponse({
          case_id: parts[1],
          leaver_name: "Priya Nair",
          question: q,
          answer: "The multi-currency migration under ticket SL-287 was deployed to staging but reverted on the same day due to floating-point rounding discrepancies in the Stripe ledger reconciliation. Documented in Jira SL-287 and commit e5f6g7h.",
          citations: [
            {
              id: "SL-287",
              type: "jira",
              label: "[JIRA SL-287]",
              title: "SL-287: Multi-currency billing rollout & rollback",
              url: "https://jira.internal/browse/SL-287",
              snippet: "SL-287: Multi-currency conversion deployed to staging. Rolled back same day due to floating-point rounding mismatches."
            }
          ],
          confidence: 0.92,
          abstained: false,
          interview_question_id: null,
          role,
          reason: "Claims grounded in verified leaver commits, PRs, and tickets.",
        });
      }

      return jsonResponse({
        case_id: parts[1],
        leaver_name: "Priya Nair",
        question: q,
        answer: "Based on Priya Nair's commits and architecture documentation, payment processing requires exponential backoff with max 5 retries over 24 hours, and idempotency keys cached in Redis for 48 hours. See PR #189.",
        citations: [
          {
            id: "189",
            type: "pr",
            label: "[PR 189]",
            title: "PR #189: Stripe webhook idempotency & exponential backoff",
            url: "https://github.com/shopledger/api/pull/189",
            snippet: "Caches idempotency keys in Redis for 48 hours. Configures exponential backoff with max 5 retries over 24 hours."
          }
        ],
        confidence: 0.88,
        abstained: false,
        interview_question_id: null,
        role,
        reason: "Claims grounded in verified leaver commits, PRs, and tickets.",
      });
    }

    if (sub === "knowledge") {
      const components = Object.fromEntries(MOCK_DB.components.map((c: any) => [c.id, c]));
      const scores = MOCK_DB.knowledge_scores.map((ks: any) => {
        const comp = components[ks.component_id] || {};
        const criticality = comp.criticality ?? 0.5;
        const L = ks.score <= 1.0 ? ks.score * 100 : ks.score;
        const others = MOCK_DB.knowledge_scores
          .filter((o: any) => o.component_id === ks.component_id && o.person_id !== ks.person_id)
          .map((o: any) => (o.score <= 1.0 ? o.score * 100 : o.score));
        const B = others.length && L > 0 ? Math.min(Math.max(...others) / L, 1.0) : 0;
        const D = 0.6;
        const risk = Math.round(criticality * (L / 100) * (1 - B) * (1 - 0.6 * D) * 1000) / 1000;
        return {
          ...ks,
          score: L,
          breakdown: {
            edits: ks.breakdown?.edits <= 1 ? ks.breakdown.edits * 100 : ks.breakdown?.edits,
            reviews: ks.breakdown?.reviews <= 1 ? ks.breakdown.reviews * 100 : ks.breakdown?.reviews,
            discussion: ks.breakdown?.discussion <= 1 ? ks.breakdown.discussion * 100 : ks.breakdown?.discussion,
          },
          risk,
          risk_formula: `Knowledge Concentration Risk = ${criticality.toFixed(2)} × ${(L / 100).toFixed(2)} × (1 − ${B.toFixed(2)}) × (1 − 0.6 × ${D.toFixed(2)}) = ${risk.toFixed(3)}`,
          risk_score_name: "Knowledge Concentration Risk",
        };
      });
      return jsonResponse(scores);
    }

    if (sub === "artifacts") {
      const allowedRoles =
        role === "engineering_lead"
          ? ["engineering_lead", "successor", "contractor"]
          : role === "successor"
          ? ["successor", "contractor"]
          : ["contractor"];
      const visible = MOCK_DB.artifacts.filter((a: any) => {
        const itemRoles = a.acl?.allowed_roles || ["engineering_lead", "successor", "contractor"];
        return itemRoles.some((r: string) => allowedRoles.includes(r));
      });
      const withheld = MOCK_DB.artifacts.length - visible.length;
      return jsonResponse({
        items: visible,
        withheld_count: withheld,
        withheld_notice: withheld > 0 ? `${withheld} item(s) withheld due to access restrictions` : null,
        role,
      });
    }

    if (sub === "findings") {
      return jsonResponse(MOCK_DB.findings);
    }

    if (sub === "questions") {
      if (parts[3] && parts[4] === "answer") {
        return jsonResponse({ status: "ok", question_id: parts[3] });
      }
      return jsonResponse(MOCK_DB.questions);
    }

    if (sub === "webhooks") {
      if (parts[3] === "simulate-drift") {
        const hoList: any[] = Array.isArray(MOCK_DB.handover) ? MOCK_DB.handover : (MOCK_DB.handover?.items || []);
        const ho1 = hoList.find((i: any) => i.id === "ho-001");
        if (ho1) {
          ho1.is_stale = true;
          ho1.evidence_drift = {
            drifted: true,
            is_stale: true,
            badge: "Evidence changed since approval",
            detected_at: new Date().toISOString(),
            trigger_event: "pull_request.closed (merged=true)",
            artifact_id: "art-001",
            external_id: "PR #47",
            issue_key: "SL-456",
            drift_summary: "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
            prior_evidence: "PR #47 state: open (in-flight draft, assigned to Priya Nair)",
            current_evidence: "PR #47 state: closed (merged to main in commit a8f912c by Alex Chen)",
            diff: "- PR #47 State: open (in-flight draft)\n- Assignee: Priya Nair\n+ PR #47 State: closed (merged into main)\n+ Merged by: Alex Chen (alexc)\n+ Merge Commit: a8f912c",
          };
        }
        return jsonResponse({
          status: "drift_detected",
          case_id: parts[1],
          event_type: "pull_request",
          affected_claims: ["ho-001"],
          re_review_item_id: "rr-001",
          badge: "Evidence changed since approval",
          drift_summary: "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
          diff: "- PR #47 State: open (in-flight draft)\n- Assignee: Priya Nair\n+ PR #47 State: closed (merged into main)\n+ Merged by: Alex Chen (alexc)\n+ Merge Commit: a8f912c",
          living_memory_updated: true,
        });
      }
    }

    if (sub === "handover") {
      if (parts[3] === "re-review-queue") {
        if (role === "contractor") {
          return jsonResponse([]);
        }
        return jsonResponse([
          {
            id: "rr-001",
            case_id: parts[1] || "case-001",
            claim_id: "ho-001",
            claim_text: "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 contains the exponential backoff queue. Remaining items: integration test suite and SQS dead-letter queue with 72h retention. PagerDuty P2 alert at 3 consecutive failures. Ready for Alex Chen to take over review and complete deployment. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
            section: "In-Flight Work",
            status: "pending",
            drift_summary: "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
            prior_evidence: "PR #47 state: open (in-flight draft, assigned to Priya Nair)",
            current_evidence: "PR #47 state: closed (merged to main in commit a8f912c by Alex Chen)",
            diff: "- PR #47 State: open (in-flight draft)\n- Assignee: Priya Nair\n+ PR #47 State: closed (merged into main)\n+ Merged by: Alex Chen (alexc)\n+ Merge Commit: a8f912c",
            suggested_update: "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 was merged into main by Alex Chen on Oct 18 (commit a8f912c). Webhook exponential backoff is now active in production. Remaining items: integration test suite and SQS dead-letter queue with 72h retention. PagerDuty P2 alert at 3 consecutive failures. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
            detected_at: new Date().toISOString(),
            resolved_at: null,
            resolved_by: null,
            resolution_action: null,
            evidence_acl: { visibility: "public", allowed_roles: ["engineering_lead", "successor", "contractor"] },
          }
        ]);
      }

      if (parts[3] === "re-review" && parts[5] === "resolve") {
        if (role !== "engineering_lead") {
          return jsonResponse({ detail: "Only engineering_lead can resolve re-review queue items." }, 403);
        }
        const claimId = parts[4] || "ho-001";
        const hoList: any[] = Array.isArray(MOCK_DB.handover) ? MOCK_DB.handover : (MOCK_DB.handover?.items || []);
        const ho1 = hoList.find((i: any) => i.id === claimId);
        if (ho1) {
          ho1.is_stale = false;
          if (ho1.evidence_drift) {
            ho1.evidence_drift.resolved = true;
          }
        }
        return jsonResponse({
          status: "resolved",
          action: "amend",
          claim_id: claimId,
          new_version: 2,
          released_version: 2,
          change_summary: `Resolved evidence drift on claim ${claimId}`,
        });
      }

      if (parts[3] === "drift-status") {
        const hoList: any[] = Array.isArray(MOCK_DB.handover) ? MOCK_DB.handover : (MOCK_DB.handover?.items || []);
        const ho1 = hoList.find((i: any) => i.id === "ho-001");
        const hasDrift = ho1?.is_stale || false;
        return jsonResponse({
          has_drift: hasDrift,
          stale_claim_count: hasDrift ? 1 : 0,
          re_review_pending_count: hasDrift ? 1 : 0,
          latest_released_version: 2,
          acknowledged_version: 1,
          update_available: true,
        });
      }

      if (parts[3] === "versions") {
        if (parts[5] === "restore-as-draft") {
          const vNum = parseInt(parts[4] || "1", 10);
          return jsonResponse({
            status: "restored",
            new_version: 2,
            source_version: vNum,
            claim_count: 5,
            change_summary: `Restored as new draft from Version v${vNum}`,
            audit_log_url: `/cases/${parts[1]}/admin?tab=audit`,
          });
        }
        return jsonResponse(MOCK_DB.handover_versions || [
          {
            version: 1,
            author: "System (Autonomous Handover Engine)",
            timestamp: "2024-10-16T12:00:00Z",
            change_summary: "Initial synthesized handover pack (5 claims extracted)",
            is_released: false,
            claim_count: 5,
          }
        ]);
      }
      if (parts[3] === "diff") {
        const v1 = parseInt(parts[4] || "1", 10) || 1;
        const v2 = parseInt(parts[5] || "2", 10) || 2;
        return jsonResponse({
          v1,
          v2,
          v1_meta: { author: "System", timestamp: "2024-10-16T12:00:00Z", summary: "Initial synthesized handover pack", is_released: false },
          v2_meta: { author: "Alex Chen (Engineering Lead)", timestamp: "2024-10-16T14:30:00Z", summary: "Lead review and correction", is_released: false },
          summary: "1 modified/edited, 0 added, 0 rejected/removed",
          audit_log_url: `/cases/${parts[1]}/admin?tab=audit`,
          diff: [
            {
              claim_id: "ho-003",
              section: "Architecture & Auth",
              change_type: "edited",
              v1: {
                status: "pending",
                text: "Users experiencing premature session timeouts after 15 minutes instead of 2 hours.",
                provenance: "stated",
              },
              v2: {
                status: "approved",
                text: "Users experiencing premature session timeouts after 2 hours (corrected from 15 minutes).",
                provenance: "verified",
              },
              word_diff: [
                { type: "equal", text: "Users experiencing premature session timeouts after " },
                { type: "delete", text: "15 minutes " },
                { type: "insert", text: "2 hours (corrected from 15 minutes)" },
                { type: "equal", text: "." },
              ],
            },
            {
              claim_id: "ho-004",
              section: "Database Migrations",
              change_type: "unchanged",
              v1: {
                status: "approved",
                text: "Two-phase migration strategy: backfill existing rows before applying NOT NULL constraint.",
                provenance: "verified",
              },
              v2: {
                status: "approved",
                text: "Two-phase migration strategy: backfill existing rows before applying NOT NULL constraint.",
                provenance: "verified",
              },
              word_diff: [
                { type: "equal", text: "Two-phase migration strategy: backfill existing rows before applying NOT NULL constraint." },
              ],
            },
          ],
        });
      }
      if (parts[3] === "verify") {
        return jsonResponse({ status: "verified", confidence: 0.95 });
      }
      if (parts[3] === "receipt" && parts[4] === "verify") {
        return jsonResponse({
          is_acknowledged: true,
          is_valid: true,
          version: 1,
          acknowledged_by: "Jordan Taylor (Successor)",
          acknowledged_at: new Date().toISOString(),
          receipt_signature: "mock_demo_hmac_sha256_sig",
          verification_algorithm: "HMAC-SHA256"
        });
      }
      if (parts[3] === "acknowledge") {
        return jsonResponse({
          status: "acknowledged",
          version: 1,
          actor: "Jordan Taylor (Successor)",
          receipt_signature: "mock_demo_hmac_sha256_sig",
          is_cryptographically_signed: true,
        });
      }
      if (parts[3] === "batch-approve-verified") {
        return jsonResponse({
          status: "ok",
          approved_count: 2,
          approved_claim_ids: ["ho-003", "ho-005"],
          skipped_inferred_or_unknown_count: 1,
          version: 2,
        });
      }
      if (parts[3] === "preflight") {
        return jsonResponse({
          can_release: true,
          unreviewed_count: 0,
          unreviewed_claim_ids: [],
          contradictions_count: 0,
          contradictions_acknowledged: true,
          secrets_detected_count: 0,
          quarantine_pending_count: 0,
          blockers: [],
        });
      }
      if (parts[3] === "contradictions" && parts[4] === "acknowledge") {
        return jsonResponse({
          status: "ok",
          contradictions_acknowledged: true,
          note: "Acknowledged contradictory claims to remain visible as Open Questions for successor",
        });
      }
      if (parts[4] === "undo") {
        return jsonResponse({
          status: "ok",
          claim_id: parts[3],
          action: "undone",
          claim_status: "pending",
          version: 1,
        });
      }
      if (parts[4] === "ask-lead") {
        let bodyJson: any = {};
        try { bodyJson = JSON.parse(options.body as string); } catch {}
        return jsonResponse({
          status: "ok",
          question_id: `q-${Date.now().toString(36)}`,
          claim_id: parts[3],
          question: {
            id: `q-${Date.now().toString(36)}`,
            case_id: parts[1],
            text: bodyJson.question || "Clarification requested",
            target_claim_id: parts[3],
            status: "open",
            asked_by: "Jordan Taylor (Successor)",
            created_at: new Date().toISOString(),
          },
        });
      }
      if (parts[3] === "approve" || parts[3] === "release") {
        return jsonResponse({ status: "ok" });
      }
      if (parts[4] === "approve" || parts[4] === "reject" || parts[4] === "edit") {
        return jsonResponse({ status: "ok" });
      }

      const isContractorPreview = path.includes("preview_role=contractor") || role === "contractor";
      const rawHandover = MOCK_DB.handover;
      if (isContractorPreview && rawHandover) {
        const rawList: any[] = Array.isArray(rawHandover) ? rawHandover : (rawHandover.items || []);
        const censoredItems = rawList.map((i: any) => {
          if (i.id === "ho-001") {
            return {
              ...i,
              text: "Withheld: requires internal clearance [WITHHELD]",
              withheld: true,
              withheld_reason: "Requires internal clearance",
              evidence_ids: ["[withheld]"],
            };
          }
          return i;
        });
        return jsonResponse({
          items: censoredItems,
          role: "contractor",
          current_version: 1,
          released_version: null,
          unreviewed_count: 0,
          can_release: true,
        });
      }

      const hoList: any[] = Array.isArray(rawHandover) ? rawHandover : (rawHandover?.items || []);
      const ho1 = hoList.find((i: any) => i.id === "ho-001");
      const hasDrift = ho1?.is_stale || false;
      return jsonResponse({
        items: hoList,
        role: role,
        grounding_score: 0.82,
        grounding_method: "deterministic lexical and entity overlap (offline)",
        case_status: "released",
        current_version: 1,
        released_version: 2,
        acknowledged: false,
        acknowledged_version: role === "successor" ? 1 : null,
        unreviewed_count: 0,
        can_release: true,
        re_review_pending_count: hasDrift ? 1 : 0,
        has_evidence_drift: hasDrift,
        update_available: role === "successor",
      });
    }

    if (sub === "completeness") {
      return jsonResponse(MOCK_DB.completeness);
    }

    if (sub === "admin") {
      return jsonResponse(MOCK_DB.admin);
    }

    if (sub === "redactions") {
      return jsonResponse(MOCK_DB.admin?.redactions || []);
    }

    if (sub === "uncertainty") {
      return jsonResponse(MOCK_DB.uncertainty);
    }

    if (sub === "decisions") {
      return jsonResponse(MOCK_DB.decisions);
    }

    if (sub === "recurring-problems") {
      return jsonResponse([
        {
          id: "rec-churn-001",
          title: "High churn on auth.config.ts (3 fix/revert cycles)",
          category: "code_churn",
          description: "File 'src/auth/auth.config.ts' was touched 3 times by fix commits, indicating brittle session expiry handling.",
          component: "Auth Service",
          frequency: 3,
          first_seen: "2024-10-01T09:15:00Z",
          last_seen: "2024-10-09T16:00:00Z",
          sources_corroborated: ["github", "slack"],
          provenance: "VERIFIED",
          evidence_ids: ["art-006a", "art-016"],
          suggested_action: "Extract session timeout middleware into tested pure function; freeze config TTL alterations."
        },
        {
          id: "rec-jira-001",
          title: "Reopened Bug: Fix JWT token expiry configuration (SL-234)",
          category: "reopened_bug",
          description: "Ticket SL-234 exhibits recurring regression behavior. Done resolution failed in production with downstream gateway timeout.",
          component: "Auth Service",
          frequency: 3,
          first_seen: "2024-10-08T15:30:00Z",
          last_seen: "2024-10-08T20:00:00Z",
          sources_corroborated: ["jira", "slack"],
          provenance: "VERIFIED",
          evidence_ids: ["art-003", "art-004", "art-018"],
          suggested_action: "Verify Cloudflare Page Rule caching headers for /auth/refresh before marking resolved."
        },
        {
          id: "rec-inc-001",
          title: "Repeated Incident: Timeout Errors in Production",
          category: "repeated_incident",
          description: "Encountered repeated reports of timeout errors across token refresh and nightly report cron jobs.",
          component: "Auth Service",
          frequency: 2,
          first_seen: "2024-10-08T18:00:00Z",
          last_seen: "2024-10-08T20:00:00Z",
          sources_corroborated: ["slack", "jira"],
          provenance: "VERIFIED",
          evidence_ids: ["art-004", "art-018"],
          suggested_action: "Add automated circuit breaker and structured alerts for downstream gateway timeout errors."
        },
        {
          id: "rec-flaky-001",
          title: "Flaky Test Pattern: Intermittent CI Failures",
          category: "flaky_test",
          description: "Identified references to flaky tests in test_payment_webhook_retry intermittent failure.",
          component: "Payment Processor",
          frequency: 1,
          first_seen: "2024-10-15T16:00:00Z",
          last_seen: "2024-10-15T16:00:00Z",
          sources_corroborated: ["github"],
          provenance: "INFERRED",
          evidence_ids: ["art-017"],
          suggested_action: "Quarantine flaky tests in separate CI stage; mock external network/database timers."
        }
      ]);
    }

    if (sub === "contacts") {
      if (path.includes("by_component=true") || cleanPath.includes("by_component=true")) {
        return jsonResponse([
          {
            component_name: "Auth Service",
            has_remaining_owner: true,
            warning: null,
            contacts_count: 1,
            contacts: [
              {
                name: "Alex Chen",
                handle: "@alex",
                role: "Engineering Lead / Designated CODEOWNER",
                source: "codeowners",
                provenance: "VERIFIED",
                contact_type: "internal",
                notes: "Primary CODEOWNER for Auth Service paths; designated in interview.",
                knowledge_score: 0.65
              }
            ]
          },
          {
            component_name: "Payment Processor",
            has_remaining_owner: true,
            warning: null,
            contacts_count: 2,
            contacts: [
              {
                name: "Alex Chen",
                handle: "@alex",
                role: "Incoming Lead",
                source: "knowledge_score",
                provenance: "INFERRED",
                contact_type: "internal",
                notes: "12% historical knowledge survival. Shadowing incoming payment work.",
                knowledge_score: 0.12
              },
              {
                name: "Stripe Merchant Support",
                handle: "@stripe-support",
                role: "Payment Gateway Escalation Vendor",
                source: "hidden_dep",
                provenance: "VERIFIED",
                contact_type: "external_vendor",
                notes: "Escalation for webhook delivery timeouts and account limits."
              }
            ]
          },
          {
            component_name: "Reporting Module",
            has_remaining_owner: true,
            warning: null,
            contacts_count: 2,
            contacts: [
              {
                name: "Sam Rodriguez",
                handle: "@sam",
                role: "DevOps / Operations Lead",
                source: "interview",
                provenance: "STATED",
                contact_type: "internal",
                notes: "Designated by departing leaver during exit interview for cron and SMTP relay."
              },
              {
                name: "SendGrid Postmaster Support",
                handle: "@sendgrid-support",
                role: "SMTP Relay Vendor",
                source: "hidden_dep",
                provenance: "VERIFIED",
                contact_type: "external_vendor",
                notes: "Escalation for SMTP_RELAY_HOST deliverability blocks."
              }
            ]
          },
          {
            component_name: "Database & Migrations",
            has_remaining_owner: false,
            warning: "No remaining owner: Departing leaver (Priya Nair) was the sole knowledge holder. No active maintainer or CODEOWNER remains.",
            contacts_count: 0,
            contacts: []
          }
        ]);
      }
      return jsonResponse(MOCK_DB.contacts);
    }

    if (sub === "continuation") {
      if (parts[3] === "progress") {
        if (options.method === "PUT") {
          let b: any = {};
          try { b = JSON.parse(options.body as string); } catch {}
          return jsonResponse({
            status: "ok",
            task: {
              id: b.task_id || "task-day1-1",
              completed: !!b.completed,
              completed_at: b.completed ? new Date().toISOString() : null,
              completed_by: b.completed ? "Jordan Taylor (Successor)" : null,
            },
            completed_count: 1,
            total_count: 7,
            progress_percent: 14,
          });
        }
        return jsonResponse({
          case_id: parts[1],
          tasks: (MOCK_DB.continuation?.first_5_days || []).map((t: any, i: number) => ({
            id: t.id || `task-day${t.day || 1}-${i + 1}`,
            day: t.day || 1,
            task: t.task,
            owner: t.owner,
            completed: t.status === "completed",
            completed_at: null,
            completed_by: null,
          })),
          completed_count: 0,
          total_count: 7,
          progress_percent: 0,
        });
      }
      return jsonResponse(MOCK_DB.continuation);
    }

    if (sub === "quarantine") {
      if (role !== "engineering_lead") {
        return jsonResponse({ detail: "Quarantine queue is restricted to Engineering Lead" }, 403);
      }
      if (parts[3] && parts[4] === "resolve") {
        return jsonResponse({
          status: "ok",
          artifact_id: parts[3],
          action: "redact",
          quarantine_status: "redacted",
          reasons: ["hr:salary"]
        });
      }
      if (parts[3] === "bulk-resolve") {
        return jsonResponse({
          status: "ok",
          resolved_count: 2,
          action: "redact"
        });
      }
      return jsonResponse([
        {
          id: "art-014",
          case_id: parts[1],
          source: "slack",
          type: "slack_message",
          title: "#engineering - Q4 compensation and retention package update",
          snippet: "Hey team, Elena Vance shared the Q4 compensation and retention package update for Priya Nair (CANARY_QUARANTINE_e42b_hr). Annual salary review and bonus package details are pending final approval under the bilateral NDA.",
          reasons: ["hr:salary", "legal:nda_lawsuit"],
          quarantine_status: "quarantined",
          occurred_at: "2024-10-12T14:00:00Z",
          url: "https://slack.com/archives/C_ENG/p1728692000"
        },
        {
          id: "art-015",
          case_id: parts[1],
          source: "slack",
          type: "slack_message",
          title: "#engineering - Customer support escalation robert.morris@enterpriseclient.com",
          snippet: "Forwarding customer support escalation: client robert.morris@enterpriseclient.com reports CID-88219 payment webhook failing with card processing error. Customer phone is +1-415-555-8392. Ref: CANARY_QUARANTINE_e42b_cust.",
          reasons: ["customer:id", "pii:email", "pii:phone"],
          quarantine_status: "quarantined",
          occurred_at: "2024-10-13T10:00:00Z",
          url: "https://slack.com/archives/C_ENG/p1728778000"
        }
      ]);
    }

    if (sub === "import") {
      if (role !== "engineering_lead") {
        return jsonResponse({ detail: "Only engineering_lead can import data." }, 403);
      }
      if (parts[3] === "preview") {
        return jsonResponse({
          staging_token: "mock-staging-" + Math.floor(Math.random() * 9000 + 1000),
          case_id: parts[1],
          total_items: 9,
          item_counts: { slack: 4, jira: 4, docs: 1 },
          date_range: { earliest: "2024-10-10T14:00:00Z", latest: "2024-10-15T13:15:00Z" },
          sample_items: [
            {
              source: "slack",
              type: "slack_message",
              external_id: "slack_engineering_001",
              title: "#engineering: Priya Nair",
              snippet: "Starting deployment of payments worker v2.0.4. DB migration alembic upgrade head completed.",
              quarantined: false,
              reasons: [],
            },
            {
              source: "jira",
              type: "jira_ticket",
              external_id: "PAY-101",
              title: "[PAY-101] Migrate webhook handler to Stripe Payment Intents v2",
              snippet: "Status: In Progress\nAssignee: Priya Nair\n\nWebhook retry backoff needs exponential delay...",
              quarantined: false,
              reasons: [],
            },
            {
              source: "slack",
              type: "slack_message",
              external_id: "slack_engineering_003",
              title: "#engineering: Priya Nair",
              snippet: "Notice: Elena Vance mentioned annual compensation review under NDA for senior engineers.",
              quarantined: true,
              reasons: ["hr:salary", "legal:nda_lawsuit"],
            },
          ],
          detected_people: [
            { name: "Priya Nair", email: "priya@shopledger.io", handle: "@priya", sources: ["jira", "slack"] },
            { name: "Alex Chen", email: "alex@shopledger.io", handle: "@alex", sources: ["jira", "slack"] },
            { name: "Sam Rodriguez", email: "sam@shopledger.io", handle: "@sam", sources: ["jira", "slack"] },
          ],
          detected_sensitive_items: [
            {
              id: "slack_engineering_003",
              source: "slack",
              title: "#engineering: Priya Nair",
              reasons: ["hr:salary", "legal:nda_lawsuit"],
              sample: "Notice: Elena Vance mentioned annual compensation review under NDA for senior engineers.",
            },
          ],
          ingest_report: {
            files_processed: 3,
            items_parsed: 9,
            items_by_source: { slack: 4, jira: 4, docs: 1 },
            errors: [],
            warnings: [],
            skipped_files: [],
          },
        });
      }
      if (parts[3] === "commit") {
        return jsonResponse({
          status: "ok",
          committed_items: 9,
          quarantined_items: 1,
          sources_added: ["slack", "jira", "docs"],
          readiness_score: 0.88,
        });
      }
    }

    if (sub === "identities") {
      if (role !== "engineering_lead") {
        return jsonResponse({ detail: "Only engineering_lead can modify identity merges." }, 403);
      }
      if (parts[4] === "confirm") {
        return jsonResponse({
          status: "confirmed",
          identity_id: parts[3],
          name: "Alex Chen",
          confidence: "100% (Lead Confirmed)",
        });
      }
      if (parts[4] === "split") {
        return jsonResponse({
          status: "split",
          identity_id: parts[3],
          split_entities: [
            { id: `${parts[3]}_code`, name: "Alex Chen (Code & Repos)", status: "split", github: "alexc", slack: "—", jira: "—", confidence: "100% (Explicitly Separated)" },
            { id: `${parts[3]}_comms`, name: "Alex Chen (Comms & Tasks)", status: "split", github: "—", slack: "@alex (U67890)", jira: "alex@shopledger.io", confidence: "100% (Explicitly Separated)" },
          ],
          busfactor_updated: true,
        });
      }
    }

    if (sub === "intelligence") {
      if (parts[3] === "events") {
        return jsonResponse(MOCK_DB.intelligence_events || []);
      }
      return jsonResponse(MOCK_DB.intelligence || {});
    }

    if (sub === "busfactor") {
      return jsonResponse(MOCK_DB.busfactor || {});
    }

    if (sub === "assets") {
      if (parts[3] === "create-handover-folder") {
        return jsonResponse(MOCK_DB.handover_folder || {
          status: "created",
          mode: "demo",
          folder_name: "RELAY Handover — ShopLedger",
          folder_url: "https://drive.google.com/drive/folders/demo-handover-shopledger",
          platform: "google_drive",
          files_organized: 4,
          categories: ["architecture", "api_docs", "runbook", "technical_spec"],
          demo_note: "DEMO MODE — No live Google Drive calls were made. Connect Google OAuth in production.",
          setup_instructions: "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
        });
      }
      if (parts[4] === "select") {
        return jsonResponse({ status: "ok", asset_id: parts[3], is_selected: true });
      }
      return jsonResponse(MOCK_DB.assets || []);
    }

    if (sub === "knowledge-graph") {
      return jsonResponse(MOCK_DB.knowledge_graph || { nodes: [], edges: [] });
    }
  }

  return jsonResponse({ status: "ok" });
}

