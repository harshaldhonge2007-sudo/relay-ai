.PHONY: help eval leak-test verifier-eval test test-backend test-frontend build

help:
	@echo "RELAY AI — Make Targets"
	@echo "  make eval           Regenerate backtest/results.json and eval/eval_results.json with defensible metrics"
	@echo "  make leak-test      Run the permission canary leak test suite"
	@echo "  make verifier-eval  Run layered verifier adversarial evaluation & calibration"
	@echo "  make test           Run both pytest and vitest test suites"
	@echo "  make build          Build production web bundle"

eval:
	python3 scripts/run_backtest.py
	python3 scripts/run_eval.py

leak-test:
	python3 scripts/run_leak_test.py

verifier-eval:
	python3 scripts/run_verifier_eval.py

test: test-backend test-frontend

test-backend:
	cd api && pytest

test-frontend:
	cd web && npm test -- --run

build:
	cd web && npm run build
