import os
import pymupdf  # PyMuPDF
from PIL import Image, ImageChops
import numpy as np

os.makedirs('design-reference/output/phaseA', exist_ok=True)

# 1. Render both PDFs at 150 DPI (150/72 = 2.083333 scale)
dpi = 150
zoom = dpi / 72.0
mat = pymupdf.Matrix(zoom, zoom)

doc_ref = pymupdf.open('design-reference/DC-00002.pdf')
page_ref = doc_ref[0]
pix_ref = page_ref.get_pixmap(matrix=mat, alpha=False)
ref_path = 'design-reference/output/phaseA/reference.png'
pix_ref.save(ref_path)

doc_mig = pymupdf.open('design-reference/output/test_tuned_pass.pdf')
page_mig = doc_mig[0]
pix_mig = page_mig.get_pixmap(matrix=mat, alpha=False)
mig_path = 'design-reference/output/phaseA/migrated.png'
pix_mig.save(mig_path)

print(f"Rendered reference.png and migrated.png at {dpi} DPI ({pix_ref.width}x{pix_ref.height})")

# 2. Compute union bounding box of non-white pixels
img_ref = Image.open(ref_path).convert('RGB')
img_mig = Image.open(mig_path).convert('RGB')

arr_ref = np.array(img_ref)
arr_mig = np.array(img_mig)

# Non-white mask: pixel is not pure white (e.g., any channel < 250)
non_white_ref = np.any(arr_ref < 250, axis=2)
non_white_mig = np.any(arr_mig < 250, axis=2)
union_mask = non_white_ref | non_white_mig

# Find union bounding box coordinates
y_indices, x_indices = np.where(union_mask)
min_y, max_y = y_indices.min(), y_indices.max()
min_x, max_x = x_indices.min(), x_indices.max()

bbox_w = max_x - min_x + 1
bbox_h = max_y - min_y + 1
print(f"Union BBox of non-white pixels: [{min_x}, {min_y}, {max_x}, {max_y}] (width={bbox_w}, height={bbox_h})")

# 3. Create visual diff with red overlay
# Calculate difference
diff_img = ImageChops.difference(img_ref, img_mig)
diff_arr = np.array(diff_img)
# Threshold difference
diff_dist = np.max(np.abs(arr_ref.astype(int) - arr_mig.astype(int)), axis=2)
diff_mask = diff_dist > 25  # ignore subtle antialiasing nuances

# Base is a muted grayscale copy of the reference
gray_ref = img_ref.convert('L').convert('RGBA')
overlay_arr = np.array(gray_ref)

# Paint differing pixels with semi-transparent bright red [255, 0, 0, 255]
overlay_arr[diff_mask] = [255, 0, 0, 255]

diff_result = Image.fromarray(overlay_arr)
diff_path = 'design-reference/output/phaseA/diff.png'
diff_result.save(diff_path)
print(f"Saved visual diff with red overlay at {diff_path}")

# 4. Compute metrics within union bbox
total_bbox_pixels = bbox_w * bbox_h
differing_bbox_pixels = np.sum(diff_mask[min_y:max_y+1, min_x:max_x+1])
match_pct = (1.0 - (differing_bbox_pixels / total_bbox_pixels)) * 100

print(f"BBox total pixels: {total_bbox_pixels}")
print(f"BBox differing pixels: {differing_bbox_pixels}")
print(f"Match rate inside non-white union BBox: {match_pct:.2f}%")

