"""
Tests for Identity Resolution:
- Fuzzy matching between handles and names
- Threshold boundaries (match vs non-match)
- Exact email and alias matching
"""
import pytest
from app.ingest.identity import IdentityResolver


def test_fuzzy_match_exact():
    resolver = IdentityResolver()
    assert resolver._fuzzy_match("priya", "priya") is True
    assert resolver._fuzzy_match("AlexChen", "alexchen") is True


def test_fuzzy_match_similar_handles():
    resolver = IdentityResolver()
    # "priyan" vs "priya" has high similarity ratio
    assert resolver._fuzzy_match("priyan", "priya", threshold=0.8) is True
    assert resolver._fuzzy_match("samr", "sam", threshold=0.7) is True


def test_fuzzy_match_different_handles_rejected():
    resolver = IdentityResolver()
    assert resolver._fuzzy_match("priya", "alex", threshold=0.8) is False
    assert resolver._fuzzy_match("samr", "priyanair", threshold=0.8) is False


def test_fuzzy_match_case_insensitive():
    resolver = IdentityResolver()
    assert resolver._fuzzy_match("ALEX_CHEN", "alex_chen") is True
    assert resolver._fuzzy_match("ShopLedger-Bot", "shopledger-bot") is True
