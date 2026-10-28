"""
Universal Server-Sided PDF Generator Controller
Provides a unified, branded, publication-grade corporate PDF layout across the entire ERP system.
Pulls live company information directly from SiteSettings (Single Source of Truth).
"""

import os
import io
import base64
from io import BytesIO
from datetime import datetime
from decimal import Decimal

from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph as _ReportLabParagraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import re
import html
from .models import SiteSettings

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_ARABIC_SUPPORT = True
except ImportError:
    HAS_ARABIC_SUPPORT = False

def format_bidi_text(text):
    """
    Reshapes and applies BiDi visual ordering to Arabic script text
    so ReportLab renders Arabic letters connected and right-to-left.
    """
    if not text or not HAS_ARABIC_SUPPORT:
        return text
    if re.search(r'[\u0600-\u06FF]', str(text)):
        try:
            reshaped = arabic_reshaper.reshape(str(text))
            return get_display(reshaped)
        except Exception:
            return text
    return text

class Paragraph(_ReportLabParagraph):
    """
    Robust ReportLab Paragraph subclass that prevents XML/HTML entity parsing exceptions
    (e.g., bare ampersands '&', '<', '>', or malformed tags in client/vendor names)
    and formats Arabic script with contextual shaping and right-to-left ordering.
    """
    def __init__(self, text, style, **kwargs):
        if text is None:
            text = ""
        else:
            text = format_bidi_text(str(text))

        try:
            super().__init__(text, style, **kwargs)
        except Exception:
            try:
                clean_text = (
                    html.escape(text)
                    .replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')
                    .replace('&lt;br/&gt;', '<br/>').replace('&lt;br&gt;', '<br/>')
                    .replace('&lt;i&gt;', '<i>').replace('&lt;/i&gt;', '</i>')
                    .replace('&lt;font', '<font').replace('&lt;/font&gt;', '</font>')
                    .replace('&lt;para', '<para').replace('&lt;/para&gt;', '</para>')
                )
                clean_text = clean_text.replace('&quot;', '"').replace('&apos;', "'")
                clean_text = re.sub(r'<([^>]*?)&gt;', r'<\1>', clean_text)
                super().__init__(clean_text, style, **kwargs)
            except Exception:
                clean_text = html.escape(re.sub(r'<[^>]+>', ' ', text))
                super().__init__(clean_text, style, **kwargs)


def _init_pdf_font():
    font_candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                pdfmetrics.registerFont(TTFont('UnicodeFont', fp))
                return 'UnicodeFont'
            except Exception:
                continue
    return 'Helvetica'

UNICODE_FONT = _init_pdf_font()


MONTH_MAP = {
    'january': 'jan', 'february': 'feb', 'march': 'mar', 'april': 'apr',
    'may': 'may', 'june': 'jun', 'july': 'jul', 'august': 'aug',
    'september': 'sep', 'october': 'oct', 'november': 'nov', 'december': 'dec'
}


def format_dynamic_filename(prefix, *parts, ext='.pdf'):
    """
    Generate clean, lowercase, snake_case dynamic filenames like:
    'salary_slip_mustaq_aug_2026.pdf' or 'bank_statement_al_rajhi_bank_2026_08_01_to_2026_08_31.pdf'.
    Normalizes month names, spaces, dates, and non-alphanumeric characters.
    """
    tokens = [str(prefix)] if prefix else []
    for part in parts:
        if part is None:
            continue
        p_str = str(part).strip()
        if not p_str or p_str.lower() in ('none', 'null', 'undefined', 'all'):
            continue
        tokens.append(p_str)

    raw = "_".join(tokens)
    # Replace non-alphanumeric (except dashes and underscores) with space
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\s]', '', raw)
    # Normalize spaces and hyphens to underscore
    cleaned = re.sub(r'[\s\-]+', '_', cleaned).lower()

    # Replace full month names with 3-letter abbreviations
    for full_m, short_m in MONTH_MAP.items():
        cleaned = re.sub(rf'(^|_){full_m}(_|$)', rf'\g<1>{short_m}\g<2>', cleaned)

    # Collapse repeated underscores
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')

    if ext:
        if not ext.startswith('.'):
            ext = '.' + ext
        if not cleaned.endswith(ext.lower()):
            cleaned += ext.lower()
    return cleaned


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render 'Page X of Y' 
    along with corporate confidentiality notice and generation timestamp.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont(UNICODE_FONT, 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        page_w, page_h = A4
        margin = 12 * mm

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(margin, margin + 6 * mm, page_w - margin, margin + 6 * mm)

        # Left: Confidential notice & company name
        company_name = getattr(self, 'company_name', 'Arab Season')
        self.drawString(
            margin, 
            margin + 2 * mm, 
            f"CONFIDENTIAL • {company_name} • Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )

        # Right: Page X of Y
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - margin, margin + 2 * mm, page_text)

        # Optional crisp outer border around the PDF
        if getattr(self, 'draw_outer_border', False):
            border_margin = getattr(self, 'outer_border_margin', 7 * mm)
            self.setStrokeColor(colors.HexColor("#0f172a"))
            self.setLineWidth(0.85)
            self.roundRect(
                border_margin,
                border_margin,
                page_w - 2 * border_margin,
                page_h - 2 * border_margin,
                radius=3.5 * mm,
                stroke=1,
                fill=0
            )

        self.restoreState()


class TimelineTable(Table):
    """
    Renders an elegant CRM timeline with a continuous vertical connecting line
    between numbered circular step badges.
    """
    def draw(self):
        canv = self.canv
        canv.saveState()

        cx = self._colWidths[0] / 2.0
        total_h = sum(self._rowHeights)

        node_centers = []
        curr_top = total_h
        for h in self._rowHeights:
            cy = curr_top - 9
            node_centers.append(cy)
            curr_top -= h

        if len(node_centers) > 1:
            canv.setStrokeColor(colors.HexColor('#94a3b8'))
            canv.setLineWidth(1.5)
            canv.line(cx, node_centers[0], cx, node_centers[-1])

        for idx, cy in enumerate(node_centers):
            # Outer white circle to mask the connecting line cleanly behind the badge
            canv.setFillColor(colors.HexColor('#ffffff'))
            canv.circle(cx, cy, 7.5, stroke=0, fill=1)

            # Node circle
            node_color = '#1d4ed8' if idx == 0 else '#0284c7'
            canv.setFillColor(colors.HexColor(node_color))
            canv.circle(cx, cy, 6, stroke=0, fill=1)

            # Step number
            canv.setFillColor(colors.HexColor('#ffffff'))
            canv.setFont('Helvetica-Bold', 6.5)
            canv.drawCentredString(cx, cy - 2.2, str(idx + 1))

        super().draw()
        canv.restoreState()


class UniversalPDFGenerator:
    """
    Central controller for all server-generated ERP PDFs.
    Ensures uniform visual hierarchy, typography, colors, and layout standard.
    """

    # Harmonious corporate color palette
    COLOR_PRIMARY = colors.HexColor("#0f172a")       # Slate 900
    COLOR_SECONDARY = colors.HexColor("#1e293b")     # Slate 800
    COLOR_MUTED = colors.HexColor("#64748b")         # Slate 500
    COLOR_BORDER = colors.HexColor("#e2e8f0")        # Slate 200
    COLOR_ROW_ALT = colors.HexColor("#f8fafc")       # Slate 50
    COLOR_ACCENT = colors.HexColor("#2563eb")        # Royal Blue
    COLOR_CREDIT = colors.HexColor("#16a34a")        # Green 600
    COLOR_DEBIT = colors.HexColor("#d97706")         # Amber 600
    COLOR_WHITE = colors.HexColor("#ffffff")

    def __init__(self):
        self.settings = self._get_site_settings()
        self.styles = self._setup_styles()
        self.logo_path = self._resolve_logo_path()

    def _get_site_settings(self):
        """Retrieve live company settings from database with fallback defaults."""
        try:
            s = SiteSettings.objects.first()
            if s:
                return {
                    'company_name': s.company_name or 'Arab Season',
                    'email': s.email or 'ad@arabseason.net',
                    'phone': s.phone or '+965 57 5287 403',
                    'address': s.address or 'Saudi Arabia,Alsalihia Dist',
                    'currency': s.currency or 'SAR',
                    'cr_number': getattr(s, 'cr_number', '') or '',
                    'tax_number': getattr(s, 'tax_number', '') or ''
                }
        except Exception:
            pass
        return {
            'company_name': 'Arab Season',
            'email': 'ad@arabseason.net',
            'phone': '+965 57 5287 403',
            'address': 'Saudi Arabia,Alsalihia Dist',
            'currency': 'SAR',
            'cr_number': '',
            'tax_number': ''
        }

    def _resolve_logo_path(self):
        """Find the high-resolution logo image on server."""
        candidates = [
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo_black.png'),
            os.path.join(settings.BASE_DIR, 'api', 'static', 'logo_black.png'),
            os.path.join(settings.BASE_DIR, 'api', 'static', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo_black.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'src', 'assets', 'logo.png'),
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png'),
        ]
        for p in candidates:
            norm = os.path.abspath(p)
            if os.path.exists(norm):
                return norm
        return None

    def _setup_styles(self):
        """Build standardized ParagraphStyle hierarchy."""
        base = getSampleStyleSheet()
        styles = {}

        styles['CompanyTitle'] = ParagraphStyle(
            'CompanyTitle',
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=self.COLOR_PRIMARY
        )

        styles['CompanyDetails'] = ParagraphStyle(
            'CompanyDetails',
            fontName='Helvetica',
            fontSize=7.8,
            leading=10.5,
            textColor=self.COLOR_MUTED,
            alignment=2 # Right align
        )

        styles['DocTitle'] = ParagraphStyle(
            'DocTitle',
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=self.COLOR_WHITE
        )

        styles['DocSubTitle'] = ParagraphStyle(
            'DocSubTitle',
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#94a3b8"),
            alignment=2
        )

        styles['MetaLabel'] = ParagraphStyle(
            'MetaLabel',
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=self.COLOR_MUTED
        )

        styles['MetaValue'] = ParagraphStyle(
            'MetaValue',
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=self.COLOR_PRIMARY
        )

        styles['KpiLabel'] = ParagraphStyle(
            'KpiLabel',
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=8.5,
            alignment=1, # Center
            textColor=self.COLOR_MUTED
        )

        styles['KpiValue'] = ParagraphStyle(
            'KpiValue',
            fontName='Helvetica-Bold',
            fontSize=10.5,
            leading=13,
            alignment=1, # Center
            textColor=self.COLOR_PRIMARY
        )

        styles['TableHeader'] = ParagraphStyle(
            'TableHeader',
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=self.COLOR_WHITE
        )

        styles['TableHeaderCenter'] = ParagraphStyle(
            'TableHeaderCenter',
            parent=styles['TableHeader'],
            alignment=1
        )

        styles['TableHeaderRight'] = ParagraphStyle(
            'TableHeaderRight',
            parent=styles['TableHeader'],
            alignment=2
        )

        styles['TableCell'] = ParagraphStyle(
            'TableCell',
            fontName='Helvetica',
            fontSize=7.8,
            leading=10,
            textColor=self.COLOR_SECONDARY
        )

        styles['TableCellCenter'] = ParagraphStyle(
            'TableCellCenter',
            parent=styles['TableCell'],
            alignment=1
        )

        styles['TableCellRight'] = ParagraphStyle(
            'TableCellRight',
            parent=styles['TableCell'],
            alignment=2
        )

        styles['TableCellBold'] = ParagraphStyle(
            'TableCellBold',
            fontName='Helvetica-Bold',
            fontSize=7.8,
            leading=10,
            textColor=self.COLOR_PRIMARY
        )

        styles['TableCellCredit'] = ParagraphStyle(
            'TableCellCredit',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=2,
            textColor=self.COLOR_CREDIT
        )

        styles['TableCellDebit'] = ParagraphStyle(
            'TableCellDebit',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=2,
            textColor=self.COLOR_DEBIT
        )

        styles['TableCellNumber'] = ParagraphStyle(
            'TableCellNumber',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=2,
            textColor=self.COLOR_PRIMARY
        )

        return styles

    def _format_currency(self, amount, currency=None):
        """Format monetary amount to standard accounting format."""
        curr = currency or self.settings.get('currency', 'SAR')
        try:
            val = Decimal(str(amount or 0))
            formatted = f"{val:,.2f}"
            return f"{formatted} {curr}"
        except Exception:
            return f"0.00 {curr}"

    def build_header_flowable(self, doc_width, show_contact_details=True):
        """
        Build the standardized top header:
        Left: Company Logo or Legal Name
        Right: Physical Address, Contact Details, CR / VAT (optional if internal)
        """
        self.settings = self._get_site_settings()
        self.logo_path = self._resolve_logo_path()

        left_flowables = []
        if self.logo_path and os.path.exists(self.logo_path):
            try:
                # logo_black.png has ~2.17 aspect ratio
                img = Image(self.logo_path, width=85, height=38)
                left_flowables.append(img)
            except Exception:
                left_flowables.append(Paragraph(self.settings['company_name'].upper(), self.styles['CompanyTitle']))
        else:
            left_flowables.append(Paragraph(self.settings['company_name'].upper(), self.styles['CompanyTitle']))

        # Right side: Contact Details
        if show_contact_details:
            right_text_lines = [
                f"<b>{self.settings['company_name']}</b>",
                self.settings.get('address') or "Saudi Arabia, Alsalihia Dist",
                f"{self.settings['phone']}, email:{self.settings['email']}"
            ]
            if self.settings.get('cr_number'):
                right_text_lines.append(f"Commercial Registration: {self.settings['cr_number']}")
            if self.settings.get('tax_number'):
                right_text_lines.append(f"VAT / TRN: {self.settings['tax_number']}")
            right_flowable = Paragraph("<br/>".join(right_text_lines), self.styles['CompanyDetails'])
        else:
            right_flowable = Paragraph("", self.styles['CompanyDetails'])

        header_table = Table(
            [[left_flowables, right_flowable]],
            colWidths=[doc_width * 0.40, doc_width * 0.60]
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))

        divider = HRFlowable(
            width="100%", 
            thickness=1.5, 
            color=self.COLOR_PRIMARY, 
            spaceBefore=4, 
            spaceAfter=8
        )

        return [header_table, divider]

    def build_doc_title_banner(self, doc_width, title, ref_number=None, period_text=None):
        """
        Build the standardized dark document title banner with document name and period.
        """
        left_content = Paragraph(f"<b>{title.upper()}</b>", self.styles['DocTitle'])
        
        right_lines = []
        if ref_number:
            right_lines.append(f"REF: {ref_number}")
        if period_text:
            right_lines.append(f"Period: {period_text}")
        right_lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y')}")

        right_content = Paragraph("<br/>".join(right_lines), self.styles['DocSubTitle'])

        banner_table = Table(
            [[left_content, right_content]],
            colWidths=[doc_width * 0.55, doc_width * 0.45]
        )
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))

        return banner_table

    def build_kpi_cards_flowable(self, doc_width, kpis):
        """
        Render a 5-card financial KPI summary block.
        kpis: list of dicts [{'label': 'Opening Balance', 'value': '10,000 SAR', 'color': '#0f172a'}, ...]
        """
        num_cards = len(kpis)
        card_w = doc_width / num_cards

        row_content = []
        for item in kpis:
            val_style = ParagraphStyle(
                f'KpiVal_{item.get("label")}',
                parent=self.styles['KpiValue'],
                textColor=item.get('color', self.COLOR_PRIMARY)
            )
            card_cells = [
                Paragraph(item.get('label', '').upper(), self.styles['KpiLabel']),
                Spacer(1, 1.5 * mm),
                Paragraph(item.get('value', '0.00'), val_style)
            ]
            row_content.append(card_cells)

        kpi_table = Table([row_content], colWidths=[card_w] * num_cards)
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        return kpi_table

    def build_signatures_flowable(self, doc_width, labels=None):
        """
        Standardized 3-column verification and signature block.
        """
        if not labels:
            labels = [
                'Prepared By (Accountant)', 
                'Verified By (Finance Director)', 
                'Official Corporate Seal'
            ]
        col_w = doc_width / len(labels)
        
        sig_cells = []
        for label in labels:
            sig_cells.append([
                Spacer(1, 14 * mm),
                HRFlowable(width="80%", thickness=0.8, color=self.COLOR_MUTED, spaceBefore=0, spaceAfter=3),
                Paragraph(f"<b>{label}</b>", ParagraphStyle('SigLbl', parent=self.styles['MetaLabel'], alignment=1))
            ])

        sig_table = Table([sig_cells], colWidths=[col_w] * len(labels))
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        return KeepTogether([sig_table])

    # =========================================================================
    # DOCUMENT BUILDER: BANK ACCOUNT STATEMENT
    # =========================================================================
    def generate_bank_statement_pdf(self, bank, summary, transactions, filters=None):
        """
        Generates a publication-grade server-side Bank Statement PDF.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        bank_name = getattr(bank, 'bank_name', str(bank))
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        doc_title = format_dynamic_filename('bank_statement', bank_name, s_date, 'to' if s_date and e_date else None, e_date, ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        period_str = "All Historical Time"
        if filters:
            s_date = filters.get('start_date')
            e_date = filters.get('end_date')
            if s_date and e_date:
                period_str = f"{s_date} to {e_date}"
            elif s_date:
                period_str = f"From {s_date} onward"
            elif e_date:
                period_str = f"Up to {e_date}"

        banner = self.build_doc_title_banner(
            doc_width,
            title="OFFICIAL BANK ACCOUNT STATEMENT",
            ref_number=f"STMT-B{bank.id}-{datetime.now().strftime('%Y%m%d')}",
            period_text=period_str
        )
        elements.append(banner)
        elements.append(Spacer(1, 3.5 * mm))

        # 3. Bank & Metadata Information Box (2 Columns)
        left_meta = [
            Paragraph("<b>BANKING INSTITUTION & ACCOUNT</b>", self.styles['MetaLabel']),
            Spacer(1, 1 * mm),
            Paragraph(f"<b>Bank Name:</b> {bank.bank_name}", self.styles['MetaValue']),
            Paragraph(f"<b>Account Number:</b> {bank.account_number}", self.styles['MetaValue']),
            Paragraph(f"<b>IBAN:</b> {bank.iban or 'N/A'}", self.styles['MetaValue']),
            Paragraph(f"<b>Branch:</b> {bank.branch_name or 'Head Office'}", self.styles['MetaValue']),
        ]

        right_meta = [
            Paragraph("<b>STATEMENT PARAMETERS</b>", self.styles['MetaLabel']),
            Spacer(1, 1 * mm),
            Paragraph(f"<b>Account Holder:</b> {bank.account_holder_name or self.settings['company_name']}", self.styles['MetaValue']),
            Paragraph(f"<b>Currency:</b> {bank.currency or 'SAR'} (Saudi Riyal)", self.styles['MetaValue']),
            Paragraph(f"<b>Account Status:</b> {bank.status}", self.styles['MetaValue']),
            Paragraph(f"<b>Statement Period:</b> {period_str}", self.styles['MetaValue']),
        ]

        info_table = Table([[left_meta, right_meta]], colWidths=[doc_width * 0.50, doc_width * 0.50])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 3.5 * mm))

        # 4. Financial KPI Cards (Opening, Credits, Debits, Net, Closing)
        net_val = Decimal(str(summary.get('net_change', 0)))
        kpis = [
            {
                'label': 'Opening Balance',
                'value': self._format_currency(summary.get('opening_balance', 0), bank.currency),
                'color': self.COLOR_SECONDARY
            },
            {
                'label': 'Total Credits (+)',
                'value': f"+{self._format_currency(summary.get('total_credits', 0), bank.currency)}",
                'color': self.COLOR_CREDIT
            },
            {
                'label': 'Total Debits (-)',
                'value': f"-{self._format_currency(summary.get('total_debits', 0), bank.currency)}",
                'color': self.COLOR_DEBIT
            },
            {
                'label': 'Net Movement',
                'value': f"{'+' if net_val >= 0 else ''}{self._format_currency(net_val, bank.currency)}",
                'color': self.COLOR_CREDIT if net_val >= 0 else self.COLOR_DEBIT
            },
            {
                'label': 'Closing Balance',
                'value': self._format_currency(summary.get('closing_balance', 0), bank.currency),
                'color': colors.HexColor("#065f46")
            }
        ]
        elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
        elements.append(Spacer(1, 4 * mm))

        # 5. Tabular Statement Ledger
        # Columns: Date (45), Ref # (52), Description (145), Party (80), Category (60), Credit (65), Debit (65), Balance (70)
        col_w = [
            doc_width * 0.10,  # Date
            doc_width * 0.11,  # Ref
            doc_width * 0.28,  # Description
            doc_width * 0.15,  # Party
            doc_width * 0.10,  # Category
            doc_width * 0.13,  # Credit
            doc_width * 0.13,  # Debit
        ]
        # Adjust total width to 100%
        # Date: 10%, Ref: 11%, Desc: 27%, Party: 14%, Credit: 12%, Debit: 12%, Balance: 14%
        col_widths = [
            doc_width * 0.09,
            doc_width * 0.11,
            doc_width * 0.28,
            doc_width * 0.14,
            doc_width * 0.12,
            doc_width * 0.12,
            doc_width * 0.14
        ]

        table_data = []

        # Table Header Row
        header_row = [
            Paragraph("<b>DATE</b>", self.styles['TableHeader']),
            Paragraph("<b>REF #</b>", self.styles['TableHeader']),
            Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
            Paragraph("<b>COUNTERPARTY</b>", self.styles['TableHeader']),
            Paragraph("<para align='right'><b>CREDIT (+)</b></para>", self.styles['TableHeader']),
            Paragraph("<para align='right'><b>DEBIT (-)</b></para>", self.styles['TableHeader']),
            Paragraph("<para align='right'><b>BALANCE</b></para>", self.styles['TableHeader']),
        ]
        table_data.append(header_row)

        # Opening Balance Row
        op_date = filters.get('start_date') if filters and filters.get('start_date') else 'INCEPTION'
        op_row = [
            Paragraph(f"<b>{op_date}</b>", self.styles['TableCellBold']),
            Paragraph("--", self.styles['TableCell']),
            Paragraph("<b>PERIOD OPENING BALANCE BROUGHT FORWARD</b>", self.styles['TableCellBold']),
            Paragraph("--", self.styles['TableCell']),
            Paragraph("--", self.styles['TableCellNumber']),
            Paragraph("--", self.styles['TableCellNumber']),
            Paragraph(self._format_currency(summary.get('opening_balance', 0), bank.currency), self.styles['TableCellNumber']),
        ]
        table_data.append(op_row)

        # Transaction Rows
        for tx in transactions:
            credit_amt = tx.get('credit', 0)
            debit_amt = tx.get('debit', 0)
            run_bal = tx.get('running_balance', 0)

            credit_cell = Paragraph(f"+{Decimal(str(credit_amt)):,.2f}", self.styles['TableCellCredit']) if credit_amt > 0 else Paragraph("-", self.styles['TableCell'])
            debit_cell = Paragraph(f"-{Decimal(str(debit_amt)):,.2f}", self.styles['TableCellDebit']) if debit_amt > 0 else Paragraph("-", self.styles['TableCell'])
            bal_cell = Paragraph(f"{Decimal(str(run_bal)):,.2f}", self.styles['TableCellNumber'])

            desc_text = f"<b>{tx.get('remark') or 'Bank Transfer'}</b>"
            if tx.get('cashbook_name'):
                desc_text += f"<br/><font size='6.5' color='#64748b'>Book: {tx.get('cashbook_name')} | {tx.get('payment_mode') or 'Bank Transfer'}</font>"

            tx_row = [
                Paragraph(str(tx.get('date', '')), self.styles['TableCell']),
                Paragraph(str(tx.get('reference_number', '')), self.styles['TableCell']),
                Paragraph(desc_text, self.styles['TableCell']),
                Paragraph(str(tx.get('party_name') or 'Direct Transaction'), self.styles['TableCell']),
                credit_cell,
                debit_cell,
                bal_cell
            ]
            table_data.append(tx_row)

        # Closing Summary Row
        cls_row = [
            Paragraph("<b>TOTALS</b>", self.styles['TableCellBold']),
            Paragraph("--", self.styles['TableCell']),
            Paragraph("<b>PERIOD CLOSING SUMMARY & FINAL BALANCE:</b>", self.styles['TableCellBold']),
            Paragraph("--", self.styles['TableCell']),
            Paragraph(f"+{Decimal(str(summary.get('total_credits', 0))):,.2f}", self.styles['TableCellCredit']),
            Paragraph(f"-{Decimal(str(summary.get('total_debits', 0))):,.2f}", self.styles['TableCellDebit']),
            Paragraph(self._format_currency(summary.get('closing_balance', 0), bank.currency), self.styles['TableCellNumber']),
        ]
        table_data.append(cls_row)

        ledger_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        table_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
            ('TOPPADDING', (0, 0), (-1, -1), 4.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, 0), 1.5, self.COLOR_PRIMARY),
            ('BACKGROUND', (0, 1), (-1, 1), self.COLOR_ROW_ALT), # Opening row background
            ('LINEBELOW', (0, 1), (-1, 1), 1, self.COLOR_BORDER),
            ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT), # Closing row background
            ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.COLOR_PRIMARY),
        ]

        # Alternating row colors for transactions
        for i in range(2, len(table_data) - 1):
            bg = self.COLOR_WHITE if i % 2 == 0 else self.COLOR_ROW_ALT
            table_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            table_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))

        ledger_table.setStyle(TableStyle(table_styles))
        elements.append(ledger_table)
        elements.append(Spacer(1, 6 * mm))

        # 6. Verification & Signatures
        elements.append(self.build_signatures_flowable(doc_width))

        # Build document with custom canvas
        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: SALARY PAYMENT VOUCHER
    # =========================================================================
    def generate_salary_voucher_pdf(self, salary, timesheets=None):
        """
        Generates an official, uniform corporate Payroll Disbursement Voucher PDF.
        Includes salary breakdown, monthly attendance summary, and timesheet log.
        salary: SalaryPayment model instance or dictionary.
        timesheets: Optional list of StaffTimesheet instances or dictionaries.
        """
        buffer = io.BytesIO()
        margin = 14 * mm
        staff_name = getattr(salary, 'staff_name', '') if hasattr(salary, 'staff_name') else (salary.get('staff_name', '') if isinstance(salary, dict) else '')
        month = getattr(salary, 'paid_month', '') or getattr(salary, 'payment_date', '') if hasattr(salary, 'paid_month') else (salary.get('paid_month', '') or salary.get('payment_date', '') if isinstance(salary, dict) else '')
        doc_title = format_dynamic_filename('salary_slip', staff_name, month, ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        # Auto-query timesheets if not provided
        if timesheets is None:
            try:
                from .models import StaffTimesheet
                from django.db.models import Q
                dt = None
                p_month = getattr(salary, 'paid_month', '') or (salary.get('paid_month', '') if isinstance(salary, dict) else '')
                if p_month:
                    try:
                        dt = datetime.strptime(str(p_month).strip(), '%B %Y')
                    except Exception:
                        pass
                if not dt:
                    p_date = getattr(salary, 'payment_date', None) or (salary.get('payment_date') if isinstance(salary, dict) else None)
                    if isinstance(p_date, str):
                        try:
                            dt = datetime.strptime(p_date[:10], '%Y-%m-%d')
                        except Exception:
                            pass
                    elif p_date:
                        dt = p_date

                if dt and staff_name:
                    timesheets = list(StaffTimesheet.objects.filter(
                        date__year=dt.year,
                        date__month=dt.month
                    ).filter(
                        Q(staff_name__iexact=staff_name) | Q(staff_name__icontains=staff_name)
                    ).order_by('date', 'id'))
                else:
                    timesheets = []
            except Exception:
                timesheets = []

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        sal_id = getattr(salary, 'id', 1)
        banner = self.build_doc_title_banner(
            doc_width,
            title="PAYROLL DISBURSEMENT VOUCHER",
            ref_number=f"VCH-SAL-{sal_id:05d}",
            period_text=f"Month: {getattr(salary, 'paid_month', '') or 'Current'}"
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. Employee & Payment Information Box (2 Columns)
        staff_name = getattr(salary, 'staff_name', '')
        paid_month = getattr(salary, 'paid_month', '')
        pay_date = str(getattr(salary, 'payment_date', ''))
        pay_mode = getattr(salary, 'payment_mode', 'Cash') or 'Cash'
        desc = getattr(salary, 'description', '') or 'Regular Monthly Salary Disbursement'

        left_info = [
            Paragraph("<b>EMPLOYEE DETAILS</b>", self.styles['MetaLabel']),
            Spacer(1, 1 * mm),
            Paragraph(f"<b>Employee Name:</b> {staff_name}", self.styles['MetaValue']),
            Paragraph(f"<b>Pay Month / Period:</b> {paid_month}", self.styles['MetaValue']),
            Paragraph(f"<b>Payment Date:</b> {pay_date}", self.styles['MetaValue']),
        ]

        right_info = [
            Paragraph("<b>DISBURSEMENT PARAMETERS</b>", self.styles['MetaLabel']),
            Spacer(1, 1 * mm),
            Paragraph(f"<b>Payment Mode:</b> {pay_mode}", self.styles['MetaValue']),
            Paragraph(f"<b>Currency:</b> {self.settings['currency']}", self.styles['MetaValue']),
            Paragraph(f"<b>Remarks:</b> {desc}", self.styles['MetaValue']),
        ]

        info_table = Table([[left_info, right_info]], colWidths=[doc_width * 0.50, doc_width * 0.50])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Earnings & Deductions Breakdown Table
        base_sal = Decimal(str(getattr(salary, 'base_salary', 0) or getattr(salary, 'amount', 0) or 0))
        ot_hrs = getattr(salary, 'overtime_hours', 0) or 0
        ot_amt = Decimal(str(getattr(salary, 'overtime_amount', 0) or 0))
        tot_sal = Decimal(str(getattr(salary, 'total_salary', 0) or (base_sal + ot_amt) or 0))
        net_paid = Decimal(str(getattr(salary, 'amount', 0) or tot_sal or 0))
        deductions = tot_sal - net_paid if tot_sal > net_paid else Decimal('0.00')

        items_table_data = [
            [
                Paragraph("<b>DESCRIPTION / EARNING COMPONENT</b>", self.styles['TableHeader']),
                Paragraph("<b>RATE / DETAILS</b>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>AMOUNT (SAR)</b></para>", self.styles['TableHeader'])
            ],
            [
                Paragraph("Base Monthly Salary", self.styles['TableCellBold']),
                Paragraph("Standard Monthly Allocation", self.styles['TableCell']),
                Paragraph(f"{base_sal:,.2f}", self.styles['TableCellNumber'])
            ]
        ]

        if ot_amt > 0 or float(ot_hrs) > 0:
            items_table_data.append([
                Paragraph("Overtime Work Compensation", self.styles['TableCellBold']),
                Paragraph(f"{ot_hrs} Hours Recorded", self.styles['TableCell']),
                Paragraph(f"+{ot_amt:,.2f}", self.styles['TableCellCredit'])
            ])

        items_table_data.append([
            Paragraph("<b>Total Gross Earnings</b>", self.styles['TableCellBold']),
            Paragraph("Base Salary + Overtime", self.styles['TableCell']),
            Paragraph(f"<b>{tot_sal:,.2f}</b>", self.styles['TableCellNumber'])
        ])

        if deductions > 0:
            items_table_data.append([
                Paragraph("Deductions / Advances Adjustment", self.styles['TableCellBold']),
                Paragraph("Advances / Statutory Adjustment", self.styles['TableCell']),
                Paragraph(f"-{deductions:,.2f}", self.styles['TableCellDebit'])
            ])

        # Net Disbursed Highlight Row
        items_table_data.append([
            Paragraph("<b>NET DISBURSED SALARY</b>", ParagraphStyle('NetLbl', parent=self.styles['DocTitle'], textColor=self.COLOR_WHITE, fontSize=9)),
            Paragraph("<b>Fully Settled</b>", ParagraphStyle('NetSub', parent=self.styles['DocTitle'], textColor=self.COLOR_WHITE, fontSize=8)),
            Paragraph(f"<b>{net_paid:,.2f} {self.settings['currency']}</b>", ParagraphStyle('NetAmt', parent=self.styles['DocTitle'], alignment=2, textColor=self.COLOR_WHITE, fontSize=10))
        ])

        col_w = [doc_width * 0.45, doc_width * 0.30, doc_width * 0.25]
        breakdown_table = Table(items_table_data, colWidths=col_w)
        breakdown_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -2), 1, self.COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -2), 0.5, self.COLOR_BORDER),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#065f46")), # Emerald highlight for Net
            ('TOPPADDING', (0, -1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 7),
        ]
        breakdown_table.setStyle(TableStyle(breakdown_styles))
        elements.append(breakdown_table)
        elements.append(Spacer(1, 4 * mm))

        # 5. Timesheet Attendance & Audit Log Section
        ts_title = Paragraph(
            f"<b>STAFF ATTENDANCE & TIMESHEET LOG • {paid_month.upper() or 'PERIOD'}</b>",
            ParagraphStyle('TsHeading', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=self.COLOR_PRIMARY)
        )
        elements.append(ts_title)
        elements.append(Spacer(1, 2 * mm))

        if timesheets and len(timesheets) > 0:
            tot_entries = len(timesheets)
            tot_ot = sum(float(getattr(t, 'overtime_hours', 0) or (t.get('overtime_hours') if isinstance(t, dict) else 0) or 0) for t in timesheets)
            off_days = sum(1 for t in timesheets if getattr(t, 'is_off_day', False) or (t.get('is_off_day') if isinstance(t, dict) else False))
            regular_days = tot_entries - off_days

            ts_kpis = [
                {'label': 'Logged Days', 'value': str(tot_entries), 'color': self.COLOR_PRIMARY},
                {'label': 'Work Days', 'value': str(regular_days), 'color': self.COLOR_CREDIT},
                {'label': 'Off / Rest Days', 'value': str(off_days), 'color': self.COLOR_MUTED},
                {'label': 'Overtime Hours', 'value': f"{tot_ot:.1f} Hrs", 'color': self.COLOR_ACCENT},
            ]
            elements.append(self.build_kpi_cards_flowable(doc_width, ts_kpis))
            elements.append(Spacer(1, 3 * mm))

            ts_table_data = [
                [
                    Paragraph("<b>DATE</b>", self.styles['TableHeader']),
                    Paragraph("<b>DAY</b>", self.styles['TableHeader']),
                    Paragraph("<b>IN TIME</b>", self.styles['TableHeader']),
                    Paragraph("<b>OUT TIME</b>", self.styles['TableHeader']),
                    Paragraph("<b>SHIFT / STATUS</b>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>OT (HRS)</b></para>", self.styles['TableHeader']),
                    Paragraph("<b>WORK DETAILS / REMARKS</b>", self.styles['TableHeader'])
                ]
            ]

            cell_style = ParagraphStyle('TsCell', fontName='Helvetica', fontSize=7.2, leading=9, textColor=self.COLOR_SECONDARY)
            cell_bold = ParagraphStyle('TsCellB', fontName='Helvetica-Bold', fontSize=7.2, leading=9, textColor=self.COLOR_PRIMARY)
            cell_credit = ParagraphStyle('TsCellC', fontName='Helvetica-Bold', fontSize=7.2, leading=9, alignment=2, textColor=self.COLOR_CREDIT)
            cell_num = ParagraphStyle('TsCellN', fontName='Helvetica', fontSize=7.2, leading=9, alignment=2, textColor=self.COLOR_MUTED)

            for t in timesheets:
                t_date = getattr(t, 'date', None) or (t.get('date') if isinstance(t, dict) else None)
                if isinstance(t_date, str):
                    try:
                        d_obj = datetime.strptime(t_date[:10], '%Y-%m-%d')
                        d_str = d_obj.strftime('%d/%m/%Y')
                        day_str = d_obj.strftime('%a')
                    except Exception:
                        d_str = t_date
                        day_str = ''
                elif t_date:
                    d_str = t_date.strftime('%d/%m/%Y')
                    day_str = t_date.strftime('%a')
                else:
                    d_str = '--'
                    day_str = ''

                tin = str(getattr(t, 'in_time', '') or (t.get('in_time') if isinstance(t, dict) else '') or '--')
                tout = str(getattr(t, 'out_time', '') or (t.get('out_time') if isinstance(t, dict) else '') or '--')
                is_off = getattr(t, 'is_off_day', False) or (t.get('is_off_day') if isinstance(t, dict) else False)
                ot_h = float(getattr(t, 'overtime_hours', 0) or (t.get('overtime_hours') if isinstance(t, dict) else 0) or 0)
                ot_txt = getattr(t, 'overtime_text', '') or (t.get('overtime_text') if isinstance(t, dict) else '')
                details = getattr(t, 'ot_details', '') or (t.get('ot_details') if isinstance(t, dict) else '')

                status_desc = "Off Day" if is_off else (ot_txt or "Standard Shift")
                status_color = "#94a3b8" if is_off else "#1e293b"

                ts_table_data.append([
                    Paragraph(d_str, cell_bold),
                    Paragraph(day_str, cell_style),
                    Paragraph(tin, cell_style),
                    Paragraph(tout, cell_style),
                    Paragraph(f"<font color='{status_color}'>{status_desc}</font>", cell_style),
                    Paragraph(f"<b>{ot_h:.1f}</b>" if ot_h > 0 else "0.0", cell_credit if ot_h > 0 else cell_num),
                    Paragraph(details or "--", cell_style)
                ])

            # Total Summary Footer Row
            ts_table_data.append([
                Paragraph("<b>TOTALS</b>", cell_bold),
                Paragraph(f"<b>{tot_entries} Days</b>", cell_bold),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph(f"<b>{regular_days} Work / {off_days} Off</b>", cell_bold),
                Paragraph(f"<b>{tot_ot:.1f} Hrs</b>", cell_credit if tot_ot > 0 else cell_num),
                Paragraph("", cell_style)
            ])

            ts_col_w = [
                doc_width * 0.15,
                doc_width * 0.08,
                doc_width * 0.13,
                doc_width * 0.13,
                doc_width * 0.16,
                doc_width * 0.11,
                doc_width * 0.24
            ]
            ts_table = Table(ts_table_data, colWidths=ts_col_w, repeatRows=1)
            ts_style = [
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
                ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT),
            ]
            for row_idx in range(1, len(ts_table_data) - 1):
                if row_idx % 2 == 0:
                    ts_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), self.COLOR_ROW_ALT))
            ts_table.setStyle(TableStyle(ts_style))
            elements.append(ts_table)
        else:
            no_ts_notice = Table(
                [[Paragraph("<i>No timesheet or attendance records logged for this employee in the selected pay period.</i>", self.styles['MetaLabel'])]],
                colWidths=[doc_width]
            )
            no_ts_notice.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
                ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER')
            ]))
            elements.append(no_ts_notice)

        elements.append(Spacer(1, 6 * mm))

        # 6. Signatures Block
        sig_labels = [
            'Employee Signature (Received By)', 
            'Prepared By (Accountant)', 
            'Authorized Signature & Stamp'
        ]
        elements.append(KeepTogether(self.build_signatures_flowable(doc_width, sig_labels)))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: FINANCIAL & OPERATIONAL REPORTS
    # =========================================================================
    def generate_financial_report_pdf(self, report_type, data, filters=None):
        """
        Generates uniform corporate Financial Report PDFs for:
        overview, customers, vendors, jobs, and expenses.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        doc_title = format_dynamic_filename('financial_report', report_type, s_date, 'to' if s_date and e_date else None, e_date, ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # Determine report metadata
        titles = {
            'overview': 'CORPORATE PERFORMANCE OVERVIEW',
            'customers': 'CUSTOMER ACCOUNT STATEMENT & RECEIVABLES',
            'vendors': 'VENDOR LEDGER STATEMENT & PAYABLES',
            'jobs': 'MASTER PROJECT LIST & PERFORMANCE RECORD',
            'expenses': 'CORPORATE EXPENSE & FINANCIAL STATEMENT'
        }
        title = titles.get(report_type, 'FINANCIAL AUDIT REPORT')

        period_str = "Last 12 Months"
        if filters:
            s_date = filters.get('start_date')
            e_date = filters.get('end_date')
            if s_date and e_date:
                period_str = f"{s_date} to {e_date}"

        banner = self.build_doc_title_banner(
            doc_width,
            title=title,
            ref_number=f"REP-{report_type[:3].upper()}-{datetime.now().strftime('%Y%m%d')}",
            period_text=period_str
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # Render content based on report_type
        if report_type == 'overview':
            # Monthly income & expense trends
            monthly_inc = data.get('monthly_income', [])
            monthly_exp = data.get('monthly_expenses', [])
            total_rev = sum(m.get('total', 0) for m in monthly_inc)
            total_exp = sum(e.get('total', 0) for e in monthly_exp)
            net_prof = total_rev - total_exp
            margin_pct = (net_prof / total_rev * 100) if total_rev > 0 else 0

            kpis = [
                {'label': 'Total Revenue', 'value': self._format_currency(total_rev), 'color': self.COLOR_CREDIT},
                {'label': 'Total Expenses', 'value': self._format_currency(total_exp), 'color': self.COLOR_DEBIT},
                {'label': 'Net Profit', 'value': self._format_currency(net_prof), 'color': self.COLOR_CREDIT if net_prof >= 0 else self.COLOR_DEBIT},
                {'label': 'Profit Margin', 'value': f"{margin_pct:.1f}%", 'color': self.COLOR_ACCENT}
            ]
            elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
            elements.append(Spacer(1, 5 * mm))

            # Monthly Breakdown Table
            # Merge months
            months = sorted(list(set([m['month'] for m in monthly_inc] + [e['month'] for e in monthly_exp])))
            inc_map = {m['month']: m['total'] for m in monthly_inc}
            exp_map = {e['month']: e['total'] for e in monthly_exp}

            table_rows = [
                [
                    Paragraph("<b>MONTH</b>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>REVENUE (SAR)</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>EXPENSE (SAR)</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>NET PROFIT (SAR)</b></para>", self.styles['TableHeader'])
                ]
            ]
            for mo in months:
                r = inc_map.get(mo, 0)
                e = exp_map.get(mo, 0)
                p = r - e
                table_rows.append([
                    Paragraph(str(mo), self.styles['TableCell']),
                    Paragraph(f"{r:,.2f}", self.styles['TableCellCredit']),
                    Paragraph(f"{e:,.2f}", self.styles['TableCellDebit']),
                    Paragraph(f"{p:,.2f}", self.styles['TableCellNumber'])
                ])

            table_rows.append([
                Paragraph("<b>TOTALS</b>", self.styles['TableCellBold']),
                Paragraph(f"<b>+{total_rev:,.2f}</b>", self.styles['TableCellCredit']),
                Paragraph(f"<b>-{total_exp:,.2f}</b>", self.styles['TableCellDebit']),
                Paragraph(f"<b>{net_prof:,.2f}</b>", self.styles['TableCellNumber'])
            ])

            col_w = [doc_width * 0.25, doc_width * 0.25, doc_width * 0.25, doc_width * 0.25]
            overview_table = Table(table_rows, colWidths=col_w, repeatRows=1)
            t_styles = [
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 4.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT),
                ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.COLOR_PRIMARY),
            ]
            for i in range(1, len(table_rows) - 1):
                bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
                t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
                t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
            overview_table.setStyle(TableStyle(t_styles))
            elements.append(overview_table)

        elif report_type == 'customers':
            customers = data.get('customers', [])
            total_rev = sum(c.get('total_revenue', 0) or c.get('rev_sum', 0) for c in customers)
            total_bal = sum(c.get('balance', 0) for c in customers)

            kpis = [
                {'label': 'Registered Customers', 'value': str(len(customers)), 'color': self.COLOR_PRIMARY},
                {'label': 'Total Client Revenue', 'value': self._format_currency(total_rev), 'color': self.COLOR_CREDIT},
                {'label': 'Outstanding Receivables', 'value': self._format_currency(total_bal), 'color': self.COLOR_DEBIT}
            ]
            elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
            elements.append(Spacer(1, 5 * mm))

            table_rows = [
                [
                    Paragraph("<b>ID</b>", self.styles['TableHeader']),
                    Paragraph("<b>CUSTOMER NAME</b>", self.styles['TableHeader']),
                    Paragraph("<b>PHONE / EMAIL</b>", self.styles['TableHeader']),
                    Paragraph("<para align='center'><b>JOBS</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>TOTAL REVENUE</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>BALANCE (SAR)</b></para>", self.styles['TableHeader'])
                ]
            ]
            for c in customers:
                rev = c.get('total_revenue', 0) or c.get('rev_sum', 0) or 0
                bal = c.get('balance', 0) or 0
                contact = f"{c.get('phone') or ''}<br/><font size='6.5' color='#64748b'>{c.get('email') or ''}</font>"
                table_rows.append([
                    Paragraph(f"#C{c.get('id')}", self.styles['TableCell']),
                    Paragraph(f"<b>{c.get('name')}</b>", self.styles['TableCellBold']),
                    Paragraph(contact, self.styles['TableCell']),
                    Paragraph(str(c.get('total_jobs', 0)), ParagraphStyle('Cnt', parent=self.styles['TableCell'], alignment=1)),
                    Paragraph(f"{Decimal(str(rev)):,.2f}", self.styles['TableCellCredit']),
                    Paragraph(f"{Decimal(str(bal)):,.2f}", self.styles['TableCellDebit'] if bal > 0 else self.styles['TableCellNumber'])
                ])

            table_rows.append([
                Paragraph("<b>TOTALS</b>", self.styles['TableCellBold']),
                Paragraph(f"<b>{len(customers)} Customers</b>", self.styles['TableCellBold']),
                Paragraph("--", self.styles['TableCell']),
                Paragraph("--", self.styles['TableCell']),
                Paragraph(f"<b>{Decimal(str(total_rev)):,.2f}</b>", self.styles['TableCellCredit']),
                Paragraph(f"<b>{Decimal(str(total_bal)):,.2f}</b>", self.styles['TableCellDebit'])
            ])

            col_w = [doc_width * 0.08, doc_width * 0.28, doc_width * 0.24, doc_width * 0.08, doc_width * 0.16, doc_width * 0.16]
            cust_table = Table(table_rows, colWidths=col_w, repeatRows=1)
            t_styles = [
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT),
                ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.COLOR_PRIMARY),
            ]
            for i in range(1, len(table_rows) - 1):
                bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
                t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
                t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
            cust_table.setStyle(TableStyle(t_styles))
            elements.append(cust_table)

        elif report_type == 'vendors':
            vendors = data.get('vendors', [])
            total_purch = sum(v.get('purch_sum', 0) or 0 for v in vendors)
            total_paid = sum(v.get('total_paid', 0) or v.get('paid_sum', 0) or 0 for v in vendors)
            total_bal = sum(v.get('balance', 0) or 0 for v in vendors)

            kpis = [
                {'label': 'Total Vendors', 'value': str(len(vendors)), 'color': self.COLOR_PRIMARY},
                {'label': 'Total Purchases', 'value': self._format_currency(total_purch), 'color': self.COLOR_DEBIT},
                {'label': 'Total Paid Out', 'value': self._format_currency(total_paid), 'color': self.COLOR_CREDIT},
                {'label': 'Outstanding Payables', 'value': self._format_currency(total_bal), 'color': self.COLOR_DEBIT}
            ]
            elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
            elements.append(Spacer(1, 5 * mm))

            table_rows = [
                [
                    Paragraph("<b>ID</b>", self.styles['TableHeader']),
                    Paragraph("<b>VENDOR NAME</b>", self.styles['TableHeader']),
                    Paragraph("<b>GROUP / CONTACT</b>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>PURCHASES</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>TOTAL PAID</b></para>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>PAYABLE BAL</b></para>", self.styles['TableHeader'])
                ]
            ]
            for v in vendors:
                p_sum = v.get('purch_sum', 0) or 0
                paid_sum = v.get('total_paid', 0) or v.get('paid_sum', 0) or 0
                bal = v.get('balance', 0) or 0
                contact = f"{v.get('business_group') or 'General'}<br/><font size='6.5' color='#64748b'>{v.get('phone') or v.get('email') or ''}</font>"
                table_rows.append([
                    Paragraph(f"#V{v.get('id')}", self.styles['TableCell']),
                    Paragraph(f"<b>{v.get('name')}</b>", self.styles['TableCellBold']),
                    Paragraph(contact, self.styles['TableCell']),
                    Paragraph(f"{Decimal(str(p_sum)):,.2f}", self.styles['TableCellDebit']),
                    Paragraph(f"{Decimal(str(paid_sum)):,.2f}", self.styles['TableCellCredit']),
                    Paragraph(f"{Decimal(str(bal)):,.2f}", self.styles['TableCellNumber'])
                ])

            table_rows.append([
                Paragraph("<b>TOTALS</b>", self.styles['TableCellBold']),
                Paragraph(f"<b>{len(vendors)} Vendors</b>", self.styles['TableCellBold']),
                Paragraph("--", self.styles['TableCell']),
                Paragraph(f"<b>{Decimal(str(total_purch)):,.2f}</b>", self.styles['TableCellDebit']),
                Paragraph(f"<b>{Decimal(str(total_paid)):,.2f}</b>", self.styles['TableCellCredit']),
                Paragraph(f"<b>{Decimal(str(total_bal)):,.2f}</b>", self.styles['TableCellNumber'])
            ])

            col_w = [doc_width * 0.08, doc_width * 0.28, doc_width * 0.24, doc_width * 0.14, doc_width * 0.13, doc_width * 0.13]
            vend_table = Table(table_rows, colWidths=col_w, repeatRows=1)
            t_styles = [
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT),
                ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.COLOR_PRIMARY),
            ]
            for i in range(1, len(table_rows) - 1):
                bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
                t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
                t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
            vend_table.setStyle(TableStyle(t_styles))
            elements.append(vend_table)

        elif report_type == 'jobs':
            job_pl = data.get('job_pl')
            if job_pl:
                # Specific project P&L record
                prof = job_pl.get('profit', 0)
                kpis = [
                    {'label': 'Contract Total', 'value': self._format_currency(job_pl.get('contract_total', 0)), 'color': self.COLOR_PRIMARY},
                    {'label': 'Revenue Collected', 'value': self._format_currency(job_pl.get('revenue', 0)), 'color': self.COLOR_CREDIT},
                    {'label': 'Project Expenses', 'value': self._format_currency(job_pl.get('expenses', 0)), 'color': self.COLOR_DEBIT},
                    {'label': 'Net Profit', 'value': self._format_currency(prof), 'color': self.COLOR_CREDIT if prof >= 0 else self.COLOR_DEBIT}
                ]
                elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
                elements.append(Spacer(1, 5 * mm))

                # Project Details Box
                p_info = [
                    [
                        Paragraph(f"<b>Project Title:</b> {job_pl.get('title')}", self.styles['TableCellBold']),
                        Paragraph(f"<b>Client:</b> {job_pl.get('client_name')}", self.styles['TableCell']),
                        Paragraph(f"<b>Status:</b> {job_pl.get('status')}", self.styles['TableCell']),
                    ]
                ]
                p_table = Table(p_info, colWidths=[doc_width * 0.40, doc_width * 0.35, doc_width * 0.25])
                p_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
                    ('BOX', (0, 0), (-1, -1), 1, self.COLOR_BORDER),
                    ('PADDING', (0, 0), (-1, -1), 8),
                ]))
                elements.append(p_table)
            else:
                # Master Job List
                jobs = data.get('jobs', [])
                tot_val = sum(Decimal(str(j.get('total_amount', 0) or 0)) for j in jobs)
                tot_paid = sum(Decimal(str(j.get('paid', 0) or 0)) for j in jobs)
                tot_bal = sum(Decimal(str(j.get('balance', 0) or 0)) for j in jobs)

                kpis = [
                    {'label': 'Total Projects', 'value': str(len(jobs)), 'color': self.COLOR_PRIMARY},
                    {'label': 'Contract Value', 'value': self._format_currency(tot_val), 'color': self.COLOR_PRIMARY},
                    {'label': 'Total Collected', 'value': self._format_currency(tot_paid), 'color': self.COLOR_CREDIT},
                    {'label': 'Pending Balance', 'value': self._format_currency(tot_bal), 'color': self.COLOR_DEBIT}
                ]
                elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
                elements.append(Spacer(1, 5 * mm))

                table_rows = [
                    [
                        Paragraph("<b>JOB ID</b>", self.styles['TableHeader']),
                        Paragraph("<b>TITLE & DESCRIPTION</b>", self.styles['TableHeader']),
                        Paragraph("<b>CLIENT</b>", self.styles['TableHeader']),
                        Paragraph("<b>STATUS</b>", self.styles['TableHeader']),
                        Paragraph("<para align='right'><b>TOTAL VALUE</b></para>", self.styles['TableHeader']),
                        Paragraph("<para align='right'><b>BALANCE</b></para>", self.styles['TableHeader'])
                    ]
                ]
                for j in jobs:
                    table_rows.append([
                        Paragraph(str(j.get('order_id')), self.styles['TableCellBold']),
                        Paragraph(str(j.get('title')), self.styles['TableCell']),
                        Paragraph(str(j.get('customer__name') or 'Direct Client'), self.styles['TableCell']),
                        Paragraph(str(j.get('status')), self.styles['TableCell']),
                        Paragraph(f"{Decimal(str(j.get('total_amount', 0))):,.2f}", self.styles['TableCellNumber']),
                        Paragraph(f"{Decimal(str(j.get('balance', 0))):,.2f}", self.styles['TableCellDebit'])
                    ])

                col_w = [doc_width * 0.12, doc_width * 0.32, doc_width * 0.20, doc_width * 0.12, doc_width * 0.12, doc_width * 0.12]
                jobs_table = Table(table_rows, colWidths=col_w, repeatRows=1)
                t_styles = [
                    ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('PADDING', (0, 0), (-1, -1), 4.5),
                ]
                for i in range(1, len(table_rows)):
                    bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
                    t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
                    t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
                jobs_table.setStyle(TableStyle(t_styles))
                elements.append(jobs_table)

        elif report_type == 'expenses':
            exp_rep = data.get('expense_report', {})
            op_bal = exp_rep.get('opening_balance', 0)
            cls_bal = exp_rep.get('closing_balance', 0)
            expenses = exp_rep.get('expenses', [])
            tot_exp = sum(Decimal(str(e.get('amount', 0) or 0)) for e in expenses)

            kpis = [
                {'label': 'Opening Reserve', 'value': self._format_currency(op_bal), 'color': self.COLOR_PRIMARY},
                {'label': 'Total Expenditures', 'value': f"-{self._format_currency(tot_exp)}", 'color': self.COLOR_DEBIT},
                {'label': 'Closing Balance', 'value': self._format_currency(cls_bal), 'color': colors.HexColor("#065f46")}
            ]
            elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
            elements.append(Spacer(1, 5 * mm))

            table_rows = [
                [
                    Paragraph("<b>DATE</b>", self.styles['TableHeader']),
                    Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
                    Paragraph("<b>CATEGORY</b>", self.styles['TableHeader']),
                    Paragraph("<b>TYPE</b>", self.styles['TableHeader']),
                    Paragraph("<para align='right'><b>AMOUNT (SAR)</b></para>", self.styles['TableHeader'])
                ]
            ]
            for e in expenses:
                table_rows.append([
                    Paragraph(str(e.get('date')), self.styles['TableCell']),
                    Paragraph(str(e.get('description')), self.styles['TableCellBold']),
                    Paragraph(str(e.get('category') or 'General'), self.styles['TableCell']),
                    Paragraph(str(e.get('type') or '-'), self.styles['TableCell']),
                    Paragraph(f"-{Decimal(str(e.get('amount', 0))):,.2f}", self.styles['TableCellDebit'])
                ])

            table_rows.append([
                Paragraph("<b>TOTAL</b>", self.styles['TableCellBold']),
                Paragraph(f"<b>{len(expenses)} Expense Entries</b>", self.styles['TableCellBold']),
                Paragraph("--", self.styles['TableCell']),
                Paragraph("--", self.styles['TableCell']),
                Paragraph(f"<b>-{Decimal(str(tot_exp)):,.2f}</b>", self.styles['TableCellDebit'])
            ])

            col_w = [doc_width * 0.12, doc_width * 0.38, doc_width * 0.20, doc_width * 0.15, doc_width * 0.15]
            exp_table = Table(table_rows, colWidths=col_w, repeatRows=1)
            t_styles = [
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('PADDING', (0, 0), (-1, -1), 4.5),
                ('BACKGROUND', (0, -1), (-1, -1), self.COLOR_ROW_ALT),
                ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.COLOR_PRIMARY),
            ]
            for i in range(1, len(table_rows) - 1):
                bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
                t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
                t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
            exp_table.setStyle(TableStyle(t_styles))
            elements.append(exp_table)

        elements.append(Spacer(1, 8 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: STAFF TIMESHEET AUDIT REPORT
    # =========================================================================
    def generate_timesheet_report_pdf(self, timesheets, filters=None):
        """
        Generates an official Staff Timesheet and Attendance Audit Report PDF.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        staff_name = filters.get('staff_name') if filters else None
        month_or_date = (filters.get('month') if filters else None) or (filters.get('start_date') if filters else None)
        doc_title = format_dynamic_filename('timesheet', staff_name or 'all_staff', month_or_date, ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        period_str = "All Recorded Attendance"
        if filters:
            s_date = filters.get('start_date')
            e_date = filters.get('end_date')
            if s_date and e_date:
                period_str = f"{s_date} to {e_date}"

        banner = self.build_doc_title_banner(
            doc_width,
            title="STAFF ATTENDANCE & TIMESHEET AUDIT REPORT",
            ref_number=f"TS-{datetime.now().strftime('%Y%m%d')}",
            period_text=period_str
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. KPI Summary
        tot_entries = len(timesheets)
        tot_ot = sum(float(getattr(t, 'overtime_hours', 0) or (t.get('overtime_hours') if isinstance(t, dict) else 0) or 0) for t in timesheets)
        off_days = sum(1 for t in timesheets if getattr(t, 'is_off_day', False) or (t.get('is_off_day') if isinstance(t, dict) else False))

        kpis = [
            {'label': 'Attendance Records', 'value': str(tot_entries), 'color': self.COLOR_PRIMARY},
            {'label': 'Total Overtime Hours', 'value': f"{tot_ot:.1f} Hrs", 'color': self.COLOR_ACCENT},
            {'label': 'Regular Working Days', 'value': str(tot_entries - off_days), 'color': self.COLOR_CREDIT},
            {'label': 'Off / Rest Days', 'value': str(off_days), 'color': self.COLOR_MUTED}
        ]
        elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
        elements.append(Spacer(1, 5 * mm))

        # 4. Timesheet Table
        table_rows = [
            [
                Paragraph("<b>DATE</b>", self.styles['TableHeader']),
                Paragraph("<b>STAFF NAME</b>", self.styles['TableHeader']),
                Paragraph("<b>IN TIME</b>", self.styles['TableHeader']),
                Paragraph("<b>LUNCH</b>", self.styles['TableHeader']),
                Paragraph("<b>OUT TIME</b>", self.styles['TableHeader']),
                Paragraph("<b>STATUS / OT</b>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>OT HOURS</b></para>", self.styles['TableHeader'])
            ]
        ]

        for t in timesheets:
            dt = str(getattr(t, 'date', '') or (t.get('date') if isinstance(t, dict) else ''))
            name = str(getattr(t, 'staff_name', '') or (t.get('staff_name') if isinstance(t, dict) else ''))
            tin = str(getattr(t, 'in_time', '') or (t.get('in_time') if isinstance(t, dict) else ''))
            tlunch = str(getattr(t, 'lunch_time', '') or (t.get('lunch_time') if isinstance(t, dict) else ''))
            tout = str(getattr(t, 'out_time', '') or (t.get('out_time') if isinstance(t, dict) else ''))
            is_off = getattr(t, 'is_off_day', False) or (t.get('is_off_day') if isinstance(t, dict) else False)
            ot_h = float(getattr(t, 'overtime_hours', 0) or (t.get('overtime_hours') if isinstance(t, dict) else 0) or 0)
            ot_txt = getattr(t, 'overtime_text', '') or (t.get('overtime_text') if isinstance(t, dict) else '')

            status_desc = "Off Day" if is_off else (ot_txt or "Standard Shift")

            table_rows.append([
                Paragraph(dt, self.styles['TableCell']),
                Paragraph(f"<b>{name}</b>", self.styles['TableCellBold']),
                Paragraph(tin or "--", self.styles['TableCell']),
                Paragraph(tlunch or "--", self.styles['TableCell']),
                Paragraph(tout or "--", self.styles['TableCell']),
                Paragraph(status_desc, self.styles['TableCell']),
                Paragraph(f"{ot_h:.1f}", self.styles['TableCellNumber'] if ot_h > 0 else self.styles['TableCell'])
            ])

        col_w = [doc_width * 0.11, doc_width * 0.25, doc_width * 0.12, doc_width * 0.12, doc_width * 0.12, doc_width * 0.18, doc_width * 0.10]
        ts_table = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        ts_table.setStyle(TableStyle(t_styles))
        elements.append(ts_table)

        elements.append(Spacer(1, 8 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: EMPLOYEE PAYROLL RUNNING LEDGER STATEMENT
    # =========================================================================
    def generate_employee_ledger_pdf(self, employee_ledger):
        """
        Generates an official Employee Running Payroll Ledger and Balance Statement PDF.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        staff_name = employee_ledger.get('staff_name', 'employee') if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'staff_name', 'employee')
        doc_title = format_dynamic_filename('employee_ledger', staff_name, datetime.now().strftime('%Y%m%d'), ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        staff_name = employee_ledger.get('staff_name', 'Employee')
        pending_bal = employee_ledger.get('current_pending_balance', 0)
        curr = self.settings['currency']

        banner = self.build_doc_title_banner(
            doc_width,
            title=f"EMPLOYEE RUNNING ACCOUNT LEDGER: {staff_name.upper()}",
            ref_number=f"LEDGER-{datetime.now().strftime('%Y%m%d')}",
            period_text=f"Total Records: {employee_ledger.get('entries_count', len(employee_ledger.get('entries', [])))} Entries"
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. KPI Summary
        kpis = [
            {'label': 'Total Base Salary', 'value': f"{curr} {employee_ledger.get('total_base_salary', 0):,.2f}", 'color': self.COLOR_PRIMARY},
            {'label': 'Total Overtime Amt', 'value': f"{curr} {employee_ledger.get('total_overtime_amount', 0):,.2f}", 'color': self.COLOR_ACCENT},
            {'label': 'Total Salary Owed', 'value': f"{curr} {employee_ledger.get('total_salary_owed', 0):,.2f}", 'color': self.COLOR_PRIMARY},
            {'label': 'Total Disbursed', 'value': f"{curr} {employee_ledger.get('total_amount_paid', 0):,.2f}", 'color': self.COLOR_CREDIT},
            {'label': 'Current Pending', 'value': f"{curr} {pending_bal:,.2f}", 'color': self.COLOR_DEBIT if pending_bal > 0 else self.COLOR_CREDIT}
        ]
        elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
        elements.append(Spacer(1, 5 * mm))

        # 4. Ledger Entries Table
        table_rows = [
            [
                Paragraph("<b>DATE</b>", self.styles['TableHeader']),
                Paragraph("<b>PERIOD</b>", self.styles['TableHeader']),
                Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>BASE</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>OT AMT</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>TOTAL OWED</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>AMOUNT PAID</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>RUNNING BAL</b></para>", self.styles['TableHeader'])
            ]
        ]

        entries = employee_ledger.get('entries', [])
        for e in entries:
            dt = str(e.get('payment_date') or '')
            m = str(e.get('paid_month') or '')
            desc = str(e.get('description') or 'Salary Disbursement')
            base = float(e.get('base_salary') or 0)
            ot = float(e.get('overtime_amount') or 0)
            tot = float(e.get('total_salary') or 0)
            paid = float(e.get('amount_paid') or 0)
            bal = float(e.get('running_balance') or 0)

            table_rows.append([
                Paragraph(dt, self.styles['TableCell']),
                Paragraph(f"<b>{m}</b>", self.styles['TableCellBold']),
                Paragraph(desc[:30], self.styles['TableCell']),
                Paragraph(f"{base:,.2f}", self.styles['TableCellNumber']),
                Paragraph(f"{ot:,.2f}", self.styles['TableCellNumber']),
                Paragraph(f"<b>{tot:,.2f}</b>", self.styles['TableCellNumber']),
                Paragraph(f"<b>{paid:,.2f}</b>", self.styles['TableCellCredit']),
                Paragraph(f"<b>{bal:,.2f}</b>", self.styles['TableCellDebit'] if bal > 0 else self.styles['TableCellCredit'])
            ])

        col_w = [
            doc_width * 0.11,
            doc_width * 0.14,
            doc_width * 0.21,
            doc_width * 0.10,
            doc_width * 0.10,
            doc_width * 0.11,
            doc_width * 0.11,
            doc_width * 0.12
        ]
        t = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        t.setStyle(TableStyle(t_styles))
        elements.append(t)

        elements.append(Spacer(1, 8 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: CASHBOOK STATEMENT & LEDGER
    # =========================================================================
    def generate_cashbook_ledger_pdf(self, book_data, summary, entries, filters=None):
        """
        Generates an official Cashbook Statement & Transaction Ledger PDF.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        book_name = book_data.get('name', 'Cashbook')
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        doc_title = format_dynamic_filename('cashbook', book_name, s_date, 'to' if s_date and e_date else None, e_date or datetime.now().strftime('%Y%m%d'), ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        book_name = book_data.get('name', 'Cashbook')
        curr = book_data.get('currency') or self.settings['currency']

        period_str = "All Time Activity"
        if filters:
            s_date = filters.get('start_date')
            e_date = filters.get('end_date')
            if s_date and e_date:
                period_str = f"{s_date} to {e_date}"
            elif s_date:
                period_str = f"From {s_date}"
            elif e_date:
                period_str = f"Up to {e_date}"

        banner = self.build_doc_title_banner(
            doc_width,
            title=f"CASHBOOK LEDGER STATEMENT: {book_name.upper()}",
            ref_number=f"CB-{book_data.get('id', 1):03d}-{datetime.now().strftime('%Y%m%d')}",
            period_text=f"{period_str} • {len(entries)} Transactions"
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. KPI Summary
        open_bal = float(summary.get('opening_balance') or book_data.get('opening_balance') or 0)
        tot_in = float(summary.get('total_in', 0))
        tot_out = float(summary.get('total_out', 0))
        net_bal = float(summary.get('net_balance', 0))

        kpis = [
            {'label': 'Opening Balance', 'value': f"{curr} {open_bal:,.2f}", 'color': self.COLOR_PRIMARY},
            {'label': 'Total Cash In', 'value': f"+{curr} {tot_in:,.2f}", 'color': self.COLOR_CREDIT},
            {'label': 'Total Cash Out', 'value': f"-{curr} {tot_out:,.2f}", 'color': self.COLOR_DEBIT},
            {'label': 'Net Book Balance', 'value': f"{curr} {net_bal:,.2f}", 'color': self.COLOR_PRIMARY if net_bal >= 0 else self.COLOR_DEBIT}
        ]
        elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
        elements.append(Spacer(1, 5 * mm))

        # 4. Table
        table_rows = [
            [
                Paragraph("<b>DATE / TIME</b>", self.styles['TableHeader']),
                Paragraph("<b>REMARK / PARTY</b>", self.styles['TableHeader']),
                Paragraph("<b>CATEGORY / MODE</b>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>CASH IN (+)</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>CASH OUT (-)</b></para>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>BALANCE</b></para>", self.styles['TableHeader'])
            ]
        ]

        for e in entries:
            dt = str(e.get('date', ''))
            tm = str(e.get('time') or '')
            dt_tm = f"{dt}<br/><font size='6.5' color='#64748b'>{tm}</font>" if tm else dt

            remark = str(e.get('remark') or '')
            party = str(e.get('party_name') or '')
            desc_text = f"<b>{remark}</b>" if remark else "Transaction"
            if party:
                desc_text += f"<br/><font size='6.5' color='#64748b'>Party: {party}</font>"

            cat = str(e.get('category') or 'General')
            mode = str(e.get('payment_mode') or 'Cash')
            cat_mode = f"{cat}<br/><font size='6.5' color='#2563eb'>{mode}</font>"

            is_in = e.get('entry_type') == 'in'
            amt = float(e.get('amount') or 0)
            bal = float(e.get('running_balance') or 0)

            cash_in = f"<b>+{amt:,.2f}</b>" if is_in else "--"
            cash_out = f"<b>-{amt:,.2f}</b>" if not is_in else "--"

            table_rows.append([
                Paragraph(dt_tm, self.styles['TableCell']),
                Paragraph(desc_text, self.styles['TableCell']),
                Paragraph(cat_mode, self.styles['TableCell']),
                Paragraph(cash_in, self.styles['TableCellCredit'] if is_in else self.styles['TableCell']),
                Paragraph(cash_out, self.styles['TableCellDebit'] if not is_in else self.styles['TableCell']),
                Paragraph(f"<b>{bal:,.2f}</b>", self.styles['TableCellBold'] if bal >= 0 else self.styles['TableCellDebit'])
            ])

        col_w = [
            doc_width * 0.15,
            doc_width * 0.31,
            doc_width * 0.18,
            doc_width * 0.12,
            doc_width * 0.12,
            doc_width * 0.12
        ]
        t = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        t.setStyle(TableStyle(t_styles))
        elements.append(t)

        elements.append(Spacer(1, 8 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # =========================================================================
    # DOCUMENT BUILDER: CASHBOOK BANK FLOW & TRANSACTION LEDGER
    # =========================================================================
    def generate_cashbook_bank_flow_pdf(self, summary, transactions, filters=None):
        """
        Generates an official Consolidated Bank Flow & Transaction Ledger PDF.
        """
        buffer = io.BytesIO()
        margin = 12 * mm
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        doc_title = format_dynamic_filename('cashbook_bank_flow', s_date, 'to' if s_date and e_date else None, e_date or datetime.now().strftime('%Y%m%d'), ext='')
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin + 8 * mm,
            title=doc_title,
            author=self.settings.get('company_name', 'Arab Season')
        )

        doc_width = A4[0] - (2 * margin)
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))

        # 2. Document Title Banner
        curr = self.settings['currency']
        period_str = "All Bank Transactions"
        if filters:
            s_date = filters.get('start_date')
            e_date = filters.get('end_date')
            if s_date and e_date:
                period_str = f"{s_date} to {e_date}"
            elif s_date:
                period_str = f"From {s_date}"
            elif e_date:
                period_str = f"Up to {e_date}"

        banner = self.build_doc_title_banner(
            doc_width,
            title="CONSOLIDATED BANK FLOW & TRANSACTION LEDGER",
            ref_number=f"BF-{datetime.now().strftime('%Y%m%d')}",
            period_text=f"{period_str} • {len(transactions)} Records"
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. KPI Summary
        tot_in = float(summary.get('total_inflows', 0))
        tot_out = float(summary.get('total_outflows', 0))
        net_flow = float(summary.get('net_flow', 0))
        tot_count = int(summary.get('total_transactions', len(transactions)))

        kpis = [
            {'label': 'Total Bank Deposits', 'value': f"+{curr} {tot_in:,.2f}", 'color': self.COLOR_CREDIT},
            {'label': 'Total Bank Withdrawals', 'value': f"-{curr} {tot_out:,.2f}", 'color': self.COLOR_DEBIT},
            {'label': 'Net Bank Flow', 'value': f"{curr} {net_flow:,.2f}", 'color': self.COLOR_CREDIT if net_flow >= 0 else self.COLOR_DEBIT},
            {'label': 'Total Transactions', 'value': str(tot_count), 'color': self.COLOR_PRIMARY}
        ]
        elements.append(self.build_kpi_cards_flowable(doc_width, kpis))
        elements.append(Spacer(1, 5 * mm))

        # 4. Table
        table_rows = [
            [
                Paragraph("<b>DATE / TIME</b>", self.styles['TableHeader']),
                Paragraph("<b>CASHBOOK</b>", self.styles['TableHeader']),
                Paragraph("<b>BANK ACCOUNT</b>", self.styles['TableHeader']),
                Paragraph("<b>CATEGORY & REMARK</b>", self.styles['TableHeader']),
                Paragraph("<b>FLOW DIRECTION</b>", self.styles['TableHeader']),
                Paragraph("<para align='right'><b>AMOUNT</b></para>", self.styles['TableHeader'])
            ]
        ]

        for tx in transactions:
            dt = str(tx.get('date', ''))
            tm = str(tx.get('time') or '')
            dt_tm = f"{dt}<br/><font size='6.5' color='#64748b'>{tm}</font>" if tm else dt

            cb_name = str(tx.get('cashbook_name') or 'Cashbook')
            b_name = str(tx.get('bank_account_name') or 'Bank')
            b_num = str(tx.get('bank_account_number') or '')
            bank_desc = f"<b>{b_name}</b>"
            if b_num:
                bank_desc += f"<br/><font size='6.5' color='#64748b'>{b_num[-8:]}</font>"

            rem = str(tx.get('remark') or '')
            cat = str(tx.get('category') or '')
            pty = str(tx.get('party_name') or '')
            detail_text = f"<b>{cat}</b>: {rem}" if rem else cat
            if pty:
                detail_text += f"<br/><font size='6.5' color='#64748b'>Party: {pty}</font>"

            flow = str(tx.get('flow_direction') or '')
            amt = float(tx.get('amount') or 0)
            is_in = 'in' in flow.lower() or 'deposit' in flow.lower()

            flow_para = Paragraph(f"<font color='{'#047857' if is_in else '#dc2626'}'><b>{flow}</b></font>", self.styles['TableCell'])
            amt_para = Paragraph(f"<b>{'+' if is_in else '-'}{curr} {amt:,.2f}</b>", self.styles['TableCellCredit'] if is_in else self.styles['TableCellDebit'])

            table_rows.append([
                Paragraph(dt_tm, self.styles['TableCell']),
                Paragraph(cb_name, self.styles['TableCell']),
                Paragraph(bank_desc, self.styles['TableCell']),
                Paragraph(detail_text, self.styles['TableCell']),
                flow_para,
                amt_para
            ])

        col_w = [
            doc_width * 0.14,
            doc_width * 0.14,
            doc_width * 0.18,
            doc_width * 0.28,
            doc_width * 0.13,
            doc_width * 0.13
        ]
        t = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        t.setStyle(TableStyle(t_styles))
        elements.append(t)

        elements.append(Spacer(1, 8 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_tax_invoice_pdf(self, invoice):
        """
        Generates an official, publication-grade corporate Tax Invoice PDF.
        Compliant with Saudi VAT standard fields, bilingual English/Arabic headers,
        line-item breakdown, banking remittance info, and vector QR code.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm
        )
        doc_width = A4[0] - (28 * mm)
        elements = []

        # 1. Standard Branded Company Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Document Banner
        banner_data = [
            [
                Paragraph("<b>TAX INVOICE</b>", self.styles['DocTitle']),
                Paragraph(f"<b>INVOICE NO:</b> {invoice.invoice_number}", self.styles['DocSubTitle'])
            ]
        ]
        banner_table = Table(banner_data, colWidths=[doc_width * 0.6, doc_width * 0.4])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6.5),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 4 * mm))

        # 3. Two-Column Information Box (Customer Details & Invoice Metadata)
        curr = self.settings['currency']
        cust = invoice.customer
        cust_name = cust.name if cust else "N/A"
        cust_tax = invoice.customer_tax_number or getattr(cust, 'tax_number', '') or 'N/A'
        cust_phone = getattr(cust, 'phone', '') or 'N/A'
        cust_email = getattr(cust, 'email', '') or 'N/A'
        cust_address = invoice.billing_address or getattr(cust, 'address', '') or 'N/A'

        job_info = f"{invoice.job_order.order_id or ''} - {invoice.job_order.title}" if invoice.job_order else "Direct Billing"
        inv_date_str = invoice.invoice_date.strftime('%d/%m/%Y') if invoice.invoice_date else 'N/A'
        due_date_str = invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else 'N/A'
        supply_date_str = invoice.supply_date.strftime('%d/%m/%Y') if invoice.supply_date else inv_date_str

        status_colors = {
            'Paid': '#16a34a',
            'Partially Paid': '#d97706',
            'Issued': '#2563eb',
            'Draft': '#64748b',
            'Overdue': '#dc2626',
            'Cancelled': '#991b1b'
        }
        st_color = status_colors.get(invoice.status, '#2563eb')

        left_content = [
            Paragraph("<b>BILLED TO</b>", self.styles['MetaLabel']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>{cust_name}</b>", ParagraphStyle('CustTitle', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=self.COLOR_PRIMARY)),
            Paragraph(f"<b>VAT / Tax ID:</b> {cust_tax}", self.styles['MetaValue']),
            Paragraph(f"<b>Address:</b> {cust_address}", self.styles['MetaValue']),
            Paragraph(f"<b>Phone:</b> {cust_phone} | <b>Email:</b> {cust_email}", self.styles['MetaValue']),
        ]

        right_content = [
            Paragraph(f"<b>Date of Issue:</b> {inv_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Due Date:</b> {due_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Supply Date:</b> {supply_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Payment Terms:</b> {invoice.payment_terms or 'Due on Receipt'}", self.styles['MetaValue']),
            Paragraph(f"<b>Project / Job Order:</b> {job_info}", self.styles['MetaValue']),
            Paragraph(f"<b>PO / Ref:</b> {invoice.reference_number or 'N/A'}", self.styles['MetaValue']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>Status:</b> <font color='{st_color}'><b>{invoice.status.upper()}</b></font>", self.styles['MetaValue']),
        ]

        meta_table = Table([[left_content, right_content]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Line Items Table
        items = list(invoice.items.all())
        headers = [
            Paragraph("<b>#</b>", self.styles['TableHeader']),
            Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
            Paragraph("<b>QTY</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>UNIT</b>", self.styles['TableHeader']),
            Paragraph(f"<b>PRICE ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>DISC %</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>VAT %</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>VAT ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>TOTAL ({curr})</b>", self.styles['TableHeaderRight']),
        ]
        table_rows = [headers]

        if items:
            for idx, itm in enumerate(items, 1):
                table_rows.append([
                    Paragraph(str(idx), self.styles['TableCell']),
                    Paragraph(str(itm.description), self.styles['TableCell']),
                    Paragraph(f"{float(itm.quantity):,.2f}", self.styles['TableCellRight']),
                    Paragraph(str(itm.unit or 'Unit'), self.styles['TableCell']),
                    Paragraph(f"{float(itm.unit_price):,.2f}", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.discount_rate):,.1f}%" if float(itm.discount_rate) > 0 else "-", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.tax_rate):,.1f}%", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.tax_amount):,.2f}", self.styles['TableCellRight']),
                    Paragraph(f"<b>{float(itm.total):,.2f}</b>", self.styles['TableCellRight']),
                ])
        else:
            table_rows.append([
                Paragraph("1", self.styles['TableCell']),
                Paragraph(invoice.notes or "General Services as per Contract", self.styles['TableCell']),
                Paragraph("1.00", self.styles['TableCellRight']),
                Paragraph("Lot", self.styles['TableCell']),
                Paragraph(f"{float(invoice.subtotal):,.2f}", self.styles['TableCellRight']),
                Paragraph("-", self.styles['TableCellRight']),
                Paragraph(f"{float(invoice.tax_rate):,.1f}%", self.styles['TableCellRight']),
                Paragraph(f"{float(invoice.tax_amount):,.2f}", self.styles['TableCellRight']),
                Paragraph(f"<b>{float(invoice.total_amount):,.2f}</b>", self.styles['TableCellRight']),
            ])

        col_w = [
            doc_width * 0.05,  # #
            doc_width * 0.35,  # Description
            doc_width * 0.07,  # Qty
            doc_width * 0.07,  # Unit
            doc_width * 0.11,  # Unit Price
            doc_width * 0.07,  # Disc %
            doc_width * 0.07,  # VAT %
            doc_width * 0.09,  # VAT
            doc_width * 0.12,  # Total
        ]
        items_table = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        items_table.setStyle(TableStyle(t_styles))
        elements.append(items_table)
        elements.append(Spacer(1, 4 * mm))

        # 5. Bottom Section: Banking Details + Summary Totals Box
        # Left Column: Bank info & Notes
        bank = invoice.bank_account
        bank_info = []
        if bank:
            bank_info = [
                Paragraph("<b>REMITTANCE / BANK DETAILS:</b>", self.styles['MetaLabel']),
                Paragraph(f"<b>Bank:</b> {bank.bank_name} | <b>Account:</b> {bank.account_number}", self.styles['TableCell']),
                Paragraph(f"<b>IBAN:</b> {bank.iban or 'N/A'}", self.styles['TableCell']),
                Spacer(1, 2 * mm),
            ]

        notes_info = []
        if invoice.notes:
            notes_info.append(Paragraph(f"<b>Notes:</b> {invoice.notes}", self.styles['TableCell']))
        if invoice.terms_conditions:
            notes_info.append(Paragraph(f"<b>Terms:</b> {invoice.terms_conditions}", self.styles['TableCell']))

        bottom_left = bank_info + notes_info

        # Right Column: Totals Summary
        paid_val = sum(float(p.amount) for p in invoice.payments.all())
        bal_val = max(0.0, float(invoice.total_amount) - paid_val)

        totals_data = [
            [Paragraph("Subtotal (Excl. VAT):", self.styles['TableCell']), Paragraph(f"{float(invoice.subtotal):,.2f} {curr}", self.styles['TableCellRight'])],
        ]
        if float(invoice.discount_amount) > 0:
            totals_data.append([
                Paragraph("Discount:", self.styles['TableCell']),
                Paragraph(f"- {float(invoice.discount_amount):,.2f} {curr}", self.styles['TableCellRight'])
            ])
        totals_data.extend([
            [Paragraph(f"VAT ({float(invoice.tax_rate):,.1f}%):", self.styles['TableCell']), Paragraph(f"{float(invoice.tax_amount):,.2f} {curr}", self.styles['TableCellRight'])],
            [Paragraph("<b>Grand Total:</b>", ParagraphStyle('TotBold', fontName='Helvetica-Bold', fontSize=9, textColor=self.COLOR_PRIMARY)), Paragraph(f"<b>{float(invoice.total_amount):,.2f} {curr}</b>", ParagraphStyle('TotBoldR', fontName='Helvetica-Bold', fontSize=9.5, alignment=2, textColor=self.COLOR_ACCENT))],
            [Paragraph("Amount Paid:", self.styles['TableCell']), Paragraph(f"{paid_val:,.2f} {curr}", self.styles['TableCellRight'])],
            [Paragraph("<b>Balance Due:</b>", ParagraphStyle('BalBold', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#dc2626') if bal_val > 0 else self.COLOR_CREDIT)), Paragraph(f"<b>{bal_val:,.2f} {curr}</b>", ParagraphStyle('BalBoldR', fontName='Helvetica-Bold', fontSize=9.5, alignment=2, textColor=colors.HexColor('#dc2626') if bal_val > 0 else self.COLOR_CREDIT))],
        ])

        totals_table = Table(totals_data, colWidths=[doc_width * 0.22, doc_width * 0.20])
        totals_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('LINEBELOW', (0, -3), (-1, -3), 1, self.COLOR_PRIMARY),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))

        bottom_table = Table([[bottom_left, totals_table]], colWidths=[doc_width * 0.56, doc_width * 0.44])
        bottom_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(bottom_table)

        # 6. Signatures & Footer
        elements.append(Spacer(1, 6 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_client_estimation_checklist_pdf(self, estimation):
        """
        Generates a publication-grade client-facing Production Checklist & Material Estimation PDF.
        CRITICAL REQUIREMENT: Cost/price/supplier columns are STRICTLY HIDDEN.
        Shows Item, Measurements/Specs, Qty, Unit, and grouped by Section/Room.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=10 * mm,
            rightMargin=10 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm
        )
        doc_width = A4[0] - 20 * mm
        elements = []

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Document Title Banner
        banner = self.build_doc_title_banner(
            doc_width,
            "PRODUCTION CHECKLIST & ESTIMATE",
            ref_number=estimation.estimate_number
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. Client & Project Meta Grid
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = estimation.date.strftime('%d/%m/%Y') if hasattr(estimation.date, 'strftime') else str(estimation.date)
        valid_str = estimation.valid_until.strftime('%d/%m/%Y') if estimation.valid_until and hasattr(estimation.valid_until, 'strftime') else "Upon Request"

        meta_left = [
            [Paragraph("<b>Project / Job:</b>", self.styles['TableCellBold']), Paragraph(estimation.title or "Client Production Estimate", self.styles['TableCell'])],
            [Paragraph("<b>Client Name:</b>", self.styles['TableCellBold']), Paragraph(client_name, self.styles['TableCell'])],
            [Paragraph("<b>Contact:</b>", self.styles['TableCellBold']), Paragraph(estimation.client_contact or "—", self.styles['TableCell'])],
        ]
        meta_right = [
            [Paragraph("<b>Estimate #:</b>", self.styles['TableCellBold']), Paragraph(f"<b>{estimation.estimate_number}</b>", self.styles['TableCellBold'])],
            [Paragraph("<b>Date:</b>", self.styles['TableCellBold']), Paragraph(c_date, self.styles['TableCell'])],
            [Paragraph("<b>Valid Until:</b>", self.styles['TableCellBold']), Paragraph(valid_str, self.styles['TableCell'])],
            [Paragraph("<b>Status:</b>", self.styles['TableCellBold']), Paragraph(estimation.status, self.styles['TableCell'])],
        ]

        meta_table = Table([
            [
                Table(meta_left, colWidths=[doc_width * 0.20, doc_width * 0.32]),
                Table(meta_right, colWidths=[doc_width * 0.18, doc_width * 0.30])
            ]
        ], colWidths=[doc_width * 0.52, doc_width * 0.48])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 5 * mm))

        # 4. Group Items by Section/Room
        items = list(estimation.items.all().order_by('section_name', 'sort_order', 'id'))
        sections_dict = {}
        for item in items:
            sec = item.section_name.strip() if item.section_name else "General"
            if sec not in sections_dict:
                sections_dict[sec] = []
            sections_dict[sec].append(item)

        sec_idx = 1
        for sec_name, sec_items in sections_dict.items():
            elements.append(Paragraph(
                f"<b>Area / Section: {sec_name.upper()}</b> ({len(sec_items)} items)",
                ParagraphStyle(f'SecTitle_{sec_idx}', fontName='Helvetica-Bold', fontSize=10, textColor=self.COLOR_ACCENT, leading=14)
            ))
            elements.append(Spacer(1, 1.5 * mm))

            table_data = [
                [
                    Paragraph("#", self.styles['TableHeaderCenter']),
                    Paragraph("Item Description", self.styles['TableHeader']),
                    Paragraph("Measurements / Specifications", self.styles['TableHeader']),
                    Paragraph("Qty", self.styles['TableHeaderCenter']),
                    Paragraph("Unit", self.styles['TableHeaderCenter']),
                    Paragraph("Notes / Remarks", self.styles['TableHeader']),
                ]
            ]

            for i_idx, item in enumerate(sec_items, 1):
                bg = self.COLOR_ROW_ALT if i_idx % 2 == 0 else self.COLOR_WHITE
                qty_str = f"{float(item.quantity):g}"
                table_data.append([
                    Paragraph(str(i_idx), self.styles['TableCellCenter']),
                    Paragraph(f"<b>{item.item_name}</b>", self.styles['TableCell']),
                    Paragraph(item.measurements or "Standard", self.styles['TableCell']),
                    Paragraph(f"<b>{qty_str}</b>", self.styles['TableCellCenter']),
                    Paragraph(item.unit or "pcs", self.styles['TableCellCenter']),
                    Paragraph(item.notes or "—", self.styles['TableCell']),
                ])

            sec_table = Table(
                table_data,
                colWidths=[doc_width * 0.06, doc_width * 0.34, doc_width * 0.24, doc_width * 0.10, doc_width * 0.10, doc_width * 0.16]
            )
            sec_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_SECONDARY),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
                ('PADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(sec_table)
            elements.append(Spacer(1, 4 * mm))
            sec_idx += 1

        # 5. Notes & Terms
        if estimation.notes:
            elements.append(Spacer(1, 2 * mm))
            elements.append(Paragraph("<b>Scope & Project Notes:</b>", self.styles['TableCellBold']))
            elements.append(Paragraph(estimation.notes, self.styles['TableCell']))
            elements.append(Spacer(1, 4 * mm))

        # 6. Signatures & Footer
        elements.append(Spacer(1, 6 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_admin_estimation_pdf(self, estimation):
        """
        Generates an internal Admin Material Pricing & Profitability Estimate PDF.
        Includes supplier shop costs, margins, and customer quotation price breakdown.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=10 * mm,
            rightMargin=10 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm
        )
        doc_width = A4[0] - 20 * mm
        elements = []

        curr = self.settings['currency']

        # 1. Standard Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Title Banner
        banner = self.build_doc_title_banner(
            doc_width,
            "INTERNAL MATERIAL ESTIMATE & MARGIN ANALYSIS",
            ref_number=estimation.estimate_number
        )
        elements.append(banner)
        elements.append(Spacer(1, 4 * mm))

        # 3. Meta Table
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = estimation.date.strftime('%d/%m/%Y') if hasattr(estimation.date, 'strftime') else str(estimation.date)

        meta_left = [
            [Paragraph("<b>Project:</b>", self.styles['TableCellBold']), Paragraph(estimation.title, self.styles['TableCell'])],
            [Paragraph("<b>Client:</b>", self.styles['TableCellBold']), Paragraph(client_name, self.styles['TableCell'])],
            [Paragraph("<b>Date:</b>", self.styles['TableCellBold']), Paragraph(c_date, self.styles['TableCell'])],
        ]
        meta_right = [
            [Paragraph("<b>Estimate #:</b>", self.styles['TableCellBold']), Paragraph(f"<b>{estimation.estimate_number}</b>", self.styles['TableCellBold'])],
            [Paragraph("<b>Status:</b>", self.styles['TableCellBold']), Paragraph(estimation.status, self.styles['TableCell'])],
            [Paragraph("<b>Total Quoted Price:</b>", self.styles['TableCellBold']), Paragraph(f"<b>{float(estimation.total_price):,.2f} {curr}</b>", self.styles['TableCellBold'])],
        ]
        meta_table = Table([
            [
                Table(meta_left, colWidths=[doc_width * 0.18, doc_width * 0.34]),
                Table(meta_right, colWidths=[doc_width * 0.22, doc_width * 0.26])
            ]
        ], colWidths=[doc_width * 0.52, doc_width * 0.48])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Financial KPI Cards
        kpi_cost = f"{float(estimation.subtotal_cost):,.2f} {curr}"
        kpi_price = f"{float(estimation.subtotal_price):,.2f} {curr}"
        kpi_margin = f"{float(estimation.margin_amount):,.2f} {curr}"
        kpi_pct = f"{float(estimation.margin_percentage):,.1f}%"

        kpi_data = [
            [
                Paragraph("<b>Total Material Cost:</b>", self.styles['TableCellCenter']),
                Paragraph("<b>Customer Quoted Price:</b>", self.styles['TableCellCenter']),
                Paragraph("<b>Projected Gross Margin:</b>", self.styles['TableCellCenter']),
                Paragraph("<b>Profit Margin:</b>", self.styles['TableCellCenter']),
            ],
            [
                Paragraph(f"<b>{kpi_cost}</b>", ParagraphStyle('k1', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#dc2626'), alignment=1)),
                Paragraph(f"<b>{kpi_price}</b>", ParagraphStyle('k2', fontName='Helvetica-Bold', fontSize=10, textColor=self.COLOR_ACCENT, alignment=1)),
                Paragraph(f"<b>{kpi_margin}</b>", ParagraphStyle('k3', fontName='Helvetica-Bold', fontSize=10, textColor=self.COLOR_CREDIT, alignment=1)),
                Paragraph(f"<b>{kpi_pct}</b>", ParagraphStyle('k4', fontName='Helvetica-Bold', fontSize=10, textColor=self.COLOR_PRIMARY, alignment=1)),
            ]
        ]
        kpi_table = Table(kpi_data, colWidths=[doc_width * 0.25] * 4)
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_ROW_ALT),
            ('BACKGROUND', (0, 1), (-1, 1), self.COLOR_WHITE),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 5 * mm))

        # 5. Items Table with Financials
        items = list(estimation.items.all().order_by('section_name', 'sort_order', 'id'))
        table_data = [
            [
                Paragraph("#", self.styles['TableHeaderCenter']),
                Paragraph("Item / Area", self.styles['TableHeader']),
                Paragraph("Supplier / Shop", self.styles['TableHeader']),
                Paragraph("Qty", self.styles['TableHeaderCenter']),
                Paragraph("Unit Cost", self.styles['TableHeaderRight']),
                Paragraph("Total Cost", self.styles['TableHeaderRight']),
                Paragraph("Unit Price", self.styles['TableHeaderRight']),
                Paragraph("Total Price", self.styles['TableHeaderRight']),
                Paragraph("Margin", self.styles['TableHeaderRight']),
            ]
        ]

        for idx, item in enumerate(items, 1):
            qty_str = f"{float(item.quantity):g} {item.unit}"
            u_cost = f"{float(item.unit_cost):,.2f}"
            t_cost = f"{float(item.total_cost):,.2f}"
            u_price = f"{float(item.unit_price):,.2f}"
            t_price = f"{float(item.total_price):,.2f}"
            m_amt = f"{float(item.margin):,.2f}"
            area_badge = f" <font color='#64748b'>[{item.section_name}]</font>" if item.section_name else ""

            table_data.append([
                Paragraph(str(idx), self.styles['TableCellCenter']),
                Paragraph(f"<b>{item.item_name}</b>{area_badge}<br/><font color='#64748b' size=6.5>{item.measurements or 'Standard'}</font>", self.styles['TableCell']),
                Paragraph(item.selected_shop_name or "—", self.styles['TableCell']),
                Paragraph(qty_str, self.styles['TableCellCenter']),
                Paragraph(u_cost, self.styles['TableCellRight']),
                Paragraph(t_cost, self.styles['TableCellRight']),
                Paragraph(u_price, self.styles['TableCellRight']),
                Paragraph(f"<b>{t_price}</b>", self.styles['TableCellRight']),
                Paragraph(f"<b>{m_amt}</b>", ParagraphStyle(f'm_{idx}', fontName='Helvetica-Bold', fontSize=8, textColor=self.COLOR_CREDIT, alignment=2)),
            ])

        items_table = Table(
            table_data,
            colWidths=[doc_width * 0.05, doc_width * 0.24, doc_width * 0.15, doc_width * 0.10, doc_width * 0.11, doc_width * 0.11, doc_width * 0.11, doc_width * 0.11, doc_width * 0.12]
        )
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(items_table)

        # 6. Signatures
        elements.append(Spacer(1, 6 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_quotation_pdf(self, quotation):
        """
        Generates an official publication-grade Quotation / Proforma PDF.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm
        )
        doc_width = A4[0] - (28 * mm)
        elements = []

        # 1. Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Document Banner
        banner_data = [
            [
                Paragraph("<b>QUOTATION</b>", self.styles['DocTitle']),
                Paragraph(f"<b>QUOTE NO:</b> {quotation.quotation_number}", self.styles['DocSubTitle'])
            ]
        ]
        banner_table = Table(banner_data, colWidths=[doc_width * 0.6, doc_width * 0.4])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6.5),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 4 * mm))

        # 3. Customer Details & Metadata
        curr = self.settings['currency']
        cust = quotation.customer
        cust_name = cust.name if cust else "N/A"
        cust_tax = quotation.customer_tax_number or getattr(cust, 'tax_number', '') or 'N/A'
        cust_phone = getattr(cust, 'phone', '') or 'N/A'
        cust_email = getattr(cust, 'email', '') or 'N/A'
        cust_address = quotation.billing_address or getattr(cust, 'address', '') or 'N/A'

        job_info = f"{quotation.job_order.order_id or ''} - {quotation.job_order.title}" if quotation.job_order else "Direct Quote"
        q_date_str = quotation.quotation_date.strftime('%d/%m/%Y') if quotation.quotation_date else 'N/A'
        valid_date_str = quotation.valid_until.strftime('%d/%m/%Y') if quotation.valid_until else 'N/A'

        status_colors = {
            'Accepted': '#16a34a',
            'Sent': '#2563eb',
            'Draft': '#64748b',
            'Declined': '#dc2626',
            'Expired': '#991b1b',
            'Converted to Invoice': '#0891b2'
        }
        st_color = status_colors.get(quotation.status, '#2563eb')

        left_content = [
            Paragraph("<b>QUOTATION PREPARED FOR</b>", self.styles['MetaLabel']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>{cust_name}</b>", ParagraphStyle('CustTitle', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=self.COLOR_PRIMARY)),
            Paragraph(f"<b>VAT / Tax ID:</b> {cust_tax}", self.styles['MetaValue']),
            Paragraph(f"<b>Address:</b> {cust_address}", self.styles['MetaValue']),
            Paragraph(f"<b>Phone:</b> {cust_phone} | <b>Email:</b> {cust_email}", self.styles['MetaValue']),
        ]

        right_content = [
            Paragraph(f"<b>Quotation Date:</b> {q_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Valid Until:</b> {valid_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Payment Terms:</b> {quotation.payment_terms or 'Due on Receipt'}", self.styles['MetaValue']),
            Paragraph(f"<b>Project / Job Order:</b> {job_info}", self.styles['MetaValue']),
            Paragraph(f"<b>Reference / PO:</b> {quotation.reference_number or 'N/A'}", self.styles['MetaValue']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>Status:</b> <font color='{st_color}'><b>{quotation.status.upper()}</b></font>", self.styles['MetaValue']),
        ]

        meta_table = Table([[left_content, right_content]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Line Items Table
        items = list(quotation.items.all())
        headers = [
            Paragraph("<b>#</b>", self.styles['TableHeader']),
            Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
            Paragraph("<b>QTY</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>UNIT</b>", self.styles['TableHeader']),
            Paragraph(f"<b>PRICE ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>DISC %</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>VAT %</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>VAT ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>TOTAL ({curr})</b>", self.styles['TableHeaderRight']),
        ]
        table_rows = [headers]

        if items:
            for idx, itm in enumerate(items, 1):
                table_rows.append([
                    Paragraph(str(idx), self.styles['TableCell']),
                    Paragraph(str(itm.description), self.styles['TableCell']),
                    Paragraph(f"{float(itm.quantity):,.2f}", self.styles['TableCellRight']),
                    Paragraph(str(itm.unit or 'Unit'), self.styles['TableCell']),
                    Paragraph(f"{float(itm.unit_price):,.2f}", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.discount_rate):,.1f}%" if float(itm.discount_rate) > 0 else "-", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.tax_rate):,.1f}%", self.styles['TableCellRight']),
                    Paragraph(f"{float(itm.tax_amount):,.2f}", self.styles['TableCellRight']),
                    Paragraph(f"<b>{float(itm.total):,.2f}</b>", self.styles['TableCellRight']),
                ])
        else:
            table_rows.append([
                Paragraph("1", self.styles['TableCell']),
                Paragraph(quotation.notes or "Quotation item details", self.styles['TableCell']),
                Paragraph("1.00", self.styles['TableCellRight']),
                Paragraph("Lot", self.styles['TableCell']),
                Paragraph(f"{float(quotation.subtotal):,.2f}", self.styles['TableCellRight']),
                Paragraph("-", self.styles['TableCellRight']),
                Paragraph(f"{float(quotation.tax_rate):,.1f}%", self.styles['TableCellRight']),
                Paragraph(f"{float(quotation.tax_amount):,.2f}", self.styles['TableCellRight']),
                Paragraph(f"<b>{float(quotation.total_amount):,.2f}</b>", self.styles['TableCellRight']),
            ])

        col_w = [
            doc_width * 0.05,
            doc_width * 0.35,
            doc_width * 0.07,
            doc_width * 0.07,
            doc_width * 0.11,
            doc_width * 0.07,
            doc_width * 0.07,
            doc_width * 0.09,
            doc_width * 0.12,
        ]
        items_table = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        items_table.setStyle(TableStyle(t_styles))
        elements.append(items_table)
        elements.append(Spacer(1, 4 * mm))

        # 5. Bottom Section
        bank = quotation.bank_account
        bank_info = []
        if bank:
            bank_info = [
                Paragraph("<b>BANK / REMITTANCE DETAILS:</b>", self.styles['MetaLabel']),
                Paragraph(f"<b>Bank:</b> {bank.bank_name} | <b>Account:</b> {bank.account_number}", self.styles['TableCell']),
                Paragraph(f"<b>IBAN:</b> {bank.iban or 'N/A'}", self.styles['TableCell']),
                Spacer(1, 2 * mm),
            ]

        notes_info = []
        if quotation.notes:
            notes_info.append(Paragraph(f"<b>Notes:</b> {quotation.notes}", self.styles['TableCell']))
        if quotation.terms_conditions:
            notes_info.append(Paragraph(f"<b>Terms & Conditions:</b> {quotation.terms_conditions}", self.styles['TableCell']))

        bottom_left = bank_info + notes_info

        totals_data = [
            [Paragraph("Subtotal (Excl. VAT):", self.styles['TableCell']), Paragraph(f"{float(quotation.subtotal):,.2f} {curr}", self.styles['TableCellRight'])],
        ]
        if float(quotation.discount_amount) > 0:
            totals_data.append([
                Paragraph("Discount:", self.styles['TableCell']),
                Paragraph(f"- {float(quotation.discount_amount):,.2f} {curr}", self.styles['TableCellRight'])
            ])
        totals_data.extend([
            [Paragraph(f"VAT ({float(quotation.tax_rate):,.1f}%):", self.styles['TableCell']), Paragraph(f"{float(quotation.tax_amount):,.2f} {curr}", self.styles['TableCellRight'])],
            [Paragraph("<b>Quotation Total:</b>", ParagraphStyle('QTotBold', fontName='Helvetica-Bold', fontSize=9, textColor=self.COLOR_PRIMARY)), Paragraph(f"<b>{float(quotation.total_amount):,.2f} {curr}</b>", ParagraphStyle('QTotBoldR', fontName='Helvetica-Bold', fontSize=9.5, alignment=2, textColor=self.COLOR_ACCENT))],
        ])

        totals_table = Table(totals_data, colWidths=[doc_width * 0.22, doc_width * 0.20])
        totals_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('LINEBELOW', (0, -2), (-1, -2), 1, self.COLOR_PRIMARY),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))

        bottom_table = Table([[bottom_left, totals_table]], colWidths=[doc_width * 0.56, doc_width * 0.44])
        bottom_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(bottom_table)

        # 6. Signatures
        elements.append(Spacer(1, 6 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_credit_note_pdf(self, credit_note):
        """
        Generates an official publication-grade Credit Note PDF.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm
        )
        doc_width = A4[0] - (28 * mm)
        elements = []

        # 1. Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Banner
        banner_data = [
            [
                Paragraph("<b>CREDIT NOTE</b>", self.styles['DocTitle']),
                Paragraph(f"<b>NOTE NO:</b> {credit_note.credit_note_number}", self.styles['DocSubTitle'])
            ]
        ]
        banner_table = Table(banner_data, colWidths=[doc_width * 0.6, doc_width * 0.4])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#991b1b')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6.5),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 4 * mm))

        # 3. Metadata
        curr = self.settings['currency']
        cust = credit_note.customer
        cust_name = cust.name if cust else "N/A"
        cust_tax = credit_note.customer_tax_number or getattr(cust, 'tax_number', '') or 'N/A'
        cust_phone = getattr(cust, 'phone', '') or 'N/A'
        cust_email = getattr(cust, 'email', '') or 'N/A'
        cust_address = credit_note.billing_address or getattr(cust, 'address', '') or 'N/A'

        cn_date_str = credit_note.credit_note_date.strftime('%d/%m/%Y') if credit_note.credit_note_date else 'N/A'
        inv_ref = credit_note.invoice.invoice_number if credit_note.invoice else 'N/A'

        left_content = [
            Paragraph("<b>CREDITED TO</b>", self.styles['MetaLabel']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>{cust_name}</b>", ParagraphStyle('CustTitle', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=self.COLOR_PRIMARY)),
            Paragraph(f"<b>VAT / Tax ID:</b> {cust_tax}", self.styles['MetaValue']),
            Paragraph(f"<b>Address:</b> {cust_address}", self.styles['MetaValue']),
            Paragraph(f"<b>Phone:</b> {cust_phone} | <b>Email:</b> {cust_email}", self.styles['MetaValue']),
        ]

        right_content = [
            Paragraph(f"<b>Credit Date:</b> {cn_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Credit Reason:</b> <b>{credit_note.credit_reason}</b>", self.styles['MetaValue']),
            Paragraph(f"<b>Against Invoice:</b> {inv_ref}", self.styles['MetaValue']),
            Paragraph(f"<b>Reference / PO:</b> {credit_note.reference_number or 'N/A'}", self.styles['MetaValue']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>Status:</b> <b>{credit_note.status.upper()}</b>", self.styles['MetaValue']),
        ]

        meta_table = Table([[left_content, right_content]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Items
        items = list(credit_note.items.all())
        headers = [
            Paragraph("<b>#</b>", self.styles['TableHeader']),
            Paragraph("<b>DESCRIPTION</b>", self.styles['TableHeader']),
            Paragraph("<b>QTY</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>UNIT</b>", self.styles['TableHeader']),
            Paragraph(f"<b>RATE ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>DISC %</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>VAT %</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>VAT ({curr})</b>", self.styles['TableHeaderRight']),
            Paragraph(f"<b>CREDIT ({curr})</b>", self.styles['TableHeaderRight']),
        ]
        table_rows = [headers]

        for idx, itm in enumerate(items, 1):
            table_rows.append([
                Paragraph(str(idx), self.styles['TableCell']),
                Paragraph(str(itm.description), self.styles['TableCell']),
                Paragraph(f"{float(itm.quantity):,.2f}", self.styles['TableCellRight']),
                Paragraph(str(itm.unit or 'Unit'), self.styles['TableCell']),
                Paragraph(f"{float(itm.unit_price):,.2f}", self.styles['TableCellRight']),
                Paragraph(f"{float(itm.discount_rate):,.1f}%" if float(itm.discount_rate) > 0 else "-", self.styles['TableCellRight']),
                Paragraph(f"{float(itm.tax_rate):,.1f}%", self.styles['TableCellRight']),
                Paragraph(f"{float(itm.tax_amount):,.2f}", self.styles['TableCellRight']),
                Paragraph(f"<b>{float(itm.total):,.2f}</b>", self.styles['TableCellRight']),
            ])

        col_w = [
            doc_width * 0.05,
            doc_width * 0.35,
            doc_width * 0.07,
            doc_width * 0.07,
            doc_width * 0.11,
            doc_width * 0.07,
            doc_width * 0.07,
            doc_width * 0.09,
            doc_width * 0.12,
        ]
        items_table = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#991b1b')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        items_table.setStyle(TableStyle(t_styles))
        elements.append(items_table)
        elements.append(Spacer(1, 4 * mm))

        # 5. Bottom
        notes_info = []
        if credit_note.notes:
            notes_info.append(Paragraph(f"<b>Notes:</b> {credit_note.notes}", self.styles['TableCell']))
        if credit_note.terms_conditions:
            notes_info.append(Paragraph(f"<b>Terms:</b> {credit_note.terms_conditions}", self.styles['TableCell']))

        totals_data = [
            [Paragraph("Credit Subtotal:", self.styles['TableCell']), Paragraph(f"{float(credit_note.subtotal):,.2f} {curr}", self.styles['TableCellRight'])],
            [Paragraph(f"VAT ({float(credit_note.tax_rate):,.1f}%):", self.styles['TableCell']), Paragraph(f"{float(credit_note.tax_amount):,.2f} {curr}", self.styles['TableCellRight'])],
            [Paragraph("<b>Total Credit Value:</b>", ParagraphStyle('CNTotBold', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#991b1b'))), Paragraph(f"<b>{float(credit_note.total_amount):,.2f} {curr}</b>", ParagraphStyle('CNTotBoldR', fontName='Helvetica-Bold', fontSize=9.5, alignment=2, textColor=colors.HexColor('#991b1b')))],
        ]
        totals_table = Table(totals_data, colWidths=[doc_width * 0.22, doc_width * 0.20])
        totals_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('LINEBELOW', (0, -2), (-1, -2), 1, colors.HexColor('#991b1b')),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))

        bottom_table = Table([[notes_info, totals_table]], colWidths=[doc_width * 0.56, doc_width * 0.44])
        bottom_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(bottom_table)

        # 6. Signatures
        elements.append(Spacer(1, 6 * mm))
        elements.append(self.build_signatures_flowable(doc_width))

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_delivery_note_pdf(self, delivery_note):
        """
        Generates an official publication-grade Delivery Note / Goods Dispatch PDF.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm
        )
        doc_width = A4[0] - (28 * mm)
        elements = []

        # 1. Header
        elements.extend(self.build_header_flowable(doc_width))
        elements.append(Spacer(1, 3 * mm))

        # 2. Banner
        banner_data = [
            [
                Paragraph("<b>DELIVERY NOTE</b>", self.styles['DocTitle']),
                Paragraph(f"<b>DELIVERY NO:</b> {delivery_note.delivery_note_number}", self.styles['DocSubTitle'])
            ]
        ]
        banner_table = Table(banner_data, colWidths=[doc_width * 0.6, doc_width * 0.4])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0d9488')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6.5),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 4 * mm))

        # 3. Delivery & Dispatch Details
        cust = delivery_note.customer
        cust_name = cust.name if cust else "N/A"
        deliv_addr = delivery_note.delivery_address or getattr(cust, 'address', '') or 'N/A'
        del_date_str = delivery_note.delivery_date.strftime('%d/%m/%Y') if delivery_note.delivery_date else 'N/A'
        disp_date_str = delivery_note.dispatch_date.strftime('%d/%m/%Y') if delivery_note.dispatch_date else del_date_str

        left_content = [
            Paragraph("<b>DELIVER TO / SHIP TO</b>", self.styles['MetaLabel']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>{cust_name}</b>", ParagraphStyle('CustTitle', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=self.COLOR_PRIMARY)),
            Paragraph(f"<b>Delivery Address:</b> {deliv_addr}", self.styles['MetaValue']),
            Paragraph(f"<b>Contact Person:</b> {delivery_note.receiver_name or getattr(cust, 'phone', 'N/A')} | <b>Phone:</b> {delivery_note.receiver_phone or 'N/A'}", self.styles['MetaValue']),
            Paragraph(f"<b>Customer PO #:</b> {delivery_note.customer_po_number or 'N/A'}", self.styles['MetaValue']),
        ]

        right_content = [
            Paragraph(f"<b>Delivery Date:</b> {del_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Dispatch Date:</b> {disp_date_str}", self.styles['MetaValue']),
            Paragraph(f"<b>Shipping Method:</b> {delivery_note.shipping_method or 'Standard Courier/Truck'}", self.styles['MetaValue']),
            Paragraph(f"<b>Driver / Carrier:</b> {delivery_note.driver_name or 'N/A'} ({delivery_note.driver_phone or 'N/A'})", self.styles['MetaValue']),
            Paragraph(f"<b>Vehicle #:</b> {delivery_note.vehicle_number or 'N/A'} | <b>Tracking #:</b> {delivery_note.tracking_number or 'N/A'}", self.styles['MetaValue']),
            Paragraph(f"<b>Total Packages:</b> <b>{delivery_note.total_packages}</b>", self.styles['MetaValue']),
            Spacer(1, 1.5 * mm),
            Paragraph(f"<b>Status:</b> <b>{delivery_note.status.upper()}</b>", self.styles['MetaValue']),
        ]

        meta_table = Table([[left_content, right_content]], colWidths=[doc_width * 0.55, doc_width * 0.45])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 5.5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 4 * mm))

        # 4. Items Table
        items = list(delivery_note.items.all())
        headers = [
            Paragraph("<b>#</b>", self.styles['TableHeader']),
            Paragraph("<b>ITEM / DESCRIPTION</b>", self.styles['TableHeader']),
            Paragraph("<b>QTY</b>", self.styles['TableHeaderRight']),
            Paragraph("<b>UNIT</b>", self.styles['TableHeader']),
            Paragraph("<b>PACKAGES</b>", self.styles['TableHeader']),
            Paragraph("<b>REMARKS / CONDITION</b>", self.styles['TableHeader']),
        ]
        col_w = [
            doc_width * 0.06,
            doc_width * 0.42,
            doc_width * 0.10,
            doc_width * 0.10,
            doc_width * 0.14,
            doc_width * 0.18,
        ]

        table_rows = [headers]
        for idx, itm in enumerate(items, 1):
            pkg_str = f"{itm.packages_count} {itm.package_type}".strip() if (itm.packages_count or itm.package_type) else "-"
            table_rows.append([
                Paragraph(str(idx), self.styles['TableCell']),
                Paragraph(str(itm.description), self.styles['TableCell']),
                Paragraph(f"{float(itm.quantity):,.2f}", self.styles['TableCellRight']),
                Paragraph(str(itm.unit or 'Unit'), self.styles['TableCell']),
                Paragraph(pkg_str, self.styles['TableCell']),
                Paragraph(str(itm.remarks or 'Good condition'), self.styles['TableCell']),
            ])

        items_table = Table(table_rows, colWidths=col_w, repeatRows=1)
        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, self.COLOR_BORDER),
            ('PADDING', (0, 0), (-1, -1), 3.5),
        ]
        for i in range(1, len(table_rows)):
            bg = self.COLOR_WHITE if i % 2 == 1 else self.COLOR_ROW_ALT
            t_styles.append(('BACKGROUND', (0, i), (-1, i), bg))
            t_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, self.COLOR_BORDER))
        items_table.setStyle(TableStyle(t_styles))
        elements.append(items_table)
        elements.append(Spacer(1, 5 * mm))

        # 5. Customer Receipt & Acknowledgment Box
        ack_data = [
            [
                Paragraph("<b>ACKNOWLEDGMENT OF RECEIPT</b>", ParagraphStyle('AckH', fontName='Helvetica-Bold', fontSize=9, textColor=self.COLOR_PRIMARY)),
                Paragraph("<b>DISPATCH / CARRIER INFO</b>", ParagraphStyle('AckH2', fontName='Helvetica-Bold', fontSize=9, textColor=self.COLOR_PRIMARY))
            ],
            [
                [
                    Paragraph("Received the above goods in full quantity and good condition without any damages.", self.styles['TableCell']),
                    Spacer(1, 4 * mm),
                    Paragraph("<b>Received By (Print Name):</b> ___________________________", self.styles['TableCell']),
                    Spacer(1, 2 * mm),
                    Paragraph("<b>Signature:</b> ____________________   <b>Date:</b> ______________", self.styles['TableCell']),
                    Spacer(1, 2 * mm),
                    Paragraph("<b>Company Stamp / Seal:</b> [                         ]", self.styles['TableCell']),
                ],
                [
                    Paragraph(f"<b>Driver Name:</b> {delivery_note.driver_name or 'N/A'}", self.styles['TableCell']),
                    Paragraph(f"<b>Vehicle Reg:</b> {delivery_note.vehicle_number or 'N/A'}", self.styles['TableCell']),
                    Paragraph(f"<b>Total Packages Delivered:</b> {delivery_note.total_packages}", self.styles['TableCell']),
                    Spacer(1, 4 * mm),
                    Paragraph("<b>Driver Signature:</b> ___________________________", self.styles['TableCell']),
                ]
            ]
        ]
        ack_table = Table(ack_data, colWidths=[doc_width * 0.60, doc_width * 0.40])
        ack_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLOR_ROW_ALT),
            ('BOX', (0, 0), (-1, -1), 0.75, self.COLOR_BORDER),
            ('LINEBELOW', (0, 0), (-1, 0), 1, self.COLOR_PRIMARY),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(ack_table)

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def _build_enquiry_attachment_flowable(self, enquiry, max_width=65 * mm, max_height=36 * mm):
        """
        Renders attached reference files (PNG, JPEG, WebP, PDF) as an embedded visual thumbnail
        with file metadata underneath, matching the Arab Season Job Log design standard.
        """
        att = getattr(enquiry, 'attachment', None)
        if not att:
            return None

        try:
            raw_bytes = None
            is_pdf = False
            att_type = getattr(enquiry, 'attachment_type', '') or ''
            att_name = getattr(enquiry, 'attachment_name', '') or 'Reference File'

            if str(att).startswith('data:'):
                header, b64 = att.split(',', 1)
                raw_bytes = base64.b64decode(b64)
                if 'application/pdf' in header.lower() or 'pdf' in att_type.lower():
                    is_pdf = True
            elif os.path.exists(str(att)):
                with open(str(att), 'rb') as f:
                    raw_bytes = f.read()
                if str(att).lower().endswith('.pdf') or 'pdf' in att_type.lower():
                    is_pdf = True

            if not raw_bytes:
                return None

            pil_img = None
            pdf_sublabel = ''

            if is_pdf:
                try:
                    import pymupdf
                    doc = pymupdf.open(stream=raw_bytes, filetype='pdf')
                    if len(doc) > 0:
                        page = doc.load_page(0)
                        pix = page.get_pixmap(dpi=140)
                        png_bytes = pix.tobytes('png')
                        from PIL import Image as PILImage
                        pil_img = PILImage.open(io.BytesIO(png_bytes))
                        pdf_sublabel = f" (Page 1 of {len(doc)})"
                except Exception:
                    pil_img = None
            else:
                try:
                    from PIL import Image as PILImage
                    pil_img = PILImage.open(io.BytesIO(raw_bytes))
                except Exception:
                    pil_img = None

            if not pil_img:
                # Fallback info card if image decoding is unsupported
                return Table([
                    [Paragraph(f"<b>Attached File:</b> {att_name} ({att_type or 'Document'})", ParagraphStyle('AttFb', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#475569')))]
                ], colWidths=[max_width], style=[('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')), ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')), ('PADDING', (0, 0), (-1, -1), 4)])

            orig_w, orig_h = pil_img.size
            scale = min(max_width / orig_w, max_height / orig_h)
            disp_w = orig_w * scale
            disp_h = orig_h * scale

            from PIL import Image as PILImage
            if pil_img.mode in ('RGBA', 'LA', 'P'):
                bg = PILImage.new('RGB', pil_img.size, (255, 255, 255))
                if pil_img.mode == 'P':
                    pil_img = pil_img.convert('RGBA')
                bg.paste(pil_img, mask=pil_img.split()[-1])
                pil_img = bg
            elif pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')

            out_io = io.BytesIO()
            pil_img.save(out_io, format='JPEG', quality=88)
            out_io.seek(0)
            rl_img = Image(out_io, width=disp_w, height=disp_h)

            sub_text = f"{att_name}{pdf_sublabel} • {orig_w}×{orig_h}px"
            lbl_p = Paragraph(f"<font color='#64748b' size='6.5'>{sub_text}</font>", ParagraphStyle('AttMeta', fontName='Helvetica', fontSize=6.5, leading=8.5, alignment=1))

            box_w = max(disp_w + 4 * mm, 60 * mm)
            att_box = Table([[rl_img], [Spacer(1, 0.5 * mm)], [lbl_p]], colWidths=[box_w])
            att_box.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('PADDING', (0, 0), (-1, -1), 3),
            ]))
            return att_box
        except Exception:
            return None

    def generate_enquiry_pdf(self, enquiry):
        """
        Generates an elegant, highly understandable Enquiry Details & Timeline PDF.
        Features:
        1. Explicitly labeled customer fields (Client Name:, Phone No:, Estimated Amount:, Lead Status:, etc.)
        2. Clean outer border framing the entire document.
        3. Visual preview of attached reference files (PNG, JPEG, WebP, PDF) matching Daily Job Log style.
        4. Step-by-step follow-up timeline history.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=12 * mm,
            rightMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm
        )
        doc_width = A4[0] - (24 * mm)
        elements = []

        # 1. Corporate Header (Logo only - internal document, contact details hidden)
        elements.extend(self.build_header_flowable(doc_width, show_contact_details=False))
        elements.append(Spacer(1, 2.5 * mm))

        # 2. Document Title Bar
        date_str = enquiry.date.strftime('%d/%m/%Y') if enquiry.date else 'N/A'
        title_style = ParagraphStyle('EnqTitle', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor('#0f172a'))
        date_style = ParagraphStyle('EnqDate', fontName='Helvetica', fontSize=8.5, leading=12, alignment=2, textColor=colors.HexColor('#64748b'))

        title_table = Table([
            [
                Paragraph(f"<b>ENQUIRY DETAILS</b>", title_style),
                Paragraph(f"Enquiry No: <b>{enquiry.enquiry_number}</b> &nbsp;|&nbsp; Date: <b>{date_str}</b>", date_style)
            ]
        ], colWidths=[doc_width * 0.55, doc_width * 0.45])
        title_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(title_table)
        elements.append(Spacer(1, 2 * mm))

        # 3. Explicitly Labeled Client & Lead Summary Grid (Requirement 1)
        cust = enquiry.customer
        cust_name = cust.name if cust else (enquiry.customer_name or "Walk-in Prospect")
        phone_val = enquiry.phone or "—"
        email_val = enquiry.email or "—"
        curr = self.settings.get('currency', 'SAR')
        est_val_str = f"{curr} {enquiry.estimated_value:,.2f}" if enquiry.estimated_value else f"{curr} 0.00"
        status_name = enquiry.get_status_display() if hasattr(enquiry, 'get_status_display') else enquiry.status
        channel_name = enquiry.get_channel_display() if hasattr(enquiry, 'get_channel_display') else enquiry.channel
        salesperson_name = enquiry.salesperson.name if enquiry.salesperson else (enquiry.salesperson_name or 'Unassigned')
        work_title = enquiry.title or "General Requirement"

        status_color = '#1d4ed8' if enquiry.status == 'under_followup' else ('#15803d' if enquiry.status == 'converted' else ('#b91c1c' if enquiry.status == 'cancelled' else '#475569'))

        cell_style = ParagraphStyle('EnqCell', fontName='Helvetica', fontSize=8.2, leading=11, textColor=colors.HexColor('#0f172a'))

        col_w = doc_width / 2.0
        meta_rows = [
            [
                Paragraph(f"<font color='#64748b'><b>Client Name:</b></font> &nbsp; <b>{cust_name}</b>", cell_style),
                Paragraph(f"<font color='#64748b'><b>Estimated Amount:</b></font> &nbsp; <font color='#0f172a' size='9'><b>{est_val_str}</b></font>", cell_style),
            ],
            [
                Paragraph(f"<font color='#64748b'><b>Phone No:</b></font> &nbsp; <b>{phone_val}</b>", cell_style),
                Paragraph(f"<font color='#64748b'><b>Lead Status:</b></font> &nbsp; <font color='{status_color}'><b>● {status_name}</b></font>", cell_style),
            ],
            [
                Paragraph(f"<font color='#64748b'><b>Project:</b></font> &nbsp; <b>{work_title}</b>", cell_style),
                Paragraph(f"<font color='#64748b'><b>Source:</b></font> &nbsp; <b>{channel_name}</b>", cell_style),
            ],
            [
                Paragraph(f"<font color='#64748b'><b>Email Address:</b></font> &nbsp; {email_val}", cell_style),
                Paragraph(f"<font color='#64748b'><b>Salesperson:</b></font> &nbsp; <b>{salesperson_name}</b>", cell_style),
            ]
        ]

        summary_card = Table(meta_rows, colWidths=[col_w, col_w])
        summary_card.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 4.5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(summary_card)
        elements.append(Spacer(1, 3 * mm))

        # 4. Requirements & Attachment Section (Compact Thumbnail Preview)
        has_desc = bool(enquiry.description and enquiry.description.strip())
        att_flowable = self._build_enquiry_attachment_flowable(enquiry, max_width=65 * mm, max_height=36 * mm)

        if has_desc or att_flowable:
            if has_desc and att_flowable:
                clean_desc = enquiry.description.replace('\n', '<br/>')
                desc_p = Paragraph(f"<b>Requirements / Specifications:</b><br/>{clean_desc}", ParagraphStyle('Desc', fontName='Helvetica', fontSize=8.2, leading=11.5, textColor=colors.HexColor('#334155')))
                right_w = 70 * mm
                left_w = doc_width - right_w
                desc_table = Table([[desc_p, att_flowable]], colWidths=[left_w, right_w])
                desc_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
                    ('BOX', (0, 0), (-1, -1), 0.65, colors.HexColor('#cbd5e1')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                    ('PADDING', (0, 0), (-1, -1), 5),
                ]))
            elif has_desc:
                clean_desc = enquiry.description.replace('\n', '<br/>')
                desc_p = Paragraph(f"<b>Requirements / Specifications:</b><br/>{clean_desc}", ParagraphStyle('Desc', fontName='Helvetica', fontSize=8.2, leading=11.5, textColor=colors.HexColor('#334155')))
                desc_table = Table([[desc_p]], colWidths=[doc_width])
                desc_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
                    ('BOX', (0, 0), (-1, -1), 0.65, colors.HexColor('#cbd5e1')),
                    ('PADDING', (0, 0), (-1, -1), 5),
                ]))
            else:
                desc_table = Table([
                    [Paragraph("<b>Requirements / Reference Attachment:</b>", ParagraphStyle('DescH', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#0f172a')))],
                    [Spacer(1, 1 * mm)],
                    [att_flowable]
                ], colWidths=[doc_width])
                desc_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
                    ('BOX', (0, 0), (-1, -1), 0.65, colors.HexColor('#cbd5e1')),
                    ('PADDING', (0, 0), (-1, -1), 5),
                ]))
            elements.append(desc_table)
            elements.append(Spacer(1, 3 * mm))

        # 5. Timeline & Follow-up History (Clean, easy-to-read chronological list)
        elements.append(Paragraph("<b>Timeline & Call History</b>", ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=colors.HexColor('#0f172a'))))
        elements.append(Spacer(1, 1.5 * mm))

        timeline_rows = []
        creator_name = enquiry.created_by.username if enquiry.created_by else "admin"
        step1_content = [
            Table([
                [
                    Paragraph("<b>Enquiry Received</b>", ParagraphStyle('OTitle1', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor('#0f172a'))),
                    Paragraph(date_str, ParagraphStyle('ODate1', fontName='Helvetica', fontSize=7.8, alignment=2, textColor=colors.HexColor('#64748b')))
                ]
            ], colWidths=[(doc_width - 11 * mm) * 0.7, (doc_width - 11 * mm) * 0.3], style=[('PADDING', (0, 0), (-1, -1), 0)]),
            Spacer(1, 0.5 * mm),
            Paragraph(f"Received via <b>{channel_name}</b> • Logged by {creator_name}", ParagraphStyle('OSub1', fontName='Helvetica', fontSize=7.8, textColor=colors.HexColor('#64748b')))
        ]
        timeline_rows.append(['', step1_content])

        step_idx = 2
        for fu in enquiry.follow_ups.all().order_by('id'):
            fu_date_str = fu.date.strftime('%d/%m/%Y, %I:%M %p') if fu.date else 'N/A'
            fu_outcome = fu.get_outcome_display() if hasattr(fu, 'get_outcome_display') else fu.outcome
            fu_mode = fu.get_contact_mode_display() if hasattr(fu, 'get_contact_mode_display') else fu.contact_mode

            fu_content = [
                Table([
                    [
                        Paragraph(f"<b>Via {fu_mode}:</b> <font color='#0284c7'><b>{fu_outcome}</b></font>", ParagraphStyle(f'OTitle{step_idx}', fontName='Helvetica', fontSize=8.2, textColor=colors.HexColor('#0f172a'))),
                        Paragraph(fu_date_str, ParagraphStyle(f'ODate{step_idx}', fontName='Helvetica', fontSize=7.8, alignment=2, textColor=colors.HexColor('#64748b')))
                    ]
                ], colWidths=[(doc_width - 11 * mm) * 0.7, (doc_width - 11 * mm) * 0.3], style=[('PADDING', (0, 0), (-1, -1), 0)]),
            ]
            if fu.notes and fu.notes.strip():
                fu_content.extend([
                    Spacer(1, 0.5 * mm),
                    Paragraph(f"<b>Notes:</b> {fu.notes}", ParagraphStyle(f'ONotes{step_idx}', fontName='Helvetica', fontSize=7.8, textColor=colors.HexColor('#334155')))
                ])
            if fu.next_follow_up_date:
                fu_content.extend([
                    Spacer(1, 0.5 * mm),
                    Paragraph(f"<font color='#d97706'><b>Next Scheduled:</b> {fu.next_follow_up_date.strftime('%d/%m/%Y')}</font>", ParagraphStyle(f'ONext{step_idx}', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#d97706')))
                ])
            timeline_rows.append(['', fu_content])
            step_idx += 1

        tl_table = TimelineTable(timeline_rows, colWidths=[9 * mm, doc_width - 9 * mm])
        tl_style = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
        ]
        for i in range(len(timeline_rows)):
            tl_style.append(('LINEBELOW', (1, i), (1, i), 0.5, colors.HexColor('#f1f5f9')))
        tl_table.setStyle(TableStyle(tl_style))
        elements.append(tl_table)

        def canvas_maker(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.company_name = self.settings['company_name']
            c.draw_outer_border = True
            c.outer_border_margin = 6 * mm
            return c

        doc.build(elements, canvasmaker=canvas_maker)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes



# Singleton instance for simple importing
universal_pdf_generator = UniversalPDFGenerator()


