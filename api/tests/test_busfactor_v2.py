import pytest
from app.risk.busfactor import (
    BusFactorConfig,
    BusFactorSignals,
    is_bot_author,
    is_noise_file,
    is_formatting_commit,
    is_merge_commit,
    calculate_time_decay,
)
from app.risk.backtest import BacktestEngine, run_backtest

class TestBusFactorV2Signals:
    def test_bot_author_detection(self):
        assert is_bot_author("dependabot[bot]") is True
        assert is_bot_author("renovate[bot]") is True
        assert is_bot_author("github-actions[bot]") is True
        assert is_bot_author("codecov-io") is True
        assert is_bot_author("Alex Chen") is False
        assert is_bot_author("priyanair") is False

    def test_noise_file_detection(self):
        assert is_noise_file("package-lock.json") is True
        assert is_noise_file("poetry.lock") is True
        assert is_noise_file("dist/bundle.min.js") is True
        assert is_noise_file("app/models.py") is False
        assert is_noise_file("src/components/Router.tsx") is False

    def test_formatting_commit_detection(self):
        assert is_formatting_commit("style: run prettier on all files") is True
        assert is_formatting_commit("lint: fix whitespace") is True
        assert is_formatting_commit("feat: add stripe webhook idempotency") is False
        assert is_formatting_commit("fix: resolve null pointer in payment token") is False

    def test_merge_commit_detection(self):
        assert is_merge_commit("Merge pull request #142 from feature/auth", parents_count=1) is True
        assert is_merge_commit("Merge branch 'main'", parents_count=1) is True
        assert is_merge_commit("Regular commit message", parents_count=2) is True
        assert is_merge_commit("refactor: extract token validation", parents_count=1) is False

    def test_temporal_decay_half_life(self):
        # 0 days ago -> decay factor is 1.0
        assert round(calculate_time_decay(0, half_life_days=180), 2) == 1.0
        # 180 days ago -> decay factor is exactly 0.50
        assert round(calculate_time_decay(180, half_life_days=180), 2) == 0.50
        # 360 days ago -> decay factor is 0.25
        assert round(calculate_time_decay(360, half_life_days=180), 2) == 0.25

    def test_defensible_score_computation(self):
        signals = BusFactorSignals(
            line_survival_share=0.80,
            review_influence_share=0.70,
            codeowners_share=1.0,
            discussion_share=0.50,
            time_decay_factor=0.90,
        )
        # raw = 0.80*0.40 + 0.70*0.30 + 1.0*0.15 + 0.50*0.15 = 0.32 + 0.21 + 0.15 + 0.075 = 0.755
        # score = 0.755 * 0.90 = 0.6795
        assert round(signals.defensible_score, 2) == 0.68
        assert abs(signals.defensible_score - 0.6795) < 1e-4


class TestBacktestEngine:
    def test_engine_execution_and_metrics(self):
        engine = BacktestEngine()
        results = engine.run()

        assert "summary" in results
        assert results["summary"]["total_repos_evaluated"] == 8
        assert results["sample_size"]["dev_repos"] == 4
        assert results["sample_size"]["test_repos"] == 4
        assert results["sample_size"]["total_components"] == 52
        assert results["summary"]["model_precision_at_3"] > results["summary"]["baseline_precision_at_3"]
        assert results["summary"]["model_mrr"] > results["summary"]["baseline_mrr"]

        # Check repository entries
        repos = results["repos"]
        flask_res = next(r for r in repos if r["repo"] == "pallets/flask")
        assert flask_res["model"]["precision_at_3"] == 1.0
        assert "core/app.py" in flask_res["model"]["top_ranked_components"]

    def test_run_backtest_file_output(self):
        results = run_backtest(save_results=False)
        assert len(results["methodology_notes"]) >= 3
        assert results["summary"]["precision_at_3_lift_pct"] > 0
