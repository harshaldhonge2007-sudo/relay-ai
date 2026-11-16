#!/usr/bin/env python3
"""
CLI runner for RELAY bus-factor historical backtesting.
Executes backtesting against open-source maintainer departure ground-truth datasets
and updates backtest/results.json.
"""

import sys
import types
from unittest.mock import MagicMock, AsyncMock
from pathlib import Path

# Add api to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
API_DIR = ROOT_DIR / "api"
sys.path.insert(0, str(API_DIR))

# Install lightweight standalone DB shim if asyncpg / greenlet not installed
try:
    import asyncpg
except ImportError:
    mod_asyncio = types.ModuleType("sqlalchemy.ext.asyncio")
    mod_asyncio.AsyncSession = MagicMock(name="AsyncSession")
    mod_asyncio.create_async_engine = MagicMock(name="create_async_engine")
    mod_asyncio.async_sessionmaker = MagicMock(name="async_sessionmaker")
    mod_asyncio.AsyncEngine = MagicMock(name="AsyncEngine")
    sys.modules["sqlalchemy.ext.asyncio"] = mod_asyncio

    class FakeBase:
        __subclasses__ = []
        metadata = MagicMock()
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    mod_db = types.ModuleType("app.db")
    mod_db.engine = MagicMock(name="engine")
    mod_db.async_session_maker = MagicMock(name="async_session_maker")
    mod_db.Base = FakeBase
    mod_db.get_async_database_url = lambda url: url
    mod_db.get_db = lambda: AsyncMock()
    mod_db.init_db = AsyncMock()
    mod_db.close_db = AsyncMock()
    sys.modules["app.db"] = mod_db

from app.risk.backtest import run_backtest

def main():
    print("=" * 60)
    print("RELAY AI — Defensible Bus-Factor Backtest Engine")
    print("Comparing Defensible Multi-Signal Model vs Raw Commit Baseline")
    print("=" * 60)
    
    results = run_backtest(save_results=True)
    summary = results["summary"]
    
    print("\n--- AGGREGATE RESULTS ---")
    print(f"Total Repositories Evaluated: {summary['total_repos_evaluated']}")
    print(f"Total Components Evaluated:   {summary['total_components_evaluated']}")
    print(f"Model Precision@1:            {summary['model_precision_at_1'] * 100:.1f}%")
    print(f"Baseline Precision@1:         {summary['baseline_precision_at_1'] * 100:.1f}%")
    print(f"Model Precision@3:            {summary['model_precision_at_3'] * 100:.1f}%")
    print(f"Baseline Precision@3:         {summary['baseline_precision_at_3'] * 100:.1f}%")
    print(f"Precision@3 Lift:             +{summary['precision_at_3_lift_pct']}%")
    print(f"Model MRR:                    {summary['model_mrr']:.3f}")
    print(f"Baseline MRR:                 {summary['baseline_mrr']:.3f}")

    print("\n--- PER-REPOSITORY BREAKDOWN ---")
    for r in results["repos"]:
        print(f"[{r['repo']}] Leaver: {r['leaver']} (Departed {r['departure_date']})")
        print(f"  Model Top-3:    {', '.join(r['model']['top_ranked_components'])} (P@3: {r['model']['precision_at_3']})")
        print(f"  Baseline Top-3: {', '.join(r['baseline']['top_ranked_components'])} (P@3: {r['baseline']['precision_at_3']})")
        print(f"  Delta P@3:      {'+' if r['delta']['precision_at_3_lift'] >= 0 else ''}{r['delta']['precision_at_3_lift']}")

    print("\nResults successfully saved to backtest/results.json")

if __name__ == "__main__":
    main()
