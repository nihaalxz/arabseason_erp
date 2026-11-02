with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = "    def build_doc_title_banner("

number_to_words_code = '''    def number_to_words(self, amount):
        """Converts currency amount to legal English words with SAR and Halalas."""
        try:
            val = float(str(amount or 0).replace(',', '').replace('SAR', '').strip())
        except (ValueError, TypeError):
            return "Zero Saudi Riyals Only"

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
            return ones[n // 100] + " Hundred" + (" and " + _convert_below_thousand(n % 100) if n % 100 != 0 else "")

        whole = int(val)
        halalas = int(round((val - whole) * 100))

        if whole == 0 and halalas == 0:
            return "Zero Saudi Riyals Only"

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
        currency = self.settings.get('currency', 'SAR') if hasattr(self, 'settings') else 'SAR'
        curr_name = "Saudi Riyals" if currency == 'SAR' else currency
        result = f"{whole_words} {curr_name}"
        if halalas > 0:
            result += f" and {_convert_below_thousand(halalas)} Halalas"
        return f"{result} Only"

    def build_doc_title_banner('''

assert target in text, "target not found"
text = text.replace(target, number_to_words_code, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added number_to_words back successfully")

