with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# Find the exact line in Tax Invoice (before generate_client_estimation_checklist_pdf)
for i in range(1700, 1900):
    if lines[i].strip() == "if credit_note.notes:":
        print(f"Replacing lines {i} to {i+5} in Tax Invoice")
        lines[i:i+5] = [
            "        if remittance_lines:",
            "            remittance_p.keepWithNext = True",
            "            elements.append(remittance_p)",
            "            elements.append(Spacer(1, 14.00))"
        ]
        break

# Find the exact line in Credit Note (before generate_delivery_note_pdf)
for i in range(2300, 2500):
    if lines[i].strip() == "if remittance_lines:":
        print(f"Replacing lines {i} to {i+5} in Credit Note")
        lines[i:i+5] = [
            "        if credit_note.notes:",
            "            notes_p = Paragraph(f\"<b>Notes:</b> {credit_note.notes}\", ParagraphStyle('CNP', fontName=font_reg, fontSize=8, leading=11, textColor=colors.HexColor('#555555')))",
            "            notes_p.keepWithNext = True",
            "            elements.append(notes_p)",
            "            elements.append(Spacer(1, 14.00))"
        ]
        break

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print("Direct line slice replacement finished!")

