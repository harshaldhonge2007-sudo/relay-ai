"""
Deterministic Grounding Verifier & Sentence Entailment Checker.
Offline: deterministic lexical and entity overlap (numbers, identifiers, names)
hardened with deterministic guards for polarity/negation, number/unit, entity swaps,
scope overreach, and prompt-injection sanitization.
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
    - Deterministic guards: polarity/negation, numeric/unit, entity conflict, scope overreach
    - Prompt-injection sanitization (treats injection markers as opaque non-evidence)
    - Downgrades unsupported sentences to INFERRED or UNKNOWN and flags them
    """

    METHOD = "deterministic lexical and entity overlap (offline)"

    STOPWORDS = {
        "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
        "at", "by", "for", "with", "about", "against", "between", "into",
        "through", "during", "before", "after", "above", "below", "to", "from",
        "up", "down", "in", "out", "on", "off", "over", "under", "again",
        "further", "then", "once", "here", "there", "all", "any", "both",
        "each", "few", "more", "most", "other", "some", "such",
        "s", "t", "can", "will", "just", "should", "now", "is", "are", "was",
        "were", "be", "been", "being", "have", "has", "had", "having", "do",
        "does", "did", "doing", "this", "that", "these", "those", "it", "its",
        "ready", "remaining", "though", "three", "two", "one",
        "first", "critical", "primary", "script", "dashboard", "note", "notes",
        "item", "items", "original", "status", "decision", "action"
    }

    # Negation and polarity markers
    NEGATION_WORDS = {
        "not", "never", "no", "neither", "nor", "none", "cannot", "without",
        "wasn't", "didn't", "isn't", "aren't", "haven't", "hasn't", "hadn't",
        "won't", "wouldn't", "shouldn't", "couldn't"
    }

    # Negated action regex: captures negation applied directly to core actions/verbs
    NEGATED_ACTION_PATTERN = re.compile(
        r'\b(?:not|never|wasn\'t|didn\'t|hasn\'t|hadn\'t|isn\'t|aren\'t|cannot|no|without)\s+(?:\w+\s+){0,2}(?:revert\w*|deprecat\w*|pass\w*|fail\w*|enabl\w*|disabl\w*|support\w*|allow\w*|abort\w*|promot\w*|silenc\w*|approv\w*|author\w*|retri\w*|retry\w*)',
        re.I
    )

    # Semantic antonym pairs that indicate inverted polarity or contradictory state
    ANTONYM_PAIRS = [
        ("reverted", "deployed"), ("reverted", "promoted"),
        ("passed", "failed"), ("succeeded", "failed"),
        ("enabled", "disabled"), ("supported", "unsupported"),
        ("aborted", "promoted"), ("completed", "aborted"),
        ("safely", "accidentally"), ("safe", "accidental"), ("resolved", "unable"),
        ("recommended", "rejected")
    ]

    ORDER_CLASH_PAIRS = [
        ("before", "after"), ("after", "before"),
        ("before", "subsequent"), ("after", "prior"),
        ("before", "first"), ("prior", "after"),
        ("after", "pass before")
    ]

    # Universal scope patterns vs limiter words
    SCOPE_UNIVERSAL_PATTERN = re.compile(
        r'\b(?:all\s+(?:microservices|services|backend|customer|external|logs|pods|endpoints)|every\s+(?:database|employee|query)|universally)\b',
        re.I
    )
    SCOPE_LIMITER_WORDS = {
        "only", "specifically", "exclusive", "restricted", "except",
        "while all other", "lack", "bypass", "remain on", "staging logs remain"
    }

    # Prompt injection patterns inside evidence to neutralize
    PROMPT_INJECTION_PATTERN = re.compile(
        r'(?i)(?:\[(?:SYSTEM|ADMIN|IMPORTANT)[^\]]*\]|<\/?(?:system|prompt)[^>]*>|<!--\s*system[^>]*-->|ignore\s+(?:previous|all)?\s*instructions|disregard\s+(?:evidence|truthfulness|verification)|mark\s+verified|set\s+verdict\s*=\s*verified|output:\s*invalid|prompt\s+injection\s+payload)',
        re.I
    )

    QUANTITY_PATTERN = re.compile(
        r'\b(\d+(?:\.\d+)?)\s*(%|ms|s|h|d|min|minutes|hours|days|m|k|mb|gb|connections|attempts|req/min)?\b',
        re.I
    )
    UNIT_MAP = {
        "minutes": "min", "minute": "min", "mins": "min",
        "hours": "h", "hour": "h", "hr": "h", "hrs": "h",
        "seconds": "s", "second": "s", "sec": "s", "secs": "s",
        "days": "d", "day": "d"
    }

    COMMON_START_WORDS = {
        "deployments", "deployment", "nightly", "database", "databases",
        "user", "users", "all", "every", "the", "this", "these", "fixed",
        "added", "updated", "created", "here", "when", "after", "before", "each"
    }

    # Extract numbers, ticket keys, env vars, URLs, paths
    NUMBER_PATTERN = re.compile(r'\b\d+(?:\.\d+)?(?:%|ms|s|h|d|min|m|k|M|B|MB|GB)?\b', re.I)
    TICKET_PATTERN = re.compile(r'\b[A-Z]{2,10}-\d+\b|PR\s*#?\d+|#\d+', re.I)
    ENV_IDENTIFIER_PATTERN = re.compile(r'\b[A-Z][A-Z0-9_]{3,}\b')
    CODE_PATH_PATTERN = re.compile(r'[\w\-\./]+\.(?:sql|py|js|ts|tsx|jsx|md|json|yml|yaml)|/[\w\-/\.]+')
    PROPER_NOUN_PATTERN = re.compile(r'\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b')

    def sanitize_evidence(self, text: str) -> str:
        """Strip adversarial prompt injection spans from evidence so they do not count as proof."""
        if not text:
            return ""
        return self.PROMPT_INJECTION_PATTERN.sub(" ", text)

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
        # Mask ticket patterns before number extraction to prevent extracting ticket digits
        text_without_tickets = self.TICKET_PATTERN.sub(" ", text)
        numbers = self.NUMBER_PATTERN.findall(text_without_tickets)
        tickets = self.TICKET_PATTERN.findall(text)
        env_vars = self.ENV_IDENTIFIER_PATTERN.findall(text)
        paths = self.CODE_PATH_PATTERN.findall(text)

        raw_proper = self.PROPER_NOUN_PATTERN.findall(text)
        proper_nouns = []
        for p in raw_proper:
            words = [w.lower() for w in p.split()]
            # Ignore single common words that only capitalize because they begin the sentence
            if len(words) == 1 and words[0] in self.COMMON_START_WORDS:
                continue
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

    def check_polarity_guard(self, sentence: str, evidence: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic Polarity Guard:
        Detects if claim introduces negation on an evidence assertion (or vice versa),
        or uses contradictory antonym states (e.g. reverted vs deployed, passed vs failed).
        """
        s_lower = sentence.lower()
        ev_lower = evidence.lower()

        # Check targeted negated action phrases
        s_neg_actions = self.NEGATED_ACTION_PATTERN.findall(sentence)
        ev_neg_actions = self.NEGATED_ACTION_PATTERN.findall(evidence)

        # If one negates an action and the other contains the affirmative action
        if s_neg_actions and not ev_neg_actions:
            # Claim negates an action; check if evidence affirms it
            for act in s_neg_actions:
                # Extract root verb
                words = act.lower().split()
                root = words[-1] if words else ""
                if root and root in ev_lower:
                    return True, f"Polarity/negation conflict: claim asserts '{act}' but evidence affirms '{root}'"

        if ev_neg_actions and not s_neg_actions:
            for act in ev_neg_actions:
                words = act.lower().split()
                root = words[-1] if words else ""
                if root and root in s_lower:
                    return True, f"Polarity/negation conflict: evidence asserts '{act}' but claim asserts positive '{root}'"

        # Check direct antonym clashes
        for word_a, word_b in self.ANTONYM_PAIRS:
            if word_a in s_lower and word_b in ev_lower:
                return True, f"Polarity/antonym mismatch: claim asserts '{word_a}' but cited evidence states '{word_b}'"
            if word_b in s_lower and word_a in ev_lower:
                return True, f"Polarity/antonym mismatch: claim asserts '{word_b}' but cited evidence states '{word_a}'"

        return False, None

    def check_numeric_guard(self, sentence: str, evidence: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic Numeric & Unit Guard:
        Extracts numbers and units. If claim asserts a specific quantity not found in evidence,
        or uses contradictory units (e.g. 72 minutes vs 72 hours), block VERIFIED.
        """
        # Mask tickets first
        s_clean = self.TICKET_PATTERN.sub(" ", sentence)
        ev_clean = self.TICKET_PATTERN.sub(" ", evidence)

        s_matches = self.QUANTITY_PATTERN.findall(s_clean)
        ev_matches = self.QUANTITY_PATTERN.findall(ev_clean)

        def norm_qty(val: str, u: str) -> Tuple[str, str]:
            u_clean = u.lower().strip()
            return val, self.UNIT_MAP.get(u_clean, u_clean)

        s_norm = [norm_qty(val, u) for val, u in s_matches]
        ev_norm = [norm_qty(val, u) for val, u in ev_matches]

        for val, u in s_norm:
            # Ignore single standalone numbers 1, 2, 3 without unit if in evidence
            if not u and val.isdigit() and len(val) == 1 and int(val) in (1, 2, 3) and val in ev_clean:
                continue
            # If unit is present, require matching (val, u)
            if u:
                if (val, u) not in ev_norm:
                    return True, f"Numeric or unit mismatch: claimed '{val}{u}' not confirmed in cited evidence"
            else:
                if not any(e_val == val for e_val, _ in ev_norm) and val not in ev_clean:
                    return True, f"Numeric mismatch: claimed number '{val}' not found in cited evidence"

        return False, None

    def check_entity_guard(self, sentence: str, evidence: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic Entity Conflict Guard:
        Ensures ticket identifiers (e.g. SL-234 vs SL-243) and maintainer attributions match.
        """
        s_tickets = self.TICKET_PATTERN.findall(sentence)
        ev_norm = re.sub(r'[\s#]', '', evidence.lower())

        for t in s_tickets:
            t_norm = re.sub(r'[\s#]', '', t.lower())
            if t_norm not in ev_norm:
                return True, f"Entity mismatch: ticket/PR key '{t}' not found in cited evidence"

        return False, None

    def check_order_guard(self, sentence: str, evidence: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic Temporal Order Guard:
        Detects inverted temporal sequencing (e.g. before vs after, after vs prior).
        """
        s_lower = sentence.lower()
        ev_lower = evidence.lower()

        for w_a, w_b in self.ORDER_CLASH_PAIRS:
            if w_a in s_lower and w_b in ev_lower:
                # Ensure they share context words (e.g. import, transaction, test, deploy, backup)
                s_words = set(re.findall(r'\b[a-z]{4,}\b', s_lower))
                ev_words = set(re.findall(r'\b[a-z]{4,}\b', ev_lower))
                shared = s_words.intersection(ev_words)
                if len(shared) >= 2:
                    return True, f"Temporal order flip: claim asserts '{w_a}' but cited evidence specifies '{w_b}'"

        return False, None

    def check_scope_guard(self, sentence: str, evidence: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic Scope Overreach Guard:
        Flags universal scope claims ('all microservices', 'every database') when evidence is qualified.
        """
        if self.SCOPE_UNIVERSAL_PATTERN.search(sentence):
            ev_lower = evidence.lower()
            for limiter in self.SCOPE_LIMITER_WORDS:
                if limiter in ev_lower:
                    return True, f"Scope overreach: universal claim refuted by qualified evidence ('{limiter}')"

        return False, None

    def verify_sentence(self, sentence: str, evidence_text: str) -> Dict[str, Any]:
        """
        Verify a single sentence against combined cited evidence text.
        Applies deterministic guards before lexical scoring.
        """
        if not evidence_text or not evidence_text.strip():
            return {
                "sentence": sentence,
                "is_grounded": False,
                "score": 0.0,
                "provenance": "unknown",
                "missing_entities": ["all (no cited evidence)"],
                "reason": "No evidence cited",
                "guard_violation": None,
            }

        clean_evidence = self.sanitize_evidence(evidence_text)
        ev_lower = clean_evidence.lower()
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

        # Weighted combination: 60% entity recall, 40% lexical recall when entities exist;
        # purely lexical recall when no domain entities are cited.
        if all_critical:
            score = round(0.6 * entity_recall + 0.4 * lexical_recall, 3)
        else:
            score = round(lexical_recall, 3)

        # -------------------------------------------------------------
        # Deterministic Guard Evaluation
        # -------------------------------------------------------------
        guard_violation = None
        guard_reason = None

        has_polarity_clash, pol_reason = self.check_polarity_guard(sentence, clean_evidence)
        if has_polarity_clash:
            guard_violation = "polarity_mismatch"
            guard_reason = pol_reason

        if not guard_violation:
            has_num_clash, num_reason = self.check_numeric_guard(sentence, clean_evidence)
            if has_num_clash:
                guard_violation = "numeric_unit_mismatch"
                guard_reason = num_reason

        if not guard_violation:
            has_ent_clash, ent_reason = self.check_entity_guard(sentence, clean_evidence)
            if has_ent_clash:
                guard_violation = "entity_mismatch"
                guard_reason = ent_reason

        if not guard_violation:
            has_order_clash, order_reason = self.check_order_guard(sentence, clean_evidence)
            if has_order_clash:
                guard_violation = "temporal_order_flip"
                guard_reason = order_reason

        if not guard_violation:
            has_scope_clash, scope_reason = self.check_scope_guard(sentence, clean_evidence)
            if has_scope_clash:
                guard_violation = "scope_overreach"
                guard_reason = scope_reason

        # If a deterministic guard triggered, enforce hard ceiling below VERIFIED (threshold 0.60)
        if guard_violation:
            capped_score = min(score, 0.45)
            return {
                "sentence": sentence,
                "is_grounded": False,
                "score": round(capped_score, 2),
                "provenance": "inferred" if capped_score >= 0.35 else "unknown",
                "entity_recall": round(entity_recall, 2),
                "lexical_recall": round(lexical_recall, 2),
                "missing_entities": missing_entities if missing_entities else [guard_violation],
                "reason": f"Unsupported ({guard_violation}). {guard_reason}",
                "guard_violation": guard_violation,
            }

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
            "guard_violation": None,
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
        guard_violations = [r["guard_violation"] for r in results if r.get("guard_violation")]

        if not combined_evidence or not combined_evidence.strip():
            provenance = "unknown"
        elif guard_violations:
            provenance = "unknown"
            all_grounded = False
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
            "guard_violations": guard_violations,
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
