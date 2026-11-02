with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix Tax Invoice concluding section
tax_bad = """        if credit_note.notes:
            notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
            notes_p.keepWithNext = True
            elements.append(notes_p)
            elements.append(Spacer(1, 14.00))"""

tax_good = """        if remittance_lines:
            remittance_p.keepWithNext = True
            elements.append(remittance_p)
            elements.append(Spacer(1, 14.00))"""

# Fix Credit Note concluding section
cn_bad = """        if remittance_lines:
            remittance_p.keepWithNext = True
            elements.append(remittance_p)
            elements.append(Spacer(1, 14.00))"""

cn_good = """        if credit_note.notes:
            notes_p = Paragraph(f"<b>Notes:</b> {credit_note.notes}", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))
            notes_p.keepWithNext = True
            elements.append(notes_p)
            elements.append(Spacer(1, 14.00))"""

c = c.replace(tax_bad, tax_good, 1)
c = c.replace(cn_bad, cn_good, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed Tax Invoice and Credit Note concluding sections!")

