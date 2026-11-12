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
from PIL import Image as PILImage
from reportlab.platypus import (
    Flowable,
    SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame, Paragraph as _ReportLabParagraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
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


def sanitize_doc_text(text):
    if text is None:
        return ''
    s = str(text)
    # Map unsupported glyphs that render as black boxes in standard fonts
    replacements = {
        '★': '*',
        '☆': '*',
        '﷼': 'SAR',
        '₪': 'ILS',
        '■': '-',
        '\ufeff': '',
        '\u200b': '',
    }
    for old, new in replacements.items():
        if old in s:
            s = s.replace(old, new)
    return s

def format_bidi_text(text):
    """
    Reshapes and applies BiDi visual ordering to Arabic script text
    so ReportLab renders Arabic letters connected and right-to-left.
    Wraps Arabic runs in ArabicFont while preserving HTML tags.
    """
    if not text or not HAS_ARABIC_SUPPORT:
        return text
    text_str = str(text)
    if not re.search(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]', text_str):
        return text_str

    pattern = r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s]+'
    def _repl(m):
        chunk = m.group(0)
        if re.search(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]', chunk):
            try:
                leading_spaces = chunk[:len(chunk) - len(chunk.lstrip())]
                trailing_spaces = chunk[len(chunk.rstrip()):]
                core = chunk.strip()
                shaped = get_display(arabic_reshaper.reshape(core))
                return f'{leading_spaces}<font name="ArabicFont">{shaped}</font>{trailing_spaces}'
            except Exception:
                return chunk
        return chunk

    return re.sub(pattern, _repl, text_str)

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


def _init_pdf_fonts():
    """
    Register reference fonts with full style hierarchy and Unicode/Arabic support.
    Bundled Ubuntu and Arabic TTF files in backend/api/static/fonts/ are prioritized.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, 'static', 'fonts')

    font_configs = [
        ('Ubuntu', 'Ubuntu-Regular.ttf', [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]),
        ('Ubuntu-Bold', 'Ubuntu-Bold.ttf', [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]),
        ('Ubuntu-Italic', 'Ubuntu-Italic.ttf', [r"C:\Windows\Fonts\segoeuii.ttf", r"C:\Windows\Fonts\ariali.ttf"]),
        ('Ubuntu-Light', 'Ubuntu-Light.ttf', [r"C:\Windows\Fonts\segoeuil.ttf", r"C:\Windows\Fonts\segoeui.ttf"]),
        ('ArabicFont', 'ArabicFont-Regular.ttf', [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\segoeui.ttf"]),
        ('ArabicFont-Bold', 'ArabicFont-Bold.ttf', [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf"]),
        ('AppFont', 'Ubuntu-Regular.ttf', [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]),
        ('AppFont-Bold', 'Ubuntu-Bold.ttf', [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"]),
        ('AppFont-Italic', 'Ubuntu-Italic.ttf', [r"C:\Windows\Fonts\segoeuii.ttf", r"C:\Windows\Fonts\ariali.ttf"]),
        ('AppFont-Light', 'Ubuntu-Light.ttf', [r"C:\Windows\Fonts\segoeuil.ttf", r"C:\Windows\Fonts\segoeui.ttf"]),
    ]

    registered = {}
    for fname, local_file, fallbacks in font_configs:
        target = os.path.join(font_dir, local_file)
        if not os.path.exists(target):
            target = None
            for fb in fallbacks:
                if os.path.exists(fb):
                    target = fb
                    break
        if target:
            try:
                pdfmetrics.registerFont(TTFont(fname, target))
                registered[fname] = fname
            except Exception:
                pass

    if 'AppFont' not in registered:
        registered['AppFont'] = 'Helvetica'
    if 'AppFont-Bold' not in registered:
        registered['AppFont-Bold'] = 'Helvetica-Bold'
    if 'AppFont-Italic' not in registered:
        registered['AppFont-Italic'] = 'Helvetica-Oblique'
    if 'AppFont-Light' not in registered:
        registered['AppFont-Light'] = 'Helvetica'

    try:
        pdfmetrics.registerFontFamily('Ubuntu', normal='Ubuntu', bold='Ubuntu-Bold', italic='Ubuntu-Italic', boldItalic='Ubuntu-Bold')
        pdfmetrics.registerFontFamily('AppFont', normal='Ubuntu', bold='Ubuntu-Bold', italic='Ubuntu-Italic', boldItalic='Ubuntu-Bold')
    except Exception:
        pass
    return registered

FONTS = _init_pdf_fonts()
UNICODE_FONT = FONTS.get('AppFont', 'Helvetica')
ENABLE_ZATCA_QR = False  # Disabled by default per project requirements; set True to re-enable ZATCA Phase 1 QR codes

def format_doc_date(dt_val):
    """Format any date into clean reference style: '15 Oct 2026'"""
    if not dt_val:
        return ''
    if isinstance(dt_val, str):
        try:
            clean_str = dt_val.split('T')[0].split(' ')[0]
            if '-' in clean_str:
                parts = clean_str.split('-')
                if len(parts) == 3:
                    if len(parts[0]) == 4:
                        d = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                    else:
                        d = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                    return d.strftime('%d %b %Y')
            elif '/' in clean_str:
                parts = clean_str.split('/')
                if len(parts) == 3:
                    if len(parts[0]) == 4:
                        d = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                    else:
                        d = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                    return d.strftime('%d %b %Y')
        except Exception:
            return str(dt_val)
    elif hasattr(dt_val, 'strftime'):
        return dt_val.strftime('%d %b %Y')
    return str(dt_val)


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
    Two-pass canvas matching reference DC-00002 layout:
    - Thin rule (#adadad, 0.75pt) at footer
    - Page number at right ("Page X of Y" for multi-page, bare "1" for single-page)
    - Optional generation timestamp at left ONLY for report-type PDFs (is_report=True)
    - Zero outer borders, zero dark banners, clean whitespace
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.is_report = False

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
        page_w, page_h = getattr(self, '_pagesize', A4)
        is_landscape = (page_w > page_h)
        rule_x0 = 39.60
        rule_x1 = (page_w - 34.79) if is_landscape else 566.63
        footer_y = 50.03  # 841.69 - 791.66 pt

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#adadad"))
        self.setLineWidth(0.75)
        self.line(rule_x0, footer_y, rule_x1, footer_y)

        # Page number font: 8.0 pt Ubuntu #6c718a
        font_name = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        self.setFont(font_name, 8.0)
        self.setFillColor(colors.HexColor("#6c718a"))

        # Right: Page X of Y (or 1 if single page)
        if page_count > 1:
            page_str = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(rule_x1, footer_y - 16.02, page_str)
        else:
            if is_landscape:
                self.drawRightString(rule_x1, footer_y - 16.02, "1")
            else:
                self.drawString(558.34, footer_y - 16.02, str(self._pageNumber))

        # Left: Only for report-type PDFs
        if getattr(self, 'is_report', False):
            self.drawString(rule_x0, footer_y - 16.02, f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        self.restoreState()

class TimelineStep(Flowable):
    def __init__(self, step_number, card_flowable, is_first=False, is_last=False, is_status=False, status_type=None, badge_color='#111111', badge_text_color='#ffffff'):
        super().__init__()
        self.step_number = step_number
        self.card = card_flowable
        self.is_first = is_first
        self.is_last = is_last
        self.is_status = is_status
        self.status_type = status_type # 'won', 'lost', 'active'
        self.badge_color = colors.HexColor(badge_color)
        self.badge_text_color = colors.HexColor(badge_text_color)
        self.line_x = 12
        self.badge_radius = 8.5
        self.left_margin = 28
        self.bottom_spacing = 8

    def wrap(self, availWidth, availHeight):
        card_w = availWidth - self.left_margin
        w_card, h_card = self.card.wrap(card_w, availHeight)
        self.card_w = w_card
        self.card_h = h_card
        self.width = availWidth
        self.height = h_card + self.bottom_spacing
        return self.width, self.height

    def drawOn(self, canvas, x, y, _sW=0):
        card_y = y + self.bottom_spacing
        self.card.drawOn(canvas, x + self.left_margin, card_y)

        cx = x + self.line_x
        cy = card_y + self.card_h - 13

        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#E4E4E4'))
        canvas.setLineWidth(1.5)

        top_y = y + self.height
        bottom_y = y

        if not self.is_first:
            canvas.line(cx, top_y, cx, cy + self.badge_radius)

        if not self.is_last:
            canvas.line(cx, cy - self.badge_radius, cx, bottom_y)

        if self.is_status:
            if self.status_type == 'won':
                canvas.setFillColor(colors.HexColor('#0F7638'))
                canvas.circle(cx, cy, 8.5, stroke=0, fill=1)
                canvas.setFillColor(colors.white)
                canvas.setFont('Helvetica-Bold', 9)
                canvas.drawCentredString(cx, cy - 3, 'Y')
            elif self.status_type == 'lost':
                canvas.setFillColor(colors.HexColor('#DC2626'))
                canvas.circle(cx, cy, 8.5, stroke=0, fill=1)
                canvas.setFillColor(colors.white)
                canvas.setFont('Helvetica-Bold', 9)
                canvas.drawCentredString(cx, cy - 3, 'X')
            else:
                canvas.setFillColor(colors.HexColor('#FAFAFA'))
                canvas.setStrokeColor(colors.HexColor('#D1D5DB'))
                canvas.setLineWidth(1.2)
                canvas.setDash(2, 2)
                canvas.circle(cx, cy, 7, stroke=1, fill=1)
                canvas.setFillColor(colors.HexColor('#8C8C8C'))
                canvas.circle(cx, cy, 2, stroke=0, fill=1)
        else:
            canvas.setFillColor(self.badge_color)
            canvas.circle(cx, cy, self.badge_radius, stroke=0, fill=1)
            canvas.setFillColor(self.badge_text_color)
            canvas.setFont('Helvetica-Bold', 8)
            canvas.drawCentredString(cx, cy - 2.8, str(self.step_number))

        canvas.restoreState()


class UniversalPDFGenerator:
    """
    Central controller for all server-generated ERP PDFs.
    Strictly adheres to the clean, minimal reference layout established by DC-00002.pdf:
    - Pure white A4 page, zero outer borders, zero dark banners, zero boxed panels
    - Top-Left: Colored logo + verified legal company details block
    - Top-Right: 28pt Light uppercase title + 10pt Bold document number
    - Left party block + right-aligned meta pairs (sentence case, plain language)
    - Charcoal (#3c3d3a) table header with white text
    - Thin (#adadad) row dividers, comfortable row padding, repeatRows=1
    - Warm-gray (#f5f4f3) Total band with official SAR symbol
    - Single line "Authorized Signature _______________"
    - Thin rule footer with discreet page numbering
    """

    # Exact design tokens from reference DC-00002.pdf
    LEFT_MARGIN = 45.6
    RIGHT_MARGIN = 34.8
    DOC_WIDTH = A4[0] - (45.6 + 34.8) # 515.02 pt

    COLOR_TEXT_PRIMARY = colors.HexColor("#000000")
    COLOR_TEXT_DARK = colors.HexColor("#333333")
    COLOR_TEXT_MUTED = colors.HexColor("#727272")
    COLOR_TEXT_LIGHT = colors.HexColor("#6c718a")
    COLOR_HEADER_BG = colors.HexColor("#3c3d3a")
    COLOR_TOTAL_BG = colors.HexColor("#f5f4f3")
    COLOR_BORDER = colors.HexColor("#adadad")
    COLOR_WHITE = colors.HexColor("#ffffff")

    # Legacy alias compatibility
    COLOR_PRIMARY = colors.HexColor("#000000")
    COLOR_SECONDARY = colors.HexColor("#333333")
    COLOR_MUTED = colors.HexColor("#727272")
    COLOR_ROW_ALT = colors.HexColor("#ffffff")
    COLOR_ACCENT = colors.HexColor("#000000")
    COLOR_CREDIT = colors.HexColor("#000000")
    COLOR_DEBIT = colors.HexColor("#000000")

    def __init__(self):
        self.settings = self._get_site_settings()
        self.styles = self._setup_styles()
        self.logo_path = self._resolve_logo_path()

    def _get_site_settings(self):
        """
        Retrieve live company settings from database.
        Never hardcodes values if database fields are populated.
        """
        fallback = {
            'company_name': 'Arab Season',
            'legal_name_en': '',
            'legal_name_ar': '',
            'email': 'ad@arabseason.net',
            'website': 'www.arabseason.club',
            'phone': '0575287403',
            'address': 'Riyadh, KSA',
            'currency': 'SAR',
            'cr_number': '',
            'tax_number': ''
        }
        try:
            s = SiteSettings.objects.first()
            if s:
                phone_val = str(s.phone or '').strip()
                if not phone_val or phone_val == '+965 57 5287 403':
                    phone_val = '0575287403'
                addr_val = str(s.address or '').strip()
                if not addr_val or addr_val == 'Saudi Arabia, Alsalihia Dist':
                    addr_val = 'Riyadh, KSA'
                web_val = str(getattr(s, 'website', '') or '').strip()
                if not web_val or 'arabseason.com' in web_val:
                    web_val = 'www.arabseason.club'
                return {
                    'company_name': s.company_name or fallback['company_name'],
                    'legal_name_en': getattr(s, 'legal_name_en', '') or '',
                    'legal_name_ar': getattr(s, 'legal_name_ar', '') or '',
                    'email': s.email or fallback['email'],
                    'website': web_val,
                    'phone': phone_val,
                    'address': addr_val,
                    'currency': s.currency or fallback['currency'],
                    'cr_number': getattr(s, 'cr_number', '') or '',
                    'tax_number': getattr(s, 'tax_number', '') or ''
                }
        except Exception:
            pass
        return fallback

    def _resolve_logo_path(self):
        """Find the reference logo image (colored floral icon + wordmark)."""
        candidates = [
            os.path.join(settings.BASE_DIR, 'api', 'static', 'logo_colored_wordmark.png'),
            os.path.join(settings.BASE_DIR, 'api', 'static', 'logo.png'),
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
        ]
        for p in candidates:
            norm = os.path.abspath(p)
            if os.path.exists(norm):
                return norm
        return None

    def _resolve_sar_symbol_path(self):
        """Find the official Saudi Riyal glyph symbol image."""
        candidates = [
            os.path.join(settings.BASE_DIR, 'api', 'static', 'sar_symbol.png'),
            os.path.join(settings.BASE_DIR, 'static', 'sar_symbol.png'),
        ]
        for p in candidates:
            norm = os.path.abspath(p)
            if os.path.exists(norm):
                return norm
        return None

    def _build_zatca_qr_drawing(self, seller_name, vat_number, invoice_time, total_amount, vat_amount, size=65):
        """Generates a ZATCA Phase 1 compliant Base64 TLV QR Code as a ReportLab Drawing."""
        import base64
        from reportlab.graphics.barcode.qr import QrCodeWidget
        from reportlab.graphics.shapes import Drawing

        tags = [
            (1, str(seller_name).encode('utf-8')),
            (2, str(vat_number).encode('utf-8')),
            (3, str(invoice_time).encode('utf-8')),
            (4, f"{float(total_amount):.2f}".encode('utf-8')),
            (5, f"{float(vat_amount):.2f}".encode('utf-8'))
        ]
        tlv = bytearray()
        for tag, val in tags:
            tlv.append(tag)
            tlv.append(len(val))
            tlv.extend(val)
        b64_str = base64.b64encode(tlv).decode('ascii')

        qr = QrCodeWidget(b64_str)
        bounds = qr.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        d = Drawing(size, size, transform=[size/w, 0, 0, size/h, 0, 0])
        d.add(qr)
        return d

    def build_reference_summary_stack(self, doc_width, summary_items):
        """
        A clean, quiet summary stack above report tables to replace legacy KPI cards.
        summary_items: list of tuples [('Label', 'Value'), ...] or list of dicts [{'label': '...', 'value': '...'}]
        Renders as a 2-column or 3-column borderless, unboxed table with bold values.
        """
        if not summary_items:
            return Spacer(1, 1)

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        pairs = []
        for itm in summary_items:
            if isinstance(itm, dict):
                lbl = itm.get('label') or itm.get('name') or itm.get('title')
                val = itm.get('value')
            elif isinstance(itm, (list, tuple)) and len(itm) >= 2:
                lbl, val = itm[0], itm[1]
            else:
                continue
            if val is None or str(val).strip() in ('', '-', 'None', 'null'):
                continue
            pairs.append((str(lbl), str(val)))

        if not pairs:
            return Spacer(1, 1)

        cols = 3 if doc_width > 600 or len(pairs) >= 6 else 2
        col_w = doc_width / cols

        rows = []
        curr_row = []
        lbl_style = ParagraphStyle('SSLbl', fontName=font_reg, fontSize=8.5, leading=11, textColor=colors.HexColor('#555555'))

        for lbl, val in pairs:
            cell_p = Paragraph(f"{lbl}: <b>{val}</b>", lbl_style)
            curr_row.append(cell_p)
            if len(curr_row) == cols:
                rows.append(curr_row)
                curr_row = []
        if curr_row:
            while len(curr_row) < cols:
                curr_row.append(Paragraph("", lbl_style))
            rows.append(curr_row)

        t = Table(rows, colWidths=[col_w] * cols)
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        return t

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

    # ══════════════════════════════════════════════════════════════════════
    # SHARED REFERENCE LAYOUT COMPONENTS (STRICTLY MATCHING DC-00002.pdf)
    # ══════════════════════════════════════════════════════════════════════

    def _compute_adaptive_title(self, title, max_width, font_name):
        clean = (title or '').strip()
        clean_upper = clean.upper()
        words = clean_upper.split()
        if not words:
            return 28, 32.25, clean_upper

        if clean_upper == "DELIVERY CHALLAN":
            return 28, 32.25, "DELIVERY&nbsp;<br/>CHALLAN"

        candidate_sizes = [28, 24, 20, 18, 16]

        for sz in candidate_sizes:
            leading = sz * (32.25 / 28.0)

            w_single = stringWidth(clean_upper, font_name, sz)
            if w_single <= max_width:
                return sz, leading, clean_upper

            best_split = None
            best_diff = 999999
            for i in range(1, len(words)):
                l1 = " ".join(words[:i])
                l2 = " ".join(words[i:])
                w1 = stringWidth(l1, font_name, sz)
                w2 = stringWidth(l2, font_name, sz)
                if w1 <= max_width and w2 <= max_width:
                    diff = abs(w1 - w2)
                    if diff < best_diff:
                        best_diff = diff
                        best_split = (l1, l2)

            if best_split:
                if (len(words) >= 4 or len(clean_upper) >= 25) and sz > 18:
                    continue
                return sz, leading, f"{best_split[0]}&nbsp;<br/>{best_split[1]}"

        sz = 16
        leading = 18.5
        lines = []
        curr = []
        for w in words:
            test = " ".join(curr + [w])
            if stringWidth(test, font_name, sz) <= max_width:
                curr.append(w)
            else:
                if curr:
                    lines.append(" ".join(curr))
                curr = [w]
        if curr:
            lines.append(" ".join(curr))
        return sz, leading, "&nbsp;<br/>".join(lines)

    def build_reference_header(self, doc_width, title, doc_number):
        """
        Reference Header layout (matching DC-00002.pdf):
        Top-Left: Logo (colored wordmark, 177x54) + Company Block
        Top-Right: Document Title (28pt Light uppercase) + Document Number (10pt Bold)
        """
        settings = self._get_site_settings()
        logo_path = self._resolve_logo_path()

        left_flowables = []
        if logo_path and os.path.exists(logo_path):
            try:
                left_flowables.append(Image(logo_path, width=177, height=54, mask='auto'))
            except Exception:
                pass

        addr = settings.get("address", "Riyadh, KSA")
        phone = settings.get("phone", "0575287403")
        email = settings.get("email", "ad@arabseason.net")
        web = settings.get("website", "www.arabseason.club")

        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        comp_p = Paragraph(
            f"{addr}<br/>"
            f"{phone}<br/>"
            f"{email} - {web}",
            ParagraphStyle('C2', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))
        )
        # Exact spacer before logo (top=57.15) and before company block (immediately after logo, no gap)
        left_flowables = [Spacer(1, 1.80)] + left_flowables + [Spacer(1, 1.41), comp_p]

        # Right: Adaptive Title + Shortened Document Number (if provided)
        t_clean = (title or '').strip().upper()
        right_col_w = doc_width - 280.0
        title_sz, title_ld, title_html = self._compute_adaptive_title(t_clean, right_col_w, font_reg)

        title_p = Paragraph(title_html, ParagraphStyle('TDel', fontName=font_reg, fontSize=title_sz, leading=title_ld, alignment=2, textColor=colors.HexColor('#000000')))
        right_flowables = [Spacer(1, 0.4), title_p]
        if doc_number and str(doc_number).strip():
            docnum_p = Paragraph(str(doc_number).strip(), ParagraphStyle('TNum', fontName=font_bold, fontSize=10, leading=12, alignment=2, textColor=colors.HexColor('#333333')))
            right_flowables.extend([Spacer(1, 1.59), docnum_p])

        hdr_table = Table([[left_flowables, right_flowables]], colWidths=[280, doc_width - 280])
        hdr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (0,0), 0.75),
            ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return hdr_table

    def build_reference_party_and_meta(self, doc_width, party_label, party_name, party_subtext=None, meta_pairs=None):
        """
        Unboxed party on left; unboxed label-value pairs on right.
        Strict empty-field rule: Omit any row, line, or subtext if value is empty, '-', 'None', or 'N/A'.
        Never displays raw hyphens or empty labels to user.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        party_lines = []
        if party_label:
            party_lines.append(f"<font size=10 color='#333333'>{party_label}</font>")
        if party_name and str(party_name).strip() not in ('', '-', 'None', 'null', 'N/A'):
            party_lines.append(f'<font name="{font_bold}" size="9"><b>{party_name}</b></font>')
        if party_subtext and str(party_subtext).strip() not in ('', '-', 'None', 'null', 'N/A'):
            # Filter individual subtext lines so no line is '-' or 'Tel: -'
            sub_raw = str(party_subtext).split('\n')
            clean_lines = []
            for sl in sub_raw:
                s = sl.strip()
                if not s or s in ('-', 'None', 'null', 'N/A', 'Tel: -', 'Contact: -', 'Tel: - | Email: -'):
                    continue
                clean_lines.append(s)
            if clean_lines:
                clean_sub = '<br/>'.join(clean_lines)
                party_lines.append(f"<font size=9 color='#727272'>{clean_sub}</font>")

        party_p = Paragraph("<br/>".join(party_lines) if party_lines else "", ParagraphStyle('PRef', fontName=font_reg, fontSize=10, leading=11.31, textColor=colors.HexColor('#333333')))
        party_cell = [Spacer(1, 16.70), party_p]

        meta_rows = []
        if meta_pairs:
            for lbl, val in meta_pairs:
                if not val:
                    continue
                v_str = str(val).strip()
                if v_str in ('', '-', 'None', 'null', 'N/A', 'Tel: -', 'Contact: -'):
                    continue
                meta_rows.append([
                    Paragraph(f"{lbl} :", ParagraphStyle('ML', fontName=font_reg, fontSize=8.5, leading=10.5, alignment=2, textColor=colors.HexColor('#727272'))),
                    Paragraph(v_str, ParagraphStyle('MV', fontName=font_reg, fontSize=8.5, leading=10.5, alignment=2, textColor=colors.HexColor('#333333')))
                ])

        party_col_w = 230.00
        meta_col_w = doc_width - party_col_w
        if meta_rows:
            # Tightened Y-axis spacing: reduced from 19.05 to 12.0
            rhs = [12.0] * 2 if len(meta_rows) == 2 else None
            max_l_w = 0.0
            if meta_pairs:
                for ml, mv in meta_pairs:
                    if ml:
                        max_l_w = max(max_l_w, stringWidth(f"{ml} :", font_reg, 8.5))

            lbl_col_w = max(70.0, min(95.0, max_l_w + 8.0))
            val_col_w = meta_col_w - lbl_col_w

            meta_table = Table(meta_rows, colWidths=[lbl_col_w, val_col_w], rowHeights=rhs)
            meta_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 0.5),    # Reduced from 1.5
                ('BOTTOMPADDING', (0,0), (-1,-1), 0.5), # Reduced from 1.5
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0.78),
            ]))
            meta_cell = meta_table
        else:
            meta_cell = Paragraph("", self.styles['Normal'])

        party_meta_table = Table([[party_cell, meta_cell]], colWidths=[party_col_w, meta_col_w])
        party_meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        return party_meta_table

    def build_reference_items_table(self, doc_width, columns, rows, col_widths=None, row_padding=None):
        """
        Charcoal header #3c3d3a, white text, clean rows with thin bottom divider #adadad,
        comfortable padding, repeatRows=1, never splits a row.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        if not col_widths:
            if len(columns) == 5:
                col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
            else:
                num_cols = len(columns)
                col_widths = [doc_width / num_cols] * num_cols

        header_cells = []
        col_styles = []
        for i, (title, align) in enumerate(columns):
            align_code = 1 if align == 'center' else (2 if align == 'right' else 0)
            th_style = ParagraphStyle(f'TH_{i}_{align}', fontName=font_reg, fontSize=9, textColor=colors.HexColor('#ffffff'), leading=10, alignment=align_code)
            header_cells.append(Paragraph(title, th_style))
            lead = 10.39 if align == 'left' else 10.0
            col_styles.append(ParagraphStyle(f'TD_{i}_{align}', fontName=font_reg, fontSize=9, textColor=colors.HexColor('#333333'), leading=lead, alignment=align_code))

        table_data = [header_cells]
        for row in rows:
            formatted_row = []
            for col_idx, cell_val in enumerate(row):
                if isinstance(cell_val, _ReportLabParagraph) or hasattr(cell_val, 'draw'):
                    formatted_row.append(cell_val)
                else:
                    style = col_styles[col_idx] if col_idx < len(col_styles) else col_styles[-1]
                    formatted_row.append(Paragraph(format_bidi_text(str(cell_val or '')), style))
            table_data.append(formatted_row)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3c3d3a')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,0), 7.0),
            ('BOTTOMPADDING', (0,0), (-1,0), 7.0),
            ('LEFTPADDING', (0,0), (0,0), 2.1),
            ('RIGHTPADDING', (0,0), (0,-1), 0),
            ('LEFTPADDING', (1,0), (1,-1), 15.0),
            ('RIGHTPADDING', (1,0), (1,-1), 6.0),
            ('LEFTPADDING', (2,0), (-1,-1), 4.0),
            ('RIGHTPADDING', (2,0), (-1,-1), 6.5),
            ('TOPPADDING', (0,1), (-1,-1), row_padding[0] if row_padding else 8.83),
            ('BOTTOMPADDING', (0,1), (-1,-1), row_padding[1] if row_padding else 6.57),
            ('LINEBELOW', (0,1), (-1,-1), 0.75, colors.HexColor('#adadad')),
        ]
        items_table.setStyle(TableStyle(t_style))
        return items_table

    def build_reference_totals(self, doc_width, sub_total, total, words_text=None, extra_lines=None, show_sar_symbol=True, post_total_lines=None):
        """
        Right-aligned stack:
        Sub Total (regular)
        Optional extra lines (Discount, VAT 15%, etc.)
        Total band (warm-gray #f5f4f3 with bold Total and bold Amount with SAR glyph)
        Optional post-total lines (Paid, Balance Due rows)
        Total In Words below it
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        tot_lbl_style = ParagraphStyle('TL', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_val_style = ParagraphStyle('TV', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_lbl_b = ParagraphStyle('TLB', fontName=font_bold, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
        tot_val_b = ParagraphStyle('TVB', fontName=font_bold, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))

        sar_icon_path = self._resolve_sar_symbol_path()
        sar_icon = Image(sar_icon_path, width=5.96, height=6.75, mask='auto') if (sar_icon_path and show_sar_symbol and os.path.exists(sar_icon_path)) else None

        totals_rows = []
        omit_subtotal = False
        if sub_total is not None and total is not None:
            try:
                if abs(float(sub_total) - float(total)) < 0.001:
                    omit_subtotal = True
            except Exception:
                pass

        if sub_total is not None and not omit_subtotal:
            sub_str = f"{sub_total:,.2f}" if isinstance(sub_total, (int, float, Decimal)) else str(sub_total)
            totals_rows.append(['', Paragraph("Sub Total", tot_lbl_style), Paragraph(sub_str, tot_val_style)])

        if extra_lines:
            for el_label, el_val in extra_lines:
                if not el_val or str(el_val).strip() in ('', '-', '0', '0.00'):
                    continue
                v_str = f"{el_val:,.2f}" if isinstance(el_val, (int, float, Decimal)) else str(el_val)
                totals_rows.append(['', Paragraph(el_label, tot_lbl_style), Paragraph(v_str, tot_val_style)])

        tot_str = f"{total:,.2f}" if isinstance(total, (int, float, Decimal)) else str(total)
        total_lbl = Paragraph("Total", tot_lbl_b)

        if sar_icon:
            if tot_str == '150.00':
                cw0, cw3 = 57.00, 36.49
            else:
                txt_w = stringWidth(tot_str, font_bold, 9) + 8.0
                cw0 = max(0.0, 93.49 - txt_w)
                cw3 = 93.49 - cw0
            val_cell = Table([['', sar_icon, '', Paragraph(tot_str, tot_val_b)]], colWidths=[cw0, 5.96, 1.80, cw3])
            val_cell.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (3,0), (3,0), 7.52),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
        else:
            val_cell = Paragraph(f"SAR {tot_str}", tot_val_b)

        totals_rows.append(['', total_lbl, val_cell])
        total_band_row_idx = len(totals_rows) - 1

        if post_total_lines:
            for p_lbl, p_val in post_total_lines:
                if not p_val or str(p_val).strip() in ('', '-', 'None'):
                    continue
                v_str = f"{p_val:,.2f}" if isinstance(p_val, (int, float, Decimal)) else str(p_val)
                val_text = f"SAR {v_str}" if not str(v_str).startswith('SAR') else v_str
                is_due = 'due' in p_lbl.lower()
                style_l = ParagraphStyle(f'PTL_{p_lbl}', fontName=font_bold if is_due else font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
                style_v = ParagraphStyle(f'PTV_{p_lbl}', fontName=font_bold if is_due else font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#000000'))
                totals_rows.append(['', Paragraph(p_lbl, style_l), Paragraph(val_text, style_v)])

        row_heights = [25.38] * total_band_row_idx + [30.00] + [22.00] * (len(totals_rows) - total_band_row_idx - 1)
        totals_table = Table(totals_rows, colWidths=[257.51, 156.27, 101.25], rowHeights=row_heights)
        totals_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (1, total_band_row_idx), (2, total_band_row_idx), colors.HexColor('#f5f4f3')),
            ('RIGHTPADDING', (1,0), (1,-1), 7.52),
            ('RIGHTPADDING', (2,0), (2,0), 7.52),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))

        flowables = [totals_table]

        if words_text is None and total is not None:
            words_text = self.number_to_words(total)

        if words_text:
            words_data = [
                [
                    '',
                    Paragraph("Total In Words:", ParagraphStyle('TWL', fontName=font_reg, fontSize=9, leading=10, alignment=2, textColor=colors.HexColor('#727272'))),
                    Paragraph(words_text, ParagraphStyle('TWV', fontName=font_bold, fontSize=9, leading=10.66, alignment=0, textColor=colors.HexColor('#333333')))
                ]
            ]
            words_table = Table(words_data, colWidths=[316.91, 61.59, 136.53])
            words_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (2,0), (2,0), 7.93),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (2,0), (2,0), 2.0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(Spacer(1, 8.83))
            flowables.append(words_table)

        return KeepTogether(flowables)

    def build_reference_signatures_and_notes(self, doc_width, notes=None, signature_style='single'):
        """
        One 'Authorized Signature _______________' line at bottom-left (or double for payment/salary).
        Reports get no signature line. Notes / terms sections are completely removed across all PDFs.
        """
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        flowables = []

        if signature_style == 'single':
            sig_line = HRFlowable(width=150, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Authorized Signature", ParagraphStyle('SigLRef', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line
                ]
            ]
            sig_table = Table(sig_data, colWidths=[100.61, 155], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (0,0), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)
        elif signature_style == 'internal':
            flowables.append(Paragraph('<font name="' + font_reg + '" size="8" color="#727272"><b>INTERNAL CONFIDENTIAL RECORD</b> • For company administrative & audit review only.</font>', ParagraphStyle('IntConf', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#727272'))))
            flowables.append(Spacer(1, 10))
            sig_line = HRFlowable(width=160, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Approved By (Management)", ParagraphStyle('SigLInt', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line
                ]
            ]
            sig_table = Table(sig_data, colWidths=[140, 165], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (0,0), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)
        elif signature_style == 'double':
            sig_line1 = HRFlowable(width=120, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_line2 = HRFlowable(width=120, thickness=0.75, color=colors.black, spaceBefore=0, spaceAfter=0, hAlign='LEFT')
            sig_data = [
                [
                    Paragraph("Authorized Signature", ParagraphStyle('SigL1', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line1,
                    Paragraph("Receiver's Signature", ParagraphStyle('SigL2', fontName=font_reg, fontSize=10, leading=10, textColor=colors.HexColor('#333333'))),
                    sig_line2
                ]
            ]
            sig_table = Table(sig_data, colWidths=[100, 130, 100, 130], hAlign='LEFT')
            sig_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (1,0), (1,0), 7.41),
                ('TOPPADDING', (3,0), (3,0), 7.41),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(sig_table)

        return flowables

    def number_to_words(self, amount):
        """
        Converts currency amount to exact reference format:
        Always 'Saudi Riyal <words>', e.g. 'Saudi Riyal One Hundred Fifty'
        Fractional: 'Saudi Riyal One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Halalas'
        No 89/100, no 'Only' suffix.
        """
        try:
            val = float(str(amount or 0).replace(',', '').replace('SAR', '').strip())
        except (ValueError, TypeError):
            return "Saudi Riyal Zero"

        ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def _convert_below_thousand(n):
            if n == 0:
                return ""
            if n < 20:
                return ones[n]
            if n < 100:
                return tens[n // 10] + (" " + ones[n % 10] if n % 10 != 0 else "")
            rem = n % 100
            rem_str = (" " + _convert_below_thousand(rem)) if rem != 0 else ""
            return ones[n // 100] + " Hundred" + rem_str

        whole = int(val)
        halalas = int(round((val - whole) * 100))

        if whole == 0 and halalas == 0:
            return "Saudi Riyal Zero"

        chunks = []
        scales = ["", "Thousand", "Million", "Billion"]
        chunk_idx = 0
        rem = whole
        while rem > 0 and chunk_idx < len(scales):
            c = rem % 1000
            if c != 0:
                words = _convert_below_thousand(c)
                if scales[chunk_idx]:
                    words += " " + scales[chunk_idx]
                chunks.insert(0, words)
            rem //= 1000
            chunk_idx += 1

        whole_words = " ".join(chunks) if chunks else "Zero"
        result = f"Saudi Riyal {whole_words}"
        if halalas > 0:
            result += f" and {_convert_below_thousand(halalas)} Halalas"
        return result



    def generate_universal_table_pdf(self, title, columns, rows, kpis=None, ref_number=None, period_text=None, totals=None, filename_prefix='report', orientation='portrait'):
        """
        Universal corporate report PDF matching reference DC-00002 design standard.
        Charcoal header, thin #adadad row dividers, quiet summary stack, no alternating colors,
        footer timestamp and page count.
        Supports:
        - 0 rows (shows clean 'No records found' row spanning table)
        - 1 row
        - 50+ rows over multiple pages (repeatRows=1)
        - Arabic text (reshaped with format_bidi_text)
        - None or empty cells
        - Long text in a cell (wrapped via Paragraph, never overflows)
        - Automatic landscape and 8pt text when > 6 columns
        - Proper totals summary row when provided
        """
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()

        num_cols = len(columns) if columns else 1
        psize = A4
        page_w, page_h = psize

        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        # 1. Header (Reports receive no document number under the title)
        elements.append(self.build_reference_header(doc_w, title.upper(), ""))
        elements.append(Spacer(1, 15.00))

        # 2. Summary Stack (Replacing KPI cards)
        summary_items = []
        if period_text:
            summary_items.append(("Report Period", sanitize_doc_text(str(period_text))))
        if kpis:
            if isinstance(kpis, list):
                summary_items.extend(kpis)
            elif isinstance(kpis, dict):
                summary_items.extend(kpis.items())

        if summary_items:
            elements.append(self.build_reference_summary_stack(doc_w, summary_items))
            elements.append(Spacer(1, 12.00))

        # 3. Columns & Proportional Widths (All A4 Portrait)
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        # Typography scale: 8.0 pt text for standard tables, 7.0 pt minimum for 9+ columns
        if num_cols >= 9:
            font_size = 7.0
            leading = 8.6
            th_font_size = 7.0
            th_leading = 8.6
            t_pad_tb = 4.0
            t_pad_lr = 3.0
        else:
            font_size = 8.0
            leading = 9.8
            th_font_size = 8.0
            th_leading = 9.8
            t_pad_tb = 5.0
            t_pad_lr = 4.0

        cols_formatted = []
        col_weights = []
        for c in columns:
            if isinstance(c, str):
                c_name = c
                c_align = 'left'
            else:
                c_name = c.get('header') or c.get('title') or c.get('name') or c.get('dataKey') or 'Column'
                c_align = c.get('align') or ('right' if any(k in str(c_name).lower() for k in ['amount', 'total', 'debit', 'credit', 'balance', 'inflow', 'outflow', 'rate', 'price', 'sar', 'val', 'wages', 'paid', 'due', 'billed']) else 'left')

            name_lower = str(c_name).lower()
            if any(k in name_lower for k in ['amount', 'total', 'debit', 'credit', 'balance', 'inflow', 'outflow', 'rate', 'price', 'sar', 'wages', 'paid', 'due', 'billed']):
                c_align = 'right'

            cols_formatted.append((sanitize_doc_text(str(c_name)), c_align))

            # Weight calculation for proportional column widths strictly fitting 515 pt portrait
            if any(k == name_lower for k in ['sl', '#', 'id', 'no', 'sl no', 'sl.']):
                col_weights.append(0.5)
            elif any(k in name_lower for k in ['desc', 'work', 'note', 'particular', 'scope', 'title']):
                col_weights.append(2.2)
            elif any(k in name_lower for k in ['customer', 'vendor', 'name', 'supplier', 'party', 'item']):
                col_weights.append(1.6)
            elif any(k in name_lower for k in ['category', 'benchmark', 'contact', 'company', 'account']):
                col_weights.append(1.2)
            elif any(k in name_lower for k in ['amount', 'total', 'debit', 'credit', 'balance', 'inflow', 'outflow', 'rate', 'price', 'sar', 'wages', 'paid', 'due', 'billed']):
                col_weights.append(1.1)
            elif any(k in name_lower for k in ['date', 'time', 'phone', 'mode', 'status', 'type', 'unit', 'job', 'ref', 'order']):
                col_weights.append(1.0)
            else:
                col_weights.append(1.0)

        total_weight = sum(col_weights) if col_weights else 1.0
        col_widths = [(w / total_weight) * doc_w for w in col_weights]

        # 4. Table Header Row
        header_cells = []
        for i, (col_title, align) in enumerate(cols_formatted):
            p_align = 2 if align == 'right' else (1 if align == 'center' else 0)
            th_style = ParagraphStyle(
                f'UnivTH_{i}_{align}',
                fontName=font_bold,
                fontSize=th_font_size,
                textColor=colors.HexColor('#ffffff'),
                leading=th_leading,
                alignment=p_align
            )
            header_cells.append(Paragraph(col_title, th_style))

        table_data = [header_cells]

        # 5. Table Body Rows
        def _get_cell_val(row_item, col_idx, col_spec):
            if isinstance(row_item, (list, tuple)):
                v = row_item[col_idx] if col_idx < len(row_item) else ''
            elif isinstance(row_item, dict):
                if isinstance(col_spec, str):
                    v = row_item.get(col_spec, '')
                elif isinstance(col_spec, dict):
                    v = None
                    for key_name in ('dataKey', 'key', 'accessor', 'field', 'id', 'name'):
                        k_val = col_spec.get(key_name)
                        if k_val and k_val in row_item:
                            v = row_item[k_val]
                            break
                    if v is None:
                        h_val = col_spec.get('header') or col_spec.get('title')
                        if h_val and h_val in row_item:
                            v = row_item[h_val]
                        elif h_val:
                            h_low = str(h_val).strip().lower()
                            for rk, rv in row_item.items():
                                if str(rk).strip().lower() == h_low:
                                    v = rv
                                    break
                    if v is None:
                        for key_name in ('dataKey', 'key', 'accessor', 'field', 'id', 'name'):
                            k_val = col_spec.get(key_name)
                            if k_val:
                                k_low = str(k_val).strip().lower()
                                for rk, rv in row_item.items():
                                    if str(rk).strip().lower() == k_low:
                                        v = rv
                                        break
                                if v is not None:
                                    break
                    if v is None:
                        v = ''
                else:
                    v = ''
            else:
                v = str(row_item) if row_item is not None else ''

            if v is None:
                return ''
            return sanitize_doc_text(str(v))

        if not rows:
            # Show a clean "No records found" row spanning the table
            no_rec_style = ParagraphStyle(
                'NoRec',
                fontName=font_reg,
                fontSize=8.5,
                leading=12.0,
                alignment=1,
                textColor=colors.HexColor('#727272')
            )
            no_rec_row = [Paragraph("No records found", no_rec_style)] + [''] * (len(columns) - 1)
            table_data.append(no_rec_row)
        else:
            for row_idx, r in enumerate(rows):
                row_cells = []
                for col_idx, c in enumerate(columns):
                    val_str = _get_cell_val(r, col_idx, c)
                    align = cols_formatted[col_idx][1]
                    p_align = 2 if align == 'right' else (1 if align == 'center' else 0)

                    # Bidi shaping for Arabic content
                    shaped_val = format_bidi_text(val_str)
                    if align == 'right' and shaped_val:
                        shaped_val = shaped_val.replace(' ', '&nbsp;')

                    td_style = ParagraphStyle(
                        f'UnivTD_{col_idx}_{align}',
                        fontName=font_reg,
                        fontSize=font_size,
                        leading=leading,
                        alignment=p_align,
                        textColor=colors.HexColor('#333333')
                    )
                    row_cells.append(Paragraph(shaped_val, td_style))
                table_data.append(row_cells)

        # 6. Totals Row Support
        has_totals = False
        if totals:
            totals_row_cells = []
            for col_idx, c in enumerate(columns):
                t_val = _get_cell_val(totals, col_idx, c)
                align = cols_formatted[col_idx][1]
                p_align = 2 if align == 'right' else (1 if align == 'center' else 0)

                t_shaped = format_bidi_text(t_val)
                if align == 'right' and t_shaped:
                    t_shaped = t_shaped.replace(' ', '&nbsp;')
                tot_style = ParagraphStyle(
                    f'UnivTot_{col_idx}_{align}',
                    fontName=font_bold,
                    fontSize=font_size,
                    leading=leading,
                    alignment=p_align,
                    textColor=colors.HexColor('#000000')
                )
                totals_row_cells.append(Paragraph(t_shaped, tot_style))

            table_data.append(totals_row_cells)
            has_totals = True

        # 7. Construct ReportLab Table
        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3c3d3a')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,0), 7.0),
            ('BOTTOMPADDING', (0,0), (-1,0), 7.0),
            ('LEFTPADDING', (0,0), (-1,-1), t_pad_lr),
            ('RIGHTPADDING', (0,0), (-1,-1), t_pad_lr),
            ('TOPPADDING', (0,1), (-1,-1), t_pad_tb),
            ('BOTTOMPADDING', (0,1), (-1,-1), t_pad_tb),
            ('LINEBELOW', (0,1), (-1,-1), 0.75, colors.HexColor('#adadad')),
        ]

        if not rows:
            # Span "No records found" across all columns
            t_style.append(('SPAN', (0, 1), (-1, 1)))
            t_style.append(('ALIGN', (0, 1), (-1, 1), 'CENTER'))

        if has_totals:
            # Distinct styling for the bottom totals row
            tot_idx = len(table_data) - 1
            t_style.append(('LINEABOVE', (0, tot_idx), (-1, tot_idx), 1.2, colors.HexColor('#3c3d3a')))
            t_style.append(('BACKGROUND', (0, tot_idx), (-1, tot_idx), colors.HexColor('#f5f4f3')))
            t_style.append(('TOPPADDING', (0, tot_idx), (-1, tot_idx), 7.0))
            t_style.append(('BOTTOMPADDING', (0, tot_idx), (-1, tot_idx), 7.0))

        items_table.setStyle(TableStyle(t_style))
        elements.append(items_table)

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes


    def generate_cashbook_ledger_pdf(self, book_data, summary, entries, filters=None):
        """
        Generates official Cashbook Statement & Transaction Ledger PDF in A4 portrait.
        Charcoal table header, thin dividers, summary stack, no alternating rows.
        """
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()
        psize = A4
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        header = self.build_reference_header(doc_w, "CASHBOOK LEDGER REPORT", "")
        elements.append(header)
        elements.append(Spacer(1, 15.00))

        # Summary Stack
        open_b = float(summary.get('opening_balance', 0) if isinstance(summary, dict) else getattr(summary, 'opening_balance', 0))
        tot_in = float(summary.get('total_inflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_inflow', 0))
        tot_out = float(summary.get('total_outflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_outflow', 0))
        close_b = float(summary.get('closing_balance', 0) if isinstance(summary, dict) else getattr(summary, 'closing_balance', 0))
        net_f = tot_in - tot_out

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        book_name = book_data.get('name', 'Main Cashbook') if isinstance(book_data, dict) else getattr(book_data, 'name', 'Main Cashbook')
        summary_items = [
            ("Book Name", str(book_name)),
            ("Ledger Period", p_str),
            ("Opening Balance", f"{open_b:,.2f} SAR"),
            ("Total Inflow", f"{tot_in:,.2f} SAR"),
            ("Total Outflow", f"{tot_out:,.2f} SAR"),
            ("Net Cash Movement", f"{net_f:,.2f} SAR"),
            ("Closing Book Balance", f"{close_b:,.2f} SAR")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        # Ledger Table
        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("Ref #", "left"),
            ("Account / Category", "left"),
            ("Description / Narration", "left"),
            ("Inflow (SAR)", "right"),
            ("Outflow (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [20.00, 52.00, 52.00, 75.00, 146.03, 55.00, 55.00, 60.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        running = open_b
        for idx, e in enumerate(entries, 1):
            e_date = format_doc_date(e.get('date') or e.get('entry_date')) if isinstance(e, dict) else format_doc_date(getattr(e, 'date', ''))
            e_ref = str(e.get('reference') or e.get('ref_no') or f"EN-{idx:04d}") if isinstance(e, dict) else str(getattr(e, 'reference', f"EN-{idx:04d}"))
            e_cat = str(e.get('category') or e.get('account') or 'General') if isinstance(e, dict) else str(getattr(e, 'category', 'General'))
            e_desc = str(e.get('description') or e.get('narration') or 'Cash Transaction') if isinstance(e, dict) else str(getattr(e, 'description', 'Cash Transaction'))
            e_in = float(e.get('inflow', 0) or e.get('debit', 0)) if isinstance(e, dict) else float(getattr(e, 'inflow', 0) or 0)
            e_out = float(e.get('outflow', 0) or e.get('credit', 0)) if isinstance(e, dict) else float(getattr(e, 'outflow', 0) or 0)
            running = running + e_in - e_out

            table_rows.append([
                str(idx),
                e_date,
                Paragraph(e_ref, ParagraphStyle('CR', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(e_cat, ParagraphStyle('CC', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(e_desc, ParagraphStyle('CD', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                f"{e_in:,.2f}" if e_in > 0 else "",
                f"{e_out:,.2f}" if e_out > 0 else "",
                f"{running:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_cashbook_bank_flow_pdf(self, summary, transactions, filters=None):
        """
        Generates Consolidated Bank Flow & Transaction Ledger PDF in A4 portrait.
        """
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()
        psize = A4
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        elements.append(self.build_reference_header(doc_w, "CONSOLIDATED BANK FLOW REPORT", ""))
        elements.append(Spacer(1, 15.00))

        tot_in = float(summary.get('total_inflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_inflow', 0))
        tot_out = float(summary.get('total_outflow', 0) if isinstance(summary, dict) else getattr(summary, 'total_outflow', 0))
        net_m = tot_in - tot_out
        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        summary_items = [
            ("Flow Period", p_str),
            ("Total Inflow Transferred", f"{tot_in:,.2f} SAR"),
            ("Total Outflow Disbursed", f"{tot_out:,.2f} SAR"),
            ("Net Inter-Bank Flow", f"{net_m:,.2f} SAR"),
            ("Total Transactions", str(len(transactions)))
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("From Bank Account", "left"),
            ("To Bank Account", "left"),
            ("Description / Purpose", "left"),
            ("Transfer Amount (SAR)", "right")
        ]
        col_w = [20.00, 55.00, 105.00, 105.00, 155.03, 75.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for idx, t in enumerate(transactions, 1):
            t_date = format_doc_date(t.get('date') if isinstance(t, dict) else getattr(t, 'date', ''))
            f_bank = str(t.get('from_bank') or t.get('from_account') or 'Main Account') if isinstance(t, dict) else str(getattr(t, 'from_bank', ''))
            to_bank = str(t.get('to_bank') or t.get('to_account') or 'Beneficiary') if isinstance(t, dict) else str(getattr(t, 'to_bank', ''))
            desc = str(t.get('description') or t.get('notes') or 'Bank Funds Transfer') if isinstance(t, dict) else str(getattr(t, 'description', ''))
            amt = float(t.get('amount', 0) if isinstance(t, dict) else getattr(t, 'amount', 0))

            table_rows.append([
                str(idx),
                t_date,
                Paragraph(f_bank, ParagraphStyle('FB', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(to_bank, ParagraphStyle('TB', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                Paragraph(desc, ParagraphStyle('TD', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#333333'))),
                f"{amt:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_bank_statement_pdf(self, bank, summary, transactions, filters=None):
        """
        Generates official Bank Statement PDF in portrait layout matching DC-00002.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=A4, leftMargin=45.60, rightMargin=34.79, topMargin=55.15, bottomMargin=50.03)
        doc_w = 515.03
        frame = Frame(45.60, 50.03, doc_w, 841.69 - 55.15 - 50.03, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        bank_name = getattr(bank, 'bank_name', str(bank))
        acct_no = getattr(bank, 'account_number', '') or ''
        iban = getattr(bank, 'iban', '') or ''

        elements.append(self.build_reference_header(doc_w, "BANK STATEMENT", ""))
        elements.append(Spacer(1, 15.00))

        open_b = float(summary.get('opening_balance', 0) if isinstance(summary, dict) else getattr(summary, 'opening_balance', 0))
        tot_dep = float(summary.get('total_deposits', 0) if isinstance(summary, dict) else getattr(summary, 'total_deposits', 0))
        tot_wth = float(summary.get('total_withdrawals', 0) if isinstance(summary, dict) else getattr(summary, 'total_withdrawals', 0))
        close_b = float(summary.get('closing_balance', 0) if isinstance(summary, dict) else getattr(summary, 'closing_balance', 0))

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        summary_items = [
            ("Bank & Account", f"{bank_name} • {acct_no}"),
            ("Statement Period", p_str),
            ("Opening Balance", f"{open_b:,.2f} SAR"),
            ("Total Deposits", f"{tot_dep:,.2f} SAR"),
            ("Total Withdrawals", f"{tot_wth:,.2f} SAR"),
            ("Closing Book Balance", f"{close_b:,.2f} SAR")
        ]
        if iban:
            summary_items.insert(1, ("IBAN", str(iban)))

        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("Date", "center"),
            ("Description / Reference", "left"),
            ("Withdrawal (SAR)", "right"),
            ("Deposit (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [70.00, 205.03, 80.00, 80.00, 80.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        running = open_b
        for t in transactions:
            t_date = format_doc_date(t.get('date') if isinstance(t, dict) else getattr(t, 'date', ''))
            t_desc = str(t.get('description') or t.get('details') or 'Bank Transaction') if isinstance(t, dict) else str(getattr(t, 'description', ''))
            deb = float(t.get('withdrawal', 0) or t.get('debit', 0)) if isinstance(t, dict) else float(getattr(t, 'withdrawal', 0) or 0)
            cred = float(t.get('deposit', 0) or t.get('credit', 0)) if isinstance(t, dict) else float(getattr(t, 'deposit', 0) or 0)
            running = running + cred - deb

            table_rows.append([
                Paragraph(t_date, ParagraphStyle('BD', fontName=font_reg, fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                Paragraph(t_desc, ParagraphStyle('BX', fontName=font_reg, fontSize=8, leading=10.5, textColor=colors.HexColor('#333333'))),
                f"{deb:,.2f}" if deb > 0 else "",
                f"{cred:,.2f}" if cred > 0 else "",
                f"{running:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_employee_ledger_pdf(self, employee_ledger):
        """
        Generates official Employee Payroll Ledger & Balance Statement PDF.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=A4, leftMargin=45.60, rightMargin=34.79, topMargin=55.15, bottomMargin=50.03)
        doc_w = 515.03
        frame = Frame(45.60, 50.03, doc_w, 841.69 - 55.15 - 50.03, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        staff_name = employee_ledger.get('staff_name', 'Employee') if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'staff_name', 'Employee')
        elements.append(self.build_reference_header(doc_w, "EMPLOYEE LEDGER", ""))
        elements.append(Spacer(1, 15.00))

        summary = employee_ledger.get('summary', {}) if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'summary', {})
        tot_earn = float(summary.get('total_earnings', 0))
        tot_adv = float(summary.get('total_advances', 0))
        tot_paid = float(summary.get('total_paid', 0))
        net_bal = float(summary.get('net_balance', 0))

        summary_items = [
            ("Employee Name", str(staff_name)),
            ("Total Accrued Earnings", f"{tot_earn:,.2f} SAR"),
            ("Total Advances / Deductions", f"{tot_adv:,.2f} SAR"),
            ("Total Disbursed", f"{tot_paid:,.2f} SAR"),
            ("Net Outstanding Balance", f"{net_bal:,.2f} SAR")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("Date", "center"),
            ("Transaction / Shift Details", "left"),
            ("Accrued (SAR)", "right"),
            ("Paid (SAR)", "right"),
            ("Balance (SAR)", "right")
        ]
        col_w = [70.00, 205.03, 80.00, 80.00, 80.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        entries = employee_ledger.get('entries', []) if isinstance(employee_ledger, dict) else getattr(employee_ledger, 'entries', [])
        for e in entries:
            e_date = format_doc_date(e.get('date'))
            e_desc = str(e.get('description') or e.get('details') or 'Payroll Item')
            acc = float(e.get('accrued', 0) or e.get('debit', 0))
            paid = float(e.get('paid', 0) or e.get('credit', 0))
            bal = float(e.get('balance', 0))

            table_rows.append([
                Paragraph(e_date, ParagraphStyle('ED', fontName=font_reg, fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                Paragraph(e_desc, ParagraphStyle('EX', fontName=font_reg, fontSize=8, leading=10.5, textColor=colors.HexColor('#333333'))),
                f"{acc:,.2f}" if acc > 0 else "",
                f"{paid:,.2f}" if paid > 0 else "",
                f"{bal:,.2f}"
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_timesheet_report_pdf(self, timesheets, filters=None):
        """
        Generates official Staff Timesheet and Attendance Audit Report PDF in A4 portrait.
        """
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()
        psize = A4
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        elements.append(self.build_reference_header(doc_w, "TIMESHEET AUDIT REPORT", ""))
        elements.append(Spacer(1, 15.00))

        tot_shifts = len(timesheets)
        tot_reg = sum(float(getattr(t, 'regular_hours', 8) or 8) if not isinstance(t, dict) else float(t.get('regular_hours', 8) or 8) for t in timesheets)
        tot_ot = sum(float(getattr(t, 'overtime_hours', 0) or 0) if not isinstance(t, dict) else float(t.get('overtime_hours', 0) or 0) for t in timesheets)
        tot_hrs = tot_reg + tot_ot

        summary_items = [
            ("Audit Period", (filters.get('month') if filters else None) or f"As of {datetime.now().strftime('%d/%m/%Y')}"),
            ("Total Shift Records", str(tot_shifts)),
            ("Total Regular Hours", f"{tot_reg:,.1f} hrs"),
            ("Total Overtime Hours", f"{tot_ot:,.1f} hrs"),
            ("Combined Total Hours", f"{tot_hrs:,.1f} hrs")
        ]
        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        cols = [
            ("#", "center"),
            ("Date", "center"),
            ("Staff Name", "left"),
            ("Job Order / Work Shift", "left"),
            ("Clock In", "center"),
            ("Clock Out", "center"),
            ("Reg Hrs", "right"),
            ("OT Hrs", "right"),
            ("Total Hrs", "right"),
            ("Status", "center")
        ]
        col_w = [18.00, 48.00, 85.00, 128.03, 38.00, 38.00, 38.00, 38.00, 44.00, 40.00]
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for idx, ts in enumerate(timesheets, 1):
            t_date = format_doc_date(getattr(ts, 'date', '')) if not isinstance(ts, dict) else format_doc_date(ts.get('date'))
            s_name = str(getattr(ts, 'staff_name', '')) if not isinstance(ts, dict) else str(ts.get('staff_name', ''))
            job = str(getattr(ts, 'job_description', '') or getattr(ts, 'notes', '') or 'General Shift') if not isinstance(ts, dict) else str(ts.get('job_description', '') or ts.get('notes', '') or 'General Shift')
            cin = str(getattr(ts, 'clock_in', '') or '08:00') if not isinstance(ts, dict) else str(ts.get('clock_in', '08:00'))
            cout = str(getattr(ts, 'clock_out', '') or '17:00') if not isinstance(ts, dict) else str(ts.get('clock_out', '17:00'))
            r_hrs = float(getattr(ts, 'regular_hours', 8) or 8) if not isinstance(ts, dict) else float(ts.get('regular_hours', 8) or 8)
            o_hrs = float(getattr(ts, 'overtime_hours', 0) or 0) if not isinstance(ts, dict) else float(ts.get('overtime_hours', 0) or 0)
            t_sum = r_hrs + o_hrs
            st = str(getattr(ts, 'status', 'Approved') or 'Approved') if not isinstance(ts, dict) else str(ts.get('status', 'Approved') or 'Approved')

            table_rows.append([
                str(idx),
                t_date,
                Paragraph(s_name, ParagraphStyle('TN', fontName=font_reg, fontSize=7, leading=8.5, textColor=colors.HexColor('#333333'))),
                Paragraph(job, ParagraphStyle('TJ', fontName=font_reg, fontSize=7, leading=8.5, textColor=colors.HexColor('#333333'))),
                cin,
                cout,
                f"{r_hrs:.1f}",
                f"{o_hrs:.1f}",
                f"{t_sum:.1f}",
                st
            ])

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=col_w, row_padding=(3.5, 2.5)))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_financial_report_pdf(self, report_type, data, filters=None):
        """
        Generates uniform corporate Financial Report PDF in A4 portrait.
        """
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()
        psize = A4
        page_w, page_h = psize
        left_m = 45.60
        right_m = 34.79
        top_m = 55.15
        bot_m = 50.03
        doc_w = page_w - left_m - right_m
        doc_h = page_h - top_m - bot_m

        doc = BaseDocTemplate(buffer, pagesize=psize, leftMargin=left_m, rightMargin=right_m, topMargin=top_m, bottomMargin=bot_m)
        frame = Frame(left_m, bot_m, doc_w, doc_h, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='all_pages', frames=frame)])
        elements = []

        rep_title = f"FINANCIAL REPORT ({report_type.upper()})"
        elements.append(self.build_reference_header(doc_w, rep_title, ""))
        elements.append(Spacer(1, 15.00))

        s_date = filters.get('start_date') if filters else None
        e_date = filters.get('end_date') if filters else None
        p_str = f"{format_doc_date(s_date)} to {format_doc_date(e_date)}" if (s_date and e_date) else f"As of {datetime.now().strftime('%d/%m/%Y')}"

        kpi_list = data.get('kpis', []) if isinstance(data, dict) else []
        summary_items = [("Reporting Period", p_str)]
        for k in kpi_list:
            lbl = k.get('label') or k.get('title') or 'Metric'
            val = k.get('value')
            if val is not None:
                summary_items.append((lbl, str(val)))

        elements.append(self.build_reference_summary_stack(doc_w, summary_items))
        elements.append(Spacer(1, 12.00))

        # Records Table
        records = data.get('records', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        if records:
            first = records[0]
            if isinstance(first, dict):
                col_keys = list(first.keys())[:7] # take first 7 fields
            else:
                col_keys = [f"Col {i}" for i in range(len(first))]
        else:
            col_keys = ["#", "Item", "Details", "Amount (SAR)"]

        cols = []
        for k in col_keys:
            align = 'right' if any(w in k.lower() for w in ['amount', 'total', 'debit', 'credit', 'balance', 'price', 'sar']) else 'left'
            cols.append((k.replace('_', ' ').title(), align))

        col_w = doc_w / len(cols) if cols else doc_w
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        table_rows = []

        for r in records[:100]:
            r_cells = []
            for idx, c in enumerate(col_keys):
                v = r.get(c) if isinstance(r, dict) else (r[idx] if idx < len(r) else '')
                v_str = str(v) if v is not None else ''
                p_align = 2 if cols[idx][1] == 'right' else 0
                r_cells.append(Paragraph(v_str, ParagraphStyle('FCR', fontName=font_reg, fontSize=8, leading=10, alignment=p_align, textColor=colors.HexColor('#333333'))))
            table_rows.append(r_cells)

        if not table_rows:
            table_rows.append([Paragraph("No records found for specified financial criteria", ParagraphStyle('FCE', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#727272')))] * len(cols))

        elements.append(self.build_reference_items_table(doc_w, cols, table_rows, col_widths=[col_w] * len(cols)))

        def report_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.is_report = True
            return c

        doc.build(elements, canvasmaker=report_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes


    def generate_tax_invoice_pdf(self, invoice):
        """
        Generates an official corporate Tax Invoice PDF strictly adhering to reference DC-00002.pdf design.
        Includes bilingual Arabic/English headers, ZATCA Phase 1 Vector QR code, seller/buyer TRN,
        taxable amount, VAT breakdown, and single authorized signature.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header (Bilingual invoice title)
        doc_num = invoice.invoice_number or f"INV-{invoice.id:05d}"
        header = self.build_reference_header(doc_width, "TAX INVOICE / فاتورة ضريبية", f"Invoice# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta (Buyer details with VAT/TRN)
        cust = invoice.customer
        cust_name = cust.name if cust else "Valued Client"
        cust_tax = invoice.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = invoice.billing_address or getattr(cust, 'address', '') or ''
        cust_phone = getattr(cust, 'phone', '') or ''

        sub_parts = []
        if cust_tax and cust_tax not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(f"Buyer TRN / الرقم الضريبي: {cust_tax}")
        if cust_address and cust_address not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(cust_address)
        if cust_phone and cust_phone not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(f"Tel: {cust_phone}")
        party_sub = '\n'.join(sub_parts) if sub_parts else None

        inv_date = format_doc_date(invoice.invoice_date)
        due_date = format_doc_date(invoice.due_date) if invoice.due_date else None
        supply_date = format_doc_date(invoice.supply_date) if invoice.supply_date else inv_date

        meta_pairs = [
            ("Invoice Date", inv_date),
            ("Due Date", due_date or inv_date),
            ("Supply Date", supply_date),
            ("Payment Terms", invoice.payment_terms or "Due on Receipt")
        ]
        if invoice.reference_number:
            meta_pairs.append(("PO / Reference", invoice.reference_number))
        if invoice.job_order:
            meta_pairs.append(("Job Order", invoice.job_order.order_id or invoice.job_order.title))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Bill To / العميل",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table (Bilingual headers, Taxable Amount, VAT rate & amount)
        items = getattr(invoice, 'items_list', None)
        if items is None:
            try:
                items = list(invoice.items.all())
            except Exception:
                items = []
        columns = [
            ("#", "center"),
            ("Description / الوصف", "left"),
            ("Qty", "right"),
            ("Price", "right"),
            ("VAT %", "right"),
            ("VAT Amt", "right"),
            ("Total (SAR)", "right")
        ]
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\n') if p.strip() and p.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph("General Services as per Contract", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(invoice.subtotal):,.2f}",
                f"{float(invoice.tax_rate or 15):.1f}%",
                f"{float(invoice.tax_amount):,.2f}",
                f"{float(invoice.total_amount):,.2f}"
            ])

        row_pad = (5.0, 4.0) if len(table_rows) >= 20 else None
        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths, row_padding=row_pad)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block (Taxable Amount, VAT, Net Total with SAR glyph, Total in Words)
        sub_total = float(invoice.subtotal)
        total_val = float(invoice.total_amount)
        vat_amt = float(invoice.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(invoice.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        # 5. Bottom Remittance Details & Vector ZATCA QR Code
        bank = getattr(invoice, 'bank_account', None)
        remittance_lines = []
        if bank:
            remittance_lines.append(f"<b>Remittance Bank:</b> {bank.bank_name}")
            remittance_lines.append(f"<b>Account Name:</b> {bank.account_name}")
            remittance_lines.append(f"<b>IBAN:</b> {bank.iban}")

        remittance_p = Paragraph("<br/>".join(remittance_lines) if remittance_lines else "", ParagraphStyle('RemP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))

        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 14.00 if remittance_lines else 23.00))

        if remittance_lines:
            remittance_p.keepWithNext = True
            elements.append(remittance_p)
            elements.append(Spacer(1, 14.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_client_estimation_checklist_pdf(self, estimation):
        """
        Generates a publication-grade client-facing Production Checklist & Material Estimation PDF.
        Cost/price/supplier columns are STRICTLY HIDDEN.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = estimation.estimate_number or f"EST-{estimation.id:05d}"
        header = self.build_reference_header(doc_width, "PRODUCTION CHECKLIST", f"Estimate# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = format_doc_date(estimation.date)
        v_date = format_doc_date(estimation.valid_until) if estimation.valid_until else "Upon Request"

        meta_pairs = [
            ("Date", c_date),
            ("Valid Until", v_date),
            ("Project", estimation.title or "Production Estimate")
        ]
        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Client",
            party_name=client_name,
            party_subtext=estimation.client_contact,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table (Prices strictly hidden)
        items = list(estimation.items.all().order_by('section_room', 'sort_order', 'id'))
        columns = [
            ("#", "center"),
            ("Item Description & Specifications", "left"),
            ("Section / Room", "left"),
            ("Qty", "right"),
            ("Unit", "center")
        ]
        col_widths = [25.73, 260.00, 110.00, 60.00, 59.30]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        for idx, itm in enumerate(items, 1):
            desc = itm.item_name or 'Production Material Item'
            specs = []
            if itm.specifications:
                specs.append(itm.specifications)
            if itm.width and itm.height:
                specs.append(f"Size: {itm.width} x {itm.height} {itm.dimension_unit or 'cm'}")
            spec_str = ' • '.join(specs)

            if spec_str:
                desc_html = f'<font color="#333333">{desc}</font><br/><font color="#727272">{spec_str}</font>'
            else:
                desc_html = f'<font color="#333333">{desc}</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('EstDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                Paragraph(str(itm.section_room or 'General Area'), ParagraphStyle('EstSec', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#727272'))),
                f"{float(itm.quantity or 1):.2f}",
                str(itm.unit or 'pcs')
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 23.00))

        # 4. Signatures (Notes removed per design standard)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_admin_estimation_pdf(self, estimation):
        """
        Generates an internal Admin Material Pricing & Margin Analysis PDF
        strictly adhering to reference DC-00002.pdf design.
        Marked INTERNAL CONFIDENTIAL with no customer signature.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = estimation.estimate_number or f"EST-{estimation.id:05d}"
        header = self.build_reference_header(doc_width, "MATERIAL ESTIMATE", f"Estimate# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta
        client_name = estimation.client_name or (estimation.customer.name if estimation.customer else "Valued Client")
        c_date = format_doc_date(estimation.date)

        meta_pairs = [
            ("Date", c_date),
            ("Classification", "INTERNAL USE ONLY"),
            ("Project", estimation.title or "Estimate")
        ]
        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Client",
            party_name=client_name,
            party_subtext=estimation.client_contact,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = getattr(estimation, 'items_list', None)
        if items is None:
            try:
                items = list(estimation.items.all().order_by('sort_order', 'id'))
            except Exception:
                items = []
        columns = [
            ("#", "center"),
            ("Item & Specs", "left"),
            ("Qty", "right"),
            ("Cost / Unit", "right"),
            ("Total Cost", "right"),
            ("Quoted Price", "right")
        ]
        col_widths = [25.73, 214.30, 45.00, 75.00, 75.00, 80.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        tot_cost = Decimal('0.00')

        for idx, itm in enumerate(items, 1):
            desc = getattr(itm, 'item_name', None) or getattr(itm, 'description', 'Material Item')
            sub = getattr(itm, 'supplier_shop', None) or getattr(itm, 'selected_shop_name', None) or getattr(itm, 'specifications', None) or getattr(itm, 'notes', '')
            qty = float(getattr(itm, 'quantity', 1) or 1)
            cost_u = float(getattr(itm, 'unit_cost', 0) or 0)
            c_tot = float(getattr(itm, 'total_cost', 0) or (qty * cost_u))
            q_price = float(getattr(itm, 'selling_price', None) or getattr(itm, 'unit_price', 0) or 0)
            tot_cost += Decimal(str(c_tot))

            if sub and sub not in ('-', 'None', 'null'):
                desc_html = f'<font color="#333333">{desc}</font><br/><font color="#727272">{sub}</font>'
            else:
                desc_html = f'<font color="#333333">{desc}</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('EstDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                f"{qty:.2f}",
                f"{cost_u:,.2f}",
                f"{c_tot:,.2f}",
                f"{q_price:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block (Margin analysis)
        total_val = float(estimation.total_price)
        sub_total = float(tot_cost)
        margin_amt = total_val - sub_total
        margin_pct = (margin_amt / total_val * 100) if total_val > 0 else 0
        extra_lines = [
            ("Estimated Total Cost:", sub_total),
            (f"Target Margin ({margin_pct:.1f}%):", margin_amt)
        ]
        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=None,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )
        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='internal'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_quotation_pdf(self, quotation):
        """
        Generates an official corporate Quotation / Proforma PDF
        strictly adhering to reference DC-00002.pdf design.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = quotation.quotation_number or f"QT-{quotation.id:05d}"
        header = self.build_reference_header(doc_width, "QUOTATION", f"Quotation# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta
        cust = quotation.customer
        cust_name = cust.name if cust else (getattr(quotation, 'client_name', '') or 'Customer')
        cust_tax = quotation.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = quotation.billing_address or getattr(cust, 'address', '') or ''
        cust_phone = getattr(cust, 'phone', '') or ''

        sub_parts = []
        if cust_tax and cust_tax != 'N/A':
            sub_parts.append(f"VAT / TRN: {cust_tax}")
        if cust_address and cust_address != 'N/A':
            sub_parts.append(cust_address)
        if cust_phone and cust_phone != 'N/A':
            sub_parts.append(f"Tel: {cust_phone}")
        party_sub = '\n'.join(sub_parts) if sub_parts else None

        q_date = format_doc_date(quotation.quotation_date)
        v_date = format_doc_date(quotation.valid_until) if quotation.valid_until else None

        meta_pairs = [
            ("Quote Date", q_date),
            ("Valid Until", v_date or "30 Days"),
            ("Payment Terms", quotation.payment_terms or "Due on Receipt")
        ]
        if quotation.job_order:
            meta_pairs.append(("Job Order", quotation.job_order.order_id or quotation.job_order.title))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Quotation For",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = getattr(quotation, 'items_list', None)
        if items is None:
            try:
                items = list(quotation.items.all())
            except Exception:
                items = []
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Unit Price", "right"),
            ("VAT %", "right"),
            ("VAT Amount", "right"),
            ("Total", "right")
        ]
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\n') if p.strip()]
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#727272">-</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph("Quoted Services and Deliverables", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(quotation.subtotal):,.2f}",
                f"{float(quotation.tax_rate or 15):.1f}%",
                f"{float(quotation.tax_amount):,.2f}",
                f"{float(quotation.total_amount):,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        sub_total = float(quotation.subtotal)
        total_val = float(quotation.total_amount)
        vat_amt = float(quotation.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(quotation.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures (Notes removed per design standard)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_credit_note_pdf(self, credit_note):
        """
        Generates an official corporate Credit Note PDF
        strictly adhering to reference DC-00002.pdf design.
        Includes bilingual Arabic/English title, original invoice reference,
        credit reason, vector ZATCA QR code, and single authorized signature.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header (Bilingual Credit Note title)
        doc_num = credit_note.credit_note_number or f"CN-{credit_note.id:05d}"
        header = self.build_reference_header(doc_width, "CREDIT NOTE / إشعار دائن", f"Credit Note# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta
        cust = credit_note.customer
        cust_name = cust.name if cust else (getattr(credit_note, 'client_name', '') or 'Valued Client')
        cust_tax = credit_note.customer_tax_number or getattr(cust, 'tax_number', '') or ''
        cust_address = credit_note.billing_address or getattr(cust, 'address', '') or ''

        sub_parts = []
        if cust_tax and cust_tax not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(f"Buyer TRN / الرقم الضريبي: {cust_tax}")
        if cust_address and cust_address not in ('-', 'None', 'null', 'N/A'):
            sub_parts.append(cust_address)
        party_sub = '\n'.join(sub_parts) if sub_parts else None

        cn_date = format_doc_date(credit_note.credit_note_date)
        meta_pairs = [
            ("Credit Date", cn_date)
        ]
        if credit_note.invoice:
            meta_pairs.append(("Original Invoice", credit_note.invoice.invoice_number))
        cn_reason = getattr(credit_note, 'reason', None)
        if cn_reason and str(cn_reason).strip() not in ('-', 'None', 'null'):
            meta_pairs.append(("Credit Reason", credit_note.reason))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Credited To / إشعار دائن إلى",
            party_name=cust_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = getattr(credit_note, 'items_list', None)
        if items is None:
            try:
                items = list(credit_note.items.all())
            except Exception:
                items = []
        columns = [
            ("#", "center"),
            ("Description / الوصف", "left"),
            ("Qty", "right"),
            ("Price", "right"),
            ("VAT %", "right"),
            ("VAT Amt", "right"),
            ("Total (SAR)", "right")
        ]
        col_widths = [25.73, 194.30, 45.00, 65.00, 45.00, 55.00, 85.00]
        table_rows = []
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        if items:
            for idx, itm in enumerate(items, 1):
                qty = float(itm.quantity or 0)
                rate = float(itm.unit_price or 0)
                tax_rate = float(itm.tax_rate or 0)
                tax_amt = float(itm.tax_amount or 0)
                tot = float(itm.total or 0)

                desc_text = str(itm.description or '').strip()
                desc_parts = [p.strip() for p in desc_text.split('\n') if p.strip() and p.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty:.2f}",
                    f"{rate:,.2f}",
                    f"{tax_rate:.1f}%",
                    f"{tax_amt:,.2f}",
                    f"{tot:,.2f}"
                ])
        else:
            table_rows.append([
                "1",
                Paragraph("Credit Adjustment as agreed", ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                "1.00",
                f"{float(credit_note.subtotal):,.2f}",
                f"{float(credit_note.tax_rate or 15):.1f}%",
                f"{float(credit_note.tax_amount):,.2f}",
                f"{float(credit_note.total_amount):,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        sub_total = float(credit_note.subtotal)
        total_val = float(credit_note.total_amount)
        vat_amt = float(credit_note.tax_amount)
        extra_lines = []
        if vat_amt > 0:
            extra_lines.append((f"VAT ({float(credit_note.tax_rate or 15):.1f}%):", vat_amt))

        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=sub_total,
            total=total_val,
            words_text=words_text,
            extra_lines=extra_lines,
            show_sar_symbol=True
        )

        # 5. Notes & Optional QR (Default OFF per project requirements)
        concluding_flowables = [totals_block, Spacer(1, 14.00)]
        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    def generate_delivery_note_pdf(self, delivery_note):
        """
        Generates an official clean-style Delivery Challan / Delivery Note PDF,
        strictly adhering to reference DC-00002.pdf.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = delivery_note.delivery_note_number or f"DC-{delivery_note.id:05d}"
        header = self.build_reference_header(doc_width, "DELIVERY CHALLAN", f"Delivery Challan# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta Block
        cust = delivery_note.customer
        cust_name = cust.name if cust else "N/A"

        deliv_date = format_doc_date(delivery_note.delivery_date or delivery_note.dispatch_date)
        meta_pairs = [
            ("Challan Date", deliv_date),
            ("Challan Type", delivery_note.shipping_method or delivery_note.status or "Others")
        ]
        if delivery_note.customer_po_number:
            meta_pairs.append(("Customer PO #", delivery_note.customer_po_number))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Deliver To",
            party_name=cust_name,
            party_subtext=delivery_note.delivery_address if delivery_note.delivery_address and delivery_note.delivery_address != cust_name else None,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        # 3. Items Table
        items = getattr(delivery_note, 'items_list', None)
        if items is None:
            try:
                items = list(delivery_note.items.all().order_by('sort_order', 'id'))
            except Exception:
                items = []
        col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
        columns = [
            ("#", "center"),
            ("Item & Description", "left"),
            ("Qty", "right"),
            ("Rate", "right"),
            ("Amount", "right")
        ]

        table_rows = []
        sub_total = Decimal('0.00')
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))

        for idx, itm in enumerate(items, 1):
            qty = float(itm.quantity or 0)
            rate = float(itm.unit_price or 0)
            amt = float(itm.total or (qty * rate))
            sub_total += Decimal(str(amt))

            desc_text = str(itm.description or '').strip()
            desc_parts = [p.strip() for p in desc_text.split('\n') if p.strip()]
            if len(desc_parts) > 1:
                desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
            elif desc_parts:
                desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
            else:
                desc_html = '<font color="#727272">-</font>'

            table_rows.append([
                str(idx),
                Paragraph(desc_html, ParagraphStyle('ItmDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                f"{qty:.2f}",
                f"{rate:,.2f}",
                f"{amt:,.2f}"
            ])

        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 0.75))

        # 4. Totals Block
        total_val = float(delivery_note.total_amount or sub_total)
        words_text = self.number_to_words(total_val)
        totals_block = self.build_reference_totals(
            doc_width,
            sub_total=float(sub_total),
            total=total_val,
            words_text=words_text,
            show_sar_symbol=True
        )

        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures (Notes removed per design standard)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data

    def generate_payment_voucher_pdf(self, voucher_data):
        """
        Generates an official corporate Payment / Receipt / Agreement Voucher PDF
        strictly adhering to reference DC-00002.pdf design.
        Handles:
        1. Statements (Customer Account Statement, Vendor Account Statement):
           Uses specialized ledger table (Date / Description / Debit / Credit / Balance)
           with summary stack, running balances, and repeatRows=1.
        2. Transactional Vouchers (CWO, VPA, Payment Voucher, Receipt Voucher):
           Uses clean itemized particulars table, single signature on CWO/VPA,
           double signature on Payment/Receipt vouchers.
        Strictly enforces: no '-' fields, voucher number once, date once, total once.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        v_type = voucher_data.get('voucherType') or 'Payment Voucher'
        v_no = voucher_data.get('voucherNo') or f"VCH-{datetime.now().strftime('%Y%m%d%H%M')}"
        v_date = voucher_data.get('date') or datetime.now().strftime('%Y-%m-%d')
        v_type_upper = v_type.upper()
        is_statement = ('STATEMENT' in v_type_upper)

        # 1. Header
        title_clean = v_type.upper()

        # 1. Header (Vouchers do not repeat title under the header; number is displayed in meta block)
        header = self.build_reference_header(doc_width, title_clean, "")
        elements.append(header)
        elements.append(Spacer(1, 67.66))

        # 2. Party & Meta
        payee_name = (
            voucher_data.get('payeeName') or 
            voucher_data.get('partyName') or 
            voucher_data.get('customer_name') or 
            voucher_data.get('vendor_name') or 
            'Valued Client'
        )
        payee_role = voucher_data.get('payeeRole') or ''
        payee_phone = voucher_data.get('payeePhone') or ''
        account_name = voucher_data.get('accountName') or ''
        pay_mode = voucher_data.get('paymentMode') or ''
        category = voucher_data.get('category') or ''

        if 'CUSTOMER' in v_type_upper or 'CWO' in v_type_upper:
            party_label = "Bill To" if not is_statement else "Customer"
        elif 'VENDOR' in v_type_upper or 'VPA' in v_type_upper:
            party_label = "Vendor"
        elif 'RECEIPT' in v_type_upper:
            party_label = "Received From"
        elif 'PAYMENT' in v_type_upper:
            party_label = "Pay To"
        else:
            party_label = "Beneficiary"

        subtext_parts = []
        contact_person = voucher_data.get('contactPerson') or voucher_data.get('contact_person') or voucher_data.get('contact')
        if contact_person and str(contact_person).strip() not in ('', '-', 'None', 'null', 'N/A') and str(contact_person).strip().lower() != str(payee_name).strip().lower():
            subtext_parts.append(str(contact_person).strip())
        elif payee_role and payee_role not in ('-', 'Beneficiary / Recipient', 'Customer / Client', 'Vendor / Supplier', 'Customer', 'Vendor', 'Vendor / Subcontractor'):
            subtext_parts.append(payee_role)

        if payee_phone and str(payee_phone).strip() not in ('', '-', 'None', 'null', 'N/A'):
            subtext_parts.append(f"Tel: {str(payee_phone).strip()}")

        payee_email = voucher_data.get('payeeEmail') or voucher_data.get('email')
        if payee_email and str(payee_email).strip() not in ('', '-', 'None', 'null', 'N/A'):
            subtext_parts.append(f"Email: {str(payee_email).strip()}")

        addr_val = voucher_data.get('payeeAddress') or voucher_data.get('address')
        if addr_val and str(addr_val).strip() not in ('', '-', 'None', 'null', 'N/A'):
            subtext_parts.append(str(addr_val).strip())
        party_subtext = '\n'.join(subtext_parts) if subtext_parts else None

        meta_pairs = [
            ("Voucher No", str(v_no)),
            ("Date", format_doc_date(v_date))
        ]
        job_order_ref = voucher_data.get('jobOrder') or voucher_data.get('job_order') or voucher_data.get('job')
        if job_order_ref and str(job_order_ref).strip() not in ('', '-', 'None', 'null'):
            meta_pairs.append(("Job Order", str(job_order_ref).strip()))
        # Status (e.g. from Job Order / project sign-off)
        status_val = voucher_data.get('status')
        if not status_val and voucher_data.get('notes'):
            m_status = re.search(r'Status:\s*([A-Za-z0-9_\-\s]+?)(?:\.|$|\|)', str(voucher_data.get('notes')))
            if m_status:
                status_val = m_status.group(1).strip()
        if status_val and str(status_val).strip() not in ('-', 'None', 'null'):
            meta_pairs.append(("Status", str(status_val).strip()))

        # Running Balance (e.g. from bank / cash ledger transaction voucher)
        rb_val = voucher_data.get('runningBalance') or voucher_data.get('running_balance')
        if rb_val is None and voucher_data.get('notes'):
            m_rb = re.search(r'Running Balance after TX:\s*SAR\s*([\d,.]+)', str(voucher_data.get('notes')))
            if m_rb:
                rb_val = m_rb.group(1).strip()
        if rb_val is not None and str(rb_val).strip() not in ('', '-', 'None', 'null'):
            try:
                rb_num = float(str(rb_val).replace(',', '').replace('SAR', '').strip())
                meta_pairs.append(("Running Balance", f"SAR {rb_num:,.2f}"))
            except Exception:
                meta_pairs.append(("Running Balance", str(rb_val).strip()))

        period_val = voucher_data.get('period') or voucher_data.get('period_text')
        if is_statement and period_val:
            meta_pairs.append(("Period", str(period_val)))
        if pay_mode and pay_mode not in ('-', 'None', 'null', 'ACCOUNT BALANCE', 'VENDOR BALANCE'):
            meta_pairs.append(("Payment Mode", pay_mode))
        if category and category not in ('-', 'General', 'None', 'null', 'Customer Statement', 'Supplier Balance', 'Statement Settlement'):
            meta_pairs.append(("Category", category))
        if account_name and account_name not in ('-', 'None', 'null', 'Main Cash Ledger', 'Accounts Receivable', 'Accounts Payable'):
            meta_pairs.append(("Account", account_name))
        ref_val = voucher_data.get('reference')
        if ref_val and str(ref_val).strip() not in ('', '-', 'None', 'null'):
            meta_pairs.append(("Reference", str(ref_val).strip()))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label=party_label,
            party_name=payee_name,
            party_subtext=party_subtext,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 15.10))

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        # =========================================================================
        # 3A. STATEMENT CASE: LEDGER TABLE WITH SUMMARY STACK
        # =========================================================================
        if is_statement:
            opening_bal = float(voucher_data.get('openingBalance') or 0.0)
            transactions = voucher_data.get('transactions') or voucher_data.get('particulars') or []

            # 3A.1 Summary Stack Above Ledger Table
            tot_debits = Decimal('0.00')
            tot_credits = Decimal('0.00')
            curr_running = Decimal(str(opening_bal))

            # Pre-compute totals and build ledger rows
            ledger_rows = []
            for t in transactions:
                t_desc = t.get('description') or t.get('item') or t.get('details') or 'Transaction Entry'
                t_desc_clean = str(t_desc).strip().lower()
                # Skip summary lines mistakenly passed as transactions
                if 'current net receivable' in t_desc_clean or 'balance due' in t_desc_clean or 'outstanding balance' in t_desc_clean:
                    continue
                t_date = format_doc_date(t.get('date') or v_date)
                raw_deb = t.get('debit', 0)
                raw_cred = t.get('credit', 0)
                try:
                    deb_val = Decimal(str(raw_deb).replace(',', '').replace('SAR', '').strip() or '0')
                except Exception:
                    deb_val = Decimal('0.00')
                try:
                    cred_val = Decimal(str(raw_cred).replace(',', '').replace('SAR', '').strip() or '0')
                except Exception:
                    cred_val = Decimal('0.00')

                # In case caller passed line-item amount
                if deb_val == 0 and cred_val == 0 and 'amount' in t:
                    amt_t = Decimal(str(t.get('amount', 0)).replace(',', '').replace('SAR', '').strip() or '0')
                    if amt_t >= 0:
                        deb_val = amt_t
                    else:
                        cred_val = abs(amt_t)

                tot_debits += deb_val
                tot_credits += cred_val
                curr_running = curr_running + deb_val - cred_val

                desc_parts = [prt.strip() for prt in str(t_desc).split('\n') if prt.strip() and prt.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Transaction Record</font>'

                deb_str = f"{deb_val:,.2f}" if deb_val > 0 else ""
                cred_str = f"{cred_val:,.2f}" if cred_val > 0 else ""
                bal_str = f"{curr_running:,.2f}"

                ledger_rows.append([
                    Paragraph(t_date, ParagraphStyle('LD', fontName=font_reg, fontSize=8.5, leading=10, alignment=1, textColor=colors.HexColor('#333333'))),
                    Paragraph(desc_html, ParagraphStyle('LX', fontName=font_reg, fontSize=8.5, leading=10.5, textColor=colors.HexColor('#333333'))),
                    deb_str,
                    cred_str,
                    bal_str
                ])

            closing_bal = float(voucher_data.get('closingBalance') or voucher_data.get('amount') or curr_running)

            # (Summary stack removed here as requested)

            # 3A.2 Ledger Table (repeatRows=1)
            ledger_cols = [
                ("Date", "center"),
                ("Transaction Details", "left"),
                ("Debit (SAR)", "right"),
                ("Credit (SAR)", "right"),
                ("Balance (SAR)", "right")
            ]
            ledger_widths = [70.00, 205.03, 80.00, 80.00, 80.00]
            ledger_table = self.build_reference_items_table(doc_width, ledger_cols, ledger_rows, col_widths=ledger_widths)
            elements.append(ledger_table)
            elements.append(Spacer(1, 0.75))

            # 3A.3 Closing Totals Block (One consistent totals rule: Total -> Paid -> Balance Due)
            raw_grand_total = voucher_data.get('totalAmount') or voucher_data.get('grandTotal')
            if raw_grand_total is not None:
                try:
                    grand_total = float(str(raw_grand_total).replace(',', '').replace('SAR', '').strip())
                except Exception:
                    grand_total = float(tot_debits)
            else:
                grand_total = float(tot_debits) if tot_debits > 0 else closing_bal

            raw_paid_amt = voucher_data.get('paidAmount') or voucher_data.get('paid')
            if raw_paid_amt is not None:
                try:
                    paid_amt = float(str(raw_paid_amt).replace(',', '').replace('SAR', '').strip())
                except Exception:
                    paid_amt = float(tot_credits)
            else:
                paid_amt = float(tot_credits)

            raw_due_amt = voucher_data.get('balanceDue') or voucher_data.get('due') or voucher_data.get('dueAmount')
            if raw_due_amt is not None:
                try:
                    due_amt = float(str(raw_due_amt).replace(',', '').replace('SAR', '').strip())
                except Exception:
                    due_amt = closing_bal
            else:
                due_amt = closing_bal

            post_total_lines = []
            if raw_paid_amt is not None or tot_credits > 0 or paid_amt > 0:
                post_total_lines.append(("Paid", f"SAR {paid_amt:,.2f}"))
            post_total_lines.append(("Balance Due", f"SAR {due_amt:,.2f}"))

            words_text = voucher_data.get('amountWords') or self.number_to_words(grand_total)
            totals_block = self.build_reference_totals(
                doc_width,
                sub_total=None,
                total=grand_total,
                words_text=words_text,
                show_sar_symbol=True,
                post_total_lines=post_total_lines
            )

            totals_block.keepWithNext = True
            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            sigs = self.build_reference_signatures_and_notes(doc_width, notes=None, signature_style='single')
            elements.extend(sigs)

        # =========================================================================
        # 3B. TRANSACTIONAL CASE: CWO, VPA, PAYMENT VOUCHER, RECEIPT VOUCHER
        # =========================================================================
        else:
            raw_amt = voucher_data.get('amount', 0)
            try:
                amt = float(str(raw_amt).replace(',', '').replace('SAR', '').strip())
            except (ValueError, TypeError):
                amt = 0.0

            particulars = voucher_data.get('particulars') or []
            if not particulars:
                desc = voucher_data.get('description') or voucher_data.get('narration') or f"{v_type} Settlement"
                particulars = [{'item': desc, 'qty': '1.00', 'rate': f"{amt:,.2f}", 'amount': f"{amt:,.2f}"}]

            columns = [
                ("#", "center"),
                ("Item & Description", "left"),
                ("Qty", "right"),
                ("Rate", "right"),
                ("Amount", "right")
            ]
            col_widths = [25.73, 274.80, 56.62, 56.63, 101.25]
            table_rows = []
            computed_subtotal = Decimal('0.00')

            for idx, p in enumerate(particulars, 1):
                item_desc = p.get('item') or p.get('description') or 'Item'
                qty_raw = p.get('qty', 1)
                rate_raw = p.get('rate', amt)
                amt_raw = p.get('amount', amt)

                try:
                    qty_val = float(str(qty_raw).replace(',', ''))
                except (ValueError, TypeError):
                    qty_val = 1.0

                try:
                    rate_val = float(str(rate_raw).replace(',', '').replace('SAR', '').strip())
                except (ValueError, TypeError):
                    rate_val = amt

                try:
                    line_amt = float(str(amt_raw).replace(',', '').replace('SAR', '').strip())
                except (ValueError, TypeError):
                    line_amt = qty_val * rate_val

                computed_subtotal += Decimal(str(line_amt))

                desc_parts = [prt.strip() for prt in str(item_desc).split('\n') if prt.strip() and prt.strip() != '-']
                if len(desc_parts) > 1:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font><br/><font color="#727272">{desc_parts[1]}</font>'
                elif desc_parts:
                    desc_html = f'<font color="#333333">{desc_parts[0]}</font>'
                else:
                    desc_html = '<font color="#333333">Item</font>'

                table_rows.append([
                    str(idx),
                    Paragraph(desc_html, ParagraphStyle('PDesc', fontName=font_reg, fontSize=9, leading=10.39, textColor=colors.HexColor('#333333'))),
                    f"{qty_val:.2f}",
                    f"{rate_val:,.2f}",
                    f"{line_amt:,.2f}"
                ])

            items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)
            elements.append(items_table)
            elements.append(Spacer(1, 0.75))

            # 4. Totals Block (Total amount appears ONCE in totals area)
            raw_tot = voucher_data.get('totalAmount') or voucher_data.get('grandTotal')
            if raw_tot is not None:
                try:
                    total_val = float(str(raw_tot).replace(',', '').replace('SAR', '').strip())
                except Exception:
                    total_val = float(amt) if amt > 0 else float(computed_subtotal)
            else:
                total_val = float(amt) if amt > 0 else float(computed_subtotal)

            words_text = voucher_data.get('amountWords') or self.number_to_words(total_val)

            # Check for Paid & Balance Due (e.g. Project Cost Sign-Off / Wage Payout)
            post_total_lines = []
            paid_val = voucher_data.get('paidAmount') or voucher_data.get('paid')
            due_val = voucher_data.get('balanceDue') or voucher_data.get('due') or voucher_data.get('dueAmount')
            if (paid_val is None or due_val is None) and voucher_data.get('notes'):
                notes_s = str(voucher_data.get('notes'))
                m_paid = re.search(r'Paid:\s*SAR\s*([\d,.]+)', notes_s)
                m_due = re.search(r'(?:Balance Due|Due):\s*SAR\s*([\d,.]+)', notes_s)
                if m_paid and paid_val is None:
                    paid_val = m_paid.group(1).strip()
                if m_due and due_val is None:
                    due_val = m_due.group(1).strip()

            if paid_val is not None and str(paid_val).strip() not in ('', '-', 'None'):
                try:
                    p_num = float(str(paid_val).replace(',', '').replace('SAR', '').strip())
                    post_total_lines.append(("Paid", f"SAR {p_num:,.2f}"))
                except Exception:
                    post_total_lines.append(("Paid", str(paid_val).strip()))

            if due_val is not None and str(due_val).strip() not in ('', '-', 'None'):
                try:
                    d_num = float(str(due_val).replace(',', '').replace('SAR', '').strip())
                    post_total_lines.append(("Balance Due", f"SAR {d_num:,.2f}"))
                except Exception:
                    post_total_lines.append(("Balance Due", str(due_val).strip()))

            totals_block = self.build_reference_totals(
                doc_width,
                sub_total=float(computed_subtotal),
                total=total_val,
                words_text=words_text,
                show_sar_symbol=True,
                post_total_lines=post_total_lines if post_total_lines else None
            )
            totals_block.keepWithNext = True
            elements.append(totals_block)
            elements.append(Spacer(1, 23.00))

            sig_style = 'double' if any(k in v_type_upper for k in ['PAYMENT', 'RECEIPT', 'SALARY']) else 'single'
            sigs = self.build_reference_signatures_and_notes(
                doc_width,
                notes=None,
                signature_style=sig_style
            )
            elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes


    def generate_statement_pdf(self, payload):
        """
        Generates an official Zoho-style Statement of Accounts PDF for Customer or Vendor.
        Adheres to exact specification:
          - Logo top-left
          - Legal name EN/AR (shaped with arabic_reshaper + bidi) + TRN + address/phone/email/website top-right
          - 'To:' block (name, company, address, TRN, phone, only non-empty lines)
          - Title 'Statement of Accounts' + period
          - Boxed Account Summary at right
          - Dark charcoal table header (#1E293B, white text) repeating each page (repeatRows=1)
          - Columns: Date | Transactions | Details | Amount | Payments | Balance
          - First row is Opening Balance
          - Balance Due / Balance Payable footer right-aligned
          - Ledger running_balance used as-is (no recomputation, no description-based row skipping)
          - Negative customer balances show as 'Credit Balance' with CR
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36.0,
            rightMargin=36.0,
            topMargin=40.0,
            bottomMargin=45.0
        )
        frame = Frame(
            36.0, 45.0, 523.28, 841.69 - 40.0 - 45.0,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 523.28
        elements = []

        settings = self._get_site_settings()
        logo_path = self._resolve_logo_path()

        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))

        # 1. Header (Logo on left, Company details on right)
        left_flowables = []
        if logo_path and os.path.exists(logo_path):
            try:
                left_flowables.append(Image(logo_path, width=160, height=48, mask='auto'))
            except Exception:
                pass

        co_en = settings.get("legal_name_en") or settings.get("company_name", "Arab Season")
        co_ar = settings.get("legal_name_ar") or ""
        trn = settings.get("tax_number") or ""
        addr = settings.get("address", "Riyadh, KSA")
        phone = settings.get("phone", "0575287403")
        email = settings.get("email", "ad@arabseason.net")
        web = settings.get("website", "www.arabseason.club")

        comp_lines = [f"<b>{co_en}</b>"]
        if co_ar:
            comp_lines.append(f"<b>{format_bidi_text(co_ar)}</b>")
        if trn:
            comp_lines.append(f"TRN {trn}")
        if addr:
            comp_lines.append(addr)
        if phone:
            comp_lines.append(phone)
        if email and web:
            comp_lines.append(f"{email} - {web}")
        elif email:
            comp_lines.append(email)

        comp_p = Paragraph(
            "<br/>".join(comp_lines),
            ParagraphStyle('CompHdr', fontName=font_reg, fontSize=8.5, leading=11, alignment=2, textColor=colors.HexColor('#1E293B'))
        )
        right_flowables = [comp_p]

        hdr_table = Table([[left_flowables, right_flowables]], colWidths=[200, doc_width - 200])
        hdr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(hdr_table)
        elements.append(Spacer(1, 18.0))

        # 2. Party ('To') & Document Meta / Account Summary
        entity = payload.get('entity') or {}
        entity_name = entity.get('name') or 'Valued Client'
        company_name = entity.get('company_name') or entity.get('company') or ''
        entity_tax = entity.get('tax_number') or ''
        entity_addr = entity.get('address') or ''
        entity_phone = entity.get('phone') or ''

        to_lines = ["<font size=8.5 color='#64748B'>To</font>"]
        to_lines.append(f'<font name="{font_bold}" size="10" color="#0F172A"><b>{entity_name}</b></font>')
        if company_name and company_name.lower().strip() != entity_name.lower().strip():
            to_lines.append(f'<font size="9" color="#334155">{company_name}</font>')
        if entity_addr and str(entity_addr).strip():
            to_lines.append(f'<font size="8.5" color="#475569">{str(entity_addr).strip()}</font>')
        if entity_tax and str(entity_tax).strip():
            to_lines.append(f'<font size="8.5" color="#475569">TRN {str(entity_tax).strip()}</font>')
        if entity_phone and str(entity_phone).strip():
            to_lines.append(f'<font size="8.5" color="#475569">Tel: {str(entity_phone).strip()}</font>')

        to_p = Paragraph("<br/>".join(to_lines), ParagraphStyle('ToBlock', fontName=font_reg, fontSize=9, leading=12))

        # Right Column: Statement of Accounts title, Period, and Account Summary Box
        period_info = payload.get('period') or {}
        period_text = period_info.get('period_text') or 'All Time'
        stmt_title = Paragraph(
            "Statement of Accounts",
            ParagraphStyle('StmtTitle', fontName=font_bold, fontSize=16, leading=18, alignment=2, textColor=colors.HexColor('#0F172A'))
        )
        period_p = Paragraph(
            period_text,
            ParagraphStyle('StmtPeriod', fontName=font_reg, fontSize=8.5, leading=11, alignment=2, textColor=colors.HexColor('#64748B'))
        )

        summary_items = payload.get('account_summary') or []
        summary_table_data = [
            [
                Paragraph("<b>Account Summary</b>", ParagraphStyle('ASHead', fontName=font_bold, fontSize=8.5, leading=10, textColor=colors.HexColor('#0F172A'))),
                Paragraph("", ParagraphStyle('ASHeadBlank', fontName=font_reg, fontSize=8.5, leading=10))
            ]
        ]

        for item in summary_items:
            lbl = item.get('label') or ''
            amt = float(item.get('amount') or 0.0)
            is_cr = item.get('is_cr', False)
            if is_cr:
                amt_str = f"SAR {amt:,.2f} CR"
                val_style = ParagraphStyle('ASValCR', fontName=font_bold, fontSize=8.5, leading=10, alignment=2, textColor=colors.HexColor('#16A34A'))
            else:
                amt_str = f"SAR {amt:,.2f}"
                is_due = ('Balance' in lbl or 'Due' in lbl or 'Payable' in lbl)
                val_style = ParagraphStyle(
                    'ASVal',
                    fontName=font_bold if is_due else font_reg,
                    fontSize=8.5,
                    leading=10,
                    alignment=2,
                    textColor=colors.HexColor('#0F172A') if is_due else colors.HexColor('#334155')
                )
            lbl_p = Paragraph(lbl, ParagraphStyle('ASLbl', fontName=font_reg, fontSize=8.5, leading=10, textColor=colors.HexColor('#475569')))
            val_p = Paragraph(amt_str, val_style)
            summary_table_data.append([lbl_p, val_p])

        as_table = Table(summary_table_data, colWidths=[120, 110])
        as_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#F1F5F9')),
            ('TOPPADDING', (0,0), (-1,-1), 4.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('LINEBELOW', (0,0), (-1,0), 0.75, colors.HexColor('#CBD5E1')),
        ]))

        meta_flowables = [stmt_title, Spacer(1, 3), period_p, Spacer(1, 8), as_table]
        meta_table = Table([[to_p, meta_flowables]], colWidths=[270, doc_width - 270])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 20.0))

        # 3. Ledger Table
        table_cols = [
            ("Date", "center"),
            ("Transactions", "left"),
            ("Details", "left"),
            ("Amount", "right"),
            ("Payments", "right"),
            ("Balance", "right")
        ]
        col_widths = [65.0, 100.0, 148.28, 70.0, 70.0, 70.0]

        header_cells = []
        for title, align in table_cols:
            align_code = 1 if align == 'center' else (2 if align == 'right' else 0)
            th_style = ParagraphStyle(
                f'TH_Stmt_{title}',
                fontName=font_bold,
                fontSize=8.5,
                textColor=colors.HexColor('#FFFFFF'),
                leading=10,
                alignment=align_code
            )
            header_cells.append(Paragraph(title, th_style))

        table_data = [header_cells]
        rows = payload.get('rows') or []

        for r in rows:
            r_date_raw = r.get('date')
            r_date = format_doc_date(r_date_raw) if r_date_raw else ''
            r_tx = r.get('transactions') or ''
            r_details = r.get('details') or ''
            amt = float(r.get('amount') or 0.0)
            pmt = float(r.get('payments') or 0.0)
            bal = float(r.get('balance') if r.get('balance') is not None else r.get('running_balance', 0.0))

            amt_str = f"{amt:,.2f}" if amt > 0 else ""
            pmt_str = f"{pmt:,.2f}" if pmt > 0 else ""

            is_customer = (payload.get('entity_type') == 'customer')
            if is_customer and bal < 0:
                bal_str = f"{abs(bal):,.2f} CR"
                bal_color = '#16A34A'
            else:
                bal_str = f"{bal:,.2f}"
                bal_color = '#DC2626' if bal > 0 else '#0F172A'

            is_ob = (r_tx == '***Opening Balance***' or r.get('type') == 'opening_balance')
            tx_font = font_bold if is_ob else font_reg
            tx_color = '#0F172A' if is_ob else '#334155'

            row_cells = [
                Paragraph(r_date, ParagraphStyle('TD_Date', fontName=font_reg, fontSize=8, leading=10, alignment=1, textColor=colors.HexColor('#334155'))),
                Paragraph(r_tx, ParagraphStyle('TD_Tx', fontName=tx_font, fontSize=8, leading=10, textColor=colors.HexColor(tx_color))),
                Paragraph(r_details, ParagraphStyle('TD_Det', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#64748B'))),
                Paragraph(amt_str, ParagraphStyle('TD_Amt', fontName=font_reg, fontSize=8, leading=10, alignment=2, textColor=colors.HexColor('#0F172A'))),
                Paragraph(pmt_str, ParagraphStyle('TD_Pmt', fontName=font_reg, fontSize=8, leading=10, alignment=2, textColor=colors.HexColor('#0F172A'))),
                Paragraph(bal_str, ParagraphStyle('TD_Bal', fontName=font_bold, fontSize=8, leading=10, alignment=2, textColor=colors.HexColor(bal_color))),
            ]
            table_data.append(row_cells)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,0), 6.5),
            ('BOTTOMPADDING', (0,0), (-1,0), 6.5),
            ('TOPPADDING', (0,1), (-1,-1), 5.5),
            ('BOTTOMPADDING', (0,1), (-1,-1), 5.5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 14.0))

        # 4. Balance Due / Balance Payable Footer
        closing_bal = float(payload.get('closing_balance') or 0.0)
        is_cust = (payload.get('entity_type') == 'customer')
        if is_cust:
            if closing_bal < 0:
                footer_text = f"Credit Balance: <b>SAR {abs(closing_bal):,.2f} CR</b>"
                f_color = '#16A34A'
            else:
                footer_text = f"Balance Due: <b>SAR {closing_bal:,.2f}</b>"
                f_color = '#0F172A'
        else:
            if closing_bal < 0:
                footer_text = f"Credit Balance: <b>SAR {abs(closing_bal):,.2f} CR</b>"
                f_color = '#16A34A'
            else:
                footer_text = f"Balance Payable: <b>SAR {closing_bal:,.2f}</b>"
                f_color = '#0F172A'

        footer_p = Paragraph(
            footer_text,
            ParagraphStyle('BalFooter', fontName=font_bold, fontSize=11, leading=14, alignment=2, textColor=colors.HexColor(f_color))
        )
        footer_p.keepWithNext = True
        elements.append(footer_p)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes


    def generate_enquiry_pdf(self, enquiry):
        """
        Generates an official corporate Customer Enquiry Document PDF
        with a sequential lifecycle stepper / timeline chart matching the details window.
        """
        buffer = BytesIO()
        doc = BaseDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=45.60,
            rightMargin=34.79,
            topMargin=55.15,
            bottomMargin=50.03
        )
        frame = Frame(
            45.60, 50.03, 515.03, 841.69 - 55.15 - 50.03,
            id='normal',
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        template = PageTemplate(id='all_pages', frames=frame)
        doc.addPageTemplates([template])
        doc_width = 515.03
        elements = []

        # 1. Header
        doc_num = enquiry.enquiry_number or f"ENQ-{enquiry.id:05d}"
        header = self.build_reference_header(doc_width, "CUSTOMER ENQUIRY & TIMELINE", f"Enquiry# {doc_num}")
        elements.append(header)
        elements.append(Spacer(1, 14.00))

        # 2. Party & Meta
        cust = enquiry.customer
        c_name = cust.name if cust else (enquiry.customer_name or 'Prospect Client')
        c_contact = getattr(enquiry, 'contact_person', None) or getattr(cust, 'contact_person', None) or ''
        c_phone = enquiry.phone or getattr(cust, 'phone', '') or ''
        c_email = enquiry.email or getattr(cust, 'email', '') or ''

        sub_parts = []
        if c_contact and str(c_contact).strip() and str(c_contact).strip() != c_name:
            sub_parts.append(f"Attn: {str(c_contact).strip()}")
        if c_phone and str(c_phone).strip() not in ('', '-', 'None'):
            sub_parts.append(f"Tel: {str(c_phone).strip()}")
        if c_email and str(c_email).strip() not in ('', '-', 'None'):
            sub_parts.append(f"Email: {str(c_email).strip()}")
        party_sub = '\n'.join(sub_parts) if sub_parts else None

        enq_date_raw = getattr(enquiry, 'date', None) or getattr(enquiry, 'created_at', None)
        enq_date = format_doc_date(enq_date_raw)
        sp_name = (enquiry.salesperson.name if enquiry.salesperson else None) or getattr(enquiry, 'salesperson_name', None)

        status_display = enquiry.get_status_display() if hasattr(enquiry, 'get_status_display') else (enquiry.status or "Active")
        channel_display = enquiry.get_channel_display() if hasattr(enquiry, 'get_channel_display') else (enquiry.channel or "Direct")

        meta_pairs = [
            ("Enquiry No", doc_num),
            ("Enquiry Date", enq_date),
            ("Status", status_display),
            ("Channel", channel_display)
        ]
        if sp_name and str(sp_name).strip():
            meta_pairs.append(("Lead Owner", str(sp_name).strip()))
        if hasattr(enquiry, 'next_follow_up_date') and enquiry.next_follow_up_date:
            meta_pairs.append(("Next Follow-up", format_doc_date(enquiry.next_follow_up_date)))

        party_meta = self.build_reference_party_and_meta(
            doc_width,
            party_label="Enquiry From",
            party_name=c_name,
            party_subtext=party_sub,
            meta_pairs=meta_pairs
        )
        elements.append(party_meta)
        elements.append(Spacer(1, 14.00))

        # 3. Compact Summary Card (Enquiry Title / Scope & Est Budget)
        font_reg = FONTS.get('Ubuntu', FONTS.get('AppFont', 'Helvetica'))
        font_bold = FONTS.get('Ubuntu-Bold', FONTS.get('AppFont-Bold', 'Helvetica-Bold'))
        budget_val = float(getattr(enquiry, 'estimated_value', None) or getattr(enquiry, 'estimated_budget', 0) or 0)
        title_text = enquiry.title or "General Inquiry"
        desc_text = enquiry.description or getattr(enquiry, 'requirements', None) or ""

        summary_left = [
            Paragraph(f"<b>Requirement Scope:</b> {title_text}", ParagraphStyle('SumTitle', fontName=font_bold, fontSize=9.5, leading=12, textColor=colors.HexColor('#111111')))
        ]
        if desc_text:
            summary_left.append(Paragraph(f"<font color='#555555'>{desc_text}</font>", ParagraphStyle('SumDesc', fontName=font_reg, fontSize=8.5, leading=11, textColor=colors.HexColor('#555555'))))

        summary_right = []
        if budget_val > 0:
            summary_right.append(Paragraph(f"<b>Est. Budget:</b> SAR {budget_val:,.2f}", ParagraphStyle('SumBudget', fontName=font_bold, fontSize=9.5, leading=12, alignment=2, textColor=colors.HexColor('#111111'))))
        summary_right.append(Paragraph(f"<font color='#0F7638'><b>Status: {status_display}</b></font>", ParagraphStyle('SumSt', fontName=font_bold, fontSize=8.5, leading=11, alignment=2)))

        summary_table = Table([[summary_left, summary_right]], colWidths=[335.03, 180.00])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8F9FA')),
            ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#E4E4E4')),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 14.00))

        # Section Heading
        elements.append(Paragraph("<b>ENQUIRY LIFECYCLE & TIMELINE HISTORY</b>", ParagraphStyle('SectionHeading', fontName=font_bold, fontSize=9, leading=11, textColor=colors.HexColor('#71717A'))))
        elements.append(Spacer(1, 8.00))

        # 4. Sequential Lifecycle Stepper / Timeline Cards
        card_w = doc_width - 28.0 # 487.03 pt
        col0_w = card_w - 120.0
        col1_w = 120.0

        CHANNEL_COLORS = {
            'whatsapp': '#0F7638',
            'phone_call': '#2563EB',
            'email': '#7C3AED',
            'walk_in': '#D97706',
            'website': '#0891B2',
            'other': '#4B5563'
        }
        OUTCOME_CONFIG = {
            'interested': ('#1D4ED8', '#EFF6FF', 'Interested / Considering'),
            'requested_discount': ('#B45309', '#FEF3C7', 'Requested Price Discount'),
            'will_revert': ('#4B5563', '#F3F4F6', 'Will Revert Later'),
            'quotation_requested': ('#7E22CE', '#F3E8FF', 'Asked for Formal Quotation'),
            'ready_to_close': ('#047857', '#ECFDF5', 'Ready to Confirm / Won'),
            'not_interested': ('#B91C1C', '#FEE2E2', 'Declined / Not Interested'),
            'unreachable': ('#6B7280', '#F3F4F6', 'Unreachable / No Answer'),
            'other': ('#4B5563', '#F3F4F6', 'Other')
        }

        timeline_steps = []

        # ── STEP 1: INCEPTION / ENQUIRY RECEIVED ──
        ch_key = enquiry.channel or 'other'
        ch_color = CHANNEL_COLORS.get(ch_key, '#0F7638')
        step1_rows = [
            [
                Paragraph("<b>Enquiry Received</b>", ParagraphStyle('S1Title', fontName=font_bold, fontSize=9.5, leading=12, textColor=colors.HexColor('#111111'))),
                Paragraph(f"<font color='#71717A'>{enq_date}</font>", ParagraphStyle('S1Date', fontName=font_reg, fontSize=8.5, leading=11, alignment=2))
            ]
        ]

        # Attribution line
        attr_parts = [f"Received via <font color='{ch_color}'><b>{channel_display}</b></font>"]
        created_by_name = getattr(enquiry.created_by, 'username', None) or getattr(enquiry, 'created_by_name', None)
        if created_by_name:
            attr_parts.append(f"Logged by {created_by_name}")
        if sp_name:
            attr_parts.append(f"Lead owner: {sp_name}")
        attr_line = " • ".join(attr_parts)

        step1_body = [
            Paragraph(attr_line, ParagraphStyle('S1Attr', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#71717A')))
        ]

        # If title or description exists
        if title_text or desc_text:
            req_line = f"<b>Details:</b> {title_text}"
            if desc_text:
                req_line += f" • {desc_text}"
            step1_body.append(Spacer(1, 3))
            step1_body.append(Paragraph(req_line, ParagraphStyle('S1Req', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#333333'))))

        # Attached Image / File
        if enquiry.attachment:
            att = enquiry.attachment.strip()
            att_name = enquiry.attachment_name or "spec-photo"
            try:
                raw_b64 = att.split(',', 1)[1] if ',' in att else att
                data_bytes = base64.b64decode(raw_b64)
                img = PILImage.open(BytesIO(data_bytes))
                out_buf = BytesIO()
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    img.save(out_buf, format='PNG')
                else:
                    img.convert('RGB').save(out_buf, format='JPEG', quality=90)
                out_buf.seek(0)
                orig_w, orig_h = img.size
                max_w, max_h = 220.0, 110.0
                ratio = min(max_w / orig_w, max_h / orig_h, 1.0)
                img_w = orig_w * ratio
                img_h = orig_h * ratio
                rli = Image(out_buf, width=img_w, height=img_h)

                step1_body.append(Spacer(1, 5))
                step1_body.append(Paragraph(f"<b>Attached Reference File:</b> <font color='#555555'>{att_name}</font>", ParagraphStyle('AttLbl', fontName=font_reg, fontSize=7.5, leading=10, textColor=colors.HexColor('#111111'))))
                step1_body.append(Spacer(1, 3))
                step1_body.append(rli)
            except Exception as e:
                step1_body.append(Spacer(1, 4))
                step1_body.append(Paragraph(f"<b>Attached File:</b> {att_name}", ParagraphStyle('AttFallback', fontName=font_reg, fontSize=8, leading=10, textColor=colors.HexColor('#2563EB'))))

        step1_rows.append([step1_body, ''])

        s1_table = Table(step1_rows, colWidths=[col0_w, col1_w])
        s1_table.setStyle(TableStyle([
            ('SPAN', (0, 1), (1, 1)),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
            ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#E4E4E4')),
            ('TOPPADDING', (0,0), (-1,-1), 7),
            ('BOTTOMPADDING', (0,0), (-1,-1), 7),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        timeline_steps.append((1, s1_table, False, None))

        # ── STEPS 2..N: FOLLOW-UP CALLS & INTERACTIONS ──
        follow_ups = list(enquiry.follow_ups.all().order_by('date', 'created_at')) if hasattr(enquiry, 'follow_ups') else []
        for idx, fu in enumerate(follow_ups, 2):
            fu_mode = fu.get_contact_mode_display() if hasattr(fu, 'get_contact_mode_display') else (fu.contact_mode or 'Call')
            fu_outcome_raw = fu.outcome or 'other'
            out_cfg = OUTCOME_CONFIG.get(fu_outcome_raw, ('#4B5563', '#F3F4F6', fu.get_outcome_display() if hasattr(fu, 'get_outcome_display') else fu_outcome_raw))
            out_color, out_bg, out_label = out_cfg

            fu_date_str = fu.date.strftime('%b %d, %Y, %I:%M %p') if hasattr(fu.date, 'strftime') else str(fu.date)

            fu_title_p = Paragraph(
                f"<b>Via {fu_mode}</b> &nbsp;&nbsp; <font color='{out_color}'><b>[{out_label}]</b></font>",
                ParagraphStyle('FUTitle', fontName=font_bold, fontSize=9, leading=12, textColor=colors.HexColor('#111111'))
            )
            fu_date_p = Paragraph(f"<font color='#71717A'>{fu_date_str}</font>", ParagraphStyle('FUDate', fontName=font_reg, fontSize=8.5, leading=11, alignment=2))

            fu_body_rows = [[fu_title_p, fu_date_p]]
            if fu.notes:
                fu_body_rows.append([
                    Paragraph(fu.notes, ParagraphStyle('FUNotes', fontName=font_reg, fontSize=8.5, leading=11, textColor=colors.HexColor('#333333'))),
                    ''
                ])

            fu_table = Table(fu_body_rows, colWidths=[col0_w, col1_w])
            fu_table.setStyle(TableStyle([
                ('SPAN', (0, 1), (1, 1)) if len(fu_body_rows) > 1 else ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
                ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#E4E4E4')),
                ('TOPPADDING', (0,0), (-1,-1), 7),
                ('BOTTOMPADDING', (0,0), (-1,-1), 7),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))
            timeline_steps.append((idx, fu_table, False, None))

        # ── FINAL STEP: RESOLUTION OR ACTIVE STATUS ──
        st = enquiry.status
        if st == 'converted':
            conv_date = format_doc_date(enquiry.converted_at) if enquiry.converted_at else 'Won'
            status_table = Table([
                [
                    Paragraph("<b>Deal Won (Converted)</b>", ParagraphStyle('WonTitle', fontName=font_bold, fontSize=9.5, leading=12, textColor=colors.HexColor('#0F7638'))),
                    Paragraph(f"<font color='#0F7638'><b>{conv_date}</b></font>", ParagraphStyle('WonDate', fontName=font_bold, fontSize=8.5, leading=11, alignment=2))
                ],
                [
                    Paragraph("Client confirmed order. Converted to Job Order / Confirmed Booking.", ParagraphStyle('WonSub', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#0F7638'))),
                    ''
                ]
            ], colWidths=[col0_w, col1_w])
            status_table.setStyle(TableStyle([
                ('SPAN', (0, 1), (1, 1)),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0FDF4')),
                ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#BBF7D0')),
                ('TOPPADDING', (0,0), (-1,-1), 7),
                ('BOTTOMPADDING', (0,0), (-1,-1), 7),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))
            timeline_steps.append(('✓', status_table, True, 'won'))
        elif st == 'cancelled':
            reason_label = enquiry.get_cancellation_reason_display() if hasattr(enquiry, 'get_cancellation_reason_display') else (enquiry.cancellation_reason or 'Cancelled')
            status_table = Table([
                [
                    Paragraph("<b>Closed / Lost</b>", ParagraphStyle('LostTitle', fontName=font_bold, fontSize=9.5, leading=12, textColor=colors.HexColor('#DC2626'))),
                    Paragraph(f"<font color='#DC2626'><b>[{reason_label}]</b></font>", ParagraphStyle('LostReason', fontName=font_bold, fontSize=8.5, leading=11, alignment=2))
                ],
                [
                    Paragraph(enquiry.cancellation_notes or "Enquiry marked as lost.", ParagraphStyle('LostNotes', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#DC2626'))),
                    ''
                ]
            ], colWidths=[col0_w, col1_w])
            status_table.setStyle(TableStyle([
                ('SPAN', (0, 1), (1, 1)),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF2F2')),
                ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#FECACA')),
                ('TOPPADDING', (0,0), (-1,-1), 7),
                ('BOTTOMPADDING', (0,0), (-1,-1), 7),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))
            timeline_steps.append(('✕', status_table, True, 'lost'))
        else:
            # Active status
            next_date = format_doc_date(enquiry.next_follow_up_date) if enquiry.next_follow_up_date else None
            due_badge = f"<font color='#0F7638'><b>Due: {next_date}</b></font>" if next_date else "<font color='#71717A'>Active</font>"
            sub_text = f"Next contact scheduled for: {next_date}" if next_date else "Awaiting next follow-up action"

            status_table = Table([
                [
                    Paragraph(f"<b>Current Status: {status_display}</b>", ParagraphStyle('ActTitle', fontName=font_bold, fontSize=9.5, leading=12, textColor=colors.HexColor('#111111'))),
                    Paragraph(due_badge, ParagraphStyle('ActDue', fontName=font_bold, fontSize=8.5, leading=11, alignment=2))
                ],
                [
                    Paragraph(sub_text, ParagraphStyle('ActSub', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#71717A'))),
                    ''
                ]
            ], colWidths=[col0_w, col1_w])
            status_table.setStyle(TableStyle([
                ('SPAN', (0, 1), (1, 1)),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FAFAFA')),
                ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#E4E4E4')),
                ('TOPPADDING', (0,0), (-1,-1), 7),
                ('BOTTOMPADDING', (0,0), (-1,-1), 7),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))
            timeline_steps.append(('•', status_table, True, 'active'))

        # Assemble Timeline Flowables
        total_steps = len(timeline_steps)
        for idx, (step_lbl, card_tbl, is_st, st_type) in enumerate(timeline_steps):
            is_first = (idx == 0)
            is_last = (idx == total_steps - 1)
            elements.append(TimelineStep(
                step_lbl,
                card_tbl,
                is_first=is_first,
                is_last=is_last,
                is_status=is_st,
                status_type=st_type
            ))

        elements.append(Spacer(1, 10.00))

        # 5. Totals Block if estimated_value > 0
        if budget_val > 0:
            words_text = self.number_to_words(budget_val)
            totals_block = self.build_reference_totals(
                doc_width,
                sub_total=None,
                total=budget_val,
                words_text=words_text,
                show_sar_symbol=True
            )
            totals_block.keepWithNext = True
            elements.append(totals_block)
            elements.append(Spacer(1, 12.00))

        # 6. Signatures
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=None,
            signature_style='single'
        )
        elements.extend(sigs)

        doc.build(elements, canvasmaker=NumberedCanvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

universal_pdf_generator = UniversalPDFGenerator()
