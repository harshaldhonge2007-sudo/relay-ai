"""
Deterministic Grounding Verifier & Sentence Entailment Checker.
Offline: deterministic lexical and entity overlap (numbers, identifiers, names).
Method: "deterministic lexical and entity overlap (offline)"
"""
import re
from typing import List, Dict, Any, Tuple, Optional


class GroundingVerifier:
    """
    Offline Deterministic Grounding Verifier.
    Verifies sentences against cited evidence text using:
    - Exact entity overlap (numbers, ticket IDs, env vars, code paths, proper nouns)
    - Lexical containment of non-stopwords
    - Downgrades unsupported sentences to INFERRED or UNKNOWN and flags them
    """

    METHOD = "deterministic lexical and entity overlap (offline)"

    STOPWORDS = {
        "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
        "at", "by", "for", "with", "about", "against", "between", "into",
        "through", "during", "before", "after", "above", "below", "to", "from",
        "up", "down", "in", "out", "on", "off", "over", "under", "again",
        "further", "then", "once", "here", "there", "all", "any", "both",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "s", "t",
        "can", "will", "just", "don", "should", "now", "is", "are", "was",
        "were", "be", "been", "being", "have", "has", "had", "having", "do",
        "does", "did", "doing", "this", "that", "these", "those", "it", "its",
        "ready", "remaining", "though", "fixed", "fix", "three", "two", "one",
        "first", "critical", "primary", "script", "dashboard", "note", "notes",
        "item", "items", "original", "status", "decision", "action"
    }

    # Extract numbers, ticket keys, env vars, URLs, paths
    NUMBER_PATTERN = re.compile(r'\b\d+(?:\.\d+)?(?:%|ms|s|h|d|min|m|k|M|B)?\b')
    TICKET_PATTERN = re.compile(r'\b[A-Z]{2,10}-\d+\b|PR\s*#?\d+|#\d+')
    ENV_IDENTIFIER_PATTERN = re.compile(r'\b[A-Z][A-Z0-9_]{3,}\b')
    CODE_PATH_PATTERN = re.compile(r'[\w\-\./]+\.(?:sql|py|js|ts|tsx|jsx|md|json|yml|yaml)|/[\w\-/\.]+')
    PROPER_NOUN_PATTERN = re.compile(r'\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b')

    def split_sentences(self, text: str) -> List[str]:
        """Split text into individual sentences, stripping markdown headings/bullets."""
        lines = text.split("\n")
        cleaned_lines = []
        for line in lines:
            c = re.sub(r'[*`#~]', '', line).strip()
            c = re.sub(r'^\s*[-+*]\s+', '', c)
            if c:
                cleaned_lines.append(c)
        cleaned_text = " ".join(cleaned_lines)
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', cleaned_text)
        return [s.strip() for s in sentences if s.strip()]

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract domain entities that require strict evidence grounding."""
        numbers = self.NUMBER_PATTERN.findall(text)
        tickets = self.TICKET_PATTERN.findall(text)
        env_vars = self.ENV_IDENTIFIER_PATTERN.findall(text)
        paths = self.CODE_PATH_PATTERN.findall(text)
        
        raw_proper = self.PROPER_NOUN_PATTERN.findall(text)
        proper_nouns = []
        for p in raw_proper:
            words = [w.lower() for w in p.split()]
            if all(w in self.STOPWORDS for w in words):
                continue
            while words and words[0] in self.STOPWORDS:
                words.pop(0)
            if words:
                proper_nouns.append(" ".join(words))

        return {
            "numbers": list(set(numbers)),
            "tickets": list(set(tickets)),
            "env_vars": list(set(env_vars)),
            "paths": list(set(paths)),
            "proper_nouns": list(set(proper_nouns)),
        }

    def verify_sentence(self, sentence: str, evidence_text: str) -> Dict[str, Any]:
        """
        Verify a single sentence against combined cited evidence text.
        Returns grounding score, whether grounded, missing entities, and downgraded provenance if unsupported.
        """
        if not evidence_text or not evidence_text.strip():
            return {
                "sentence": sentence,
                "is_grounded": False,
                "score": 0.0,
                "provenance": "unknown",
                "missing_entities": ["all (no cited evidence)"],
                "reason": "No evidence cited",
            }

        ev_lower = evidence_text.lower()
        entities = self.extract_entities(sentence)

        missing_entities = []
        found_entities = []

        all_critical = (
            entities["tickets"] +
            entities["env_vars"] +
            entities["paths"] +
            entities["numbers"] +
            entities["proper_nouns"]
        )

        for ent in all_critical:
            ent_lower = ent.lower()
            if ent_lower in ev_lower:
                found_entities.append(ent)
            elif " " in ent_lower and any(w in ev_lower for w in ent_lower.split() if w not in self.STOPWORDS):
                found_entities.append(ent)
            else:
                missing_entities.append(ent)

        entity_recall = (
            len(found_entities) / len(all_critical) if all_critical else 1.0
        )

        # Lexical token overlap
        words = re.findall(r'\b[a-zA-Z]{3,}\b', sentence.lower())
        sig_words = [w for w in words if w not in self.STOPWORDS]
        found_words = [w for w in sig_words if w in ev_lower]
        lexical_recall = len(found_words) / len(sig_words) if sig_words else 1.0

        # Weighted combination: 60% entity recall, 40% lexical recall
        score = round(0.6 * entity_recall + 0.4 * lexical_recall, 3)

        # Grounding threshold: score >= 0.60 and no more than 30% missing critical entities
        is_grounded = score >= 0.60 and (len(missing_entities) == 0 or entity_recall >= 0.70)

        if is_grounded:
            provenance = "verified"
            reason = "Supported by cited evidence"
        elif score >= 0.35:
            provenance = "inferred"
            reason = f"Partially grounded. Missing entities: {', '.join(missing_entities[:3])}" if missing_entities else "Low lexical support"
        else:
            provenance = "unknown"
            reason = f"Unsupported. Critical entities not found in evidence: {', '.join(missing_entities[:3])}"

        return {
            "sentence": sentence,
            "score": score,
            "is_grounded": is_grounded,
            "provenance": provenance,
            "entity_recall": round(entity_recall, 2),
            "lexical_recall": round(lexical_recall, 2),
            "missing_entities": missing_entities,
            "reason": reason,
        }

    def verify_claim(self, claim_text: str, evidence_texts: List[str]) -> Dict[str, Any]:
        """Verify all sentences in a claim against cited evidence texts."""
        combined_evidence = " ".join(evidence_texts)
        sentences = self.split_sentences(claim_text)
        if not sentences:
            sentences = [claim_text]

        results = [self.verify_sentence(s, combined_evidence) for s in sentences]
        scores = [r["score"] for r in results]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        all_grounded = all(r["is_grounded"] for r in results)
        flagged = [r for r in results if not r["is_grounded"]]

        if not combined_evidence:
            provenance = "unknown"
        elif all_grounded:
            provenance = "verified"
        elif avg_score >= 0.40:
            provenance = "inferred"
        else:
            provenance = "unknown"

        return {
            "score": round(avg_score, 2),
            "method": self.METHOD,
            "is_grounded": all_grounded,
            "provenance": provenance,
            "sentences": results,
            "flagged_count": len(flagged),
            "flagged_reasons": [f["reason"] for f in flagged],
        }

    def verify_document(self, claims: List[Dict[str, Any]], artifacts_map: Dict[str, Any]) -> Dict[str, Any]:
        """Verify entire set of handover claims against an artifact dictionary."""
        claim_verifications = []
        scores = []

        for claim in claims:
            e_ids = claim.get("evidence_ids", [])
            ev_texts = []
            for eid in e_ids:
                art = artifacts_map.get(eid)
                if art:
                    title = art.get("title", "")
                    body = art.get("body", "")
                    ev_texts.append(f"{title} {body}")

            v_res = self.verify_claim(claim.get("text", ""), ev_texts)
            claim_verifications.append({
                "claim_id": claim.get("id"),
                "verification": v_res,
            })
            scores.append(v_res["score"])

        doc_score = sum(scores) / len(scores) if scores else 0.0
        return {
            "grounding_score": round(doc_score, 2),
            "method": self.METHOD,
            "claims_verified": len(claims),
            "claims": claim_verifications,
        }
