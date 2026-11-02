with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Register FontFamily in _init_pdf_fonts
old_reg_end = "    return registered"
new_reg_end = """    try:
        pdfmetrics.registerFontFamily('Ubuntu', normal='Ubuntu', bold='Ubuntu-Bold', italic='Ubuntu-Italic', boldItalic='Ubuntu-Bold')
        pdfmetrics.registerFontFamily('AppFont', normal='Ubuntu', bold='Ubuntu-Bold', italic='Ubuntu-Italic', boldItalic='Ubuntu-Bold')
    except Exception:
        pass
    return registered"""

assert old_reg_end in text, "old_reg_end not found"
text = text.replace(old_reg_end, new_reg_end, 1)

# 2. Update party_lines in build_reference_party_and_meta so party_name is Ubuntu-Bold 9pt
old_party = 'party_lines.append(f"<font size=9><b>{party_name}</b></font>")'
new_party = 'party_lines.append(f\'<font name="{font_bold}" size="9"><b>{party_name}</b></font>\')'
assert old_party in text, "old_party not found"
text = text.replace(old_party, new_party, 1)

# 3. Update table header in build_reference_items_table so header is Ubuntu Regular 9pt
old_th = "th_style = ParagraphStyle(f'TH_{i}_{align}', fontName=font_bold, fontSize=9, textColor=colors.HexColor('#ffffff'), leading=10, alignment=align_code)"
new_th = "th_style = ParagraphStyle(f'TH_{i}_{align}', fontName=font_reg, fontSize=9, textColor=colors.HexColor('#ffffff'), leading=10, alignment=align_code)"
assert old_th in text, "old_th not found"
text = text.replace(old_th, new_th, 1)

# 4. Update number_to_words to match exact user spec
old_num_words_start = text.find('    def number_to_words(self, amount):')
old_num_words_end = text.find('    def build_doc_title_banner(')

new_num_words = '''    def number_to_words(self, amount):
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

'''
text = text[:old_num_words_start] + new_num_words + text[old_num_words_end:]

# 5. Update build_reference_totals to use number_to_words automatically if words_text not provided
old_tot_start = text.find('        if words_text:')
new_tot_start = '''        if words_text is None and total is not None:
            words_text = self.number_to_words(total)

        if words_text:'''
assert old_tot_start != -1, "old_tot_start not found"
text = text[:old_tot_start] + new_tot_start + text[old_tot_start + len('        if words_text:'):]

# 6. In generate_delivery_note_pdf, use self.number_to_words(total_val)
old_dn_words = 'words_text = "Saudi Riyal One Hundred<br/>Fifty" if abs(total_val - 150.0) < 0.01 else self.number_to_words(total_val)'
new_dn_words = 'words_text = self.number_to_words(total_val)'
assert old_dn_words in text, "old_dn_words not found"
text = text.replace(old_dn_words, new_dn_words, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied Phase A refinements successfully")
