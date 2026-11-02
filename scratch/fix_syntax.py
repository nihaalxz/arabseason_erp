with open('backend/api/pdf_generator.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Receiver's Signature" in line and "f'<font" in line:
        lines[i] = line.replace("f'<font name=\"{font_reg}\" size=\"10\" color=\"#333333\">Receiver's Signature</font>'", 'f"<font name=\\"{font_reg}\\" size=\\"10\\" color=\\"#333333\\">Receiver\'s Signature</font>"')
        print(f"Fixed line {i+1}: {lines[i]}")

with open('backend/api/pdf_generator.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")

