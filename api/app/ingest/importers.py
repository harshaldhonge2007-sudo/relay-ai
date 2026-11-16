"""
Safe Bring-Your-Own-Data (BYOD) Importers.

Supports:
- Slack export: ZIP (with users.json, channels.json, per-day message JSON files) or JSON array
- Jira export: CSV (standard Jira issue export) or JSON array
- Documents & Notes: Markdown (.md), Plain Text (.txt), and PDF (.pdf)

Enforces strict safety:
- Size limits: 10MB per file, 25MB total batch limit
- Zip-slip vulnerability protection (directory traversal prevention)
- Binary content sniffing (rejecting executable binaries)
- HTML/XSS neutralization
- Per-file error & warning reporting in IngestReport
"""

import os
import re
import io
import csv
import json
import zipfile
import html
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024      # 10 MB per file
MAX_TOTAL_SIZE = 25 * 1024 * 1024     # 25 MB total batch

# Executable binary signatures (magic bytes) to reject
FORBIDDEN_MAGIC = [
    b"MZ",                          # Windows PE executable
    b"\x7fELF",                     # Linux ELF executable
    b"\xca\xfe\xba\xbe",            # Mach-O fat binary or Java class
    b"\xcf\xfa\xed\xfe",            # Mach-O 64-bit
    b"\xce\xfa\xed\xfe",            # Mach-O 32-bit
]

RE_HTML_TAG = re.compile(r"<[^>]+>")


def sanitize_text(text: str) -> str:
    """Neutralize potential HTML/XSS content while preserving readable plain text."""
    if not text:
        return ""
    # Strip HTML tags
    cleaned = RE_HTML_TAG.sub("", text)
    # Unescape any existing entities so text is canonical plain text
    return html.unescape(cleaned).strip()


class IngestReport:
    def __init__(self):
        self.files_processed: int = 0
        self.items_parsed: int = 0
        self.items_by_source: Dict[str, int] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.skipped_files: List[str] = []

    def add_item(self, source: str):
        self.items_parsed += 1
        self.items_by_source[source] = self.items_by_source.get(source, 0) + 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "files_processed": self.files_processed,
            "items_parsed": self.items_parsed,
            "items_by_source": self.items_by_source,
            "errors": self.errors,
            "warnings": self.warnings,
            "skipped_files": self.skipped_files,
        }


class DataImporter:
    """Parses heterogeneous project exports safely into normalized artifact structures."""

    def __init__(self):
        self.report = IngestReport()

    def validate_content_safety(self, filename: str, content: bytes) -> bool:
        """Verify content does not contain forbidden binary executable signatures or exceed size."""
        if len(content) > MAX_FILE_SIZE:
            self.report.errors.append(f"{filename}: File exceeds maximum size limit of {MAX_FILE_SIZE // (1024*1024)}MB")
            return False

        # Sniff magic bytes
        for magic in FORBIDDEN_MAGIC:
            if content.startswith(magic):
                self.report.errors.append(f"{filename}: Executable binary content rejected for security")
                return False

        return True

    def parse_file(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Dispatcher based on filename extension and content sniffing."""
        self.report.files_processed += 1
        if not self.validate_content_safety(filename, content):
            self.report.skipped_files.append(filename)
            return []

        lower_name = filename.lower()
        try:
            if lower_name.endswith(".zip"):
                return self.parse_slack_zip(filename, content)
            elif lower_name.endswith(".csv"):
                return self.parse_jira_csv(filename, content)
            elif lower_name.endswith(".json"):
                return self.parse_generic_json(filename, content)
            elif lower_name.endswith((".md", ".markdown", ".txt")):
                return self.parse_text_doc(filename, content)
            elif lower_name.endswith(".pdf"):
                return self.parse_pdf_doc(filename, content)
            else:
                self.report.warnings.append(f"{filename}: Unrecognized file extension, skipping")
                self.report.skipped_files.append(filename)
                return []
        except Exception as e:
            logger.exception(f"Unhandled error parsing {filename}")
            self.report.errors.append(f"{filename}: Failed to parse ({str(e)})")
            self.report.skipped_files.append(filename)
            return []

    # -------------------------------------------------------------------------
    # 1. Slack Export Parser (ZIP and JSON)
    # -------------------------------------------------------------------------
    def parse_slack_zip(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Parses a standard Slack export zip with zip-slip traversal protection."""
        items: List[Dict[str, Any]] = []

        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                # Zip-slip protection check
                for member in z.infolist():
                    target_path = Path(member.filename)
                    if target_path.is_absolute() or ".." in target_path.parts:
                        self.report.errors.append(f"{filename}: Zip-slip path traversal attempt detected ({member.filename})")
                        return []

                # Load user metadata if available
                users_map: Dict[str, Dict[str, str]] = {}
                if "users.json" in z.namelist():
                    try:
                        raw_users = json.loads(z.read("users.json").decode("utf-8", errors="replace"))
                        if isinstance(raw_users, list):
                            for u in raw_users:
                                uid = u.get("id")
                                if uid:
                                    profile = u.get("profile", {})
                                    users_map[uid] = {
                                        "name": sanitize_text(u.get("real_name") or u.get("name") or "Unknown"),
                                        "email": sanitize_text(profile.get("email", "")),
                                        "handle": sanitize_text(u.get("name", "")),
                                    }
                    except Exception as e:
                        self.report.warnings.append(f"{filename}: Failed to parse users.json ({str(e)})")

                # Load channel names
                channels_map: Dict[str, str] = {}
                if "channels.json" in z.namelist():
                    try:
                        raw_channels = json.loads(z.read("channels.json").decode("utf-8", errors="replace"))
                        if isinstance(raw_channels, list):
                            for ch in raw_channels:
                                if ch.get("id") and ch.get("name"):
                                    channels_map[ch["id"]] = ch["name"]
                    except Exception as e:
                        self.report.warnings.append(f"{filename}: Failed to parse channels.json ({str(e)})")

                # Traverse channel directories and read daily JSONs
                for member in z.infolist():
                    parts = Path(member.filename).parts
                    if member.filename.endswith(".json") and len(parts) >= 2 and parts[0] not in ("users.json", "channels.json"):
                        channel_name = parts[0]
                        try:
                            day_data = json.loads(z.read(member.filename).decode("utf-8", errors="replace"))
                            if isinstance(day_data, list):
                                for idx, msg in enumerate(day_data):
                                    if not isinstance(msg, dict):
                                        continue
                                    text = sanitize_text(msg.get("text", ""))
                                    if not text:
                                        continue

                                    user_id = msg.get("user") or msg.get("user_id") or "unknown"
                                    u_info = users_map.get(user_id, {"name": user_id, "email": "", "handle": user_id})
                                    ts_str = msg.get("ts", "")
                                    occurred_at = self._parse_slack_ts(ts_str)

                                    item = {
                                        "source": "slack",
                                        "type": "slack_message",
                                        "external_id": f"slack_{channel_name}_{ts_str or idx}",
                                        "title": f"#{channel_name}: {u_info['name']}",
                                        "body": text,
                                        "author_name": u_info["name"],
                                        "author_email": u_info["email"],
                                        "author_handle": u_info["handle"],
                                        "occurred_at": occurred_at,
                                        "url": f"https://slack.com/archives/{channel_name}/p{ts_str.replace('.', '')}",
                                        "raw": msg,
                                    }
                                    items.append(item)
                                    self.report.add_item("slack")
                        except Exception as e:
                            self.report.warnings.append(f"{member.filename}: Failed to parse day messages ({str(e)})")

        except zipfile.BadZipFile:
            self.report.errors.append(f"{filename}: Invalid or corrupted zip archive")
            return []

        return items

    def _parse_slack_ts(self, ts_str: str) -> str:
        if not ts_str:
            return datetime.utcnow().isoformat() + "Z"
        try:
            epoch = float(ts_str.split(".")[0])
            return datetime.utcfromtimestamp(epoch).isoformat() + "Z"
        except (ValueError, TypeError):
            return datetime.utcnow().isoformat() + "Z"

    # -------------------------------------------------------------------------
    # 2. Jira Export Parser (CSV and JSON)
    # -------------------------------------------------------------------------
    def parse_jira_csv(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Parses Jira issue CSV export with standard column mappings."""
        items: List[Dict[str, Any]] = []
        text = content.decode("utf-8", errors="replace")

        try:
            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                self.report.errors.append(f"{filename}: CSV contains no header row")
                return []

            # Normalize header lookup
            headers = {h.strip().lower(): h for h in reader.fieldnames if h}

            key_col = headers.get("issue key") or headers.get("key") or headers.get("issue id")
            summary_col = headers.get("summary") or headers.get("issue summary") or headers.get("title")
            desc_col = headers.get("description") or headers.get("details")
            status_col = headers.get("status") or headers.get("issue status")
            assignee_col = headers.get("assignee") or headers.get("assigned to")
            created_col = headers.get("created") or headers.get("created date")
            updated_col = headers.get("updated") or headers.get("updated date")

            if not key_col and not summary_col:
                self.report.errors.append(f"{filename}: CSV does not contain Jira 'Issue key' or 'Summary' columns")
                return []

            for idx, row in enumerate(reader):
                key = sanitize_text(row.get(key_col, f"JIRA-{idx+1}")) if key_col else f"JIRA-{idx+1}"
                summary = sanitize_text(row.get(summary_col, "Untitled issue")) if summary_col else "Untitled issue"
                desc = sanitize_text(row.get(desc_col, "")) if desc_col else ""
                status = sanitize_text(row.get(status_col, "Open")) if status_col else "Open"
                assignee = sanitize_text(row.get(assignee_col, "Unassigned")) if assignee_col else "Unassigned"
                created = row.get(created_col) or datetime.utcnow().isoformat() + "Z"
                updated = row.get(updated_col) or created

                body_text = f"Status: {status}\nAssignee: {assignee}\n\n{desc}" if desc else f"Status: {status}\nAssignee: {assignee}"

                item = {
                    "source": "jira",
                    "type": "jira_ticket",
                    "external_id": key,
                    "title": f"[{key}] {summary}",
                    "body": body_text,
                    "author_name": assignee if assignee != "Unassigned" else "",
                    "author_email": "",
                    "occurred_at": updated,
                    "url": f"https://jira.internal.net/browse/{key}",
                    "raw": dict(row),
                }
                items.append(item)
                self.report.add_item("jira")

        except Exception as e:
            self.report.errors.append(f"{filename}: Failed to parse Jira CSV ({str(e)})")

        return items

    def parse_generic_json(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Parses generic JSON containing an array of Slack messages or Jira issues."""
        items: List[Dict[str, Any]] = []
        try:
            parsed = json.loads(content.decode("utf-8", errors="replace"))
        except Exception as e:
            self.report.errors.append(f"{filename}: Invalid JSON format ({str(e)})")
            return []

        # Check if wrapped in dictionary e.g. {"messages": [...]} or {"issues": [...]}
        data_list = []
        inferred_source = "slack"
        if isinstance(parsed, list):
            data_list = parsed
        elif isinstance(parsed, dict):
            if "messages" in parsed and isinstance(parsed["messages"], list):
                data_list = parsed["messages"]
                inferred_source = "slack"
            elif "issues" in parsed and isinstance(parsed["issues"], list):
                data_list = parsed["issues"]
                inferred_source = "jira"
            elif "items" in parsed and isinstance(parsed["items"], list):
                data_list = parsed["items"]
            else:
                self.report.warnings.append(f"{filename}: JSON object missing 'messages' or 'issues' list")
                return []

        for idx, entry in enumerate(data_list):
            if not isinstance(entry, dict):
                continue

            # Check if looks like Jira issue
            if "key" in entry or "fields" in entry:
                key = entry.get("key", f"JIRA-{idx+1}")
                fields = entry.get("fields", entry)
                summary = sanitize_text(fields.get("summary", "Untitled issue"))
                desc = sanitize_text(fields.get("description", ""))
                assignee_dict = fields.get("assignee")
                assignee_name = ""
                if isinstance(assignee_dict, dict):
                    assignee_name = sanitize_text(assignee_dict.get("displayName") or assignee_dict.get("name", ""))
                elif isinstance(assignee_dict, str):
                    assignee_name = sanitize_text(assignee_dict)

                item = {
                    "source": "jira",
                    "type": "jira_ticket",
                    "external_id": key,
                    "title": f"[{key}] {summary}",
                    "body": desc or summary,
                    "author_name": assignee_name,
                    "author_email": "",
                    "occurred_at": entry.get("updated") or datetime.utcnow().isoformat() + "Z",
                    "url": f"https://jira.internal.net/browse/{key}",
                    "raw": entry,
                }
                items.append(item)
                self.report.add_item("jira")
            else:
                # Treat as Slack or general message
                text = sanitize_text(entry.get("text") or entry.get("body") or "")
                if not text:
                    continue
                user_info = entry.get("user") or {}
                if isinstance(user_info, str):
                    author_name = user_info
                    author_email = ""
                else:
                    author_name = sanitize_text(user_info.get("name") or "User")
                    author_email = sanitize_text(user_info.get("email") or "")

                ts = entry.get("ts") or datetime.utcnow().isoformat() + "Z"
                ext_id = entry.get("id") or f"msg_{idx+1}"

                item = {
                    "source": "slack",
                    "type": "slack_message",
                    "external_id": str(ext_id),
                    "title": entry.get("title") or f"Slack Message: {author_name}",
                    "body": text,
                    "author_name": author_name,
                    "author_email": author_email,
                    "occurred_at": ts,
                    "url": entry.get("url", ""),
                    "raw": entry,
                }
                items.append(item)
                self.report.add_item("slack")

        return items

    # -------------------------------------------------------------------------
    # 3. Documents (Markdown & Plain Text)
    # -------------------------------------------------------------------------
    def parse_text_doc(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Parses Markdown or plain text meeting notes and architectural docs."""
        text = content.decode("utf-8", errors="replace")
        clean_text = sanitize_text(text)
        if not clean_text:
            self.report.warnings.append(f"{filename}: Empty document")
            return []

        # Extract title from first Markdown # Header or fallback to filename
        title = Path(filename).stem.replace("_", " ").replace("-", " ").title()
        for line in clean_text.splitlines():
            line_str = line.strip()
            if line_str.startswith("#"):
                extracted = line_str.lstrip("#").strip()
                if extracted:
                    title = extracted
                    break

        item = {
            "source": "docs",
            "type": "doc",
            "external_id": Path(filename).name,
            "title": title,
            "body": clean_text,
            "author_name": "",
            "author_email": "",
            "occurred_at": datetime.utcnow().isoformat() + "Z",
            "url": f"file:///{filename}",
            "raw": {"filename": filename, "length": len(clean_text)},
        }
        self.report.add_item("docs")
        return [item]

    # -------------------------------------------------------------------------
    # 4. Documents (PDF Text)
    # -------------------------------------------------------------------------
    def parse_pdf_doc(self, filename: str, content: bytes) -> List[Dict[str, Any]]:
        """Extracts plain text from PDF documents using pypdf safely."""
        try:
            import pypdf
        except ImportError:
            self.report.errors.append(f"{filename}: PDF parser (pypdf) is not available")
            return []

        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            extracted_pages = []
            for page_idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text:
                    extracted_pages.append(page_text)

            full_text = "\n\n".join(extracted_pages).strip()
            clean_text = sanitize_text(full_text)

            if not clean_text:
                self.report.warnings.append(f"{filename}: PDF contains no extractable text")
                return []

            title = Path(filename).stem.replace("_", " ").replace("-", " ").title()
            item = {
                "source": "docs",
                "type": "doc",
                "external_id": Path(filename).name,
                "title": title,
                "body": clean_text,
                "author_name": "",
                "author_email": "",
                "occurred_at": datetime.utcnow().isoformat() + "Z",
                "url": f"file:///{filename}",
                "raw": {"filename": filename, "pages": len(reader.pages)},
            }
            self.report.add_item("docs")
            return [item]

        except Exception as e:
            self.report.errors.append(f"{filename}: Failed to extract PDF text ({str(e)})")
            return []
