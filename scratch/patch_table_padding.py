with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = """    def build_reference_items_table(self, doc_width, columns, rows, col_widths=None):"""

replacement = """    def build_reference_items_table(self, doc_width, columns, rows, col_widths=None, row_padding=None):"""

c = c.replace(target, replacement, 1)

target2 = """            ('TOPPADDING', (0,1), (-1,-1), 8.83),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6.57),"""

replacement2 = """            ('TOPPADDING', (0,1), (-1,-1), row_padding[0] if row_padding else 8.83),
            ('BOTTOMPADDING', (0,1), (-1,-1), row_padding[1] if row_padding else 6.57),"""

c = c.replace(target2, replacement2, 1)

# In generate_tax_invoice_pdf, if len(items) >= 20, use compact row_padding=(5.0, 4.0)
target3 = """        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths)"""
replacement3 = """        row_pad = (5.0, 4.0) if len(table_rows) >= 20 else None
        items_table = self.build_reference_items_table(doc_width, columns, table_rows, col_widths=col_widths, row_padding=row_pad)"""

c = c.replace(target3, replacement3, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated build_reference_items_table and generate_tax_invoice_pdf with adaptive row_padding!")

