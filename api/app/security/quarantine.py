"""
RELAY AI — Item-Level Sensitive-Content Quarantine Engine
Deterministic default-deny classifier for secrets, PII, HR/legal/financial data, and customer IDs.
"""

import math
import re
from typing import Dict, List, Optional, Tuple, Any


def shannon_entropy(data: str) -> float:
    """Calculate the Shannon entropy of a string."""
    if not data:
        return 0.0
    entropy = 0.0
    length = len(data)
    counts: Dict[str, int] = {}
    for char in data:
        counts[char] = counts.get(char, 0) + 1
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def luhn_verify(candidate: str) -> bool:
    """Verify Luhn mod-10 checksum on credit/debit card numbers."""
    digits = [int(d) for d in re.sub(r"\D", "", candidate)]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, digit in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = digit * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += digit
    return checksum % 10 == 0


# Pre-compiled Regex Patterns

# 1. Secrets
RE_KNOWN_SECRETS = [
    (re.compile(r"CANARY_[a-zA-Z0-9_]+"), "secret:canary_token"),
    (re.compile(r"ghp_[a-zA-Z0-9]{36}"), "secret:github_pat"),
    (re.compile(r"gho_[a-zA-Z0-9]{36}"), "secret:github_oauth"),
    (re.compile(r"sk-[a-zA-Z0-9]{32,}"), "secret:openai_key"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "secret:aws_access_key"),
    (re.compile(r"(?i)aws_secret_access_key[\s:=]+([a-zA-Z0-9/+=]{40})"), "secret:aws_secret_key"),
    (re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"), "secret:jwt_token"),
    (re.compile(r"(?i)(api_?key|apikey|secret|password)[\s:=]+[\"']?([a-zA-Z0-9_\-\.]{14,})[\"']?"), "secret:credential_assignment"),
]

# 2. PII
RE_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
RE_PHONE = re.compile(r"(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
RE_CARD_CANDIDATE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")
RE_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# 3. HR / Legal / Financial
RE_HR_SALARY = re.compile(
    r"(?i)\b(salary|base\s+pay|compensation|bonus\s+package|equity\s+grant|annual\s+pay|stock\s+options)\b(?:\s*[:=]?\s*(\$?\d{2,3}(?:,\d{3})*(?:\.\d{2})?|\b[0-9]{2,3}k\b))?"
)
RE_HR_PERFORMANCE = re.compile(
    r"(?i)\b(performance\s+improvement\s+plan|PIP|underperformance|poor\s+performance|performance\s+review)\b"
)
RE_HR_TERMINATION = re.compile(
    r"(?i)\b(termination|severance\s+package|fired|laid\s+off|dismissal)\b"
)
RE_LEGAL = re.compile(
    r"(?i)\b(lawsuit|litigation|subpoena|non-disclosure\s+agreement|NDA|attorney-client)\b"
)
RE_FINANCIAL_CONFIDENTIAL = re.compile(
    r"(?i)\b(acquisition|merger\s+discussions|confidential\s+valuation|revenue\s+projection)\b"
)

# 4. Customer Identifiers
RE_CUSTOMER_ID = re.compile(
    r"(?i)\b(customer_?id|account_?id|tenant_?id|cid)[\s:=]+([a-zA-Z0-9_\-]{6,})\b|\bCID-[0-9]{4,}\b"
)


class SensitiveContentMatch:
    def __init__(self, category: str, reason: str, matched_text: str, start: int, end: int, placeholder: str):
        self.category = category
        self.reason = reason
        self.matched_text = matched_text
        self.start = start
        self.end = end
        self.placeholder = placeholder

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "reason": self.reason,
            "matched_text": self.matched_text,
            "span": [self.start, self.end],
            "placeholder": self.placeholder,
        }


class SensitiveClassifier:
    """
    Deterministic item-level sensitive content classifier.
    Categorizes content into Secrets, PII, HR/Legal/Financial, and Customer IDs.
    """

    def __init__(self, entropy_threshold: float = 3.8):
        self.entropy_threshold = entropy_threshold

    def classify_text(self, text: str) -> Tuple[bool, List[str], List[SensitiveContentMatch]]:
        """
        Classify text. Returns (is_quarantined, reasons, matches).
        """
        if not text:
            return False, [], []

        matches: List[SensitiveContentMatch] = []
        reasons_set: Set[str] = set()

        # 1. Secrets - Known patterns
        for pattern, reason in RE_KNOWN_SECRETS:
            for m in pattern.finditer(text):
                matched = m.group(0)
                reasons_set.add(reason)
                matches.append(
                    SensitiveContentMatch(
                        category="secrets",
                        reason=reason,
                        matched_text=matched,
                        start=m.start(),
                        end=m.end(),
                        placeholder="[REDACTED:secret]",
                    )
                )

        # 1b. Secrets - Shannon Entropy on candidate tokens in key=val or token contexts
        token_context_pattern = re.compile(r"(?i)(?:key|token|auth|bearer|secret)[\s:=]+([^\s\"';,]{18,})")
        for m in token_context_pattern.finditer(text):
            candidate = m.group(1)
            entropy = shannon_entropy(candidate)
            if entropy >= self.entropy_threshold:
                reason = "secret:high_entropy"
                reasons_set.add(reason)
                matches.append(
                    SensitiveContentMatch(
                        category="secrets",
                        reason=reason,
                        matched_text=candidate,
                        start=m.start(1),
                        end=m.end(1),
                        placeholder="[REDACTED:secret]",
                    )
                )

        # 2. PII - Emails
        for m in RE_EMAIL.finditer(text):
            matched = m.group(0)
            reason = "pii:email"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="pii",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:email]",
                )
            )

        # 2b. PII - Phone numbers
        for m in RE_PHONE.finditer(text):
            matched = m.group(0)
            # Avoid matching version numbers like 1.2.3.4
            if matched.count(".") > 2 or re.search(r"[a-zA-Z]", matched):
                continue
            reason = "pii:phone"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="pii",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:phone]",
                )
            )

        # 2c. PII - Luhn-valid Credit Cards
        for m in RE_CARD_CANDIDATE.finditer(text):
            matched = m.group(0)
            if luhn_verify(matched):
                reason = "pii:credit_card"
                reasons_set.add(reason)
                matches.append(
                    SensitiveContentMatch(
                        category="pii",
                        reason=reason,
                        matched_text=matched,
                        start=m.start(),
                        end=m.end(),
                        placeholder="[REDACTED:credit_card]",
                    )
                )

        # 2d. PII - National ID (SSN)
        for m in RE_SSN.finditer(text):
            matched = m.group(0)
            reason = "pii:national_id"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="pii",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:national_id]",
                )
            )

        # 3. HR / Legal / Financial
        for m in RE_HR_SALARY.finditer(text):
            matched = m.group(0)
            reason = "hr:salary"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="hr_legal",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:salary]",
                )
            )

        for m in RE_HR_PERFORMANCE.finditer(text):
            matched = m.group(0)
            reason = "hr:performance"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="hr_legal",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:performance_issue]",
                )
            )

        for m in RE_HR_TERMINATION.finditer(text):
            matched = m.group(0)
            reason = "hr:termination"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="hr_legal",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:termination]",
                )
            )

        for m in RE_LEGAL.finditer(text):
            matched = m.group(0)
            reason = "legal:nda_lawsuit"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="hr_legal",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:legal]",
                )
            )

        for m in RE_FINANCIAL_CONFIDENTIAL.finditer(text):
            matched = m.group(0)
            reason = "financial:confidential"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="hr_legal",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:financial]",
                )
            )

        # 4. Customer Identifiers
        for m in RE_CUSTOMER_ID.finditer(text):
            matched = m.group(0)
            reason = "customer:id"
            reasons_set.add(reason)
            matches.append(
                SensitiveContentMatch(
                    category="customer",
                    reason=reason,
                    matched_text=matched,
                    start=m.start(),
                    end=m.end(),
                    placeholder="[REDACTED:customer_id]",
                )
            )

        # Sort matches by start index
        matches.sort(key=lambda x: x.start)

        # Deduplicate overlapping matches
        deduped_matches: List[SensitiveContentMatch] = []
        last_end = -1
        for match in matches:
            if match.start >= last_end:
                deduped_matches.append(match)
                last_end = match.end

        is_quarantined = len(deduped_matches) > 0
        sorted_reasons = sorted(list(reasons_set))

        return is_quarantined, sorted_reasons, deduped_matches

    def redact(self, text: str) -> str:
        """
        Apply stable placeholders to sensitive matches.
        Preserves string structure and citation integrity.
        """
        _, _, matches = self.classify_text(text)
        if not matches:
            return text

        # Reconstruct string replacing spans in reverse order to preserve offsets
        redacted = text
        for match in reversed(matches):
            redacted = redacted[: match.start] + match.placeholder + redacted[match.end :]

        return redacted


# Global shared instance
default_classifier = SensitiveClassifier()
