import io
import re
from datetime import datetime
from typing import List, Optional, Dict, Any

from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

PAGE_WIDTH, PAGE_HEIGHT = A4

NAVY = HexColor('#1a1f36')
GRAY = HexColor('#6b7280')
LIGHT_GRAY = HexColor('#f3f4f6')
MID_GRAY = HexColor('#d1d5db')
VERIFIED_COLOR = HexColor('#065f46')   # dark green
STATED_COLOR = HexColor('#1e40af')     # dark blue
INFERRED_COLOR = HexColor('#92400e')   # dark amber


def _wrap_url(url: str, max_len: int = 60) -> str:
    """Wrap long URLs with zero-width break opportunities."""
    if len(url) <= max_len:
        return url
    # Insert soft breaks every max_len chars
    chunks = [url[i:i+max_len] for i in range(0, len(url), max_len)]
    return '\n'.join(chunks)


def _convert_bold_markdown(text: str) -> str:
    """Convert **bold** markdown to ReportLab bold tags."""
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)


def _header_footer_factory(case_name: str, generated_date: str):
    """Return (on_first_page, on_later_pages) canvas callbacks."""

    def _draw_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GRAY)
        # Left: confidential + date
        canvas.drawString(
            2 * cm, 1.2 * cm,
            f"RELAY AI Confidential — Generated {generated_date}  |  {case_name}"
        )
        # Right: page number
        page_num = f"Page {doc.page}"
        canvas.drawRightString(PAGE_WIDTH - 2 * cm, 1.2 * cm, page_num)
        canvas.restoreState()

    def _draw_header(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(2 * cm, PAGE_HEIGHT - 1.5 * cm, "RELAY AI — Project Handover")
        canvas.drawRightString(PAGE_WIDTH - 2 * cm, PAGE_HEIGHT - 1.5 * cm, case_name)
        canvas.setStrokeColor(MID_GRAY)
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, PAGE_HEIGHT - 1.7 * cm, PAGE_WIDTH - 2 * cm, PAGE_HEIGHT - 1.7 * cm)
        canvas.restoreState()

    def on_first_page(canvas, doc):
        _draw_footer(canvas, doc)
        # No header on cover

    def on_later_pages(canvas, doc):
        _draw_header(canvas, doc)
        _draw_footer(canvas, doc)

    return on_first_page, on_later_pages


class HandoverPDFBuilder:
    def build(
        self,
        case_name: str,
        leaver_name: Optional[str],
        repo_url: str,
        handover_items: List[Dict[str, Any]],
        grounding_score: float = 0.82,
        contacts: Optional[List[Dict[str, Any]]] = None,
        recurring_problems: Optional[List[Dict[str, Any]]] = None,
        continuation: Optional[Dict[str, Any]] = None,
        generated_at: Optional[datetime] = None,
        version: int = 1,
    ) -> bytes:
        if generated_at is None:
            generated_at = datetime.utcnow()

        generated_date = generated_at.strftime('%Y-%m-%d')
        buf = io.BytesIO()

        on_first_page, on_later_pages = _header_footer_factory(case_name, generated_date)

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2.5 * cm,
            title=f"RELAY AI — {case_name} Handover",
            author="RELAY AI",
        )

        styles = getSampleStyleSheet()
        story = []

        # ------------------------------------------------------------------ #
        # Custom styles
        # ------------------------------------------------------------------ #
        cover_title_style = ParagraphStyle(
            'CoverTitle',
            parent=styles['Normal'],
            fontSize=28,
            leading=36,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=0.4 * cm,
            fontName='Helvetica-Bold',
        )
        cover_sub_style = ParagraphStyle(
            'CoverSub',
            parent=styles['Normal'],
            fontSize=16,
            leading=22,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=0.2 * cm,
            fontName='Helvetica',
        )
        cover_meta_style = ParagraphStyle(
            'CoverMeta',
            parent=styles['Normal'],
            fontSize=10,
            leading=16,
            textColor=GRAY,
            alignment=TA_CENTER,
            fontName='Helvetica',
        )
        section_header_style = ParagraphStyle(
            'SectionHeader',
            parent=styles['Normal'],
            fontSize=13,
            leading=18,
            textColor=NAVY,
            fontName='Helvetica-Bold',
            spaceBefore=0.6 * cm,
            spaceAfter=0.15 * cm,
        )
        item_meta_style = ParagraphStyle(
            'ItemMeta',
            parent=styles['Normal'],
            fontSize=8,
            leading=12,
            textColor=GRAY,
            fontName='Helvetica',
            spaceAfter=0.05 * cm,
        )
        item_body_style = ParagraphStyle(
            'ItemBody',
            parent=styles['Normal'],
            fontSize=10,
            leading=15,
            textColor=colors.black,
            fontName='Helvetica',
            spaceAfter=0.3 * cm,
        )
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=9,
            leading=14,
            textColor=HexColor('#374151'),
            fontName='Helvetica-Oblique',
        )
        heading2_style = ParagraphStyle(
            'Heading2Custom',
            parent=styles['Normal'],
            fontSize=12,
            leading=16,
            textColor=NAVY,
            fontName='Helvetica-Bold',
            spaceBefore=0.4 * cm,
            spaceAfter=0.15 * cm,
        )

        # ------------------------------------------------------------------ #
        # COVER PAGE
        # ------------------------------------------------------------------ #
        story.append(Spacer(1, 4 * cm))
        story.append(Paragraph("RELAY AI", cover_title_style))
        story.append(Paragraph("Project Handover Document", cover_sub_style))
        story.append(Spacer(1, 0.5 * cm))
        story.append(HRFlowable(width="80%", thickness=2, color=NAVY, hAlign='CENTER'))
        story.append(Spacer(1, 0.6 * cm))

        story.append(Paragraph(f"<b>Project:</b> {case_name}", cover_meta_style))
        if leaver_name:
            story.append(Paragraph(f"<b>Leaver:</b> {leaver_name}", cover_meta_style))

        wrapped_url = _wrap_url(repo_url)
        story.append(Paragraph(f"<b>Repository:</b> {wrapped_url}", cover_meta_style))
        story.append(Paragraph(f"<b>Generated:</b> {generated_date}", cover_meta_style))
        story.append(Paragraph(f"<b>Version:</b> {version}", cover_meta_style))
        story.append(Paragraph(
            f"<b>Grounding Score:</b> {int(round(grounding_score * 100))}%",
            cover_meta_style,
        ))

        story.append(Spacer(1, 1 * cm))

        # Cover disclaimer box
        cover_disclaimer_data = [[
            Paragraph(
                "<b>DISCLAIMER</b><br/>"
                "This document was generated by RELAY AI. Content marked <b>INFERRED</b> is "
                "AI-synthesized and should be independently verified. <b>STATED</b> content comes "
                "from leaver interviews. <b>VERIFIED</b> content is grounded in multiple evidence sources.",
                disclaimer_style,
            )
        ]]
        cover_disclaimer_table = Table(cover_disclaimer_data, colWidths=[14 * cm])
        cover_disclaimer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#fef3c7')),
            ('BOX', (0, 0), (-1, -1), 1, HexColor('#f59e0b')),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ]))
        story.append(cover_disclaimer_table)
        story.append(PageBreak())

        # ------------------------------------------------------------------ #
        # SUMMARY TABLE
        # ------------------------------------------------------------------ #
        total = len(handover_items)
        verified_count = sum(
            1 for i in handover_items if i.get('provenance', '').lower() == 'verified'
        )
        stated_count = sum(
            1 for i in handover_items if i.get('provenance', '').lower() == 'stated'
        )
        inferred_count = sum(
            1 for i in handover_items if i.get('provenance', '').lower() == 'inferred'
        )

        story.append(Paragraph("Summary", heading2_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
        story.append(Spacer(1, 0.3 * cm))

        summary_data = [
            ['Metric', 'Value'],
            ['Total Claims', str(total)],
            ['Verified', str(verified_count)],
            ['Stated', str(stated_count)],
            ['Inferred', str(inferred_count)],
            ['Overall Grounding Score', f"{int(round(grounding_score * 100))}%"],
        ]
        summary_table = Table(summary_data, colWidths=[8 * cm, 6 * cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
            ('GRID', (0, 0), (-1, -1), 0.5, MID_GRAY),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.6 * cm))

        # ------------------------------------------------------------------ #
        # BODY — items grouped by section
        # ------------------------------------------------------------------ #
        story.append(Paragraph("Handover Items", heading2_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))

        if not handover_items:
            story.append(Spacer(1, 0.4 * cm))
            story.append(Paragraph("No handover items available.", item_body_style))
        else:
            # Group by section
            sections: Dict[str, List[Dict[str, Any]]] = {}
            for item in handover_items:
                sec = item.get('section') or 'General'
                sections.setdefault(sec, []).append(item)

            for section_name, items in sections.items():
                section_block = []
                section_block.append(Spacer(1, 0.3 * cm))
                section_block.append(Paragraph(section_name, section_header_style))
                section_block.append(HRFlowable(width="100%", thickness=0.5, color=NAVY))

                for item in items:
                    provenance = (item.get('provenance') or 'inferred').lower()
                    confidence = item.get('confidence', 0.0)
                    evidence_ids = item.get('evidence_ids') or []
                    text = item.get('text', '')

                    # Badge color
                    if provenance == 'verified':
                        badge_color = VERIFIED_COLOR
                        badge_label = 'VERIFIED'
                    elif provenance == 'stated':
                        badge_color = STATED_COLOR
                        badge_label = 'STATED'
                    else:
                        badge_color = INFERRED_COLOR
                        badge_label = 'INFERRED'

                    meta_text = (
                        f'<font color="#{badge_color.hexval()[2:]}">[{badge_label}]</font>'
                        f'  Confidence: {int(round(confidence * 100))}%'
                        f'  |  Evidence sources: {len(evidence_ids)}'
                    )
                    section_block.append(Spacer(1, 0.2 * cm))
                    section_block.append(Paragraph(meta_text, item_meta_style))

                    # Convert bold markdown and render body
                    body_text = _convert_bold_markdown(text)
                    section_block.append(Paragraph(body_text, item_body_style))

                story.append(KeepTogether(section_block))

        # ------------------------------------------------------------------ #
        # RECURRING PROBLEMS & OPERATIONAL VULNERABILITIES
        # ------------------------------------------------------------------ #
        if recurring_problems:
            story.append(Spacer(1, 0.6 * cm))
            story.append(Paragraph("Recurring Problems &amp; Operational Vulnerabilities", heading2_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
            story.append(Spacer(1, 0.3 * cm))

            for prob in recurring_problems:
                prob_block = []
                p_prov = (prob.get("provenance") or "inferred").upper()
                prov_color = VERIFIED_COLOR if p_prov == "VERIFIED" else INFERRED_COLOR

                header_text = (
                    f"<b>{prob.get('title', 'Recurring Issue')}</b> "
                    f"<font color=\"#{prov_color.hexval()[2:]}\">[{p_prov}]</font> "
                    f"· Frequency: {prob.get('frequency', 1)}x "
                    f"· Component: {prob.get('component', 'General')}"
                )
                prob_block.append(Paragraph(header_text, item_meta_style))
                prob_block.append(Paragraph(prob.get("description", ""), item_body_style))

                action_text = f"<b>Suggested Next Action:</b> {prob.get('suggested_action', 'Investigate recurrence')}"
                action_table = Table([[Paragraph(action_text, disclaimer_style)]], colWidths=[doc.width])
                action_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f9fafb')),
                    ('BOX', (0, 0), (-1, -1), 0.5, MID_GRAY),
                    ('PADDING', (0, 0), (-1, -1), 6),
                ]))
                prob_block.append(action_table)
                prob_block.append(Spacer(1, 0.3 * cm))
                story.append(KeepTogether(prob_block))

        # ------------------------------------------------------------------ #
        # KEY CONTACTS ("WHO TO ASK" BY COMPONENT)
        # ------------------------------------------------------------------ #
        if contacts:
            story.append(Spacer(1, 0.6 * cm))
            story.append(Paragraph("Key Contacts ('Who to Ask' by Component)", heading2_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
            story.append(Spacer(1, 0.3 * cm))

            for comp_entry in contacts:
                comp_block = []
                comp_name = comp_entry.get("component_name") or comp_entry.get("name") or "Component"
                has_owner = comp_entry.get("has_remaining_owner", True)
                warning = comp_entry.get("warning")

                comp_block.append(Paragraph(f"<b>{comp_name}</b>", section_header_style))

                if not has_owner and warning:
                    warn_table = Table([[Paragraph(f"<b>CRITICAL:</b> {warning}", disclaimer_style)]], colWidths=[doc.width])
                    warn_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#fef2f2')),
                        ('BOX', (0, 0), (-1, -1), 1, HexColor('#ef4444')),
                        ('PADDING', (0, 0), (-1, -1), 8),
                    ]))
                    comp_block.append(warn_table)
                    comp_block.append(Spacer(1, 0.2 * cm))

                c_list = comp_entry.get("contacts") or []
                if c_list:
                    contact_rows = [[
                        Paragraph("<b>Contact &amp; Handle</b>", item_meta_style),
                        Paragraph("<b>Role</b>", item_meta_style),
                        Paragraph("<b>Provenance &amp; Source</b>", item_meta_style),
                        Paragraph("<b>Notes</b>", item_meta_style),
                    ]]
                    for c in c_list:
                        contact_rows.append([
                            Paragraph(f"{c.get('name', '')} ({c.get('handle', '')})", item_body_style),
                            Paragraph(c.get("role", ""), item_body_style),
                            Paragraph(f"[{c.get('provenance', 'INFERRED')}] {c.get('source', '')}", item_body_style),
                            Paragraph(c.get("notes", ""), item_body_style),
                        ])
                    c_table = Table(contact_rows, colWidths=[doc.width * 0.28, doc.width * 0.22, doc.width * 0.22, doc.width * 0.28])
                    c_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), LIGHT_GRAY),
                        ('GRID', (0, 0), (-1, -1), 0.5, MID_GRAY),
                        ('PADDING', (0, 0), (-1, -1), 4),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    comp_block.append(c_table)

                comp_block.append(Spacer(1, 0.4 * cm))
                story.append(KeepTogether(comp_block))

        # ------------------------------------------------------------------ #
        # FIRST 5 DAYS ONBOARDING PLAN
        # ------------------------------------------------------------------ #
        first_5_days = (continuation or {}).get("first_5_days") or []
        if first_5_days:
            story.append(Spacer(1, 0.6 * cm))
            story.append(Paragraph("First 5 Days Onboarding Plan", heading2_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
            story.append(Spacer(1, 0.3 * cm))

            plan_rows = [[
                Paragraph("<b>Day</b>", item_meta_style),
                Paragraph("<b>Action Item / Task</b>", item_meta_style),
                Paragraph("<b>Assigned Owner</b>", item_meta_style),
                Paragraph("<b>Status</b>", item_meta_style),
            ]]
            for t in first_5_days:
                plan_rows.append([
                    Paragraph(f"Day {t.get('day', 1)}", item_body_style),
                    Paragraph(t.get("task", ""), item_body_style),
                    Paragraph(t.get("owner", ""), item_body_style),
                    Paragraph(t.get("status", "pending").capitalize(), item_body_style),
                ])
            plan_table = Table(plan_rows, colWidths=[doc.width * 0.12, doc.width * 0.58, doc.width * 0.18, doc.width * 0.12])
            plan_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), LIGHT_GRAY),
                ('GRID', (0, 0), (-1, -1), 0.5, MID_GRAY),
                ('PADDING', (0, 0), (-1, -1), 5),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(KeepTogether([plan_table, Spacer(1, 0.4 * cm)]))

        # ------------------------------------------------------------------ #
        # DISCLAIMER BOX
        # ------------------------------------------------------------------ #
        story.append(Spacer(1, 0.6 * cm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GRAY))
        story.append(Spacer(1, 0.3 * cm))

        disclaimer_data = [[
            Paragraph(
                "<b>Content Provenance Guide</b><br/>"
                "Content marked <b>INFERRED</b> is AI-synthesized from available evidence and may "
                "require independent verification. <b>STATED</b> content comes directly from leaver "
                "interviews and self-reported knowledge. <b>VERIFIED</b> is grounded in multiple "
                "corroborating evidence sources (commits, tickets, documentation).",
                disclaimer_style,
            )
        ]]
        disclaimer_table = Table(disclaimer_data, colWidths=[doc.width])
        disclaimer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#eff6ff')),
            ('BOX', (0, 0), (-1, -1), 1, HexColor('#3b82f6')),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(disclaimer_table)

        # ------------------------------------------------------------------ #
        # Build
        # ------------------------------------------------------------------ #
        doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
        return buf.getvalue()
