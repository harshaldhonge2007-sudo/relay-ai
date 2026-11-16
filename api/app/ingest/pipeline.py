"""
Two-Phase BYOD Ingestion Pipeline.

Flow:
1. upload & parse -> PREVIEW (staging, counts, date range, people, sensitive items, zero persistence)
2. lead reviews & assigns visibility tiers -> COMMIT (scrub secrets, quarantine isolation, persistence, identity resolution, detectors, claims)
"""

import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from app.ingest.importers import DataImporter, IngestReport
from app.security.quarantine import default_classifier

logger = logging.getLogger(__name__)

# In-memory staging storage: staging_token -> StagedImport
_STAGING_STORAGE: Dict[str, "StagedImport"] = {}


class StagedImport:
    def __init__(self, case_id: str, items: List[Dict[str, Any]], report: IngestReport):
        self.token: str = str(uuid.uuid4())
        self.case_id: str = case_id
        self.items: List[Dict[str, Any]] = items
        self.report: IngestReport = report
        self.created_at: datetime = datetime.utcnow()

        # Run sensitive detection on parsed items
        self.detected_sensitive: List[Dict[str, Any]] = []
        for item in self.items:
            is_q, reasons, _ = default_classifier.classify_text(f"{item.get('title', '')} {item.get('body', '')}")
            if is_q:
                item["quarantine_reasons"] = reasons
                item["quarantine_status"] = "quarantined"
                self.detected_sensitive.append({
                    "id": item["external_id"],
                    "source": item["source"],
                    "title": item["title"],
                    "reasons": item["quarantine_reasons"],
                    "sample": item["body"][:120] + "..." if len(item["body"]) > 120 else item["body"],
                })
            else:
                item["quarantine_reasons"] = []
                item["quarantine_status"] = "active"

        # Extract people
        people_map: Dict[str, Dict[str, str]] = {}
        for item in self.items:
            name = item.get("author_name")
            email = item.get("author_email")
            handle = item.get("author_handle")
            if name and name != "Unknown":
                if name not in people_map:
                    people_map[name] = {"name": name, "email": email or "", "handle": handle or "", "sources": set()}
                people_map[name]["sources"].add(item["source"])

        self.detected_people = [
            {
                "name": p["name"],
                "email": p["email"],
                "handle": p["handle"],
                "sources": sorted(list(p["sources"])),
            }
            for p in people_map.values()
        ]

    def to_preview_dict(self) -> Dict[str, Any]:
        """Generate PREVIEW payload for lead review without persisting anything."""
        # Calculate date range
        dates = [item["occurred_at"] for item in self.items if item.get("occurred_at")]
        earliest = min(dates) if dates else "—"
        latest = max(dates) if dates else "—"

        # Item counts by source
        counts: Dict[str, int] = {}
        for item in self.items:
            src = item["source"]
            counts[src] = counts.get(src, 0) + 1

        # Sample items (up to 5 items)
        samples = [
            {
                "source": it["source"],
                "type": it["type"],
                "external_id": it["external_id"],
                "title": it["title"],
                "snippet": it["body"][:150] + ("..." if len(it["body"]) > 150 else ""),
                "quarantined": it["quarantine_status"] == "quarantined",
                "reasons": it["quarantine_reasons"],
            }
            for it in self.items[:5]
        ]

        return {
            "staging_token": self.token,
            "case_id": self.case_id,
            "total_items": len(self.items),
            "item_counts": counts,
            "date_range": {"earliest": earliest, "latest": latest},
            "sample_items": samples,
            "detected_people": self.detected_people,
            "detected_sensitive_items": self.detected_sensitive,
            "ingest_report": self.report.to_dict(),
        }


def create_import_preview(case_id: str, files: List[Tuple[str, bytes]]) -> Dict[str, Any]:
    """Parse uploaded files safely into unpersisted staging session."""
    importer = DataImporter()
    all_items: List[Dict[str, Any]] = []

    for filename, content in files:
        parsed_items = importer.parse_file(filename, content)
        all_items.extend(parsed_items)

    staged = StagedImport(case_id, all_items, importer.report)
    _STAGING_STORAGE[staged.token] = staged
    return staged.to_preview_dict()


def get_staged_import(staging_token: str) -> Optional[StagedImport]:
    """Retrieve an active unpersisted staging session."""
    return _STAGING_STORAGE.get(staging_token)


def drop_staged_import(staging_token: str):
    """Clean up staging session once committed or discarded."""
    _STAGING_STORAGE.pop(staging_token, None)
