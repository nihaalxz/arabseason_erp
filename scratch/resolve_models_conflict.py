"""
Resolve the conflict markers in models.py:
- Keep yahya's side (lines 2 to 2393, after the <<<<<<< HEAD marker)
- Discard your old side (lines 2395 to 3592, after the ======= marker)
- Then ensure SiteSettings has the website field (add it if missing)
"""

with open(r"d:\freelanceprojects\ERP-Arab-Season-main\ERP-Arab-Season-main\backend\api\models.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find conflict markers
start_marker = None  # <<<<<<< HEAD
mid_marker = None    # =======
end_marker = None    # >>>>>>>

for i, line in enumerate(lines):
    stripped = line.rstrip('\r\n')
    if '<<<<<<' in stripped and start_marker is None:
        start_marker = i
    elif stripped.strip() == '=======' and mid_marker is None and start_marker is not None:
        mid_marker = i
    elif '>>>>>>>' in stripped and end_marker is None and mid_marker is not None:
        end_marker = i

print(f"Conflict: lines {start_marker}–{end_marker}")
print(f"  HEAD (yahya) side: lines {start_marker+1}–{mid_marker-1} ({mid_marker - start_marker - 1} lines)")
print(f"  d765184 (your) side: lines {mid_marker+1}–{end_marker-1} ({end_marker - mid_marker - 1} lines)")

# Keep yahya's side only
resolved = lines[start_marker+1:mid_marker]  # yahya's content (no markers)

# Check if 'website' field exists in yahya's SiteSettings
content_so_far = "".join(resolved)
if "website = models.CharField" not in content_so_far:
    # Find SiteSettings class in yahya's half and add website field
    # Look for the get_settings method or end of SiteSettings
    # Find line with 'class SiteSettings' first
    ss_line = None
    for i, line in enumerate(resolved):
        if line.strip().startswith("class SiteSettings("):
            ss_line = i
            break
    
    if ss_line is not None:
        # Find a good insertion point: after the last field definition before get_settings
        insert_at = None
        for i in range(ss_line, len(resolved)):
            if "def get_settings" in resolved[i]:
                # Insert before this method
                insert_at = i
                break
        
        if insert_at:
            website_line = "    website = models.CharField(max_length=255, blank=True, default='www.arabseason.club')\n"
            resolved.insert(insert_at, website_line)
            print(f"Inserted 'website' field at line {insert_at} (before get_settings)")
        else:
            print("WARNING: Could not find insertion point for website field")
    else:
        print("WARNING: SiteSettings class not found in yahya's half")
else:
    print("'website' field already present in yahya's half")

# Write resolved file
with open(r"d:\freelanceprojects\ERP-Arab-Season-main\ERP-Arab-Season-main\backend\api\models.py", "w", encoding="utf-8") as f:
    f.writelines(resolved)

print(f"Resolved models.py written: {len(resolved)} lines")

# Verify no conflict markers remain
with open(r"d:\freelanceprojects\ERP-Arab-Season-main\ERP-Arab-Season-main\backend\api\models.py", "r", encoding="utf-8") as f:
    content = f.read()

markers_remaining = content.count("<<<<<<<") + content.count(">>>>>>>") + content.count("\n=======\n")
print(f"Conflict markers remaining: {markers_remaining}")
