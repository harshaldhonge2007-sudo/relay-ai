import logging
from typing import Optional, List, Dict, Any
from difflib import SequenceMatcher
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Person

logger = logging.getLogger(__name__)


class IdentityResolver:
    """Maps identities across GitHub, Slack, Jira, and docs to unified persons."""

    async def resolve_identities(self, session: AsyncSession) -> Dict[str, Any]:
        """Resolve and merge person identities across sources."""
        results = {
            "merged": 0,
            "matched": 0,
            "unresolved": 0,
        }

        people = (await session.execute(select(Person))).scalars().all()

        email_map = {}
        for person in people:
            for identity in person.identities:
                email = identity.get("email")
                if email:
                    if email not in email_map:
                        email_map[email] = []
                    email_map[email].append(person.id)

        for email, person_ids in email_map.items():
            if len(person_ids) > 1:
                primary_id = person_ids[0]
                for secondary_id in person_ids[1:]:
                    await self._merge_persons(session, secondary_id, primary_id)
                    results["merged"] += 1

        handle_map = {}
        for person in people:
            for identity in person.identities:
                handle = identity.get("handle") or identity.get("id")
                if handle:
                    match = None
                    for existing_handle in handle_map:
                        if self._fuzzy_match(handle, existing_handle):
                            match = existing_handle
                            break

                    if match:
                        if handle_map[match] != person.id:
                            await self._merge_persons(session, person.id, handle_map[match])
                            results["merged"] += 1
                    else:
                        handle_map[handle] = person.id
                        results["matched"] += 1

        results["unresolved"] = len(people) - results["merged"] - results["matched"]
        await session.flush()
        return results

    async def _merge_persons(self, session: AsyncSession, secondary_id, primary_id):
        """Merge secondary person into primary person."""
        secondary = (await session.execute(select(Person).where(Person.id == secondary_id))).scalar()
        primary = (await session.execute(select(Person).where(Person.id == primary_id))).scalar()

        if not secondary or not primary:
            return

        for identity in secondary.identities:
            if identity not in primary.identities:
                primary.identities.append(identity)

        if not primary.display_name or primary.display_name == "Unknown":
            primary.display_name = secondary.display_name

        if secondary.is_leaver:
            primary.is_leaver = True

        await session.delete(secondary)

    def _fuzzy_match(self, s1: str, s2: str, threshold: float = 0.8) -> bool:
        """Fuzzy string matching."""
        ratio = SequenceMatcher(None, s1.lower(), s2.lower()).ratio()
        return ratio >= threshold

    async def add_identity_override(
        self,
        session: AsyncSession,
        person_id,
        source: str,
        identity_id: str,
        email: Optional[str] = None,
    ):
        """Add an identity override for manual person mapping."""
        person = (await session.execute(select(Person).where(Person.id == person_id))).scalar()
        if not person:
            return

        new_identity = {
            "source": source,
            "id": identity_id,
        }
        if email:
            new_identity["email"] = email

        if new_identity not in person.identities:
            person.identities.append(new_identity)
            await session.flush()
