with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Read the conflict text from scratch/index_css_conflict.txt
start_str = "<<<<<<< HEAD\n"
mid_str = "=======\n"
end_str = ">>>>>>> origin/frontend-cashbook\n"

idx_start = text.find(start_str)
idx_mid = text.find(mid_str, idx_start)
idx_end = text.find(end_str, idx_mid)

if idx_start != -1 and idx_mid != -1 and idx_end != -1:
    head_content = text[idx_start + len(start_str):idx_mid]
    # In head_content, make sure the closing brace is included
    if not head_content.strip().endswith('}'):
        head_content = head_content.strip() + "\n}\n\n"
    else:
        head_content = head_content + "\n\n"
        
    incoming_content = text[idx_mid + len(mid_str):idx_end]
    if not incoming_content.strip().endswith('}'):
        incoming_content = incoming_content.strip() + "\n}\n"
        
    resolved = head_content + incoming_content
    full_resolved = text[:idx_start] + resolved + text[idx_end + len(end_str):]
    
    with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
        f.write(full_resolved)
    print("Resolved index.css conflict by combining both sections cleanly!")
else:
    print("Conflict markers not found in index.css")

