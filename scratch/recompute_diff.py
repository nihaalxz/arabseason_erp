import os
import pymupdf
from PIL import Image, ImageChops
import numpy as np

dpi = 150
zoom = dpi / 72.0
mat = pymupdf.Matrix(zoom, zoom)

doc_ref = pymupdf.open('design-reference/DC-00002.pdf')
page_ref = doc_ref[0]
pix_ref = page_ref.get_pixmap(matrix=mat, alpha=False)
ref_path = 'design-reference/output/phaseA/reference.png'
pix_ref.save(ref_path)

doc_mig = pymupdf.open('design-reference/output/test_live_migrated.pdf')
page_mig = doc_mig[0]
pix_mig = page_mig.get_pixmap(matrix=mat, alpha=False)
mig_path = 'design-reference/output/phaseA/migrated.png'
pix_mig.save(mig_path)

img_ref = Image.open(ref_path).convert('RGB')
img_mig = Image.open(mig_path).convert('RGB')

arr_ref = np.array(img_ref)
arr_mig = np.array(img_mig)

non_white_ref = np.any(arr_ref < 250, axis=2)
non_white_mig = np.any(arr_mig < 250, axis=2)
union_mask = non_white_ref | non_white_mig

y_indices, x_indices = np.where(union_mask)
min_y, max_y = y_indices.min(), y_indices.max()
min_x, max_x = x_indices.min(), x_indices.max()

bbox_w = max_x - min_x + 1
bbox_h = max_y - min_y + 1

diff_img = ImageChops.difference(img_ref, img_mig)
diff_arr = np.array(diff_img)
diff_dist = np.max(np.abs(arr_ref.astype(int) - arr_mig.astype(int)), axis=2)
diff_mask = diff_dist > 25

gray_ref = img_ref.convert('L').convert('RGBA')
overlay_arr = np.array(gray_ref)
overlay_arr[diff_mask] = [255, 0, 0, 255]

diff_result = Image.fromarray(overlay_arr)
diff_path = 'design-reference/output/phaseA/diff.png'
diff_result.save(diff_path)

total_bbox_pixels = bbox_w * bbox_h
differing_bbox_pixels = np.sum(diff_mask[min_y:max_y+1, min_x:max_x+1])
match_pct = (1.0 - (differing_bbox_pixels / total_bbox_pixels)) * 100

print(f"Union BBox of non-white pixels: [{min_x}, {min_y}, {max_x}, {max_y}] ({bbox_w}x{bbox_h})")
print(f"Total BBox pixels: {total_bbox_pixels}")
print(f"Differing pixels: {differing_bbox_pixels}")
print(f"Match rate inside non-white union BBox: {match_pct:.2f}%")

