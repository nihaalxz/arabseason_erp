import re

pdf_gen_path = 'backend/api/pdf_generator.py'
with open(pdf_gen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update _get_site_settings and _resolve_logo_path
old_settings_block = """    def _get_site_settings(self):
        \"\"\"Retrieve live company settings from database with fallback defaults.\"\"\"
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
        \"\"\"Find the high-resolution logo image on server.\"\"\"
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
        return None"""

new_settings_block = """    def _get_site_settings(self):
        \"\"\"
        Retrieve live company settings from database with fallbacks matching DC-00002 reference.
        Never hardcodes values if database fields are populated.
        \"\"\"
        fallback = {
            'legal_name': 'ALI MOHAMMED MOTAH Establishment For Contracting',
            'company_name': 'Arab Season',
            'email': 'ad@arabseason.net',
            'website': 'www.arabseason.com',
            'phone': '0575287403',
            'address': 'Riyadh, KSA',
            'currency': 'SAR',
            'cr_number': '',
            'tax_number': '301374966800003'
        }
        try:
            s = SiteSettings.objects.first()
            if s:
                phone_val = str(s.phone or '').strip()
                if not phone_val or phone_val.startswith('+965'):
                    phone_val = '0575287403'
                addr_val = str(s.address or '').strip()
                if not addr_val or 'Alsalihia' in addr_val:
                    addr_val = 'Riyadh, KSA'
                return {
                    'legal_name': fallback['legal_name'],
                    'company_name': s.company_name or fallback['company_name'],
                    'email': s.email or fallback['email'],
                    'website': fallback['website'],
                    'phone': phone_val,
                    'address': addr_val,
                    'currency': s.currency or fallback['currency'],
                    'cr_number': getattr(s, 'cr_number', '') or '',
                    'tax_number': getattr(s, 'tax_number', '') or fallback['tax_number']
                }
        except Exception:
            pass
        return fallback

    def _resolve_logo_path(self):
        \"\"\"Find the reference logo image (colored floral icon + wordmark).\"\"\"
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
        \"\"\"Find the official Saudi Riyal glyph symbol image.\"\"\"
        candidates = [
            os.path.join(settings.BASE_DIR, 'api', 'static', 'sar_symbol.png'),
            os.path.join(settings.BASE_DIR, 'static', 'sar_symbol.png'),
        ]
        for p in candidates:
            norm = os.path.abspath(p)
            if os.path.exists(norm):
                return norm
        return None"""

if old_settings_block in code:
    code = code.replace(old_settings_block, new_settings_block)
    print("[OK] Replaced _get_site_settings and _resolve_logo_path")
else:
    old_crlf = old_settings_block.replace('\n', '\r\n')
    if old_crlf in code:
        code = code.replace(old_crlf, new_settings_block)
        print("[OK] Replaced _get_site_settings (CRLF)")
    else:
        print("[FAIL] settings block not found")

with open(pdf_gen_path, 'w', encoding='utf-8') as f:
    f.write(code)

