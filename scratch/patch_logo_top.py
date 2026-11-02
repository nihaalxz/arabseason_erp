with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        left_flowables.extend([Spacer(1, 3.21), comp_p1, comp_p2])"""
replacement = """        # Exact spacer before logo (top=57.15) and before company block
        left_flowables = [Spacer(1, 1.80)] + left_flowables + [Spacer(1, 1.41), comp_p1, comp_p2]"""

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Tuned logo top position successfully")

