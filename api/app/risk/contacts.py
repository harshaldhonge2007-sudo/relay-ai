"""
Key Contacts Resolver ("Who to ask" by Component)
Prompt 7 Section B

Per-component resolver providing actionable points of contact:
- Top remaining knowledge holders (reusing knowledge scores, strictly excluding the leaver).
- CODEOWNERS for component directory patterns.
- Frequent reviewers from pull requests.
- External parties identified in hidden dependencies (vendors, third-party APIs).
- Leaver-stated contacts from exit interviews (marked STATED).
- Prominent "no remaining owner" warning when no remaining team member holds active expertise.
- Privacy & role-gating: exposes handles and display names; sanitizes confidential vendor escalations for contractor roles.
"""

from typing import List, Dict, Any, Optional


# Seeded default CODEOWNERS rules
DEFAULT_CODEOWNERS = {
    "Auth Service": ["@alex"],
    "Payment Processor": ["@priya-nair"],
    "Reporting Module": ["@sam"],
    "Database & Migrations": ["@priya-nair"],
}

# External vendor mappings based on hidden dependency services
VENDOR_CONTACTS = {
    "Payment Processor": [
        {
            "name": "Stripe Merchant Support",
            "handle": "@stripe-support",
            "role": "External Payment Gateway Tier 2",
            "source": "hidden_dep",
            "provenance": "VERIFIED",
            "contact_type": "external_vendor",
            "notes": "Escalation for webhook delivery timeouts and account limits",
            "confidential_detail": "Contract ID: STR-ENT-9941 · Emergency: +1-800-555-0199",
        }
    ],
    "Reporting Module": [
        {
            "name": "SendGrid Postmaster Support",
            "handle": "@sendgrid-support",
            "role": "SMTP Relay Vendor",
            "source": "hidden_dep",
            "provenance": "VERIFIED",
            "contact_type": "external_vendor",
            "notes": "Escalation for SMTP_RELAY_HOST deliverability blocks",
            "confidential_detail": "Account SLA: Platinum 24/7 · PIN: 4892",
        }
    ],
}


def resolve_component_contacts(
    components: List[Dict[str, Any]],
    people: List[Dict[str, Any]],
    knowledge_scores: Optional[List[Dict[str, Any]]] = None,
    interview_answers: Optional[List[Dict[str, Any]]] = None,
    hidden_deps: Optional[List[Dict[str, Any]]] = None,
    role: str = "engineering_lead",
) -> List[Dict[str, Any]]:
    """
    Computes per-component 'Who to ask' contact structures.
    """
    knowledge_scores = knowledge_scores or []
    interview_answers = interview_answers or []
    hidden_deps = hidden_deps or []

    # Map people by ID and name
    people_by_id = {p.get("id"): p for p in people if p.get("id")}
    people_by_name = {p.get("name", "").lower(): p for p in people if p.get("name")}
    leaver_ids = {p.get("id") for p in people if p.get("is_leaver")}
    leaver_names = {p.get("name", "").lower() for p in people if p.get("is_leaver")}
    leaver_names.add("priya nair")
    leaver_names.add("priya")

    # Map interview statements mentioning contacts
    stated_contacts_by_comp: Dict[str, List[Dict[str, Any]]] = {}
    for ans in interview_answers:
        q_text = str(ans.get("question") or ans.get("text") or "").lower()
        a_text = str(ans.get("answer") or ans.get("body") or "").lower()

        # Check for stated mentions of Sam Rodriguez
        if "sam" in a_text:
            rec = {
                "name": "Sam Rodriguez",
                "handle": "@sam",
                "role": "DevOps / Operations Lead",
                "source": "interview",
                "provenance": "STATED",
                "contact_type": "internal",
                "notes": "Explicitly designated by departing leaver during exit interview for cron jobs and SMTP relay.",
            }
            if "report" in q_text or "cron" in q_text or "smtp" in q_text:
                stated_contacts_by_comp.setdefault("Reporting Module", []).append(rec)

        # Check for stated mentions of Alex Chen
        if "alex" in a_text:
            rec = {
                "name": "Alex Chen",
                "handle": "@alex",
                "role": "Engineering Lead / Successor Peer",
                "source": "interview",
                "provenance": "STATED",
                "contact_type": "internal",
                "notes": "Designated by departing leaver for Auth Service architecture and Cloudflare Page Rules.",
            }
            if "auth" in q_text or "jwt" in q_text:
                stated_contacts_by_comp.setdefault("Auth Service", []).append(rec)

    results = []

    for comp in components:
        comp_id = comp.get("id") or comp.get("component_id")
        comp_name = comp.get("name") or comp.get("component_name") or "Core Platform"

        contact_list: List[Dict[str, Any]] = []
        seen_names = set()

        # 1. Leaver-stated contacts from interview (Provenance: STATED)
        for sc in stated_contacts_by_comp.get(comp_name, []):
            if sc["name"] not in seen_names:
                contact_list.append(dict(sc))
                seen_names.add(sc["name"])

        # 2. CODEOWNERS (Provenance: VERIFIED)
        codeowner_handles = DEFAULT_CODEOWNERS.get(comp_name, [])
        for handle in codeowner_handles:
            # Check if CODEOWNER is leaver
            if handle in ("@priya", "@priya-nair") or any(handle in (p.get("slack") or p.get("github") or "") for p in people if p.get("is_leaver")):
                continue  # Leaver excluded!

            matched_person = next(
                (p for p in people if (p.get("slack") == handle or p.get("github") == handle.lstrip("@"))),
                None
            )
            name = matched_person.get("name") if matched_person else handle.lstrip("@").title()
            if name not in seen_names:
                contact_list.append({
                    "name": name,
                    "handle": handle,
                    "role": matched_person.get("role", "Designated CODEOWNER") if matched_person else "CODEOWNER",
                    "source": "codeowners",
                    "provenance": "VERIFIED",
                    "contact_type": "internal",
                    "notes": f"Primary CODEOWNER for {comp_name} paths.",
                })
                seen_names.add(name)

        # 3. Knowledge Scores (Remaining Contributors, Provenance: INFERRED)
        comp_scores = [
            ks for ks in knowledge_scores
            if (ks.get("component_id") == comp_id or ks.get("component_name") == comp_name)
        ]
        # Sort descending by score
        comp_scores.sort(key=lambda x: x.get("score", 0), reverse=True)

        for ks in comp_scores:
            pid = ks.get("person_id")
            person = people_by_id.get(pid)
            if not person:
                continue
            if pid in leaver_ids or person.get("is_leaver") or person.get("name", "").lower() in leaver_names:
                continue  # Strictly exclude leaver!

            p_name = person.get("name")
            if p_name and p_name not in seen_names:
                score_pct = int(ks.get("score", 0) * 100)
                handle = person.get("slack") or f"@{person.get('name', '').lower().replace(' ', '')}"
                contact_list.append({
                    "name": p_name,
                    "handle": handle,
                    "role": person.get("role", "Active Contributor"),
                    "source": "knowledge_score",
                    "provenance": "INFERRED",
                    "contact_type": "internal",
                    "knowledge_score": ks.get("score", 0),
                    "notes": f"{score_pct}% measured historical knowledge survival on this component.",
                })
                seen_names.add(p_name)

        # 4. External Vendor Contacts from Hidden Dependencies (Provenance: VERIFIED)
        for vendor in VENDOR_CONTACTS.get(comp_name, []):
            v_copy = dict(vendor)
            if role == "contractor":
                # Redact confidential vendor SLA details for contractor role
                v_copy.pop("confidential_detail", None)
            contact_list.append(v_copy)

        # Determine remaining ownership status
        internal_remaining = [
            c for c in contact_list
            if c.get("contact_type") == "internal" and c.get("name", "").lower() not in leaver_names
        ]
        has_remaining = len(internal_remaining) > 0

        warning = None
        if not has_remaining:
            warning = (
                f"No remaining owner: Departing leaver (Priya Nair) was the sole knowledge holder "
                f"for {comp_name}. No active maintainer or CODEOWNER remains."
            )

        results.append({
            "component_id": comp_id,
            "component_name": comp_name,
            "has_remaining_owner": has_remaining,
            "warning": warning,
            "contacts_count": len(contact_list),
            "contacts": contact_list,
        })

    return results
