"""Add website field to SiteSettings in models.py at the exact spot"""

path = r"d:\freelanceprojects\ERP-Arab-Season-main\ERP-Arab-Season-main\backend\api\models.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The blank line + 4 spaces before def __str__ is the insertion point
old = "    tax_number = models.CharField(max_length=100, blank=True, default='')\r\n\r\n    \r\n\r\n    def __str__(self):"
new = "    tax_number = models.CharField(max_length=100, blank=True, default='')\r\n\r\n    website = models.CharField(max_length=255, blank=True, default='www.arabseason.club')\r\n\r\n    def __str__(self):"

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: website field added to SiteSettings")
else:
    # Try LF version
    old_lf = "    tax_number = models.CharField(max_length=100, blank=True, default='')\n\n    \n\n    def __str__(self):"
    new_lf = "    tax_number = models.CharField(max_length=100, blank=True, default='')\n\n    website = models.CharField(max_length=255, blank=True, default='www.arabseason.club')\n\n    def __str__(self):"
    if old_lf in content:
        content = content.replace(old_lf, new_lf, 1)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("OK: website field added to SiteSettings (LF)")
    else:
        print("ERROR: pattern not found. Showing context around line 537:")
        lines = content.splitlines()
        for i in range(534, min(544, len(lines))):
            print(f"  {i+1}: {repr(lines[i])}")
