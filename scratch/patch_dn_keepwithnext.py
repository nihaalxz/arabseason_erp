with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

# In generate_delivery_note_pdf:
target = """        # 5. Signatures and Notes (Bound together to prevent orphan signature)
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=delivery_note.notes,
            signature_style='single'
        )
        elements.append(KeepTogether([totals_block, Spacer(1, 23.00), *sigs]))"""

replacement = """        totals_block.keepWithNext = True
        elements.append(totals_block)
        elements.append(Spacer(1, 23.00))

        # 5. Signatures and Notes
        sigs = self.build_reference_signatures_and_notes(
            doc_width,
            notes=delivery_note.notes,
            signature_style='single'
        )
        elements.extend(sigs)"""

c = c.replace(target, replacement, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated generate_delivery_note_pdf with keepWithNext = True!")

