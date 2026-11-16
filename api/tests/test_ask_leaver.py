import pytest
from app.llm.provider import redact_secrets, MockLLMProvider
from app.retrieval.engine import RetrievalEngine, GroundingVerifier, EvidenceChunk

class TestSecretRedaction:
    def test_redacts_tokens_and_keys(self):
        sample = (
            "Here is my github token: ghp_1234567890abcdefghijklmnopqrstuvwxyzAB "
            "and my AWS key AKIAIOSFODNN7EXAMPLE and sk-1234567890abcdef1234567890abcdef"
        )
        redacted = redact_secrets(sample)
        assert "ghp_" not in redacted
        assert "[REDACTED_GITHUB_TOKEN]" in redacted
        assert "AKIA" not in redacted
        assert "[REDACTED_AWS_ACCESS_KEY]" in redacted
        assert "sk-" not in redacted
        assert "[REDACTED_API_KEY]" in redacted

    def test_redacts_passwords(self):
        sample = "config: password = 'super_secret_production_password'"
        redacted = redact_secrets(sample)
        assert "super_secret_production_password" not in redacted
        assert "[REDACTED_CREDENTIAL]" in redacted


class TestAskTheLeaverGrounding:
    @pytest.mark.anyio
    async def test_grounded_answer_and_citations(self):
        retrieval = RetrievalEngine()
        llm = MockLLMProvider()

        query = "Why was the JWT access token expiration changed to 15m?"
        retrieved = retrieval.search(query, role="successor", top_k=4)
        assert len(retrieved) > 0

        context_str = "\n".join(f"[{c['source_type']} {c['source_id']}] {c['content']}" for c in retrieved)
        system_prompt = f"Answer from context:\n{context_str}"

        answer = await llm.generate(prompt=query, system_prompt=system_prompt)
        grounding = GroundingVerifier.verify(query, answer, retrieved)

        assert grounding["abstained"] is False
        assert grounding["confidence"] >= 0.70
        assert len(grounding["citations"]) > 0
        citation_ids = [c["id"] for c in grounding["citations"]]
        assert "a1b2c3d" in citation_ids or "142" in citation_ids

    @pytest.mark.anyio
    async def test_abstention_on_trap_queries(self):
        retrieval = RetrievalEngine()
        llm = MockLLMProvider()

        trap_query = "Where are the AWS production root keys stored?"
        retrieved = retrieval.search(trap_query, role="successor", top_k=4)

        answer = await llm.generate(prompt=trap_query, system_prompt="Answer from context")
        grounding = GroundingVerifier.verify(trap_query, answer, retrieved)

        assert grounding["abstained"] is True
        assert grounding["confidence"] == 0.0
        assert len(grounding["citations"]) == 0

    def test_rbac_filtering_for_contractors(self):
        retrieval = RetrievalEngine()

        # Database migration policy is in chunk-005 (Slack internal, restricted from contractors)
        query = "database migration policy zero-downtime"
        lead_results = retrieval.search(query, role="engineering_lead", top_k=4)
        contractor_results = retrieval.search(query, role="contractor", top_k=4)

        lead_ids = [c["chunk_id"] for c in lead_results]
        contractor_ids = [c["chunk_id"] for c in contractor_results]

        assert "chunk-005" in lead_ids
        assert "chunk-005" not in contractor_ids

