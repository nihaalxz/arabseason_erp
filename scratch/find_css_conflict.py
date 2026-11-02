with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_conflict = False
conflict_lines = []
for i, l in enumerate(lines):
    if '<<<<<<<' in l:
        in_conflict = True
        conflict_lines.append(f"START line {i+1}:\n")
    if in_conflict:
        conflict_lines.append(l)
    if '>>>>>>>' in l:
        in_conflict = False
        conflict_lines.append(f"END line {i+1}\n")

with open('scratch/index_css_conflict.txt', 'w', encoding='utf-8') as f:
    f.writelines(conflict_lines)

print("Wrote conflict to scratch/index_css_conflict.txt")

